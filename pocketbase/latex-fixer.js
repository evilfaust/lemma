// latex-fixer.js
// Постпроцессор LaTeX-формул, извлечённых из sdamgia.ru — нормализация под KaTeX.
//
// Применяется в pdf-service.js (cleanLatexFormula) ПОСЛЕ всех русскоязычных
// замен («дробь:», «корень из:» и т.п.). Принимает строку LaTeX без $-обёрток.
//
// Принципы:
//   - Каждое правило — отдельная функция fixFoo(text).
//   - Правила идемпотентны: повторное применение не должно ничего ломать.
//   - Правила консервативны: лучше пропустить редкий случай, чем испортить.
//   - Правила — регулярки; исключение — \over и \abs (fixInfixOver,
//     fixAbsShortcut): там нужны границы операндов, их ищет маленький токенизатор.
//
// Тесты — в latex-fixer.test.js.

/**
 * Команды, которые часто пишутся слитно с буквенным аргументом без скобок:
 * \angleABC → \angle{ABC}, \widehatXYZ → \widehat{XYZ}, \overrightarrowCM → \overrightarrow{CM}.
 * Только для аргументов из латинских букв (1+ символов).
 */
const SLAMMED_COMMANDS = [
  'angle', 'widehat', 'widetilde',
  'overrightarrow', 'overleftarrow', 'overline', 'underline',
  'vec', 'bar', 'hat', 'tilde', 'mathring', 'dot', 'ddot',
  'mathbf', 'mathrm', 'mathit', 'mathcal', 'mathbb', 'mathfrak',
  'underset', 'overset', 'phantom',
  // В alt «Решу» встречается сырой LaTeX без скобок: \sqrta, \boldsymbola
  'sqrt', 'boldsymbol',
];

const SLAMMED_RE = new RegExp(
  `\\\\(${SLAMMED_COMMANDS.join('|')})([A-Za-z][A-Za-z0-9]*)`,
  'g'
);

export function fixSlammedCommands(text) {
  return text.replace(SLAMMED_RE, (_, cmd, arg) => `\\${cmd}{${arg}}`);
}

/**
 * Русские нотации тригонометрии, которых нет в KaTeX по умолчанию:
 * \tg, \ctg, \arctg, \arcctg, \cosec, \arccosec → \operatorname{...}.
 * \sh, \ch, \th, \cth — гиперболические (русские).
 */
const RU_TRIG_COMMANDS = ['tg', 'ctg', 'arctg', 'arcctg', 'cosec', 'arccosec', 'sh', 'ch', 'th', 'cth'];
const RU_TRIG_RE = new RegExp(
  `\\\\(${RU_TRIG_COMMANDS.join('|')})(?![A-Za-z])`,
  'g'
);

export function fixRussianTrig(text) {
  return text.replace(RU_TRIG_RE, (_, cmd) => `\\operatorname{${cmd}}`);
}

/**
 * «N г» (артефакт парсинга «градусов» — sdamgia рендерит «°» как картинку,
 * у которой alt = «г») → N^{\circ}.
 * Паттерн: цифра(ы), пробелы, «г», граница (не буква/цифра).
 */
export function fixDegreesArtifact(text) {
  // Случаи: "90 г,", "90 г=", "90 г ", "180 г.", "90 г$"
  return text.replace(/(\d+)\s+г(?=[\s,.\-+=)*/\]}]|$)/g, '$1^{\\circ}');
}

/**
 * Юникодный знак градуса °:  "30°" → "30^{\circ}".
 */
export function fixDegreeSymbol(text) {
  return text.replace(/(\d+)\s*°/g, '$1^{\\circ}');
}

/**
 * Степень в круглых скобках без фигурных: a ^ ( x + b ) → a^{x+b}.
 * Только для не-вложенных скобок (без вложенных «(»).
 */
export function fixPowerParens(text) {
  return text.replace(/\^\s*\(\s*([^()]+?)\s*\)/g, '^{$1}');
}

/**
 * Индекс в круглых скобках без фигурных: a _ ( i + j ) → a_{i+j}.
 */
export function fixSubscriptParens(text) {
  return text.replace(/_\s*\(\s*([^()]+?)\s*\)/g, '_{$1}');
}

/**
 * Многосимвольная степень/индекс без скобок: x^23 → x^{23}, x^abc → x^{abc}.
 * Срабатывает только если за ^/_ идёт 2+ латинских букв/цифр подряд.
 * (Одиночный символ — нормально для KaTeX.)
 */
