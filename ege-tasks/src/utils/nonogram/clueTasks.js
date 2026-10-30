/**
 * Подсказки японского кроссворда — примеры устного счёта под нужное число.
 *
 * Число подсказки (1…15) — ответ примера из отдельного списка («√49»,
 * «log₂8»), который ученик вписывает у поля. Примеры берутся двумя путями:
 *  - **пул** — генераторы разделов устного счёта (`utils/oral/*`) гоняются
 *    по многу раз, целые ответы раскладываются по значению;
 *  - **«от ответа»** — раздел «Целые числа» этого модуля: пример строится
 *    вокруг заданного числа, поэтому есть на любое число. Им же добираются
 *    числа, которых в пуле не нашлось (обычно 11–15 на «Разминке»).
 *
 * 🚨 Ответ примера «от ответа» считается из тех же чисел, что и печать, —
 * сторож `__tests__/nonogramClues.test.js` пересчитывает напечатанное.
 */
import { rand, randInt } from '../linearExpr';
import { DEC_GENERATORS, DEC_LABELS } from '../oral/decimals';
import { FR_GENERATORS, FR_LABELS } from '../oral/fractions';
import { POW_GENERATORS, POW_LABELS } from '../oral/powers';
import { LOG_GENERATORS, LOG_LABELS } from '../oral/logarithms';

export const MAX_CLUE = 15;

// ─── Раздел «Целые числа»: пример от ответа ──────────────────────────────────

const neg = (n) => `(-${n})`;

/** Делители числа больше 1 и меньше самого числа. */
function factorPairs(v) {
  const out = [];
  for (let a = 2; a * a <= v; a++) if (v % a === 0) out.push([a, v / a]);
  return out;
}

const INT_TARGETS = {
  addSub(v, level) {
    if (level === 1) {
      if (v > 2 && Math.random() < 0.5) {
        const b = randInt(1, v - 1);
        return `${v - b} + ${b}`;
      }
      const b = randInt(1, 9);
      return `${v + b} - ${b}`;
    }
    if (level === 2) {
      const b = randInt(11, 69);
      return `${v + b} - ${b}`;
    }
    const b = randInt(12, 48);
    const c = randInt(13, 57);
    return `${v + b + c} - ${b} - ${c}`;
  },

  mulDiv(v, level) {
    const pairs = factorPairs(v);
    if (level === 1) {
      if (pairs.length && Math.random() < 0.5) {
        const [a, b] = rand(pairs);
        return Math.random() < 0.5 ? `${a} \\cdot ${b}` : `${b} \\cdot ${a}`;
      }
      const b = randInt(2, 5);
      return `${v * b} : ${b}`;
    }
    if (level === 2) {
      const b = randInt(3, 12);
      return `${v * b} : ${b}`;
    }
    const b = randInt(2, 6);
    const c = randInt(2, 5);
    return `${v * b * c} : ${b} : ${c}`;
  },

  order(v, level) {
    if (level === 1) {
      const a = randInt(2, 6);
      const b = randInt(2, 6);
      if (a * b > v) return `${a} \\cdot ${b} - ${a * b - v}`;
      return `${v - a * b} + ${a} \\cdot ${b}`.replace(/^0 \+ /, '');
    }
    if (level === 2) {
      if (Math.random() < 0.5) {
        const b = randInt(2, 9);
        const c = randInt(2, 9);
        return `${v + b * c} - ${b} \\cdot ${c}`;
      }
      const c = randInt(2, 7);
      const s = v * c;
      const a = randInt(1, s - 1);
      return `(${a} + ${s - a}) : ${c}`;
    }
    // a·b − c·d = v
    for (let t = 0; t < 30; t++) {
      const c = randInt(2, 9);
      const d = randInt(2, 9);
      const ab = v + c * d;
      const pairs = factorPairs(ab).filter(([x, y]) => y <= 15);
      if (pairs.length) {
        const [a, b] = rand(pairs);
        return `${a} \\cdot ${b} - ${c} \\cdot ${d}`;
      }
    }
    const b = randInt(6, 9);
    const c = randInt(6, 9);
    return `${v + b * c} - ${b} \\cdot ${c}`;
  },

  powers(v, level) {
    if (level === 1) {
      if (Math.random() < 0.5) return `\\sqrt{${v * v}}`;
      const a = randInt(Math.min(6, Math.ceil(Math.sqrt(v + 1))), 6);
      return `${a}^{2} - ${a * a - v}`;
    }
    if (level === 2) {
      // a² − b² = v, иначе 2ᵏ − c
      const sq = factorPairs(v).concat([[1, v]])
        .filter(([p, q]) => (p + q) % 2 === 0 && q > p);
      if (sq.length && Math.random() < 0.6) {
        const [p, q] = rand(sq);
        return `${(q + p) / 2}^{2} - ${(q - p) / 2}^{2}`;
      }
      const k = randInt(Math.max(4, Math.ceil(Math.log2(v + 1))), 6);
      return `2^{${k}} - ${2 ** k - v}`;
    }
    // √A − √B = v
    const m = randInt(2, 9);
    return `\\sqrt{${(v + m) ** 2}} - \\sqrt{${m * m}}`;
  },

  signs(v, level) {
    if (level === 1) {
      const a = randInt(1, 9);
      return `-${a} + ${v + a}`;
    }
    if (level === 2) {
      if (Math.random() < 0.5) {
        const a = randInt(1, 20);
        return `|${a} - ${a + v}|`;
      }
      const a = randInt(2, 6);
      const b = randInt(2, 6);
      if (a * b > v) return `${neg(a)} \\cdot ${neg(b)} - ${a * b - v}`;
      if (a * b === v) return `${neg(a)} \\cdot ${neg(b)}`;
      return `${neg(a)} \\cdot ${neg(b)} + ${v - a * b}`;
    }
    const a = randInt(2, 7);
    const b = randInt(2, 7);
    return `${neg(a)} \\cdot ${b} + ${v + a * b}`;
  },
};

