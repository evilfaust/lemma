// sdamgia-lib.mjs — разбор страниц «Решу ЕГЭ / ОГЭ» (sdamgia.ru) в markdown + LaTeX.
//
// Чистый модуль: cheerio и KaTeX приходят параметрами, сети и сервера нет.
// Им живёт ручка pdf-service `/parse-sdamgia` (и импорт, и «Перепарсить» в
// редакторе задачи), а тесты гоняют его по сохранённым страницам
// (ege-tasks/src/__tests__/sdamgiaParser.test.js).
//
// 🚨 На VPS класть ВМЕСТЕ с pdf-service.js и latex-fixer.js в
// /opt/pocketbase/pdf-service/.
//
// Как устроена страница задачи (print=true&crit=true):
//   .prob_maindiv
//     .prob_nums            «Тип 19 № 548492»
//     .pbody                условие (у блочных задач ОГЭ — два .pbody)
//     .solution             решение (может быть несколько: «Приведём другое решение»)
//     .prob_crits           критерии (часть 2)
//     .answer               «Ответ:» — формулы картинками
// Формула — <img class="tex" src=".../formula/svg/…" alt="словесная запись">.
// Своего LaTeX у «Решу» в разметке нет, только alt: «дробь: числитель: …».

import { fixLatex } from './latex-fixer.js';

export const SDAMGIA_BASE_URL = 'https://mathb-ege.sdamgia.ru';

// Служебные метки в тексте — символы из Private Use Area: в задачах их не
// бывает, а регулярки разбора (латиница, цифры) их не задевают.
const BR = '';
const F_OPEN = '', F_CLOSE = '';       // формула №N
const IMG_OPEN = '', IMG_CLOSE = '';   // картинка №N
const TBL_OPEN = '', TBL_CLOSE = '';   // таблица №N
const I_OPEN = '', I_CLOSE = '';       // <i>x</i> — переменная
const SUB_OPEN = '', SUB_CLOSE = '';   // <sub>
const SUP_OPEN = '', SUP_CLOSE = '';   // <sup>
const B_OPEN = '', B_CLOSE = '';       // <b>
const ROW = '';                              // «новая строка» в alt системы

const isFormulaSrc = (src) => /formula/.test(src || '');

// Формулы из одного знака → символ текста (см. processCondition)
const LONE_OP = { '\\cdot': '·', '\\times': '×', '=': '=', '+': '+', '-': '−', '<': '<', '>': '>', '\\le': '≤', '\\leq': '≤', '\\ge': '≥', '\\geq': '≥', '\\ne': '≠' };

// ─────────────────────────────────────────────────────────────────────
// Формула: alt → LaTeX
// ─────────────────────────────────────────────────────────────────────

/**
 * Конечная пунктуация alt'а — это знак ПРЕДЛОЖЕНИЯ, а не формулы:
 * «a не равно 0.» → `$a \ne 0$.`. Раньше точки срезались (и пропадали из
 * текста), а запятые оставались внутри формулы.
 * «… конец системы .» — точка там закрывает скобку (`\right.`), это не знак.
 */
export function splitAltPunct(alt) {
  const a = String(alt || '')
    .replace(/[­​]/g, '')
    .replace(/конец\s*(системы|совокупности)\s*\./gi, 'конец $1');
  const m = a.match(/^([\s\S]*?)\s*([.,;:]+)\s*$/);
  if (!m || !m[1].trim()) return { body: a, punct: '' };
  // «…» внутри формулы («плюс ... плюс») сюда не попадает — только хвост.
  return { body: m[1], punct: m[2].replace(/\.+/g, '.') };
}

