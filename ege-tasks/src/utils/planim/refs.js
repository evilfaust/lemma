// Ссылки на прямые и окружности — выражениями, а не id шагов.
//
// Прямая:
//   ['A', 'B']                          через две точки
//   { k: 'par',  p: 'P', ref }          через P параллельно ref
//   { k: 'perp', p: 'P', ref }          через P перпендикулярно ref
//   { k: 'bis',  pts: ['A', 'V', 'B'] } биссектриса угла AVB (вершина V)
// Окружность:
//   { k: 'cp', o: 'O', a: 'A' }         центр O, проходит через A
//   { k: 'cr', o: 'O', r: 3 }           центр O, радиус 3
//   { k: 'circum', pts: [A, B, C] }     описанная около треугольника
//   { k: 'in', pts: [A, B, C] }         вписанная в треугольник
//
// Выражение самодостаточно: шаг ссылается только на ИМЕНА ТОЧЕК, поэтому
// удаление с зависимыми, переименование и выгрузка в текст не знают об id.
// Текстом: «AB», «(P||AB)», «(P⊥AB)», «(бис AVB)», «окр(O,A)», «окр(O,3)»,
// «окр(ABC)», «впис(ABC)»; «окр(O)» — уже нарисованная окружность с центром O.

export const NAME_RE = /^[A-Z][0-9]*$/;
const NAME = '[A-Z][0-9]*';

export const isPairRef = (r) => Array.isArray(r) && r.length === 2;
export const isCircleRef = (r) => !!r && !Array.isArray(r) && ['cp', 'cr', 'circum', 'in'].includes(r.k);

/** «A1» → «A₁» */
export function prettyName(name) {
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  return String(name).replace(/\d/g, (d) => SUB[Number(d)]);
}

/** «AA1C1C» → ['A','A1','C1','C']; null — это не список имён. */
export function splitNames(s) {
  const str = String(s || '').replace(/[()]/g, '');
  if (!new RegExp(`^(?:${NAME})+$`).test(str)) return null;
  return str.match(new RegExp(NAME, 'g'));
}

/** Все имена точек, на которые опирается выражение. */
export function refNames(ref) {
  if (!ref) return [];
  if (Array.isArray(ref)) return [...ref];
  switch (ref.k) {
    case 'par':
    case 'perp': return [ref.p, ...refNames(ref.ref)];
    case 'bis':
    case 'circum':
    case 'in': return [...(ref.pts || [])];
    case 'cp': return [ref.o, ref.a];
    case 'cr': return [ref.o];
    default: return [];
  }
}

/** Выражение с переименованными точками. */
export function mapRefNames(ref, fn) {
  if (!ref) return ref;
  if (Array.isArray(ref)) return ref.map(fn);
  switch (ref.k) {
    case 'par':
    case 'perp': return { ...ref, p: fn(ref.p), ref: mapRefNames(ref.ref, fn) };
    case 'bis':
    case 'circum':
    case 'in': return { ...ref, pts: ref.pts.map(fn) };
    case 'cp': return { ...ref, o: fn(ref.o), a: fn(ref.a) };
    case 'cr': return { ...ref, o: fn(ref.o) };
    default: return ref;
  }
}

const num = (x) => String(Math.round(Number(x) * 10000) / 10000);

/** Канонический ключ прямой: «AB» и «BA» — одна прямая. */
export function lineRefKey(ref) {
  if (Array.isArray(ref)) return [...ref].sort().join('-');
  switch (ref?.k) {
    case 'par': return `par(${ref.p},${lineRefKey(ref.ref)})`;
    case 'perp': return `perp(${ref.p},${lineRefKey(ref.ref)})`;
    case 'bis': return `bis(${[ref.pts[0], ref.pts[2]].sort().join(',')};${ref.pts[1]})`;
    default: return '?';
  }
}

/** Канонический ключ окружности. */
export function circleRefKey(ref) {
  switch (ref?.k) {
    case 'cp': return `cp(${ref.o},${ref.a})`;
    case 'cr': return `cr(${ref.o},${num(ref.r)})`;
    case 'circum': return `circum(${[...ref.pts].sort().join(',')})`;
    case 'in': return `in(${[...ref.pts].sort().join(',')})`;
    default: return '?';
  }
}

/** Прямая → текст команды; null — не выражается. */
export function lineRefText(ref) {
  if (Array.isArray(ref)) return ref.length === 2 ? ref.join('') : null;
  switch (ref?.k) {
    case 'par': { const b = lineRefText(ref.ref); return b ? `(${ref.p}||${b})` : null; }
    case 'perp': { const b = lineRefText(ref.ref); return b ? `(${ref.p}⊥${b})` : null; }
    case 'bis': return `(бис ${ref.pts.join('')})`;
    default: return null;
  }
}