const INT_LABELS = {
  addSub: 'Сложение и вычитание',
  mulDiv: 'Умножение и деление',
  order:  'Порядок действий',
  powers: 'Квадраты и корни',
  signs:  'Минусы и модуль',
};

/**
 * Самая короткая запись числа — для узких клеток над столбцами (сетка 15×15):
 * однозначные «9 + 6», «8 − 3», «8 : 4», «√81». Ширина ~2 em.
 */
export function shortTask(v) {
  const forms = [];
  for (let a = Math.max(1, v - 9); a <= Math.min(9, v - 1); a++) forms.push(`${a} + ${v - a}`);
  for (let b = 1; v + b <= 9; b++) forms.push(`${v + b} - ${b}`);
  for (let b = 2; v * b <= 9; b++) forms.push(`${v * b} : ${b}`);
  if (v <= 9) forms.push(`\\sqrt{${v * v}}`);
  if (!forms.length) return null;
  return { exprLatex: rand(forms), resultLatex: String(v), value: v, cat: 'int.short' };
}

/** Пример «от ответа»: `{ exprLatex, resultLatex, value, cat }`. */
export function targetTask(cat, v, level) {
  const make = INT_TARGETS[cat];
  if (!make) return null;
  const exprLatex = make(v, level);
  return { exprLatex, resultLatex: String(v), value: v, cat: `int.${cat}` };
}

// ─── Разделы ─────────────────────────────────────────────────────────────────

export const CLUE_SECTIONS = [
  { key: 'int', label: 'Целые числа', labels: INT_LABELS, target: true },
  { key: 'dec', label: 'Десятичные дроби', labels: DEC_LABELS, generators: DEC_GENERATORS },
  { key: 'fr',  label: 'Обыкновенные дроби', labels: FR_LABELS, generators: FR_GENERATORS },
  { key: 'pow', label: 'Степени и корни', labels: POW_LABELS, generators: POW_GENERATORS },
  { key: 'log', label: 'Логарифмы', labels: LOG_LABELS, generators: LOG_GENERATORS },
];

const SECTION_BY_KEY = Object.fromEntries(CLUE_SECTIONS.map(s => [s.key, s]));

/** Ключ категории — «раздел.категория»: у разделов есть одинаковые имена. */
export const catKey = (section, cat) => `${section}.${cat}`;

/** Все категории раздела включены — умолчание. */
export function sectionCategories(sectionKey, on = true) {
  const s = SECTION_BY_KEY[sectionKey];
  return s ? Object.fromEntries(Object.keys(s.labels).map(c => [catKey(sectionKey, c), on])) : {};
}

export const DEFAULT_CLUE_CATEGORIES = sectionCategories('int');

// ─── Ширина записи ───────────────────────────────────────────────────────────

/**
 * Приблизительная ширина формулы в em (кегль KaTeX). Точность «на глаз»
 * достаточна: по ней решается, влезет ли пример в клетку подсказки, а кегль
 * на листе всё равно подбирается по самому широкому примеру.
 */