export function fixMultiCharSuperSub(text) {
  // Берём только чисто-буквенные или чисто-цифровые последовательности.
  // Смешанные (`_1B`, `_x2`) НЕ трогаем — это часто остатки внутри уже
  // обёрнутых кластеров (см. fixDoubleSubscript), оборачивать повторно нельзя.
  //
  // Lookahead `(?![A-Za-z0-9_])` — НЕ оборачивать, если следом ещё один `_`,
  // потому что тогда KaTeX получит двойной subscript (S_{AB}_1B — broken).
  // Старое поведение для `S_AB_1B` — KaTeX рендерит как S_A B_1 B (некрасиво,
  // но валидно). Семантически восстановить намерение автора без AST нельзя.
  text = text.replace(/\^([A-Za-z]{2,})(?![A-Za-z0-9_])/g, '^{$1}');
  text = text.replace(/\^(\d{2,})(?![A-Za-z0-9_])/g, '^{$1}');
  text = text.replace(/_([A-Za-z]{2,})(?![A-Za-z0-9_])/g, '_{$1}');
  text = text.replace(/_(\d{2,})(?![A-Za-z0-9_])/g, '_{$1}');
  return text;
}

/**
 * Аргумент функции в круглых скобках без фигурных: \sqrt ( x ) → \sqrt{x},
 * \sin ( x ) тоже, но \sin(x) для KaTeX нормально — оставляем как есть.
 * Здесь чиним только команды, для которых ()-скобки рендерятся как часть результата.
 */
const PAREN_AS_ARG_CMDS = ['sqrt', 'cbrt'];
const PAREN_ARG_RE = new RegExp(
  `\\\\(${PAREN_AS_ARG_CMDS.join('|')})\\s*\\(\\s*([^()]+?)\\s*\\)`,
  'g'
);

export function fixFunctionParenArg(text) {
  return text.replace(PAREN_ARG_RE, (_, cmd, arg) => `\\${cmd}{${arg}}`);
}

/**
 * Двойной subscript без скобок: S_A_1B_1 → S_{A_1B_1}.
 * Регулярка: после _ идёт буква/цифра + один или более _<буква/цифра+>.
 */
