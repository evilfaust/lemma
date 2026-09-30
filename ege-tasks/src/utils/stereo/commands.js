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
//   H = M ⊥ AB          перпендикуляр из точки на прямую (основание H)
//   H = M ⊥ (ABC)       перпендикуляр из точки на плоскость; «перпендикуляр M ABC»
//   A ⊥ (ABC)           из точки самой плоскости — прямая, дальше «(A⊥ABC)»
//   M ⊥ AC в ABC        из точки на прямой — в плоскости, дальше «(M⊥AC в ABC)»
//   сечение M ⊥ BD1     сечение плоскостью через M перпендикулярно BD1
//   плоскость AB ⊥ (SCD) плоскость через AB перпендикулярно (SCD);
//                        дальше на неё ссылаются «(M⊥BD1)», «(AB⊥SCD)»
//   угол SA (ABC)       угол между прямой и плоскостью: проекция, дуга
//   сечение MND         сечение плоскостью по трём точкам
//   грань ABCD          подсветить грань / «плоскость AA1C1C»
//   заливка KLMN        закрасить многоугольник
//   отмена              убрать последний шаг
//   переименовать M K   переименовать точку

import { prettyName } from './bodies';
import {
  newOpId, refName, planeName, pointInPlane, pointOnLineRef, makeAngleOp, evaluateScene,
} from './scene';
import { colorKeyFromWord } from './render';
import { nextFreeName, nextFootName } from './naming';

const CYR_TO_LAT = {
  А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', О: 'O', Р: 'P', Т: 'T', Х: 'X', У: 'Y',
};