export function texWidthEm(tex) {
  // У дробей скобки KaTeX растягивает (\left( … \right)) — они шире
  const parenEm = /\\[dt]?frac/.test(String(tex)) ? 0.62 : 0.39;
  const s = String(tex)
    .replace(/\\left|\\right/g, '')
    .replace(/\\[,!;]/g, '')
    .replace(/\{,\}/g, ',');
  let i = 0;
  // Ширины — по метрикам шрифта KaTeX Main: цифра 0.5em, знак бинарной
  // операции 0.78em + по 4/18em с боков, отношение (=, :) — по 5/18em.
  // После открывающей скобки и в начале минус унарный — без отступов.
  let prevOpen = true;

  function group() {
    if (s[i] === '{') {
      i++;
      const save = prevOpen;
      prevOpen = true;
      const w = seq('}');
      prevOpen = save;
      i++;
      return w;
    }
    return atom();
  }

  function atom() {
    const ch = s[i];
    if (ch === '{') { prevOpen = false; return group(); }
    if (ch === '\\') {
      const m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
      const name = m ? m[1] : s[i + 1];
      i += m ? m[0].length : 2;
      if (name === 'dfrac' || name === 'frac' || name === 'tfrac') {
        const a = group();
        const b = group();
        prevOpen = false;
        return Math.max(a, b) * (name === 'tfrac' ? 0.7 : 1) + 0.24;
      }
      if (name === 'sqrt') {
        let idx = 0;
        if (s[i] === '[') {
          const end = s.indexOf(']', i);
          idx = 0.3;
          i = end + 1;
        }
        const w = group() + 0.9 + idx;
        prevOpen = false;
        return w;
      }
      const wasOpen = prevOpen;
      prevOpen = name === 'cdot' || name === 'pm';
      if (name === 'cdot') return 0.72;
      if (name === 'pm') return wasOpen ? 0.78 : 1.22;
      if (name === 'log') return 1.45;
      if (name === 'lg' || name === 'ln') return 1.0;
      return 0.6;
    }
    i++;
    if (ch === '^' || ch === '_') { const w = group() * 0.72; prevOpen = false; return w; }
    if (ch === ' ') return 0;
    const wasOpen = prevOpen;
    prevOpen = '+-=:(['.includes(ch);
    if (/[0-9]/.test(ch)) return 0.5;
    if (/[a-zA-Z]/.test(ch)) return 0.55;
    if (ch === ',' || ch === '.') return 0.28;
    if (ch === '+' || ch === '-') return wasOpen ? 0.78 : 1.22;
    if (ch === '=') return 1.33;
    if (ch === ':') return 0.83;
    if ('()[]'.includes(ch)) return parenEm;
    if (ch === '|') return 0.28;
    return 0.5;
  }

  function seq(stop) {
    let w = 0;
    while (i < s.length && s[i] !== stop) w += atom();
    return w;
  }

  return Math.round(seq(null) * 100) / 100;
}

/** Высокая ли запись (дробная черта) — в столбце подсказок ей нужна двойная строка. */
export const isTallTex = (tex) => /\\[dt]?frac/.test(String(tex));

// ─── Пул и раздача ───────────────────────────────────────────────────────────

/**
 * Пример годится в клетку подсказки: одни числа, без слов и букв
 * («(2a)³ : a⁶, a ≠ 0» — задание на преобразование, а не на счёт).
 */
export function isPlainNumeric(tex) {
  const s = String(tex);
  if (/\\text|\\neq|\\pi|,\\ /.test(s)) return false;
  return !/[a-zA-Z]/.test(s.replace(/\\[a-zA-Z]+/g, ''));
}

function integerValue(resultLatex) {
  const a = String(resultLatex ?? '').replace(/[{}\s]/g, '');
  return /^\d+$/.test(a) ? Number(a) : null;
}

/** Включённые категории `{ section, cat }` из словаря настроек. */
export function enabledCategories(categories = DEFAULT_CLUE_CATEGORIES) {
  const out = [];
  for (const [key, on] of Object.entries(categories)) {
    if (!on) continue;
    const [section, cat] = key.split('.');
    const s = SECTION_BY_KEY[section];
    if (s && s.labels[cat]) out.push({ section, cat, target: Boolean(s.target) });
  }
  return out;
}

/**
 * Пул примеров из генераторов разделов: значение → список заданий.
 * `tries` — сколько раз гонять каждую категорию.
 */