/** Окружность → текст команды. */
export function circleRefText(ref) {
  switch (ref?.k) {
    case 'cp': return `окр(${ref.o},${ref.a})`;
    case 'cr': return `окр(${ref.o};${num(ref.r).replace('.', ',')})`;
    case 'circum': return `окр(${ref.pts.join('')})`;
    case 'in': return `впис(${ref.pts.join('')})`;
    default: return null;
  }
}

/** Прямая по-человечески: «AB», «через P ∥ AB». */
export function lineRefPretty(ref) {
  const P = prettyName;
  if (Array.isArray(ref)) return ref.map(P).join('');
  switch (ref?.k) {
    case 'par': return `через ${P(ref.p)} ∥ ${lineRefPretty(ref.ref)}`;
    case 'perp': return `через ${P(ref.p)} ⊥ ${lineRefPretty(ref.ref)}`;
    case 'bis': return `биссектриса ∠${ref.pts.map(P).join('')}`;
    default: return '?';
  }
}

/** Окружность по-человечески. */
export function circleRefPretty(ref) {
  const P = prettyName;
  switch (ref?.k) {
    case 'cp': return `окружность (${P(ref.o)}; ${P(ref.o)}${P(ref.a)})`;
    case 'cr': return `окружность (${P(ref.o)}; ${num(ref.r).replace('.', ',')})`;
    case 'circum': return `описанная окружность △${ref.pts.map(P).join('')}`;
    case 'in': return `вписанная окружность △${ref.pts.map(P).join('')}`;
    default: return '?';
  }
}

/** Похоже ли слово на ссылку на окружность. */
export const isCircleTok = (tok) => /^(?:окр|впис)[а-яё]*\(/i.test(String(tok || ''));

/**
 * Текст → прямая. Пробелы внутри скобок к этому моменту убраны
 * (normalizeCommand): «(бисAVB)», «(P||AB)».
 */
export function parseLineRef(tok, what = 'Прямая — две точки: «AB», параллельная «(P||AB)», перпендикуляр «(P⊥AB)» или биссектриса «(бис ABC)»') {
  const t = String(tok || '');
  let m = new RegExp(`^\\(бис[а-яё]*((?:${NAME}){3})\\)$`, 'i').exec(t);
  if (m) return { k: 'bis', pts: splitNames(m[1]) };
  m = new RegExp(`^\\((${NAME})(\\|\\||⊥)(.+)\\)$`).exec(t);
  if (m) return { k: m[2] === '⊥' ? 'perp' : 'par', p: m[1], ref: parseLineRef(m[3], what) };
  const n = splitNames(t);
  if (!n || n.length !== 2) throw new Error(what);
  return n;
}

/**
 * Текст → окружность. «окр(O)» ищет уже нарисованную окружность с центром O
 * (последнюю), поэтому нужен model.
 */
export function parseCircleRef(tok, model) {
  const t = String(tok || '');
  let m = /^впис[а-яё]*\((.+)\)$/i.exec(t);
  if (m) {
    const n = splitNames(m[1]);
    if (!n || n.length !== 3) throw new Error('Вписанная окружность — по трём вершинам: «впис(ABC)»');
    return { k: 'in', pts: n };
  }
  m = /^окр[а-яё]*\((.+)\)$/i.exec(t);
  if (!m) throw new Error('Окружность пишется так: «окр(O,A)», «окр(O;3)», «окр(ABC)» или «окр(O)»');
  const inner = m[1];
  let q = new RegExp(`^(${NAME})[,;](${NAME})$`).exec(inner);
  if (q) return { k: 'cp', o: q[1], a: q[2] };
  q = new RegExp(`^(${NAME})[,;](\\d+(?:[.,]\\d+)?)$`).exec(inner);
  if (q) return { k: 'cr', o: q[1], r: Number(q[2].replace(',', '.')) };
  const n = splitNames(inner);
  if (n && n.length === 3) return { k: 'circum', pts: n };
  if (n && n.length === 1) {
    const found = [...(model?.circles || [])].reverse().find((c) => c.centerName === n[0]);
    if (!found) throw new Error(`Нет окружности с центром ${prettyName(n[0])}`);
    return found.ref;
  }
  throw new Error('Окружность пишется так: «окр(O,A)», «окр(O;3)», «окр(ABC)» или «окр(O)»');
}