// Латинские служебные слова; всё остальное латиницей — имена точек.
const LATIN_WORDS = new Set([
  'seg', 'segment', 'line', 'par', 'perp', 'angle', 'section', 'plane', 'face', 'fill', 'rename',
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
    .replace(/\s*⊥\s*/g, '⊥') // «M ⊥ (ABC)» → «M⊥(ABC)»
    // Ссылка «(M⊥AC в ABC)» — тоже одним словом: «(M⊥ACвABC)».
    .replace(/\(\s*([A-Z][0-9]*⊥(?:\([^()]*\)|[^()\s])+)\s+в\s+\(?([A-Z0-9]+)\)?\s*\)/g, '($1в$2)')
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
// выгружаются в текст и читаются обратно. Перпендикуляр к плоскости,
// восставленный из её точки, — «(P⊥ABC)», перпендикуляр к прямой из её
// точки в плоскости — «(M⊥AC в ABC)».
//
// Плоскость — три и больше точек («ABC», «(ABC)») или перпендикулярная
// плоскость, построенная шагом: «(M⊥BD1)» — через M перпендикулярно BD1,
// «(AB⊥SCD)» — через AB перпендикулярно (SCD). Что за «⊥» — прямая или
// плоскость, — видно по сторонам: точка ⊥ плоскость = прямая, точка ⊥
// прямая = плоскость, прямая ⊥ плоскость = плоскость (refKind).

/** «(X⊥Y)» с этим ⊥ в начале; null — не такая запись. */
const PERP_TOK = /^\(((?:[A-Z][0-9]*)+)⊥(.+)\)$/;

/**
 * Что обозначает текст: прямую или плоскость.
 * @returns {'line' | 'plane' | null}
 */
export function refKind(tok) {
  const t = String(tok || '');
  if (/^\([A-Z][0-9]*\|\|/.test(t)) return 'line';
  const m = PERP_TOK.exec(t);
  if (m) {
    const head = splitNames(m[1])?.length || 0;
    if (head === 2) return 'plane';
    if (head !== 1) return null;
    // «(M⊥AC в ABC)» — прямая в плоскости.
    if (/^(?:(?:[A-Z][0-9]*){2}|\([^()]*\))в/.test(m[2])) return 'line';
    return refKind(m[2]) === 'plane' ? 'line' : 'plane';
  }
  const n = splitNames(t)?.length || 0;
  if (n === 2) return 'line';
  return n >= 3 ? 'plane' : null;
}

/** Ссылка на плоскость → текст (имена — без скобок); null — не выражается. */
export function planeRefText(ref, opsById = {}) {
  if (Array.isArray(ref)) return ref.join('');
  const op = opsById[ref];
  if (op?.type !== 'perpPlane') return null;
  if (op.from) {
    const base = lineRefText(op.ref, opsById);
    return base ? `(${op.from}⊥${base})` : null;
  }
  const pl = planeRefText(op.plane, opsById);
  return Array.isArray(op.line) && pl ? `(${op.line.join('')}⊥${pl})` : null;
}

/** Плоскость в скобках для команды: «(ABC)», «(M⊥BD1)». */
const planeTokText = (ref, opsById) => {
  const t = planeRefText(ref, opsById);
  if (!t) return null;
  return Array.isArray(ref) ? `(${t})` : t;
};

/** Ссылка на прямую → текст; null — не выражается. */
export function lineRefText(ref, opsById = {}) {
  if (Array.isArray(ref)) return ref.length === 2 ? ref.join('') : null;
  const op = opsById[ref];
  if (op?.type === 'perp' && op.plane) {
    const pl = planeRefText(op.plane, opsById);
    return pl ? `(${op.from}⊥${pl})` : null;
  }
  if (op?.type === 'perp' && op.within) {
    const base = lineRefText(op.ref, opsById);
    const pl = planeRefText(op.within, opsById);
    return base && pl ? `(${op.from}⊥${base} в ${pl})` : null;
  }
  if (op?.type !== 'parallel') return null;
  const base = lineRefText(op.ref, opsById);
  return base ? `(${op.through}||${base})` : null;
}

const sameLineRef = (a, b) => (Array.isArray(a) && Array.isArray(b)
  ? a.length === 2 && b.length === 2 && ((a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]))
  : a === b);

const sameNameSet = (a, b) => a.length === b.length && [...a].sort().join(' ') === [...b].sort().join(' ');

const samePlaneRef = (a, b) => (Array.isArray(a) && Array.isArray(b) ? sameNameSet(a, b) : a === b);

/**
 * Текст плоскости → имена точек или id шага «перпендикулярная плоскость».
 * @param what — текст ошибки, если это не плоскость
 */
export function parsePlaneRef(tok, model, what = 'Плоскость — три точки: «(ABC)»') {
  const t = String(tok || '');
  const m = PERP_TOK.exec(t);
  if (m && refKind(t) === 'plane') {
    const head = splitNames(m[1]);
    const ops = Object.values(model?.opsById || {}).filter((o) => o.type === 'perpPlane' && model.planes?.[o.id]);
    let op;
    if (head.length === 1) {
      const ref = parseLineRef(m[2], model, what);
      op = ops.find((o) => o.from === head[0] && sameLineRef(o.ref, ref));
      if (!op) throw new Error(`Нет плоскости через ${prettyName(head[0])} ⊥ ${m[2]} — сначала «сечение ${head[0]} ⊥ ${m[2]}»`);
    } else {
      const pl = parsePlaneRef(m[2], model, what);
      op = ops.find((o) => sameLineRef(o.line, head) && samePlaneRef(o.plane, pl));
      if (!op) throw new Error(`Нет плоскости через ${head.map(prettyName).join('')} ⊥ ${m[2]} — сначала «плоскость ${head.join('')} ⊥ ${/^\(/.test(m[2]) ? m[2] : `(${m[2]})`}»`);
    }
    return op.id;
  }
  const n = PERP_TOK.test(t) ? null : splitNames(t);
  if (!n || n.length < 3) throw new Error(what);
  return n;
}

/** Текст ссылки на прямую → пара имён или id шага («параллельная», «перпендикуляр к плоскости»). */
export function parseLineRef(tok, model, what = 'Прямая — две точки: «AB» или параллельная «(P||AB)»') {
  const t = String(tok || '');
  const mw = /^\(([A-Z][0-9]*)⊥(.+)в\(?((?:[A-Z][0-9]*){3,})\)?\)$/.exec(t);
  if (mw) {
    const base = parseLineRef(mw[2], model, what);
    const within = splitNames(mw[3]);
    const op = Object.values(model?.opsById || {}).find((o) => o.type === 'perp' && o.within && o.from === mw[1]
      && sameLineRef(o.ref, base) && sameNameSet(o.within, within) && model.lines.some((l) => l.id === o.id));
    if (!op) {
      const bt = Array.isArray(base) ? base.join('') : mw[2];
      throw new Error(`Нет перпендикуляра к ${bt} через ${prettyName(mw[1])} в (${within.map(prettyName).join('')}) — сначала «${mw[1]} ⊥ ${bt} в ${within.join('')}»`);
    }
    return op.id;
  }
  const mp = PERP_TOK.exec(t);
  if (mp && refKind(t) === 'line' && splitNames(mp[1]).length === 1) {
    // Прямая есть только у восставленного перпендикуляра (точка в плоскости);
    // опущенный — обычный отрезок «MH».
    const plane = parsePlaneRef(mp[2], model);
    const op = Object.values(model?.opsById || {}).find((o) => o.type === 'perp' && o.plane && o.from === mp[1]
      && samePlaneRef(o.plane, plane) && model.lines.some((l) => l.id === o.id && l.ref === o.id));
    if (!op) {
      const pt = Array.isArray(plane) ? `(${plane.join('')})` : mp[2];
      throw new Error(`Нет перпендикуляра через ${prettyName(mp[1])} к ${pt} — сначала «${mp[1]} ⊥ ${pt}»`);
    }
    return op.id;
  }
  if (mp && refKind(t) === 'plane') throw new Error(`${t} — это плоскость, а нужна прямая`);
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

/** Плоскость в команде: «(ABC)», три и больше точек или «(M⊥BD1)» (но не «(P||AB)»). */
const isPlaneTok = (t) => refKind(t) === 'plane' || /^\((?:[A-Z][0-9]*)+\)$/.test(String(t));

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

    // «угол SA (ABC)», «угол между SA и ABC» — угол между прямой и плоскостью.
    // Имена новых точек можно задать: «… основание O след X».
    m = /^(?:угол|angle)\s+(?:между\s+)?(?:прям[а-яё]*\s+)?(\S+)\s+(?:и\s+)?(?:плоскост[а-яё]*\s+)?(\S+)((?:\s+(?:основание|след)\s+[A-Z][0-9]*)*)$/i.exec(src);
    if (m) {
      let [, a, b] = m;
      if (isPlaneTok(a) && !isPlaneTok(b)) [a, b] = [b, a];
      if (!isPlaneTok(b)) throw new Error('Угол между прямой и плоскостью: «угол SA (ABC)»');
      const ref = parseLineRef(a, model, 'Угол между прямой и плоскостью: «угол SA (ABC)»');
      const plane = parsePlaneRef(b, model);
      const op = makeAngleOp(model, ref, plane, newOpId());
      for (const [, key, nm] of m[3].matchAll(/(основание|след)\s+([A-Z][0-9]*)/gi)) {
        op[/^осн/i.test(key) ? 'foot' : 'at'] = nm;
      }
      return { op };
    }

    // «сечение M ⊥ BD1» — через точку перпендикулярно прямой; «плоскость
    // AB ⊥ (SCD)» — через прямую перпендикулярно плоскости. «Сечение» рисует
    // сечение тела, «плоскость» — полупрозрачную плоскость.
    m = /^(сечение|плоскость|section|plane)\s+(?:через\s+)?((?:[A-Z][0-9]*)+)(?:⊥|\s+(?:перпендикулярн[а-яё]*|perp)\s+)(?:(?:к\s+)?(?:прям[а-яё]*|плоскост[а-яё]*)\s+)?(\S+)$/i.exec(src);
    if (m) {
      const style = /^(сечение|section)$/i.test(m[1]) ? 'section' : 'plane';
      const head = splitNames(m[2]);
      const kind = refKind(m[3]) || (isPlaneTok(m[3]) ? 'plane' : null);
      if (head.length === 1) {
        if (kind === 'plane') {
          throw new Error(`Через точку перпендикулярных плоскости ${m[3]} плоскостей много — задайте прямую: «плоскость ${head[0]}K ⊥ ${m[3]}» или «${head[0]} ⊥ ${m[3]}» (перпендикуляр)`);
        }
        const ref = parseLineRef(m[3], model, 'Перпендикулярно прямой: «сечение M ⊥ BD1»');
        return { op: { id: newOpId(), type: 'perpPlane', from: head[0], ref, style } };
      }
      if (head.length === 2) {
        if (kind !== 'plane') {
          throw new Error(`Через прямую ${head.join('')} перпендикулярно прямой — только если они перпендикулярны; задайте плоскость: «плоскость ${head.join('')} ⊥ (SCD)»`);
        }
        const plane = parsePlaneRef(m[3], model);
        return { op: { id: newOpId(), type: 'perpPlane', line: head, plane, style } };
      }
      throw new Error('Перпендикулярная плоскость — через точку «сечение M ⊥ BD1» или через прямую «плоскость AB ⊥ (SCD)»');
    }

    // «H = M ⊥ AB», «H = M ⊥ (ABC)», «перпендикуляр из M на ABC»;
    // из точки на прямой — с плоскостью: «M ⊥ AC в ABC».
    const WITHIN = '(?:\\s+в\\s+(?:плоскост[а-яё]*\\s+)?(\\S+))?';
    m = new RegExp(`^(?:([A-Z][0-9]*)\\s*=\\s*)?([A-Z][0-9]*)⊥(\\S+)${WITHIN}$`).exec(src)
      || new RegExp(`^(?:([A-Z][0-9]*)\\s*=\\s*)?(?:перпендикуляр|перп\\.?|perp)\\s+(?:(?:из|от)\\s+)?(?:точки\\s+)?([A-Z][0-9]*)\\s+(?:(?:на|к)\\s+)?(?:(?:прям|плоскост)[а-яё]*\\s+)?(\\S+)${WITHIN}$`, 'i').exec(src);
    if (m) {
      const [, name, from, target, withinTok] = m;
      const pts = isPlaneTok(target) ? parsePlaneRef(target, model) : null;
      if (pts) {
        // Из точки самой плоскости перпендикуляр восставляется — это прямая,
        // основания (и имени) у неё нет.
        const op = { id: newOpId(), type: 'perp', from, plane: pts };
        if (pointInPlane(model, from, pts) !== true) op.name = name || nextFootName(model);
        return { op };
      }
      const ref = parseLineRef(target, model, 'Перпендикуляр — к прямой «M ⊥ AB» или к плоскости «M ⊥ (ABC)»');
      // Точка на самой прямой — перпендикуляр строится в плоскости «в ABC»
      // и выходит прямой без основания. Плоскость без нужды не сохраняем.
      if (withinTok && pointOnLineRef(model, from, ref) !== false) {
        const within = parsePlaneRef(withinTok, model, 'Плоскость построения — три точки: «M ⊥ AC в ABC»');
        return { op: { id: newOpId(), type: 'perp', from, ref, within } };
      }
      return { op: { id: newOpId(), type: 'perp', name: name || nextFootName(model), from, ref } };
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
      const pl = parsePlaneRef(m[2], model, 'Плоскость следа — три точки: «след MN ABCD»');
      return { op: { id: newOpId(), type: 'trace', name: auto(null), ref: l, plane: pl } };
    }

    const OPERAND = '(\\([A-Z0-9|⊥в()]+\\)|[A-Z0-9]+)';
    m = new RegExp(`^(?:([A-Z][0-9]*)\\s*=\\s*)?${OPERAND}\\s*${OP_RE}\\s*${OPERAND}$`).exec(src);
    if (m) {
      const rightPlane = isPlaneTok(m[3]);
      const leftPlane = isPlaneTok(m[2]);
      if (leftPlane && !rightPlane) {
        const left = parsePlaneRef(m[2], model, 'Плоскость — три точки: «(ABC) ∩ MN»');
        const ref = parseLineRef(m[3], model, 'Прямая — две точки');
        return { op: { id: newOpId(), type: 'trace', name: auto(m[1]), ref, plane: left } };
      }
      const l1 = parseLineRef(m[2], model, 'Прямая — две точки: «MN ∩ AC»');
      if (rightPlane) {
        const right = parsePlaneRef(m[3], model, 'Плоскость — три точки: «MN ∩ (ABC)»');
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
    case 'perp': {
      const to = op.plane ? planeName(op.plane, opsById) : refName(op.ref, opsById);
      if (op.name) return `${P(op.from)}${P(op.name)} ⊥ ${to}`;
      return `Прямая через ${P(op.from)} ⊥ ${to}${op.within ? ` в ${planeName(op.within, opsById)}` : ''}`;
    }
    case 'angle': return `Угол между ${refName(op.ref, opsById)} и ${planeName(op.plane, opsById)}`;
    case 'perpPlane': {
      const what = op.style === 'plane' ? 'Плоскость' : 'Сечение';
      return op.from
        ? `${what} через ${P(op.from)} ⊥ ${refName(op.ref, opsById)}`
        : `${what} через ${refName(op.line, opsById)} ⊥ ${planeName(op.plane, opsById)}`;
    }
    case 'intersect': return `${P(op.name)} = ${refName(op.l1, opsById)} ∩ ${refName(op.l2, opsById)}`;
    case 'trace': return `${P(op.name)} = ${refName(op.ref, opsById)} ∩ ${planeName(op.plane, opsById)}`;
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
    case 'perp': {
      const to = op.plane ? planeTokText(op.plane, opsById) : r(op.ref);
      if (!to) return '';
      if (op.name) return `${op.name} = ${op.from} ⊥ ${to}`;
      if (!op.within) return `${op.from} ⊥ ${to}`;
      const w = planeRefText(op.within, opsById);
      return w ? `${op.from} ⊥ ${to} в ${w}` : '';
    }
    case 'angle': {
      const pl = planeTokText(op.plane, opsById);
      if (!r(op.ref) || !pl) return '';
      return `угол ${r(op.ref)} ${pl}${op.foot ? ` основание ${op.foot}` : ''}${op.at ? ` след ${op.at}` : ''}`;
    }
    case 'perpPlane': {
      const what = op.style === 'plane' ? 'плоскость' : 'сечение';
      if (op.from) return r(op.ref) ? `${what} ${op.from} ⊥ ${r(op.ref)}` : '';
      const pl = planeTokText(op.plane, opsById);
      return Array.isArray(op.line) && pl ? `${what} ${n(op.line)} ⊥ ${pl}` : '';
    }
    case 'intersect':
      return r(op.l1) && r(op.l2) ? `${op.name} = ${r(op.l1)} ∩ ${r(op.l2)}` : '';
    case 'trace': {
      const pl = planeTokText(op.plane, opsById);
      return r(op.ref) && pl ? `${op.name} = ${r(op.ref)} ∩ ${pl}` : '';
    }
    case 'section': return `сечение ${n(op.pts)}`;
    case 'plane': return `плоскость ${n(op.pts)}`;
    case 'fill': return `заливка ${n(op.pts)}`;
    default: return '';
  }
}

// --- правка шага командой -------------------------------------------------------

const NAME_FIELDS = ['name', 'at', 'foot'];

/**
 * Заменить шаг журнала новой командой — на том же месте и с тем же id
 * (прямые и плоскости по id шага, подпись и цвет не теряются). Команда
 * разбирается на чертеже ДО этого шага. Имя, которое учитель в новой команде
 * не написал, остаётся прежним — иначе автоимя могло совпасть с точкой
 * дальнейшего шага.
 * @returns {{ scene, broken: number[] } | { error }} broken — номера (с 1)
 *   дальнейших шагов, которые после правки перестали строиться
 */
export function editStepCommand(scene, opId, text) {
  const ops = scene?.ops || [];
  const idx = ops.findIndex((o) => o.id === opId);
  if (idx < 0) return { error: 'Нет такого шага' };
  const r = parseCommand(text, evaluateScene(scene, { upTo: idx }));
  if (r.error) return { error: r.error };
  if (!r.op) return { error: 'Шаг — это построение; цвет, имя и отмена делаются отдельно' };
  const old = ops[idx];
  const typed = normalizeCommand(text);
  const op = { ...r.op, id: old.id };
  for (const f of NAME_FIELDS) {
    if (!old[f] || !op[f] || op[f] === old[f]) continue;
    const written = new RegExp(`(^|[^A-Z0-9])${op[f]}(?![0-9])`).test(typed);
    if (!written) op[f] = old[f];
  }
  if (old.note) op.note = old.note;
  if (old.color) op.color = old.color;
  const next = { ...scene, ops: ops.map((o, i) => (i === idx ? op : o)) };
  const was = evaluateScene(scene).steps;
  const now = evaluateScene(next).steps;
  if (!now[idx].ok) return { error: now[idx].error };
  const broken = now.filter((st, i) => i > idx && !st.ok && was[i]?.ok).map((st) => st.index + 1);
  return { scene: next, broken };
}

