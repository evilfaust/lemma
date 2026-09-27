// Строка команд редактора ⇄ операции журнала.
//
// Учитель строит на уроке, поэтому разбор прощающий: русская раскладка
// («М» кириллицей = M), знаки ∩ / × / x, отношение «1:2», дробь «1/3»,
// «середина». Эта же грамматика — будущий текстовый DSL для теории и листов.
//
//   M на AA1 1:2        точка на ребре (AM : MA1 = 1 : 2)
//   M на AA1            середина
//   MN | отрезок MN     отрезок
//   прямая MN           прямая
//   X = MN ∩ AC         пересечение прямых (или «MN x AC» — имя подберётся)
//   X = MN ∩ (ABC)      след прямой на плоскости; «след MN ABCD»
//   прямая K || AB      параллельная через точку
//   сечение MND         сечение плоскостью по трём точкам
//   грань ABCD          подсветить грань / «плоскость AA1C1C»
//   заливка KLMN        закрасить многоугольник
//   отмена              убрать последний шаг
//   переименовать M K   переименовать точку

import { prettyName } from './bodies';
import { newOpId, refName } from './scene';
import { colorKeyFromWord } from './render';
import { nextFreeName } from './naming';

const CYR_TO_LAT = {
  А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', О: 'O', Р: 'P', Т: 'T', Х: 'X', У: 'Y',
};

// Латинские служебные слова; всё остальное латиницей — имена точек.
const LATIN_WORDS = new Set([
  'seg', 'segment', 'line', 'par', 'section', 'plane', 'face', 'fill', 'rename',
  'undo', 'on', 'in', 'mid', 'midpoint', 't', 'x',
  'color', 'red', 'blue', 'green', 'orange', 'violet', 'purple', 'black',
]);

/**
 * Кириллица-двойник → латиница (только заглавные — строчные это слова),
 * имена точек, набранные строчными, — заглавными («mn» → «MN»).
 */
export function normalizeCommand(text) {
  return String(text || '')
    .replace(/[АВСЕНКМОРТХУ]/g, (c) => CYR_TO_LAT[c])
    .replace(/[₀-₉]/g, (c) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c)))
    .replace(/\b[a-z][a-z0-9]*\b/g, (w) => (LATIN_WORDS.has(w) ? w : w.toUpperCase()))
    .replace(/∥/g, '||')
    .replace(/\s*\|\|\s*/g, '||') // «(P || AB)» → «(P||AB)»: ссылка на параллельную — одним словом
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- ссылка на прямую текстом -------------------------------------------------
//
// Прямая — пара точек («AB») или параллельная, построенная шагом: её пишем
// выражением «(P||AB)» — «прямая через P, параллельная AB» (вложенно:
// «(Q||(P||AB))»). Так точка на параллельной, пересечение с ней и след
// выгружаются в текст и читаются обратно.

/** Ссылка на прямую → текст; null — не выражается. */
export function lineRefText(ref, opsById = {}) {
  if (Array.isArray(ref)) return ref.length === 2 ? ref.join('') : null;
  const op = opsById[ref];
  if (op?.type !== 'parallel') return null;
  const base = lineRefText(op.ref, opsById);
  return base ? `(${op.through}||${base})` : null;
}

const sameLineRef = (a, b) => (Array.isArray(a) && Array.isArray(b)
  ? a.length === 2 && b.length === 2 && ((a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]))
  : a === b);

/** Текст ссылки на прямую → пара имён или id шага «параллельная». */
export function parseLineRef(tok, model, what = 'Прямая — две точки: «AB» или параллельная «(P||AB)»') {
  const t = String(tok || '');
  if (!t.includes('||')) {
    const n = splitNames(t);
    if (!n || n.length !== 2) throw new Error(what);
    return n;
  }
  const m = /^\(([A-Z][0-9]*)\|\|(.+)\)$/.exec(t);
  if (!m) throw new Error('Параллельная прямая пишется так: «(P||AB)» — через P параллельно AB');
  const base = parseLineRef(m[2], model, what);
  const op = Object.values(model?.opsById || {}).find((o) => o.type === 'parallel' && o.through === m[1] && sameLineRef(o.ref, base));
  if (!op) {
    const bt = Array.isArray(base) ? base.map(prettyName).join('') : m[2];
    throw new Error(`Нет прямой через ${prettyName(m[1])} ∥ ${bt} — сначала «прямая ${m[1]} || ${Array.isArray(base) ? base.join('') : m[2]}»`);
  }
  return op.id;
}

/** Плоскость в команде: «(ABC)» или три и больше точек (но не «(P||AB)»). */
const isPlaneTok = (t) => !String(t).includes('||') && (/^\(/.test(t) || (splitNames(t)?.length || 0) >= 3);

/** Имя точки, набранное как угодно («м», «m1», «К») → «M», «M1», «K». */
export function normalizePointName(text) {
  return String(text || '')
    .trim()
    .toUpperCase()
    .replace(/[АВСЕНКМОРТХУ]/g, (c) => CYR_TO_LAT[c])
    .replace(/[₀-₉]/g, (c) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c)));
}

