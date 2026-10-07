/**
 * ТДФ — разметка пункта: пропуски, «свойства + условия», соответствие и
 * пустые оси под график.
 *
 * Один и тот же текст пункта печатается в двух видах:
 *   • эталон  (`'etalon'`) — всё как написал учитель;
 *   • бланк   (`'gaps'`)   — помеченное учителем убрано, на его месте линия
 *                            той же длины (ученик вписывает от руки).
 *
 * На выходе — обычный markdown для MathRenderer: своих React-компонентов здесь
 * нет, поэтому разметка работает везде, где уже рисуется текст пункта
 * (конспект, карточки, флипы, лист), и не тянет за собой вёрстку.
 *
 * Синтаксис (тот же — в справке редактора пункта, `TDF_MARKUP_HELP`):
 *
 *   [[неотрицательное]]        пропуск в тексте или в формуле ($b \ge [[0]]$);
 *   \gap{…}                     то же внутри формулы (для LaTeX-привычки);
 *
 *   ```свойства                нумерованный список формул и общая фигурная
 *   \sqrt[n]{ab} = …            скобка условий справа (как «свойства корней»);
 *   ---                         ниже черты — условия;
 *   n \in \mathbb{N}
 *   ```
 *
 *   ```соответствие            «А) левое → 1) правое»: правый столбец
 *   # ФУНКЦИИ -> ГРАФИКИ        перемешивается (детерминированно), под ним
 *   $y=\sqrt x$ -> `plot: …`    таблица ответа — в эталоне с цифрами,
 *   ```                         в бланке пустая;
 *
 *   ```plot пропуск            в бланке остаются только оси и сетка —
 *   x -1 6; y -1 3; f sqrt(x)   график строит ученик.
 *   ```
 *
 * Чистый модуль: без React, DOM и сети — покрыт `__tests__/tdfMarkup.test.js`.
 */

import { splitPlotCommands } from './coordPlot';

export const TDF_VIEW_ETALON = 'etalon';
export const TDF_VIEW_GAPS = 'gaps';

const PROPS_LANGS = ['свойства', 'properties', 'props'];
const MATCH_LANGS = ['соответствие', 'matching'];
const PLOT_LANGS = ['plot', 'vectors'];
const GAP_FLAG = /(^|\s)(пропуск|gap|оси|blank)(\s|$)/i;

/** Команды чертежа, которые описывают оси и сетку, а не сам график. */
const PLOT_FRAME_CMDS = new Set([
  'x', 'xrange', 'y', 'yrange', 'grid', 'size', 'width', 'axis', 'units', 'xtick', 'ytick',
]);

const LETTERS = 'АБВГДЕЖЗИКЛМНОП';

/** Пропуск короче — сплошной линией, длиннее — по словам с переносом. */
const SHORT_GAP_CHARS = 40;

/* ── Пропуски ─────────────────────────────────────────────────────────────── */