export function fixDoubleSubscript(text) {
  // Кластер вида A_1B_1C_1 после внешнего _ (геометрические индексы) плюс
  // хвостовые буквы без индекса: V_A_1B_2CB → V_{A_1B_2CB}.
  // Идемпотентно без подсчёта скобок: шаблон начинается с буквы, а внутри уже
  // обёрнутого «_{A_1B_1}» после «_» стоит цифра. Раньше правило не работало
  // внутри любых {} — индексы в \frac{…}{S_A_1B_2C} оставались сломанными.
  // «S_AB_1B» (индекс AB, без цифры у первой буквы) по-прежнему не трогаем.
  return text.replace(
    /_([A-Za-z](?:_\d+)+(?:[A-Za-z](?:_\d+)*)*)(?![A-Za-z0-9_{])/g,
    (_, cluster) => `_{${cluster}}`,
  );
}

/**
 * Десятичная запятая в формуле: 0,5 → 0{,}5.
 * Иначе KaTeX вставляет пробел после запятой (как после знака пунктуации).
 */
export function fixDecimalComma(text) {
  return text.replace(/(\d),(\d)/g, '$1{,}$2');
}

/**
 * \log a b → \log_{a} b (sdamgia теряет _ при парсинге MathML).
 * Срабатывает когда после \log/\lg/\ln идёт пробел, одиночный символ-основание,
 * пробел, и аргумент. Консервативно: основание — одна буква или одна цифра.
 */
export function fixLogBase(text) {
  // \log a 32 → \log_{a} 32
  text = text.replace(/\\(log|lg|ln)\s+([A-Za-z]|\d+)\s+(\S+)/g, '\\$1_{$2} $3');
  // \log ( a ) x → \log_{a} x (после fixPowerParens круглые ещё на месте)
  text = text.replace(/\\(log|lg|ln)\s*\(\s*([^()]+?)\s*\)\s+(\S+)/g, '\\$1_{$2} $3');
  return text;
}

/**
 * Косметика: пробелы внутри круглых скобок «( x )» → «(x)».
 * Не критично для рендера, но улучшает читаемость и экономит место.
 */
export function fixSpacesInParens(text) {
  // ( x → (x  и  x ) → x)
  // Только если внутри один пробел сразу после/перед скобкой.
  text = text.replace(/\(\s+/g, '(');
  text = text.replace(/\s+\)/g, ')');
  return text;
}

/**
 * Удалить пробелы перед ^ и _ (KaTeX не любит «a ^ 2»).
 */
export function fixSpaceBeforeSupSub(text) {
  return text.replace(/\s+([\^_])/g, '$1');
}

/**
 * Полный пайплайн: применить все фиксы в правильном порядке.
 * Порядок важен:
 *   1) слитные команды (\angleABC),
 *   2) русские триг.команды,
 *   3) градусы,
 *   4) аргументы функций в скобках,
 *   5) логарифмы,
 *   6) убрать пробелы перед ^/_,
 *   7) скобки в степенях/индексах,
 *   8) ДВОЙНОЙ subscript раньше многосимвольного — иначе многосимвольный
 *      съест внутренние _ (S_A_1B_1 → S_A_{1B}_1, что испортит структуру),
 *   9) косметика (запятая, пробелы в скобках).
 */
// ─── TeX-сокращения, которые «Решу» кладёт в alt как есть (v3.9.354) ───

/**
 * Дуга: «\overset\smileBC», «\overset\smileD_1B» → \overset{\smile}{BC}.
 * Аргумент — подряд идущие точки (заглавная буква с необязательным индексом).
 */
export function fixArcShortcut(text) {
  return text
    .replace(/\\overset\s*\\smile\s*\{([^{}]*)\}/g, '\\overset{\\smile}{$1}')
    .replace(
      /\\overset\s*\\smile\s*((?:[A-Z](?:_\{[^{}]*\}|_[0-9A-Za-z])?)+)/g,
      '\\overset{\\smile}{$1}'
    );
}

// Строки «\beginmatrix A, B \endmatrix» разделены запятой с пробелом
// (запятая внутри {…} — десятичная, не трогаем).
function splitMatrixRows(body) {
  const rows = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\') { cur += c + (body[i + 1] || ''); i++; continue; }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth = Math.max(0, depth - 1);
    if (c === ',' && depth === 0 && /\s/.test(body[i + 1] || ' ')) { rows.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) rows.push(cur.trim());
  return rows;
}

/**
 * Система/совокупность: «\left\{ \beginmatrix A, B \endmatrix .» → \begin{cases},
 * «\left[ \beginmatrix … \endmatrix .» → \left[\begin{array}{l} … \end{array}\right.
 * Точка после \endmatrix — остаток «\right.» из alt.
 */
export function fixMatrixShortcut(text) {
  if (!/\\beginmatrix/.test(text)) return text;
  return text.replace(
    /(\\left\s*(\\\{|\[)\s*)?\\beginmatrix\s*([\s\S]*?)\s*\\endmatrix(\s*\.)?/g,
    (_, left, br, body) => {
      const rows = splitMatrixRows(body).join(' \\\\ ');
      if (br === '\\{') return `\\begin{cases} ${rows} \\end{cases}`;
      if (br === '[') return `\\left[\\begin{array}{l} ${rows} \\end{array}\\right.`;
      return `\\begin{matrix} ${rows} \\end{matrix}`;
    }
  );
}

// Токены для \over и \abs. Стоп-токены разделяют операнды (+, −, отношения).
const STOP_CMDS = new Set([
  'leq', 'geq', 'le', 'ge', 'ne', 'neq', 'lt', 'gt', 'approx', 'equiv', 'sim',
  'Leftrightarrow', 'Rightarrow', 'Leftarrow', 'leftrightarrow', 'rightarrow', 'to',
  'iff', 'implies', 'pm', 'mp', 'in', 'notin', 'cup', 'cap', 'subset', 'supset',
  'quad', 'qquad', 'text', 'over', 'abs',
]);
const REL_CHARS = '=<>,;';
// Функции без скобок: аргумент — следующий атом («\\cos A», «\\log_{2} 8»).
const FUNC_RE = /^\\(?:sin|cos|tan|cot|tg|ctg|sec|csc|arcsin|arccos|arctan|arctg|arcctg|log|ln|lg|exp|operatorname\{[a-z]+\})(?:[_^](?:\{[^{}]*\}|\S))*$/;
const ABS_LIKE = new Set(['abstract']); // настоящие команды на «abs…» (KaTeX их не знает, но мало ли)
const ADD_CHARS = '+-';

function matchClose(s, i, open, close) {
  let d = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === open) d++;
    else if (s[j] === close) { d--; if (d === 0) return j; }
  }
  return -1;
}

// Разбор одного уровня: [{t, k}] — k: atom | mul | add | rel | over | abs | space.
function tokenize(s) {
  const out = [];
  let i = 0;
  const suffix = (j) => {
    // ^/_ после атома — часть атома
    for (;;) {
      let k = j;
      while (s[k] === ' ') k++;
      if (s[k] !== '^' && s[k] !== '_') return j;
      k++;
      while (s[k] === ' ') k++;
      if (s[k] === '{') { const e = matchClose(s, k, '{', '}'); if (e < 0) return j; j = e + 1; }
      else if (s[k] === '\\') { let e = k + 1; while (/[A-Za-z]/.test(s[e] || '')) e++; j = e; }
      else if (s[k]) j = k + 1;
      else return j;
    }
  };
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { let j = i; while (/\s/.test(s[j] || '')) j++; out.push({ t: s.slice(i, j), k: 'space' }); i = j; continue; }
    if (c === '{') {
      const e = matchClose(s, i, '{', '}'); if (e < 0) return null;
      const j = suffix(e + 1);
      out.push({ t: '{' + rewriteGroup(s.slice(i + 1, e), true) + '}' + s.slice(e + 1, j), k: 'atom' }); i = j; continue;
    }
    if (c === '(' || c === '[') {
      const close = c === '(' ? ')' : ']';
      const e = matchClose(s, i, c, close); if (e < 0) return null;
      const j = suffix(e + 1);
      out.push({ t: c + rewriteGroup(s.slice(i + 1, e)) + close + s.slice(e + 1, j), k: 'atom' }); i = j; continue;
    }
    if (c === '\\') {
      let e = i + 1;
      while (/[A-Za-z]/.test(s[e] || '')) e++;
      if (e === i + 1) e = i + 2; // \{ \, \! …
      const name = s.slice(i + 1, e);
      if (name === 'over') { out.push({ t: s.slice(i, e), k: 'over' }); i = e; continue; }
      // «\abs8», а то и «\absx» (буква приклеилась) — модуль
      if (name === 'abs' || (name.startsWith('abs') && !ABS_LIKE.has(name))) {
        out.push({ t: '\\abs', k: 'abs' }); i += 4; continue;
      }
      if (name === 'cdot' || name === 'times') { out.push({ t: s.slice(i, e), k: 'mul' }); i = e; continue; }
      if (STOP_CMDS.has(name) || name === '\\') { out.push({ t: s.slice(i, e), k: 'rel' }); i = e; continue; }
      // команда + её аргументы {…} / […]
      let j = e;
      for (;;) {
        let k = j; while (s[k] === ' ') k++;
        if (s[k] === '{') { const z = matchClose(s, k, '{', '}'); if (z < 0) break; j = z + 1; continue; }
        if (s[k] === '[' && /^(sqrt)$/.test(name)) { const z = matchClose(s, k, '[', ']'); if (z < 0) break; j = z + 1; continue; }
        break;
      }
      const raw = s.slice(i, j);
      const head = s.slice(i, e);
      const args = raw.slice(head.length).replace(/\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (m, inner) => `{${rewriteGroup(inner, true)}}`);
      const jj = suffix(j);
      out.push({ t: head + args + s.slice(j, jj), k: 'atom' }); i = jj; continue;
    }
    if (REL_CHARS.includes(c) || c === '&' || c === '|') { out.push({ t: c, k: 'rel' }); i++; continue; }
    if (ADD_CHARS.includes(c)) { out.push({ t: c, k: 'add' }); i++; continue; }
    if (/[0-9]/.test(c)) {
      let j = i; while (/[0-9.]/.test(s[j] || '') || (s.slice(j, j + 3) === '{,}')) j += s.slice(j, j + 3) === '{,}' ? 3 : 1;
      j = suffix(j); out.push({ t: s.slice(i, j), k: 'atom' }); i = j; continue;
    }
    const j = suffix(i + 1);
    out.push({ t: s.slice(i, j), k: 'atom' }); i = j;
  }
  return out;
}