// Словарь словесной записи «Решу». Порядок важен: длинные фразы раньше
// коротких, которые в них входят («котангенс» раньше «тангенса», «арксинус»
// раньше «синуса», «не равно» раньше «равно»).
const REPLACEMENTS = [
  // Обратные тригонометрические (до прямых: иначе «арк\cos»)
  ['арк­ко­си­нус', '\\arccos '],
  ['арккосинус', '\\arccos '],
  ['арк­си­нус', '\\arcsin '],
  ['арксинус', '\\arcsin '],
  ['арк­ко­тан­генс', '\\arcctg '],
  ['арккотангенс', '\\arcctg '],
  ['арк­тан­генс', '\\arctg '],
  ['арктангенс', '\\arctg '],

  // Тригонометрия (котангенс раньше тангенса, косинус раньше синуса)
  ['ко­тан­генс', '\\cot'],
  ['котангенс', '\\cot'],
  ['тан­генс', '\\tan'],
  ['тангенс', '\\tan'],
  ['ко­си­нус', '\\cos'],
  ['косинус', '\\cos'],
  ['си­нус', '\\sin'],
  ['синус', '\\sin'],

  // Греческие буквы
  ['альфа', '\\alpha'],
  ['бета', '\\beta'],
  ['гамма', '\\gamma'],
  ['дельта', '\\delta'],
  ['эпсилон', '\\varepsilon'],
  ['омега', '\\omega'],
  ['лямбда', '\\lambda'],
  // 'пи' / 'фи' — отдельной регуляркой с границами слов («правая», «фигурная»)

  // Скобки. Квадратные и фигурные — БЕЗ \left/\right: «Решу» записывает
  // полуинтервал «левая квадратная скобка … правая круглая скобка», и пара
  // \left[ … ) не собиралась в KaTeX.
  ['левая круг­лая скоб­ка', '('],
  ['пра­вая круг­лая скоб­ка', ')'],
  ['левая квадратная скобка', '['],
  ['правая квадратная скобка', ']'],
  ['левая фигурная скобка', '\\{'],
  ['правая фигурная скобка', '\\}'],

  // ± / ∓ (до «плюс» и «минус»)
  ['плюс минус', '\\pm'],
  ['плюс-минус', '\\pm'],
  ['минус плюс', '\\mp'],
  ['минус-плюс', '\\mp'],

  ['плюс', '+'],
  ['минус', '-'],
  ['умно­жить на', '\\cdot'],
  ['де­лить на', '/'],

  // Степени
  ['в квад­ра­те', '^{2}'],
  ['в кубе', '^{3}'],
  ['в сте­пе­ни', '^'],

  // Логарифмы
  ['ло­га­рифм по ос­но­ва­нию', '\\log'],
  ['на­ту­раль­ный ло­га­рифм', '\\ln'],
  ['десятичный логарифм', '\\lg '],

  // Отношения (составные — раньше простых)
  ['рав­но­силь­но', '\\Leftrightarrow'],
  ['боль­ше или равно', '\\geq'],
  ['мень­ше или равно', '\\leq'],
  ['не равно', '\\ne '],
  ['не принадлежит', '\\notin'],
  ['принадлежит', '\\in'],
  ['боль­ше', '>'],
  ['мень­ше', '<'],

  // Артефакт углов
  ['ра­ду­сов', ''],

  // Множества
  ['множество целых чисел', '\\mathbb{Z}'],
  ['множество натуральных чисел', '\\mathbb{N}'],
  ['множество рациональных чисел', '\\mathbb{Q}'],
  ['множество действительных чисел', '\\mathbb{R}'],

  ['бесконечность', '\\infty'],
].map(([k, v]) => [k.replace(/­/g, ''), v]);

/** Разбить содержимое системы/совокупности на строки. */
function splitRows(content) {
  // Вложенная скобка без запятой после неё («…конец системы .x ≠ −1») —
  // следующая строка всё равно новая.
  content = content.replace(/\uE022\s*(?=[^\s,\\])/g, '\uE022,');
  let parts = content.includes(ROW)
    ? content.split(ROW)
    // Запятая — разделитель строк, но не десятичная «0,5».
    : content.split(/(?<!\d),|,(?!\d)/);
  // Строка одна, а это система: «−1 < x ≤ 0,2 ≤ x ≤ 3» — запятая между
  // цифрами здесь всё-таки разделитель.
  if (parts.length === 1 && /\d,\d/.test(content) && !content.includes(ROW)) {
    parts = content.split(/(?<=\d),(?=\d)/);
  }
  const rows = [];
  for (let p of parts) {
    p = p.trim().replace(/[.;]+$/, '').trim();
    if (!p) continue;
    // «-2x + 2a, при x ≤ a - 2» — условие к предыдущей строке, а не строка.
    if (rows.length && /^(при|если|где)(?![а-яё])/i.test(p)) {
      rows[rows.length - 1] += `, & ${p}`;
    } else {
      rows.push(p);
    }
  }
  return rows;
}

const GROUP_OPEN_RE = /(система|совокупность)\s*выражений\s*/gi;
const GROUP_CLOSE_RE = /\s*конец\s*(?:системы|совокупности)/i;
const STASH_OPEN = '\uE021', STASH_CLOSE = '\uE022';

/**
 * «система выражений … конец системы» → \begin{cases}, «совокупность …» →
 * \left[\begin{array}. Пары ищутся по положению: первый «конец» закрывает
 * ближайшее открытие перед ним. «Решу» во вложенных скобках путает слова
 * («совокупность … конец системы, … конец совокупности»), а по положению
 * получается верная запись. Готовая внутренняя скобка прячется в метку, чтобы
 * запятые внешней скобки не резали её на строки.
 */
function convertGroups(text) {
  const stash = [];
  for (let guard = 0; guard < 30; guard++) {
    const close = GROUP_CLOSE_RE.exec(text);
    if (!close) break;
    let open = null;
    for (const m of text.slice(0, close.index).matchAll(GROUP_OPEN_RE)) open = m;
    if (!open) {
      text = text.slice(0, close.index) + text.slice(close.index + close[0].length);
      continue;
    }
    const rows = splitRows(text.slice(open.index + open[0].length, close.index));
    const tex = /^система/i.test(open[1])
      ? `\\begin{cases} ${rows.join(' \\\\ ')} \\end{cases}`
      : `\\left[\\begin{array}{l} ${rows.map(r => r.replace(/, & /g, ', \\ ')).join(' \\\\ ')} \\end{array}\\right.`;
    stash.push(tex);
    text = text.slice(0, open.index) + `${STASH_OPEN}${stash.length - 1}${STASH_CLOSE}` + text.slice(close.index + close[0].length);
  }
  text = text.replace(GROUP_OPEN_RE, '');
  const re = new RegExp(`${STASH_OPEN}(\\d+)${STASH_CLOSE}`, 'g');
  for (let guard = 0; guard < 30 && text.includes(STASH_OPEN); guard++) {
    text = text.replace(re, (_, k) => stash[k]);
  }
  return text;
}