/** «AA1C1C» → ['A','A1','C1','C']; null, если это не список имён. */
export function splitNames(s) {
  const str = String(s || '').replace(/[()]/g, '');
  if (!/^(?:[A-Z][0-9]*)+$/.test(str)) return null;
  return str.match(/[A-Z][0-9]*/g);
}

/** Положение точки на отрезке: «1:2», «1/3», «0,25», «середина». */
export function parsePosition(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(',', '.');
  if (!s || /^(середина|сер|mid|midpoint|½)$/.test(s)) return { t: 0.5, ratio: [1, 1] };
  let m = /^(-?\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a + b === 0) return null;
    return { t: a / (a + b), ratio: [a, b] };
  }
  m = /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(s);
  if (m) {
    const b = Number(m[2]);
    return b ? { t: Number(m[1]) / b } : null;
  }
  m = /^(?:t\s*=\s*)?(-?\d+(?:\.\d+)?)$/.exec(s);
  if (m) return { t: Number(m[1]) };
  return null;
}

const OP_RE = '(?:∩|×|\\^|(?<![A-Za-z0-9])[xх](?![A-Za-z0-9])|пересеч[а-яё]*(?:\\s+с)?)';

/**
 * Разбирает команду в операцию.
 * @returns {{ op } | { action: 'undo' } | { action: 'rename', from, to }
 *   | { action: 'color', names, lines?, segments?, color } | { error }}
 */