const join = (toks) => toks.map((x) => x.t).join('').trim();

// Внутри одного уровня: сначала \abs (до отношения или конца группы),
// затем \over (числитель — произведение слева, знаменатель — атом справа).
function rewriteGroup(s, inner = false) {
  if (!/\\over(?![A-Za-z])|\\abs(?![A-Za-z]{2})/.test(s)) return s;
  let toks = tokenize(s);
  if (!toks) return s;
  // \abs — только однозначные случаи (у «Решу» закрывающая черта потеряна,
  // граница модуля в общем случае не восстанавливается):
  //   \abs{X}                     → |X|
  //   {\abs X …} — первым в группе → модуль на всю группу (числитель формулы расстояния)
  //   \abs x = …, \abs x в конце   → |x| (один атом перед отношением)
  // Остальное («4 \absy + x^2 = 0» — это 4|y| или 4|y + x^2|?) не трогаем.
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].k !== 'abs') continue;
    let j = i + 1;
    while (j < toks.length && toks[j].k === 'space') j++;
    const t = toks[j];
    if (!t) continue;
    if (t.k === 'atom' && /^\{[\s\S]*\}$/.test(t.t)) {
      toks.splice(i, j - i + 1, { t: `\\left|${t.t.slice(1, -1)}\\right|`, k: 'atom' });
      continue;
    }
    const rest = toks.slice(j);
    const firstInGroup = inner && toks.slice(0, i).every((x) => x.k === 'space');
    if (firstInGroup && rest.every((x) => x.k !== 'rel' && x.k !== 'abs')) {
      toks.splice(i, toks.length - i, { t: `\\left|${join(rest)}\\right|`, k: 'atom' });
      continue;
    }
    if (t.k !== 'atom') continue;
    let k = j + 1;
    while (k < toks.length && toks[k].k === 'space') k++;
    if (k === toks.length || toks[k].k === 'rel') {
      toks.splice(i, j - i + 1, { t: `\\left|${t.t}\\right|`, k: 'atom' });
    }
  }
  // \over: числитель — произведение слева, знаменатель — справа
  for (let guard = 0; guard < 20; guard++) {
    const o = toks.findIndex((x) => x.k === 'over');
    if (o < 0) break;
    let a = o;
    while (a > 0 && ['atom', 'mul', 'space'].includes(toks[a - 1].k)) a--;
    while (a < o && toks[a].k !== 'atom') a++;
    // знаменатель — ОДИН атом: «a \\over 5 \\cdot 5 \\over \\sqrt{5}» = (a/5)·(5/√5),
    // жадный знаменатель дал бы a/(5·5)/√5
    let b = o + 1;
    while (b < toks.length && toks[b].k === 'space') b++;
    // функция берёт свой аргумент: «\\over \\cos A» → знаменатель «\\cos A»
    while (b < toks.length && toks[b].k === 'atom') {
      const fn = FUNC_RE.test(toks[b].t);
      b++;
      if (!fn) break;
      while (b < toks.length && toks[b].k === 'space') b++;
    }
    const num = join(toks.slice(a, o));
    const den = join(toks.slice(o + 1, b));
    if (!num || !den) return s; // не разобрать — оставляем как было
    toks.splice(a, b - a, { t: `\\frac{${num}}{${den}}`, k: 'atom' });
  }
  return toks.map((x) => x.t).join('');
}