/** Кириллица, оставшаяся в формуле (пометки S_бок, «при», единицы) → \text{…}. */
function wrapCyrillic(tex) {
  // Не трогаем то, что уже текстом.
  const parts = tex.split(/(\\(?:text|operatorname|mathrm|textbf)\{[^{}]*\})/);
  return parts.map((part, i) => {
    if (i % 2) return part;
    return part.replace(/([_^]?)(\s*)([А-Яа-яЁё]+(?:[ .]+[А-Яа-яЁё]+)*\.?)(\s*)/g, (_, script, pre, word, post) => {
      if (script) return `${script}{\\text{${word}}}${post ? ' ' : ''}`;
      const padL = pre ? ' ' : '';
      const padR = post ? ' ' : '';
      return `${padL}\\text{${padL}${word}${padR}}${padR}`;
    });
  }).join('');
}

/** \left/\right без пары ломают KaTeX — тогда снимаем их все (скобки остаются). */
function balanceLeftRight(tex) {
  const l = (tex.match(/\\left(?![a-zA-Z])/g) || []).length;
  const r = (tex.match(/\\right(?![a-zA-Z])/g) || []).length;
  if (l === r) return tex;
  // Обычный виновник — сырой «\left| … |» из alt: сначала снимаем только его.
  if (!/\\right\s*\|/.test(tex) && /\\left\s*\|/.test(tex)) {
    const fixed = tex.replace(/\\left\s*\|/g, '|');
    if ((fixed.match(/\\left(?![a-zA-Z])/g) || []).length === (fixed.match(/\\right(?![a-zA-Z])/g) || []).length) return fixed;
  }
  return tex
    .replace(/\\(?:left|right)\s*\./g, '')
    .replace(/\\(?:left|right)(?![a-zA-Z])\s*/g, '');
}

/**
 * Очистка формулы: alt-текст «Решу» → LaTeX.
 * Поддерживает три формата alt: с мягкими переносами, с пробелами и слитный
 * («кореньиз», «началоаргумента»).
 */