export function parseCommand(text, model) {
  const src = normalizeCommand(text);
  if (!src) return { error: 'Пустая команда' };
  const low = src.toLowerCase();
  const auto = (name) => name || nextFreeName(model);
  const need = (names, n, what) => {
    if (!names || names.length !== n) throw new Error(what);
    return names;
  };

  try {
    if (/^(отмена|отменить|undo|назад)$/.test(low)) return { action: 'undo' };

    let m = /^(?:переименовать|rename)\s+([A-Z][0-9]*)\s+(?:в\s+)?([A-Z][0-9]*)$/.exec(src);
    if (m) return { action: 'rename', from: m[1], to: m[2] };

    // «цвет прямой AB красный» — прямая целиком (с продолжениями);
    // «цвет отрезка AM синий», «цвет отрезков AM, BK …» — только кусок.
    m = /^(?:цвет|color)\s+(прям|отрез|лини|line|seg)[а-яёa-z]*\s+(.+?)\s+(\S+)$/i.exec(src);
    if (m) {
      const isSeg = /^(отрез|seg)/i.test(m[1]);
      const pairs = m[2].split(/[\s,;]+/).filter(Boolean).map(splitNames);
      if (!pairs.length || pairs.some((n) => !n || n.length !== 2)) {
        throw new Error(isSeg ? 'Отрезок — двумя точками: «цвет отрезка AM красный»' : 'Прямая — двумя точками: «цвет прямой AB красный»');
      }
      const color = colorKeyFromWord(m[3]);
      if (color == null) throw new Error('Цвета: красный, синий, зелёный, оранжевый, фиолетовый; «нет» — снять');
      return isSeg
        ? { action: 'color', names: [], segments: pairs, color }
        : { action: 'color', names: [], lines: pairs, color };
    }

    // «цвет MNB красный» — выделить точки (оформление, не шаг); «… нет» — снять.
    m = /^(?:цвет|color)\s+(?:точ[а-яё]*\s+)?(\S+)\s+(\S+)$/i.exec(src);
    if (m) {
      const names = splitNames(m[1]);
      if (!names) throw new Error('Цвет: «цвет MNB красный»');
      const color = colorKeyFromWord(m[2]);
      if (color == null) throw new Error('Цвета: красный, синий, зелёный, оранжевый, фиолетовый; «нет» — снять');
      return { action: 'color', names, color };
    }

    // «середина AB», «K = середина AB» — точка посередине двух точек.
    m = /^(?:([A-Z][0-9]*)\s*=\s*)?(?:середина|mid(?:point)?)\s+(?:отрезка\s+)?(\S+)$/i.exec(src);
    if (m) {
      const n = need(splitNames(m[2]), 2, 'Середина — двух точек: «середина AB»');
      return { op: { id: newOpId(), type: 'pointOnLine', name: auto(m[1]), ref: n, t: 0.5, ratio: [1, 1] } };
    }

    m = /^(?:отрезок|seg(?:ment)?)\s+(\S+)$/i.exec(src);
    if (m) {
      const n = need(splitNames(m[1]), 2, 'Отрезок задаётся двумя точками: «отрезок MN»');
      return { op: { id: newOpId(), type: 'segment', ref: n } };
    }

    m = /^(?:прямая|line)\s+(?:через\s+)?([A-Z][0-9]*)\s*(?:\|\||∥|параллельно|par)\s*(\S+)$/i.exec(src)
      || /^(?:через\s+)?([A-Z][0-9]*)\s*(?:\|\||∥|параллельно)\s*(\S+)$/i.exec(src);
    if (m) {
      const n = parseLineRef(m[2], model, 'Параллельно прямой из двух точек: «прямая K || AB»');
      return { op: { id: newOpId(), type: 'parallel', through: m[1], ref: n } };
    }

    m = /^(?:прямая|line)\s+(\S+)$/i.exec(src);
    if (m) {
      const n = need(splitNames(m[1]), 2, 'Прямая задаётся двумя точками: «прямая MN»');
      return { op: { id: newOpId(), type: 'line', ref: n } };
    }

    m = /^(?:сечение|section)\s+(\S+)$/i.exec(src);
    if (m) {
      const n = splitNames(m[1]);
      if (!n || n.length < 3) throw new Error('Сечение задаётся тремя точками: «сечение MND»');
      return { op: { id: newOpId(), type: 'section', pts: n } };
    }

    m = /^(?:плоскость|грань|plane|face)\s+(\S+)$/i.exec(src);
    if (m) {
      const n = splitNames(m[1]);
      if (!n || n.length < 3) throw new Error('Плоскость задаётся тремя точками: «плоскость AA1C»');
      return { op: { id: newOpId(), type: 'plane', pts: n } };
    }

    m = /^(?:заливка|залить|многоугольник|fill)\s+(\S+)$/i.exec(src);
    if (m) {
      const n = splitNames(m[1]);
      if (!n || n.length < 3) throw new Error('Многоугольник — не меньше трёх точек: «заливка KLMN»');
      return { op: { id: newOpId(), type: 'fill', pts: n } };
    }

    m = /^(?:след)\s+(?:прямой\s+)?(\S+)\s+(?:на\s+)?(?:плоскости\s+)?(\S+)$/i.exec(src);
    if (m) {
      const l = parseLineRef(m[1], model, 'След: «след MN ABCD»');
      const pl = splitNames(m[2]);
      if (!pl || pl.length < 3) throw new Error('Плоскость следа — три точки: «след MN ABCD»');
      return { op: { id: newOpId(), type: 'trace', name: auto(null), ref: l, plane: pl } };
    }

    const OPERAND = '(\\([A-Z0-9|()]+\\)|[A-Z0-9]+)';
    m = new RegExp(`^(?:([A-Z][0-9]*)\\s*=\\s*)?${OPERAND}\\s*${OP_RE}\\s*${OPERAND}$`).exec(src);
    if (m) {
      const rightPlane = isPlaneTok(m[3]);
      const leftPlane = isPlaneTok(m[2]);
      if (leftPlane && !rightPlane) {
        const left = splitNames(m[2]);
        if (!left || left.length < 3) throw new Error('Плоскость — три точки: «(ABC) ∩ MN»');
        const ref = parseLineRef(m[3], model, 'Прямая — две точки');
        return { op: { id: newOpId(), type: 'trace', name: auto(m[1]), ref, plane: left } };
      }
      const l1 = parseLineRef(m[2], model, 'Прямая — две точки: «MN ∩ AC»');
      if (rightPlane) {
        const right = splitNames(m[3]);
        if (!right || right.length < 3) throw new Error('Плоскость — три точки: «MN ∩ (ABC)»');
        return { op: { id: newOpId(), type: 'trace', name: auto(m[1]), ref: l1, plane: right } };
      }
      const l2 = parseLineRef(m[3], model, 'Прямая — две точки: «MN ∩ AC»');
      return { op: { id: newOpId(), type: 'intersect', name: auto(m[1]), l1, l2 } };
    }

    m = /^(?:точка\s+)?(?:([A-Z][0-9]*)\s+)?(?:в\s+грани|в\s+плоскости|on\s+face)\s+(\S+)\s+(-?\d+(?:[.,]\d+)?)\s+(-?\d+(?:[.,]\d+)?)$/i.exec(src);
    if (m) {
      const face = splitNames(m[2]);
      if (!face || face.length < 3) throw new Error('Грань — не меньше трёх точек: «K в грани ABB1A1 0,3 0,4»');
      return {
        op: {
          id: newOpId(), type: 'pointOnFace', name: auto(m[1]), face,
          s: Number(m[3].replace(',', '.')), t: Number(m[4].replace(',', '.')),
        },
      };
    }

    m = /^(?:точка\s+)?(?:([A-Z][0-9]*)\s+)?(?:на|∈|on|in)\s+(\S+)\s*(.*)$/i.exec(src);
    if (m) {
      const ref = parseLineRef(m[2], model, 'Точка на отрезке из двух точек: «M на AA1 1:2»');
      const pos = parsePosition(m[3]);
      if (!pos) throw new Error('Положение: «1:2», «1/3», «0,25» или «середина»');
      const op = { id: newOpId(), type: 'pointOnLine', name: auto(m[1]), ref, t: pos.t };
      // Отношение — к двум точкам; на параллельной (без второй точки) — только доля.
      if (pos.ratio && Array.isArray(ref)) op.ratio = pos.ratio;
      return { op };
    }

    const names = splitNames(src);
    if (names && names.length === 2) return { op: { id: newOpId(), type: 'segment', ref: names } };
    if (names && names.length >= 3) {
      throw new Error(`Что сделать с ${names.map(prettyName).join('')}? Например: «сечение ${src}» или «грань ${src}»`);
    }
    throw new Error('Не понял команду. Примеры: «M на AA1 1:2», «MN», «X = MN ∩ AC», «сечение MND»');
  } catch (e) {
    return { error: e.message };
  }
}