/** Индекс закрывающей фигурной скобки для открывающей в `s[open]`. */
function matchBrace(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\') { i += 1; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Пропуск внутри формулы: линия длиной с ответ и запасом под почерк. */
function mathGapLatex(body) {
  return `\\underline{\\hspace{0.9em}\\phantom{${body}}\\hspace{0.9em}}`;
}

/**
 * Пропуски внутри формулы: `\gap{…}` и `[[…]]`.
 * Эталон — содержимое как есть, бланк — подчёркнутая пустота той же ширины.
 */
export function applyMathGaps(latex, mode = TDF_VIEW_ETALON) {
  if (!latex) return latex;
  const blank = mode === TDF_VIEW_GAPS;
  let out = '';
  let i = 0;
  while (i < latex.length) {
    if (latex.startsWith('\\gap{', i)) {
      const close = matchBrace(latex, i + 4);
      if (close > 0) {
        const body = applyMathGaps(latex.slice(i + 5, close), mode);
        out += blank ? mathGapLatex(body) : `{${body}}`;
        i = close + 1;
        continue;
      }
    }
    if (latex.startsWith('[[', i)) {
      const close = latex.indexOf(']]', i + 2);
      if (close > 0) {
        const body = latex.slice(i + 2, close);
        out += blank ? mathGapLatex(body) : `{${body}}`;
        i = close + 2;
        continue;
      }
    }
    if (latex[i] === '\\') { out += latex.slice(i, i + 2); i += 2; continue; }
    out += latex[i];
    i += 1;
  }
  return out;
}

const TEXT_ESCAPES = { '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '#': '\\#', '%': '\\%', '&': '\\&', _: '\\_', '^': '\\^{}', '~': '\\~{}', $: '\\$' };
const escapeText = (s) => s.replace(/[\\{}#%&_^~$]/g, (ch) => TEXT_ESCAPES[ch]);

/** Куски текстового пропуска: слова и формулы `$…$` — каждый своим куском. */
function gapPieces(content) {
  const pieces = [];
  const re = /\$([^$]+)\$|(\S+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m[1] != null) pieces.push(m[1]);
    else pieces.push(`\\text{${escapeText(m[2])}}`);
  }
  return pieces;
}

/**
 * Пропуск в тексте. В бланке — линия длиной с ответ, разбитая по словам:
 * длинная формулировка переносится по строкам, а не торчит за поле одним
 * неразрывным куском. Между кусками — U+200B: KaTeX-блоки идут вплотную
 * (линия сплошная), но строка может разорваться.
 */
function textGap(content, mode) {
  if (mode !== TDF_VIEW_GAPS) return content;
  const pieces = gapPieces(content);
  if (!pieces.length) return '$\\underline{\\hspace{3em}}$';
  // Короткий пропуск — одна сплошная линия: куски с просветами между ними
  // (формула + «, 1 корень» в ячейке таблицы) читаются как несколько полей.
  if (content.length <= SHORT_GAP_CHARS) {
    return `$\\underline{\\hspace{0.8em}\\phantom{${pieces.join('\\ ')}}\\hspace{0.8em}}$`;
  }
  return pieces.map((p, idx) => {
    const left = idx === 0 ? '\\hspace{0.8em}' : '';
    const right = idx === pieces.length - 1 ? '\\hspace{0.8em}' : '\\hspace{0.3em}';
    return `$\\underline{${left}\\phantom{${p}}${right}}$`;
  }).join('​');
}

/** Позиция закрывающего `$` / `$$` (не экранированного) начиная с `from`. */
function findMathClose(s, from, delim) {
  for (let i = from; i < s.length; i++) {
    if (s[i] === '\\') { i += 1; continue; }
    if (s.startsWith(delim, i)) {
      if (delim === '$' && s[i + 1] === '$') return -1; // `$a$$` — не наш случай
      return i;
    }
    if (delim === '$' && s[i] === '\n' && s[i + 1] === '\n') return -1;
  }
  return -1;
}

/**
 * Пропуски в обычном markdown (без fenced-блоков): `[[…]]` в тексте,
 * `[[…]]` и `\gap{…}` внутри `$…$` / `$$…$$`. Инлайн-код (`plot: …` в ячейке
 * таблицы) не трогается.
 */
export function applyTextGaps(text, mode = TDF_VIEW_ETALON) {
  if (!text) return text;
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') { out += text.slice(i, i + 2); i += 2; continue; }
    if (ch === '`') {
      let run = 1;
      while (text[i + run] === '`') run += 1;
      const fence = '`'.repeat(run);
      const close = text.indexOf(fence, i + run);
      if (close > 0) {
        out += text.slice(i, close + run);
        i = close + run;
        continue;
      }
    }
    if (ch === '$') {
      const delim = text[i + 1] === '$' ? '$$' : '$';
      const close = findMathClose(text, i + delim.length, delim);
      if (close > 0) {
        out += delim + applyMathGaps(text.slice(i + delim.length, close), mode) + delim;
        i = close + delim.length;
        continue;
      }
    }
    if (text.startsWith('[[', i)) {
      const close = text.indexOf(']]', i + 2);
      if (close > 0 && !text.slice(i + 2, close).includes('\n\n')) {
        out += textGap(text.slice(i + 2, close), mode);
        i = close + 2;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

/* ── «Свойства + условия» ─────────────────────────────────────────────────── */

const stripDollars = (line) => line.replace(/^\${1,2}/, '').replace(/\${1,2}$/, '').trim();

/**
 * Нумерованный столбец формул и общая фигурная скобка условий справа.
 * Скобка тянется на всю высоту списка (`\vphantom` списка внутри
 * `\left\{ … \right.`), условия стоят по её центру.
 */
export function propertiesLatex(body) {
  const lines = String(body || '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
  const sep = lines.findIndex(l => /^-{3,}$/.test(l));
  const list = (sep < 0 ? lines : lines.slice(0, sep)).map(stripDollars).filter(Boolean)
    .map(l => l.replace(/^\d+\s*[).]\s*/, ''));
  const conds = sep < 0 ? [] : lines.slice(sep + 1).map(stripDollars).filter(Boolean);
  if (!list.length && !conds.length) return '';

  const listLatex = list.length
    ? `\\begin{aligned}${list.map((f, i) => `&${i + 1})\\;\\; ${f}`).join('\\\\[1.4ex]')}\\end{aligned}`
    : '';
  if (!conds.length) return listLatex;

  const condsLatex = `\\begin{aligned}${conds.map(c => `&${c}`).join('\\\\[0.8ex]')}\\end{aligned}`;
  const brace = `\\left\\{${listLatex ? `\\vphantom{${listLatex}}` : ''}${condsLatex}\\right.`;
  return listLatex ? `${listLatex}\\qquad ${brace}` : brace;
}

/* ── Соответствие ─────────────────────────────────────────────────────────── */

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Перестановка правого столбца: одна и та же для одного и того же текста
 * (эталон и бланк совпадают, перепечатка не меняет ответ) и никогда не
 * тождественная — иначе ответ «1 2 3 4» читается без задания.
 */
export function matchingOrder(n, seedText = '') {
  const order = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return order;
  const rnd = mulberry32(hashString(seedText));
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (order.every((v, i) => v === i)) order.push(order.shift());
  return order;
}

/** Ячейка GFM-таблицы: `|` внутри формулы → `\vert`, в тексте — экранируется. */
function cellText(s) {
  return String(s || '')
    .replace(/\$([^$]+)\$/g, (_, m) => `$${m.replace(/\\\|/g, '\\Vert ').replace(/\|/g, '\\vert ')}$`)
    .replace(/(^|[^\\])\|(?![^$]*\$)/g, '$1\\|')
    .trim();
}

/** Разбор блока соответствия: заголовки столбцов и пары «левое → правое». */
export function parseMatching(body) {
  const pairs = [];
  let heads = null;
  for (const raw of String(body || '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    const arrow = /\s*(?:->|→)\s*/;
    if (line.startsWith('#')) {
      const parts = line.replace(/^#+\s*/, '').split(arrow);
      heads = [parts[0] || '', parts.slice(1).join(' ') || ''];
      continue;
    }
    const m = arrow.exec(line);
    if (!m) continue;
    pairs.push({ left: line.slice(0, m.index).trim(), right: line.slice(m.index + m[0].length).trim() });
  }
  return { heads, pairs };
}

/**
 * Markdown задания на соответствие: таблица без линий «А) … | 1) …» и под
 * ней таблица ответа (`| А | Б | В |`). Эталон — с цифрами, бланк — пустая
 * строка (remarkTableModifiers делает её полем для записи).
 */
export function matchingMarkdown(body, mode = TDF_VIEW_ETALON, seed = '') {
  const { heads, pairs } = parseMatching(body);
  if (!pairs.length) return '';
  const n = pairs.length;
  const order = matchingOrder(n, `${seed}\n${body}`);
  const answer = pairs.map((_, i) => order.indexOf(i) + 1);

  const head = heads
    ? `| ${cellText(heads[0])} | ${cellText(heads[1])} |`
    : '|  |  |';
  const rows = pairs.map((p, i) => {
    const right = pairs[order[i]].right;
    return `| ${LETTERS[i]}) ${cellText(p.left)} | ${i + 1}) ${cellText(right)} |`;
  });
  const letters = pairs.map((_, i) => LETTERS[i]);
  const answerRow = mode === TDF_VIEW_GAPS ? letters.map(() => ' ') : answer.map(String);

  return [
    '',
    heads ? '{без линий}' : '{без линий, без шапки}',
    head,
    '| --- | --- |',
    ...rows,
    '',
    `| ${letters.join(' | ')} |`,
    `| ${letters.map(() => '---').join(' | ')} |`,
    `| ${answerRow.join(' | ')} |`,
    '',
  ].join('\n');
}

/* ── Пустые оси ───────────────────────────────────────────────────────────── */

/** Только оси, сетка и засечки — без графиков, точек и подписей. */
export function plotFrameOnly(spec) {
  return splitPlotCommands(spec)
    .map(c => c.trim())
    .filter(c => PLOT_FRAME_CMDS.has((c.split(/\s+/)[0] || '').toLowerCase()))
    .join('\n');
}

/* ── Сборка ───────────────────────────────────────────────────────────────── */

/** Делит markdown на fenced-блоки и текст между ними. */
function splitFences(md) {
  const lines = md.split('\n');
  const parts = [];
  let text = [];
  for (let i = 0; i < lines.length; i++) {
    const open = /^(\s*)(`{3,}|~{3,})\s*([^\s`]*)\s*(.*)$/.exec(lines[i]);
    if (!open) { text.push(lines[i]); continue; }
    const fence = open[2];
    let j = i + 1;
    while (j < lines.length && !lines[j].trim().startsWith(fence)) j += 1;
    if (text.length) { parts.push({ kind: 'text', text: text.join('\n') }); text = []; }
    parts.push({
      kind: 'fence',
      fence,
      lang: open[3].toLowerCase(),
      info: open[4].trim(),
      body: lines.slice(i + 1, j).join('\n'),
      closed: j < lines.length,
    });
    i = j;
  }
  if (text.length) parts.push({ kind: 'text', text: text.join('\n') });
  return parts;
}

function renderFence(part, mode, seed) {
  const { lang, info, body, fence } = part;
  if (PROPS_LANGS.includes(lang)) {
    const latex = applyMathGaps(propertiesLatex(body), mode);
    return latex ? `\n$$\n${latex}\n$$\n` : '';
  }
  if (MATCH_LANGS.includes(lang)) {
    return applyTextGaps(matchingMarkdown(body, mode, seed), mode);
  }
  if (PLOT_LANGS.includes(lang) && GAP_FLAG.test(info)) {
    const spec = mode === TDF_VIEW_GAPS ? plotFrameOnly(body) : body;
    return `${fence}${lang}\n${spec}\n${fence}`;
  }
  return `${fence}${lang}${info ? ` ${info}` : ''}\n${body}${part.closed ? `\n${fence}` : ''}`;
}

/**
 * Текст пункта ТДФ → markdown для MathRenderer в нужном виде.
 *
 * @param {string} md    — formulation_md / short_notation_md
 * @param {'etalon'|'gaps'} mode
 * @param {{seed?: string}} opts — seed перемешивания соответствия (id пункта)
 */
export function tdfMarkdown(md, mode = TDF_VIEW_ETALON, { seed = '' } = {}) {
  if (!md || typeof md !== 'string') return md || '';
  return splitFences(md)
    .map(p => (p.kind === 'text' ? applyTextGaps(p.text, mode) : renderFence(p, mode, seed)))
    .join('\n');
}

/** Есть ли в тексте то, что бланк прячет: пропуски, соответствие, пустые оси. */
export function tdfHasGaps(md) {
  if (!md) return false;
  return /\[\[[\s\S]*?\]\]|\\gap\{/.test(md)
    // `\b` кириллицу буквой не считает — граница слова lookahead'ом.
    || /^\s*(`{3,}|~{3,})\s*(соответствие|matching)(?![0-9a-zа-яё])/im.test(md)
    || /^\s*(`{3,}|~{3,})\s*(plot|vectors)[^\S\n]+[^\n]*(пропуск|gap|оси|blank)/im.test(md);
}

/** Пункт целиком: есть ли пропуски хотя бы в одном из текстовых полей. */
export function tdfItemHasGaps(item) {
  return !!item && (tdfHasGaps(item.formulation_md) || tdfHasGaps(item.short_notation_md));
}

/* ── Заготовки для редактора пункта ───────────────────────────────────────── */

export const TDF_SNIPPETS = {
  properties: [
    '',
    '```свойства',
    '\\sqrt[n]{ab} = \\sqrt[n]{a} \\cdot \\sqrt[n]{b}',
    '\\sqrt[n]{\\dfrac{a}{b}} = \\dfrac{\\sqrt[n]{a}}{\\sqrt[n]{b}}',
    '---',
    'n \\in \\mathbb{N},\\ n \\ge 2',
    'a \\ge 0,\\ b \\ge 0',
    '```',
    '',
  ].join('\n'),
  matching: [
    '',
    '```соответствие',
    '# ФУНКЦИИ -> ГРАФИКИ',
    '$y = \\sqrt{x}$ -> `plot: x -1 6; y -1 3; f sqrt(x)`',
    '$y = \\sqrt[3]{x}$ -> `plot: x -4 4; y -2 2; f cbrt(x)`',
    '$y = x^2$ -> `plot: x -3 3; y -1 5; f x^2`',
    '```',
    '',
  ].join('\n'),
  piecewise: '$\\sqrt[n]{a^n} = \\begin{cases} [[|a|]], & \\text{если } n \\text{ чётное} \\\\ [[a]], & \\text{если } n \\text{ нечётное} \\end{cases}$',
  axes: [
    '',
    '```plot пропуск',
    'x -1 6',
    'y -1 3',
    'f sqrt(x)',
    'label 4 2.4 y=\\sqrt{x}',
    '```',
    '',
  ].join('\n'),
};