export function cleanLatexFormula(text) {
  text = String(text || '');
  // Убираем точки в конце (пунктуацию предложения отделяет splitAltPunct)
  text = text.replace(/\.+\s*$/, '');

  // Невидимые символы и Unicode-математика
  text = text.replace(/­/g, '');
  text = text.replace(/​/g, '');
  text = text.replace(/ /g, ' ');
  text = text.replace(/√/g, '\\sqrt ');
  text = text.replace(/∛/g, '\\sqrt[3]');
  text = text.replace(/∜/g, '\\sqrt[4]');

  // «новая строка» в системе — метка строки (раньше слово просто вырезалось)
  text = text.replace(/новая\s*строка/gi, ROW);
  // Точка-скобка после системы — не знак
  text = text.replace(/конец\s*(системы|совокупности)\s*\./gi, 'конец $1');

  // Pass-1: слитные варианты многословных фраз («леваяквадратнаяскобка»)
  for (const [key, rep] of REPLACEMENTS) {
    if (/\s/.test(key)) {
      const concat = key.replace(/\s+/g, '');
      if (concat.length >= 8) text = text.replaceAll(concat, rep);
    }
  }
  for (const [key, rep] of REPLACEMENTS) text = text.replaceAll(key, rep);

  // Короткие слова — с не-буквенными границами
  text = text.replace(/(?<![а-яА-ЯёЁ])(?:пи|Пи)(?![а-яА-ЯёЁ])/g, '\\pi ');
  text = text.replace(/(?<![а-яА-ЯёЁ])фи(?![а-яА-ЯёЁ])/g, '\\varphi ');

  // Аргументы «начало аргумента … конец аргумента» = фигурные скобки.
  // 🚨 Маркеры не удалять (v3.9.353): скобки встают по позициям маркеров.
  text = text.replace(/начало\s*аргумента\s*:?\s*/gi, '{');
  text = text.replace(/\s*конец\s*аргумента/gi, '}');

  // Корни
  text = text.replace(/корень\s*(\d+)\s*степени\s*из\s*:?/gi, (_, n) => `\\sqrt[${n}]`);
  text = text.replace(/корень\s*из(?![а-яА-Я])\s*:?/gi, '\\sqrt');
  text = text.replace(/\\sqrt(\[\d+\])?\s*:\s*/g, (_, deg) => `\\sqrt${deg || ''} `);
  text = text.replace(/\\sqrt(\[\d+\])?\s+\{/g, (_, deg) => `\\sqrt${deg || ''}{`);

  // Дроби (от внутренних к внешним)
  for (let i = 0; i < 12; i++) {
    const m = text.match(/дробь\s*:\s*числитель\s*:\s*(.*?)\s*,?\s*знаменатель\s*:\s*(.*?)\s*конец\s*дроби/i);
    if (!m) break;
    text = text.slice(0, m.index) + `\\frac{${m[1].trim()}}{${m[2].trim()}}` + text.slice(m.index + m[0].length);
  }

  // «дробная часть : числитель : A, знаменатель : B»
  for (let i = 0; i < 10; i++) {
    const m = text.match(
      /дробная\s+часть\s*:?\s*числитель\s*:?\s*([^,;]+?)\s*,\s*знаменатель\s*:?\s*([^.,;]+?)(?=[\s,.;]|$)/i,
    );
    if (!m) break;
    text = text.slice(0, m.index) + `\\frac{${m[1].trim()}}{${m[2].trim()}}` + text.slice(m.index + m[0].length);
  }

  // «целая часть : N» → _{N} (индекс log)
  text = text.replace(
    /целая\s+часть\s*:?\s*(\d+|[A-Za-zА-Яа-я])\s*,?(?=\s*(?:дробная|\\frac|$|[^,]))/gi,
    '_{$1}',
  );
  text = text.replace(/целая\s+часть\s*:?\s*(\d+|[A-Za-zА-Яа-я])/gi, '_{$1}');

  // Системы и совокупности (с вложенностью) → cases / квадратная скобка
  text = convertGroups(text);
  text = text.replaceAll(ROW, ', ');

  // Сырой LaTeX из alt без скобок: \beginarrayl … \endarray
  text = text.replace(/\\beginarray\s*\{?([lcr]+)\}?/g, '\\begin{array}{$1}');
  text = text.replace(/\\endarray\s*\.?/g, '\\end{array}');
  if (/\\\{\s*\\begin\{array\}/.test(text) && !/\\right/.test(text)) {
    text = text.replace(/\\\{\s*\\begin\{array\}/g, '\\left\\{\\begin{array}').replace(/\\end\{array\}/g, '\\end{array}\\right.');
  }

  text = text.replace(/\s+/g, ' ').trim();
  // Точка-скобка перед степенью («| . в степени …») — артефакт \right.
  text = text.replace(/\s\.\s*(?=\^)/g, '');

  // Нормализация под KaTeX (latex-fixer.js)
  text = fixLatex(text);

  // P_\max → P_{\max}: команда без скобок в индексе KaTeX не берёт
  text = text.replace(/([_^])\\([a-zA-Z]+)/g, '$1{\\$2}');
  text = balanceLeftRight(text);
  text = wrapCyrillic(text);

  return text.replace(/\s+/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────────
// Строчная разметка: <i>a</i>&#8239;=&#8239;3<i>x</i> → $a = 3x$
// ─────────────────────────────────────────────────────────────────────

const GREEK = {
  α: '\\alpha', β: '\\beta', γ: '\\gamma', δ: '\\delta', ε: '\\varepsilon', φ: '\\varphi',
  π: '\\pi', ω: '\\omega', λ: '\\lambda', μ: '\\mu', ρ: '\\rho', σ: '\\sigma', τ: '\\tau',
  Δ: '\\Delta', Ω: '\\Omega', Φ: '\\Phi',
};
const OPS_TEX = { '⋅': '\\cdot ', '−': '-', '–': '-', '≤': '\\le ', '≥': '\\ge ', '⩽': '\\le ', '⩾': '\\ge ', '≠': '\\ne ', '·': '\\cdot ', '×': '\\times ', '÷': ':', '′': "'", '°': '^{\\circ}', '∞': '\\infty ' };

function inlineTex(s) {
  return s
    .replace(new RegExp(`${SUB_OPEN}([^${SUB_CLOSE}]*)${SUB_CLOSE}`, 'g'), (_, x) => `_{${inlineTex(x)}}`)
    .replace(new RegExp(`${SUP_OPEN}([^${SUP_CLOSE}]*)${SUP_CLOSE}`, 'g'), (_, x) => `^{${inlineTex(x).replace(/\^\{\\circ\}/g, '\\circ')}}`)
    .replace(/[α-ωΑ-Ω]/g, ch => GREEK[ch] ? `${GREEK[ch]} ` : ch)
    .replace(/[⋅−–≤≥⩽⩾≠·×÷′°∞]/g, ch => OPS_TEX[ch])
    .replace(/(\d),(\d)/g, '$1{,}$2')
    .replace(/[   ]/g, ' ');
}

const LATIN_MATH = new RegExp(`^[A-Za-z0-9α-ωΑ-Ω'′\\s${SUB_OPEN}${SUB_CLOSE}${SUP_OPEN}${SUP_CLOSE}]+$`);

const TOKEN_RE = new RegExp([
  `(${F_OPEN}\\d+${F_CLOSE}|${IMG_OPEN}\\d+${IMG_CLOSE}|${TBL_OPEN}\\d+${TBL_CLOSE})`, // 1 атомы-метки
  `(${I_OPEN}[^${I_CLOSE}]*${I_CLOSE}|${SUB_OPEN}[^${SUB_CLOSE}]*${SUB_CLOSE}|${SUP_OPEN}[^${SUP_CLOSE}]*${SUP_CLOSE})`, // 2 переменная/индекс
  '(\\d+(?:,\\d+)?)',                   // 3 число
  '([A-Za-z]+)',                        // 4 латиница
  "([=+\\-−<>≤≥⩽⩾≠·⋅×÷:/()|°′'∞])",       // 5 знак
  '([ \\u00A0\\u202F\\u2009]+)',         // 6 пробелы
  '([\\s\\S])',                         // 7 прочее
].join('|'), 'g');

const NO_EDGE_START = new Set(['=', '+', '<', '>', '≤', '≥', '⩽', '⩾', '≠', '·', '⋅', '×', '÷', ':', '/', ')', '°', '′', "'"]);
const NO_EDGE_END = new Set(['=', '+', '-', '−', '<', '>', '≤', '≥', '⩽', '⩾', '≠', '·', '⋅', '×', '÷', ':', '/', '(']);

/**
 * Находит в тексте «математические отрезки» из переменных <i>…</i>, индексов,
 * чисел и знаков, связанных узким неразрывным пробелом (так «Решу» набирает
 * формулы прямо в тексте), и оборачивает их в $…$. Отрезок без переменной
 * (просто «1 : 2») остаётся текстом.
 */
// Кириллица-двойник перед индексом: «О<sub>1</sub>» у «Решу» — это O₁
const LOOKALIKE = { А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', О: 'O', Р: 'P', Т: 'T', Х: 'X' };

export function convertMathRuns(text) {
  text = text.replace(
    new RegExp(`(?<![А-Яа-яЁё])([АВСЕНКМОРТХ])(?=${SUB_OPEN}|${SUP_OPEN})`, 'g'),
    ch => LOOKALIKE[ch],
  );
  const toks = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    let type = 'other';
    if (m[1]) type = 'atom';
    else if (m[2]) type = 'var';
    else if (m[3]) type = 'num';
    else if (m[4]) type = 'lat';
    else if (m[5]) type = 'op';
    else if (m[6]) type = 'sp';
    toks.push({ type, v: m[0] });
  }
  const isMath = t => t && (t.type === 'var' || t.type === 'num' || t.type === 'lat' || t.type === 'op');
  const isRealOp = t => t && t.type === 'op' && t.v !== '(' && t.v !== ')' && t.v !== '|';

  let out = '';
  let i = 0;
  while (i < toks.length) {
    if (!isMath(toks[i])) { out += toks[i].v; i++; continue; }
    // Собираем отрезок
    let j = i + 1;
    let end = i; // последний математический токен
    while (j < toks.length) {
      const t = toks[j];
      if (isMath(t)) { end = j; j++; continue; }
      if (t.type === 'sp') {
        const next = toks[j + 1];
        if (!isMath(next)) break;
        const narrow = !/[  ]/.test(t.v);
        if (narrow || isRealOp(toks[end]) || isRealOp(next)) { j++; continue; }
      }
      break;
    }
    let run = toks.slice(i, end + 1).concat(); // без хвостовых пробелов
    // Края: знаки, которые не могут начинать/заканчивать формулу
    const lead = [];
    const trail = [];
    while (run.length && (run[0].type === 'sp' || (run[0].type === 'op' && NO_EDGE_START.has(run[0].v)))) lead.push(run.shift());
    while (run.length && (run[run.length - 1].type === 'sp' || (run[run.length - 1].type === 'op' && NO_EDGE_END.has(run[run.length - 1].v)))) trail.unshift(run.pop());
    // Непарные скобки по краям — вон из формулы
    const bal = () => run.reduce((s, t) => s + (t.v === '(' ? 1 : t.v === ')' ? -1 : 0), 0);
    while (run.length && bal() > 0 && run[0].v === '(') lead.push(run.shift());
    while (run.length && bal() < 0 && run[run.length - 1].v === ')') trail.unshift(run.pop());
    const hasVar = run.some(t => t.type === 'var');
    const raw = s => s.map(t => t.v).join('');
    if (!hasVar || bal() !== 0) {
      out += raw(toks.slice(i, end + 1)).replace(new RegExp(`[${I_OPEN}${I_CLOSE}]`, 'g'), '');
    } else {
      const tex = run.map(t => (t.type === 'var' && t.v[0] === I_OPEN ? t.v.slice(1, -1) : t.v)).join('');
      out += raw(lead) + `$${inlineTex(tex).replace(/\s+/g, ' ').trim()}$` + raw(trail);
    }
    i = end + 1;
  }
  // Оставшиеся метки (вне отрезков их не бывает, но на всякий случай)
  return out
    .replace(new RegExp(`[${I_OPEN}${I_CLOSE}]`, 'g'), '')
    .replace(new RegExp(`${SUB_OPEN}([^${SUB_CLOSE}]*)${SUB_CLOSE}`, 'g'), '$1')
    .replace(new RegExp(`${SUP_OPEN}([^${SUP_CLOSE}]*)${SUP_CLOSE}`, 'g'), '$1');
}

/** <b>…</b> → **…** (жирный абзац «Примечание.», пункты «а)»). */
function applyBold(text) {
  return text.replace(new RegExp(`${B_OPEN}([^${B_OPEN}${B_CLOSE}]*)${B_CLOSE}`, 'g'), (m, inner, off, full) => {
    const core = inner.trim();
    if (!core || core.includes('\n') || /^[.,;:]+$/.test(core)) return inner;
    const before = full[off - 1] || '';
    const after = full[off + m.length] || '';
    const lead = /\s/.test(inner[0]) || /[\p{L}\p{N}]/u.test(before) ? ' ' : '';
    const trail = /\s/.test(inner[inner.length - 1]) || /[\p{L}\p{N}]/u.test(after) ? ' ' : '';
    return `${lead}**${core}**${trail}`;
  }).replace(new RegExp(`[${B_OPEN}${B_CLOSE}]`, 'g'), '');
}

/** Текст фрагмента: строчная разметка → markdown, пробелы схлопнуты. */
function finishInline(text) {
  return applyBold(convertMathRuns(text.replace(/[­​]/g, '')))
    .replace(/[ \t\r\f\v    -  ]+/g, ' ');
}

// ─────────────────────────────────────────────────────────────────────
// Блоки
// ─────────────────────────────────────────────────────────────────────

/** Sdamgia file_id из /get_file?id=145381 */
export function extractSdamgiaFileId(url) {
  const m = String(url || '').match(/[?&]id=(\d+)/);
  return m ? m[1] : '';
}

function tableToMarkdown($, tableEl) {
  const rows = [];
  $(tableEl).find('tr').each(function () {
    const cells = [];
    $(this).find('th, td').each(function () {
      const cell = finishInline($(this).text()).replace(new RegExp(BR, 'g'), ' ').replace(/\s+/g, ' ').trim();
      cells.push(cell.replace(/\|/g, '\\|'));
    });
    if (cells.length) rows.push(cells);
  });
  if (!rows.length) return '';
  const width = Math.max(...rows.map(r => r.length));
  const pad = r => r.concat(Array(width - r.length).fill(''));
  const lines = [
    '| ' + pad(rows[0]).join(' | ') + ' |',
    '| ' + Array(width).fill('---').join(' | ') + ' |',
    ...rows.slice(1).map(r => '| ' + pad(r).join(' | ') + ' |'),
  ];
  return '\n\n' + lines.join('\n') + '\n\n';
}

/** Формула стоит одна в <center> — выключная (отдельной строкой по центру). */
function isDisplayFormula($, img) {
  const $c = $(img).closest('center');
  if (!$c.length || $(img).closest('table').length) return false;
  // В центре только формулы (бывает две — одна под другой) — каждая выключной;
  // есть текст — строчные. Считается ДО замены картинок метками.
  return !$c.text().replace(/[\s\u00A0\u00AD]/g, '')
    && $c.find('img').toArray().every(im => isFormulaSrc($(im).attr('src')));
}

/**
 * Блок страницы (условие, решение, критерии, ответ) → markdown.
 * role: 'condition' | 'solution' | 'criteria' | 'answer'
 * Возвращает { text, images: [{url, file_id, order, role}], formulas: [LaTeX] }.
 */
export function processCondition($, conditionEl, { baseUrl = SDAMGIA_BASE_URL, role = 'condition' } = {}) {
  if (!conditionEl) return { text: '', images: [], formulas: [] };
  const images = [];
  const formulas = [];
  const formulaReps = [];
  const imageReps = [];
  const tableReps = [];

  const $el = $(conditionEl).clone();
  $el.find('script, style, noscript').remove();

  // «Решение.» в начале решения — заголовок, не текст
  if (role === 'solution') {
    $el.find('b, strong').each(function () {
      if (/^\s*Решение\s*\.?\s*$/i.test($(this).text().replace(/[\u00AD\u200B]/g, ''))) $(this).remove();
    });
  }

  // 0. Длинную формулу «Решу» кладёт в нескольких вариантах вёрстки под ширину
  // экрана (одной строкой / в две / в три): span.tex-span с одинаковым
  // data-formulaHash, видим первый. Оставляем его, прочие — вон.
  const seenHashes = new Set();
  $el.find('span.tex-span').each(function () {
    const hash = $(this).attr('data-formulahash');
    if (!hash) return;
    if (seenHashes.has(hash)) $(this).remove();
    else seenHashes.add(hash);
  });

  // 1. Формулы (везде, в т.ч. в таблицах). Повторы по alt НЕ выкидываем: одна
  // и та же формула законно встречается в решении и в «Ответе» (до v3.9.401
  // глобальный дедуп по alt съедал её второе вхождение).
  const displayImgs = new Set($el.find('img').toArray().filter(im => isFormulaSrc($(im).attr('src')) && isDisplayFormula($, im)));
  $el.find('img').each(function () {
    const src = $(this).attr('src') || '';
    if (!isFormulaSrc(src)) return;
    const alt = $(this).attr('alt') || '';
    if (!alt.trim()) { $(this).remove(); return; }
    const { body, punct } = splitAltPunct(alt);
    const latex = cleanLatexFormula(body);
    // Формула-знак («7 <умножить на> 2 · x») — это знак текста: пусть
    // встанет в строчную формулу рядом, а не отдельной $\cdot$.
    if (!displayImgs.has(this) && LONE_OP[latex] && !punct) {
      $(this).replaceWith(LONE_OP[latex]);
      return;
    }
    const display = displayImgs.has(this);
    formulas.push(latex);
    formulaReps.push({ latex, punct, display });
    $(this).replaceWith(`${F_OPEN}${formulaReps.length - 1}${F_CLOSE}`);
  });

  // 2. Чертежи. Один — вырезаем (рисуется отдельным полем, v3.9.33),
  // несколько — оставляем ![image](url) на местах (v3.9.60).
  const absUrl = u => (u.startsWith('http') ? u : new URL(u, baseUrl).href);
  const distinct = new Set();
  $el.find('img').each(function () {
    const u = $(this).attr('src') || '';
    if (u) distinct.add(absUrl(u));
  });
  const keepInline = distinct.size >= 2;
  const seen = new Set();
  $el.find('img').each(function () {
    const u = $(this).attr('src') || '';
    if (!u) { $(this).remove(); return; }
    const url = absUrl(u);
    if (seen.has(url)) { $(this).remove(); return; }
    seen.add(url);
    images.push({ url, file_id: extractSdamgiaFileId(url), order: images.length + 1, role });
    imageReps.push(keepInline ? `![image](${url})` : '');
    $(this).replaceWith(`${IMG_OPEN}${imageReps.length - 1}${IMG_CLOSE}`);
  });

  // 3. Строчная разметка → метки
  $el.find('br').replaceWith(BR);
  $el.find('sub').each(function () { $(this).replaceWith(SUB_OPEN + $(this).text() + SUB_CLOSE); });
  $el.find('sup').each(function () { $(this).replaceWith(SUP_OPEN + $(this).text() + SUP_CLOSE); });
  $el.find('i, em').each(function () {
    const t = $(this).text();
    if (LATIN_MATH.test(t) && /[A-Za-zα-ωΑ-Ω]/.test(t)) $(this).replaceWith(I_OPEN + t + I_CLOSE);
  });
  if (role !== 'criteria') {
    $el.find('b, strong').each(function () { $(this).prepend(B_OPEN); $(this).append(B_CLOSE); });
  }

  // 4. Таблицы → markdown
  $el.find('table').each(function () {
    const md = tableToMarkdown($, this);
    if (md) {
      tableReps.push(md);
      $(this).replaceWith(`${TBL_OPEN}${tableReps.length - 1}${TBL_CLOSE}`);
    } else {
      $(this).remove();
    }
  });

  // 5. Абзацы и списки
  $el.find('p').each(function () {
    const t = $(this).text().trim();
    $(this).prepend(/^\d+\)/.test(t) || /^[a-zа-я]\)/.test(t) || /^-\s/.test(t) ? BR : BR + BR);
  });
  $el.find('ol').each(function () {
    $(this).before(BR + BR);
    $(this).children('li').each(function (k) { $(this).prepend(`${BR}${k + 1}. `); });
    $(this).after(BR + BR);
  });
  $el.find('ul').each(function () {
    $(this).before(BR + BR);
    $(this).children('li').each(function () { $(this).prepend(`${BR}- `); });
    $(this).after(BR + BR);
  });
  $el.find('div, center').each(function () { $(this).before(BR); $(this).after(BR); });

  // 6. Текст
  let text = finishInline($el.text());
  text = text.split(BR).map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n');

  text = text.replace(new RegExp(`${TBL_OPEN}(\\d+)${TBL_CLOSE}`, 'g'), (_, k) => tableReps[k]);
  text = text.replace(new RegExp(`${F_OPEN}(\\d+)${F_CLOSE}`, 'g'), (_, k) => {
    const { latex, punct, display } = formulaReps[k];
    if (!latex) return punct;
    return display ? `\n\n$$\n${latex}${punct}\n$$\n\n` : ` $${latex}$${punct} `;
  });
  text = text.replace(new RegExp(`${IMG_OPEN}(\\d+)${IMG_CLOSE}`, 'g'), (_, k) => imageReps[k]);

  return { text: tidyMarkdown(text), images, formulas };
}

/** Финальная уборка: пробелы у знаков, лишние пустые строки, повторы-дубли. */
function tidyMarkdown(text) {
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    // «$x$ ,» → «$x$,»;  «( $x$» → «($x$»
    .replace(/(\S\$) +([.,;:!?)\]»])/g, '$1$2')
    .replace(/([(«[]) +\$(?!\$)/g, '$1$')
    // Подряд одинаковые формулы — копии «Решу» под retina/печать
    .replace(/(\$([^$\n]+)\$)((?:[ \t]*\$\2\$)+)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────
// Задача целиком
// ─────────────────────────────────────────────────────────────────────

// «Приведём другое решение (пункта а).» → подзаголовок
const ALT_SOLUTION_RE = /(?:\*\*)?[ \t]*Прив[её]д[её]м\s+(?:ещё\s+одно|еще\s+одно|другое|иное|второе)\s+решение(?:\s+(?:пункта|задачи)\s*([абвгде])\))?[ \t]*\.?[ \t]*(?:\*\*)?/gi;

function cleanAnswer(text) {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/^\s*Ответ\s*:?\s*/i, '')
    .replace(/\s*\n+\s*/g, ' ')
    .trim()
    .replace(/\s*\.$/, '')
    .trim();
}

function validateLatex(katex, formula) {
  if (!katex) return true;
  try {
    katex.renderToString(formula, { throwOnError: true, strict: false });
    return true;
  } catch {
    return false;
  }
}

/** div.prob_maindiv → задача (или null, если условия нет). */
export function parseProblemFromDiv($, probDiv, { baseUrl = SDAMGIA_BASE_URL, katex = null } = {}) {
  const problem = {
    id: '',
    sdamgia_url: '',
    condition: '',
    answer: '',
    solution: '',
    criteria_md: '',
    max_score: null,
    condition_images: [],
    solution_images: [],
    criteria_images: [],
    latex_needs_review: false,
    // backward-compat для старого фронта
    images: [],
    solution_images_legacy: [],
  };
  const allFormulas = [];
  const opts = { baseUrl };

  const probNums = $(probDiv).find('.prob_nums');
  if (probNums.length) {
    // «Тип 7 № 27455» — номер задания в КИМ («Д4» у доп. типов)
    const typeMatch = probNums.text().replace(/ /g, ' ').match(/Тип\s+([^\s№]+)/);
    if (typeMatch) problem.type_label = typeMatch[1];
    const link = probNums.find('a');
    if (link.length) {
      problem.id = link.text().trim();
      let href = link.attr('href') || '';
      if (href) {
        if (!href.startsWith('http')) href = new URL(href, baseUrl).href;
        problem.sdamgia_url = href;
      }
    }
  }

  // Условие: ВСЕ .pbody вне решения/ответа/критериев (блочные задачи ОГЭ)
  const condPbodies = $(probDiv).find('.pbody').filter(function () {
    return $(this).closest('.solution, .answer, .prob_crits').length === 0;
  });
  const texts = [];
  condPbodies.each(function () {
    const { text, images, formulas } = processCondition($, this, { ...opts, role: 'condition' });
    if (text) texts.push(text);
    problem.condition_images.push(...images);
    allFormulas.push(...formulas);
  });
  problem.condition = texts.join('\n\n');
  problem.images = problem.condition_images.map(img => img.url);

  // Ответ — формулы картинками, поэтому тем же разбором, что и текст
  const answerDiv = $(probDiv).find('.answer').first();
  if (answerDiv.length) {
    const { text } = processCondition($, answerDiv.get(0), { ...opts, role: 'answer' });
    let answer = cleanAnswer(text);
    // На массовой странице у части 2 бывает только «б)»
    if (/^[абвгде]\)$/i.test(answer) || answer.length < 1) answer = '';
    problem.answer = answer;
  }

  // Решение (все .solution подряд)
  const solutions = $(probDiv).find('.solution');
  if (solutions.length) {
    const parts = [];
    const solImages = [];
    solutions.each(function () {
      const $sol = $(this).clone();
      $sol.find('.prob_crits').remove();
      const { text, images, formulas } = processCondition($, $sol.get(0), { ...opts, role: 'solution' });
      if (text) parts.push(text);
      for (const img of images) solImages.push({ ...img, order: solImages.length + 1 });
      allFormulas.push(...formulas);
    });
    let solText = parts.join('\n\n').replace(/^\s*(?:\*\*)?Решение\s*\.?\s*(?:\*\*)?\s*/i, '').trim();

    if (!problem.answer) {
      // «Ответ: …» последнего решения до «Приведём другое…» — первое подходящее
      for (const m of solText.matchAll(/Ответ\s*:?\s*([^\n]+)/gi)) {
        const candidate = cleanAnswer(m[1]);
        if (candidate && !/^[абвгде]\)$/i.test(candidate)) { problem.answer = candidate; break; }
      }
    }

    solText = solText
      .replace(ALT_SOLUTION_RE, (_, p) => `\n\n---\n\n### Другое решение${p ? ` пункта ${p})` : ''}\n\n`)
      // «Ответ:» в решении оставляем (их бывает несколько — по одному на способ),
      // но отдельным абзацем с жирной меткой.
      .replace(/(^|\n)[ \t]*Ответ\s*:\s*/g, '$1**Ответ:** ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (solText) {
      problem.solution = solText;
      problem.solution_images = solImages;
      problem.solution_images_legacy = solImages.map(img => img.url);
    }
  }

  // Критерии (часть 2) — соседний с решением блок .prob_crits
  const critsDiv = $(probDiv).find('.prob_crits').first();
  if (critsDiv.length) {
    const { text, images, formulas } = processCondition($, critsDiv.get(0), { ...opts, role: 'criteria' });
    if (text) {
      const crit = text.replace(/^Критерии\s*проверки\s*\.?\s*:?\s*/i, '').trim();
      problem.criteria_md = crit;
      problem.criteria_images = images;
      allFormulas.push(...formulas);
      const maxBall = crit.match(/Максимальный\s+балл\s*[|:]?\s*(\d+)/i);
      if (maxBall) {
        problem.max_score = parseInt(maxBall[1], 10);
      } else {
        const scores = crit.split('\n').map(l => l.match(/\|\s*(\d+)\s*\|\s*$/)).filter(Boolean).map(m => +m[1]);
        if (scores.length) problem.max_score = Math.max(...scores);
      }
    }
  }

  problem.latex_needs_review = allFormulas.some(f => !validateLatex(katex, f));

  return problem.condition ? problem : null;
}

/**
 * Страница sdamgia целиком → { problems, totalOnPage }.
 * @param {string} html
 * @param {{ cheerio: object, katex?: object, baseUrl?: string }} deps
 */
export function parseSdamgiaHtml(html, { cheerio, katex = null, baseUrl = SDAMGIA_BASE_URL }) {
  const $ = cheerio.load(html);
  const divs = $('.prob_maindiv');
  const problems = [];
  divs.each(function () {
    try {
      const p = parseProblemFromDiv($, this, { baseUrl, katex });
      if (p) problems.push(p);
    } catch (e) {
      console.error('[Sdamgia] Ошибка разбора задачи:', e.message);
    }
  });
  return { problems, totalOnPage: divs.length };
}