const fmt = (x) => {
  const r = Math.round(x * 1000) / 1000;
  return String(r).replace('.', ',');
};

/** Человеческое описание шага журнала. */
export function describeOp(op, opsById = {}) {
  const P = prettyName;
  const names = (arr) => (arr || []).map(P).join('');
  switch (op?.type) {
    case 'pointOnLine': {
      const [a, b] = op.ref || [];
      const base = `${P(op.name)} ∈ ${Array.isArray(op.ref) ? names(op.ref) : refName(op.ref, opsById)}`;
      if (op.ratio && Array.isArray(op.ref)) {
        if (op.ratio[0] === op.ratio[1]) return `${base}, середина`;
        return `${base}, ${P(a)}${P(op.name)} : ${P(op.name)}${P(b)} = ${fmt(op.ratio[0])} : ${fmt(op.ratio[1])}`;
      }
      if (Math.abs(op.t - 0.5) < 1e-9) return `${base}, середина`;
      if (op.t < 0 || op.t > 1) return `${base} (на продолжении)`;
      return base;
    }
    case 'pointOnFace': return `${P(op.name)} ∈ (${names(op.face)})`;
    case 'segment': return `Отрезок ${names(op.ref)}`;
    case 'line': return `Прямая ${names(op.ref)}`;
    case 'parallel': return `Прямая через ${P(op.through)} ∥ ${refName(op.ref, opsById)}`;
    case 'intersect': return `${P(op.name)} = ${refName(op.l1, opsById)} ∩ ${refName(op.l2, opsById)}`;
    case 'trace': return `${P(op.name)} = ${refName(op.ref, opsById)} ∩ (${names(op.plane)})`;
    case 'section': return `Сечение (${names(op.pts)})`;
    case 'plane': return `Плоскость (${names(op.pts)})`;
    case 'fill': return `Многоугольник ${names(op.pts)}`;
    default: return String(op?.type || '?');
  }
}

const fmtDot = (x) => String(Math.round(Number(x) * 1000) / 1000);

/** Операция обратно в строку команды (для правки шага и будущего DSL). */
export function opToCommand(op, opsById = {}) {
  // Ссылка на прямую — пара имён или параллельная «(P||AB)»; что текстом не
  // выражается, отдаётся пустой строкой (а не падает).
  const n = (arr) => (Array.isArray(arr) ? arr.join('') : '');
  const r = (ref) => lineRefText(ref, opsById);
  switch (op?.type) {
    case 'pointOnLine': {
      if (!r(op.ref)) return '';
      const pos = op.ratio && Array.isArray(op.ref) ? `${op.ratio[0]}:${op.ratio[1]}` : fmt(op.t);
      return `${op.name} на ${r(op.ref)} ${pos}`;
    }
    case 'pointOnFace': return `${op.name} в грани ${n(op.face)} ${fmtDot(op.s)} ${fmtDot(op.t)}`;
    case 'segment': return Array.isArray(op.ref) ? `отрезок ${n(op.ref)}` : '';
    case 'line': return Array.isArray(op.ref) ? `прямая ${n(op.ref)}` : '';
    case 'parallel': return r(op.ref) ? `прямая ${op.through} || ${r(op.ref)}` : '';
    case 'intersect':
      return r(op.l1) && r(op.l2) ? `${op.name} = ${r(op.l1)} ∩ ${r(op.l2)}` : '';
    case 'trace': return r(op.ref) ? `${op.name} = ${r(op.ref)} ∩ (${n(op.plane)})` : '';
    case 'section': return `сечение ${n(op.pts)}`;
    case 'plane': return `плоскость ${n(op.pts)}`;
    case 'fill': return `заливка ${n(op.pts)}`;
    default: return '';
  }
}