/** «\abs8 - 20» в числителе → \left|8 - 20\right|; однозначные случаи — см. rewriteGroup. */
export function fixAbsShortcut(text) {
  return /\\abs(?![A-Za-z]{2})/.test(text) ? rewriteGroup(text) : text;
}

/**
 * «AC \over \cos A = 4 \over 0{,}5» → \frac{AC}{\cos A} = \frac{4}{0{,}5}.
 * В alt «Решу» \over связывает соседей, а не всю группу, как в TeX:
 * «\sqrt{1 - 20 \over 25}» = √(1 − 20/25).
 */
export function fixInfixOver(text) {
  return /\\over(?![A-Za-z])/.test(text) ? rewriteGroup(text) : text;
}

export function fixLatex(text) {
  if (!text) return text;
  let t = text;
  t = fixArcShortcut(t);       // ДО fixSlammedCommands: «\smileBC» склеено с буквами
  t = fixMatrixShortcut(t);
  t = fixSlammedCommands(t);
  t = fixRussianTrig(t);
  t = fixDegreesArtifact(t);
  t = fixDegreeSymbol(t);
  t = fixFunctionParenArg(t);
  t = fixLogBase(t);
  t = fixSpaceBeforeSupSub(t);
  t = fixPowerParens(t);
  t = fixSubscriptParens(t);
  t = fixDoubleSubscript(t);   // ДО fixMultiCharSuperSub
  t = fixMultiCharSuperSub(t);
  t = fixDecimalComma(t);
  t = fixSpacesInParens(t);
  t = fixAbsShortcut(t);       // ПОСЛЕ скобочных правил: границы групп уже на месте
  t = fixInfixOver(t);
  return t;
}

export default fixLatex;