export function buildPool(cats, level, { tries = 60, maxValue = MAX_CLUE } = {}) {
  const pool = new Map();
  const seen = new Set();
  for (const { section, cat, target } of cats) {
    if (target) continue;
    const gen = SECTION_BY_KEY[section].generators[cat];
    for (let t = 0; t < tries; t++) {
      let q;
      try { q = gen(level); } catch { q = null; }
      if (!q?.exprLatex || !isPlainNumeric(q.exprLatex) || seen.has(q.exprLatex)) continue;
      const v = integerValue(q.resultLatex);
      if (v == null || v < 1 || v > maxValue) continue;
      seen.add(q.exprLatex);
      if (!pool.has(v)) pool.set(v, []);
      pool.get(v).push({ exprLatex: q.exprLatex, resultLatex: String(v), value: v, cat: catKey(section, cat) });
    }
  }
  return pool;
}

function fits(item, limit) {
  if (!limit) return true;
  const em = texWidthEm(item.exprLatex);
  if (em > limit.em) return false;
  if (limit.noTall && isTallTex(item.exprLatex)) return false;
  return true;
}

/**
 * Один пример на число `v`. Сначала — случайная включённая категория (пул или
 * «от ответа»), без повторов внутри варианта (`used`); не нашлось — добор
 * разделом «Целые числа». Последний рубеж — само число (`fallback: 'number'`).
 */
function pickTask(v, { cats, pool, level, used, limit }) {
  const order = [...cats].sort(() => Math.random() - 0.5);
  for (const c of order) {
    if (c.target) {
      for (let t = 0; t < 6; t++) {
        const q = targetTask(c.cat, v, level);
        if (q && !used.has(q.exprLatex) && fits(q, limit)) return q;
      }
    } else {
      const list = (pool.get(v) || []).filter(q => q.cat === catKey(c.section, c.cat)
        && !used.has(q.exprLatex) && fits(q, limit));
      if (list.length) return rand(list);
    }
  }
  // Добор: «Целые числа», от уровня вниз — короче запись
  for (let lv = level; lv >= 1; lv--) {
    for (const cat of Object.keys(INT_TARGETS).sort(() => Math.random() - 0.5)) {
      for (let t = 0; t < 4; t++) {
        const q = targetTask(cat, v, lv);
        if (q && !used.has(q.exprLatex) && fits(q, limit)) return { ...q, fallback: 'int' };
      }
    }
  }
  // Узкая клетка: самая короткая запись
  for (let t = 0; t < 12; t++) {
    const q = shortTask(v);
    if (q && !used.has(q.exprLatex) && fits(q, limit)) return { ...q, fallback: 'int' };
  }
  // Повтор лучше, чем голое число
  const repeat = (pool.get(v) || []).find(q => fits(q, limit));
  if (repeat) return { ...repeat, repeated: true };
  return { exprLatex: String(v), resultLatex: String(v), value: v, cat: 'number', fallback: 'number' };
}

/**
 * Варианты подсказок для одной картинки: числа у всех вариантов одни и те же
 * (ключ один), запись — разная.
 *
 * `limits` — `{ row: {em, noTall}, col: {em, noTall} }`: сколько em влезает в
 * отдельное выражение в списке строк и столбцов (считает раскладка листа).
 * Результат: `{ variants: [{ rows: Item[][], cols: Item[][] }], stats }`.
 */
export function buildClueVariants(clues, {
  categories = DEFAULT_CLUE_CATEGORIES,
  level = 1,
  variantsCount = 1,
  limits = null,
} = {}) {
  const cats = enabledCategories(categories);
  const useCats = cats.length ? cats : enabledCategories(DEFAULT_CLUE_CATEGORIES);
  const pool = buildPool(useCats, level);
  const stats = { total: 0, fallback: 0, numbers: 0, repeated: 0 };
  const variants = [];
  for (let n = 0; n < Math.max(1, variantsCount); n++) {
    const used = new Set();
    const side = (lines, limit) => lines.map(line => line.map(v => {
      const q = pickTask(v, { cats: useCats, pool, level, used, limit });
      used.add(q.exprLatex);
      stats.total++;
      if (q.fallback === 'int') stats.fallback++;
      if (q.fallback === 'number') stats.numbers++;
      if (q.repeated) stats.repeated++;
      return q;
    }));
    variants.push({
      rows: side(clues.rows, limits?.row),
      cols: side(clues.cols, limits?.col),
    });
  }
  return { variants, stats };
}

/** Самая широкая запись среди подсказок одной стороны варианта, em. */
export function widestEm(lines) {
  let w = 0;
  for (const line of lines) for (const q of line) w = Math.max(w, texWidthEm(q.exprLatex));
  return w;
}
