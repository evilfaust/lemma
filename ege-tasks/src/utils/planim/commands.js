// Строка команд планиметрического редактора ⇄ операции журнала. Эта же
// грамматика — текстовый формат блока ```planim (dsl.js).
//
// Разбор прощающий, как в стереоредакторе: русская раскладка («М» кириллицей
// = M), знаки ∩ / × / x, отношение «1:2», дробь «1/3», «середина».
//
//   A = (0; 0)               свободная точка (её можно двигать)
//   треугольник ABC 5 6 7    фигура по сторонам (AB, BC, AC) — три точки и контур
//   квадрат ABCD 4           и другие фигуры: прямоугольник, ромб, трапеция…
//   M на AB 1:2 | середина AB
//   X = AC ∩ BD              пересечение прямых
//   H = высота C AB          основание, отрезок CH и прямой угол
//   M = медиана C AB · L = биссектриса ACB
//   AB | прямая AB | луч AB  отрезок, прямая, луч
//   прямая K || AB · прямая K ⊥ AB · биссектриса угла ABC
//   окружность O A | окружность O 3 | O = описанная ABC | I = вписанная ABC
//   X = AB ∩ окр(O,A)        пересечение с окружностью
//   угол ABC 2 α · равны AB CD · длина AB 5   пометки
//   пунктир CH · цвет отрезка AB красный · скрыть O   оформление (не шаги)

import {
  prettyName, splitNames, parseLineRef, parseCircleRef, isCircleTok, lineRefText, circleRefText,
  lineRefPretty, circleRefPretty,
} from './refs';
import { newOpId } from './scene';
import { nextFreeName, nextFreeNames } from './naming';
import { figureOps, figureVertexCount } from './figures';
import { lineCircle, circleCircle } from './geometry';
import { dist } from './vec2';
import { colorKeyFromWord } from '../stereo/render';
import { parsePosition } from '../stereo/commands';

export { parsePosition };

const CYR_TO_LAT = {
  А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', О: 'O', Р: 'P', Т: 'T', Х: 'X', У: 'Y',
};

// Латинские служебные слова; всё остальное латиницей — имена точек.
const LATIN_WORDS = new Set([
  'seg', 'segment', 'line', 'ray', 'par', 'perp', 'circle', 'polygon', 'fill', 'rename',
  'undo', 'on', 'in', 'mid', 'midpoint', 'foot', 'altitude', 'median', 'bisector', 't', 'x',
  'color', 'red', 'blue', 'green', 'orange', 'violet', 'purple', 'black', 'dash', 'solid',
  'hide', 'show', 'tick', 'auto', 'circumcircle', 'incircle',
]);

const NAME = '[A-Z][0-9]*';
const NUM = '-?\\d+(?:[.,]\\d+)?';
const toNum = (s) => Number(String(s).replace(',', '.'));

/** Убрать пробелы внутри скобок: «(P || AB)» → «(P||AB)», «окр(O, A)» → «окр(O,A)». */
function stripParenSpaces(s) {
  let depth = 0;
  let out = '';
  for (const ch of s) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth > 0 && /\s/.test(ch)) continue;
    out += ch;
  }
  return out;
}

/**
 * Кириллица-двойник → латиница (только отдельно стоящие заглавные — начало
 * русского слова не трогаем), имена точек строчными — заглавными («mn» → «MN»),
 * координаты в скобках — к виду «(x;y)».
 */
export function normalizeCommand(text) {
  const s = String(text || '')
    .replace(/−/g, '-')
    .replace(/[АВСЕНКМОРТХУ](?![а-яё])/g, (c) => CYR_TO_LAT[c])
    .replace(/[₀-₉]/g, (c) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c)))
    .replace(/\b[a-z][a-z0-9]*\b/g, (w) => (LATIN_WORDS.has(w) ? w : w.toUpperCase()))
    .replace(/^\s*x(?=\s*=)/, 'X') // «x = …» — имя точки, а не знак пересечения
    .replace(/∥/g, '||')
    .replace(/_\|_|⟂/g, '⊥')
    .replace(new RegExp(`\\(\\s*(${NUM})\\s+(${NUM})\\s*\\)`, 'g'), '($1;$2)')
    .replace(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s+(-?\d+(?:\.\d+)?)\s*\)/g, '($1;$2)')
    .replace(/\((-?\d+),(-?\d+)\)/g, '($1;$2)');
  return stripParenSpaces(s)
    .replace(/\s*\|\|\s*/g, '||')
    .replace(/\s*⊥\s*/g, '⊥')
    .replace(/(окр[а-яё]*|впис[а-яё]*)\s+\(/gi, '$1(')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Имя точки, набранное как угодно («м», «m1», «К») → «M», «M1», «K». */
export function normalizePointName(text) {
  return String(text || '')
    .trim()
    .toUpperCase()
    .replace(/[АВСЕНКМОРТХУ]/g, (c) => CYR_TO_LAT[c])
    .replace(/[₀-₉]/g, (c) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c)));
}

const fmt = (x) => String(Math.round(Number(x) * 10000) / 10000).replace('.', ',');
const fmt2 = (x) => String(Math.round(Number(x) * 100) / 100).replace('.', ',');

const OP_RE = '(?:∩|×|\\^|(?<![A-Za-z0-9])[xх](?![A-Za-z0-9])|пересеч[а-яё]*(?:\\s+с)?)';
const OPERAND = '((?:окр|впис)[а-яё]*\\([^\\s]*\\)|\\([^\\s]+\\)|[A-Z0-9]+)';

const COLOR_HINT = 'Цвета: красный, синий, зелёный, оранжевый, фиолетовый; «нет» — снять';

const DIR_WORDS = [
  [/^(в?право|справа|right|e)$/, 0], [/^(в?верх|сверху|up|n)$/, 90],
  [/^(в?лево|слева|left|w)$/, 180], [/^(в?низ|снизу|down|s)$/, 270],
];

/** «135», «вверх-влево», «авто» → угол в градусах; null — авто; undefined — не понял. */
function parseLabelDir(word) {
  const w = String(word || '').toLowerCase();
  if (/^(авто|auto|нет|сброс)$/.test(w)) return null;
  if (/^-?\d+(?:[.,]\d+)?$/.test(w)) return toNum(w);
  let x = 0;
  let y = 0;
  for (const part of w.split(/[-\s]+/).filter(Boolean)) {
    const hit = DIR_WORDS.find(([re]) => re.test(part));
    if (!hit) return undefined;
    x += Math.cos((hit[1] * Math.PI) / 180);
    y += Math.sin((hit[1] * Math.PI) / 180);
  }
  if (Math.hypot(x, y) < 1e-9) return undefined;
  return Math.round((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// --- команды с подписью: её текст нельзя «нормализовать» (x не должен стать X) ---

// Сдвиг подписи, поставленной мышью: «длина AB 5 @(0,4; -0,3)» — от середины
// отрезка, «угол ABC 60 @(0,5; 0,6)» — от вершины (единицы чертежа).
const AT_TAIL = new RegExp(`\\s*@\\s*\\(\\s*(${NUM})\\s*;\\s*(${NUM})\\s*\\)\\s*$`);

function takeAt(tail) {
  const src = String(tail || '').replace(/−/g, '-');
  const m = AT_TAIL.exec(src);
  if (!m) return { rest: String(tail || '').trim(), at: null };
  return { rest: src.slice(0, m.index).trim(), at: { x: toNum(m[1]), y: toNum(m[2]) } };
}

const atText = (at) => (at && Number.isFinite(Number(at.x)) && Number.isFinite(Number(at.y))
  ? ` @(${fmt(at.x)}; ${fmt(at.y)})` : '');

function parseLabeled(raw, model) {
  let m = /^(?:длина|подпись|length|label)\s+(\S+)(?:\s+(.+))?$/i.exec(raw);
  if (m) {
    const n = splitNames(normalizeCommand(m[1]));
    if (!n || n.length !== 2) throw new Error('Подпись отрезка: «длина AB 5» (без числа — подставится его длина)');
    const { rest, at } = takeAt(m[2]);
    let text = rest;
    if (!text) {
      const A = model?.points?.[n[0]]?.pos;
      const B = model?.points?.[n[1]]?.pos;
      if (!A || !B) throw new Error(`Нет точки ${prettyName(A ? n[1] : n[0])}`);
      text = fmt2(dist(A, B));
    }
    const op = { id: newOpId(), type: 'measure', ref: n, text };
    if (at) op.at = at;
    return { op };
  }

  m = /^(?:текст|надпись|text)\s+(.+)$/i.exec(raw);
  if (m) {
    const rest = m[1].replace(/−/g, '-');
    const q = new RegExp(`^\\(\\s*(${NUM})\\s*(?:;|\\s)\\s*(${NUM})\\s*\\)\\s+(.+)$`).exec(rest)
      || /^\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\s+(.+)$/.exec(rest)
      || new RegExp(`^(${NUM})\\s+(${NUM})\\s+(.+)$`).exec(rest);
    if (!q) throw new Error('Надпись: «текст (3; 4) a» — координаты и сам текст');
    return { op: { id: newOpId(), type: 'text', x: toNum(q[1]), y: toNum(q[2]), text: q[3].trim() } };
  }

  m = /^(прямой\s+угол|угол|angle)\s+(\S+)(?:\s+(.+))?$/i.exec(raw);
  if (m) {
    const n = splitNames(normalizeCommand(m[2]));
    if (!n || n.length !== 3) throw new Error('Угол — тремя точками, вершина посередине: «угол ABC»');
    const op = { id: newOpId(), type: 'angle', pts: n };
    if (/^прямой/i.test(m[1])) op.right = true;
    const { rest, at } = takeAt(m[3]);
    const words = rest.split(/\s+/).filter(Boolean);
    if (words.length && /^[123]$/.test(words[0])) op.arcs = Number(words.shift());
    let label = words.join(' ');
    if (/^\d+(?:[.,]\d+)?$/.test(label)) label += '°';
    if (label) op.label = label;
    if (label && at) op.at = at;
    return { op };
  }
  return null;
}

// --- готовые фигуры ---------------------------------------------------------------

const FIGURE_WORDS = [
  [/^прямоугольный\s+треугольник/i, 'rightTriangle', ['a', 'b']],
  [/^равнобедренный\s+треугольник/i, 'isoTriangle', ['a', 'h']],
  [/^(?:равносторонний|правильный)\s+треугольник/i, 'equilateral', ['a']],
  [/^треугольник/i, 'triangle', ['a', 'b', 'c']],
  [/^квадрат/i, 'square', ['a']],
  [/^прямоугольник/i, 'rectangle', ['a', 'b']],
  [/^параллелограмм/i, 'parallelogram', ['a', 'b', 'angle']],
  [/^ромб/i, 'rhombus', ['a', 'angle']],
  [/^равнобедренная\s+трапеция/i, 'isoTrapezoid', ['a', 'b', 'h']],
  [/^прямоугольная\s+трапеция/i, 'rightTrapezoid', ['a', 'b', 'h']],
  [/^трапеция/i, 'trapezoid', ['a', 'b', 'h']],
  [/^четыр[её]хугольник/i, 'quad', []],
  [/^правильный(?:\s+[а-яё]*угольник)?/i, 'regular', ['a']],
];

/** Куда поставить новую фигуру: правее уже нарисованного. */
export function freeOrigin(model) {
  const b = model?.bbox;
  if (!b) return { x: 0, y: 0 };
  return { x: Math.ceil(b.x1 + 2), y: Math.floor(b.y0) };
}

function parseFigure(src, model) {
  const hit = FIGURE_WORDS.find(([re]) => re.test(src));
  if (!hit) return null;
  const [re, kind0, keys] = hit;
  const words = src.replace(re, '').trim().split(/\s+/).filter(Boolean);
  let names = null;
  const nums = [];
  for (const w of words) {
    if (new RegExp(`^${NUM}$`).test(w)) nums.push(toNum(w));
    else if (!names && splitNames(w)) names = splitNames(w);
    else throw new Error(`Не понял «${w}». Пример: «треугольник ABC 5 6 7», «квадрат ABCD 4»`);
  }
  let kind = kind0;
  const spec = {};
  if (kind === 'regular') {
    // «правильный ABCDEF 3» — сторон по числу букв; «правильный 6 3» — шесть сторон, ребро 3.
    if (names) spec.n = names.length;
    else if (nums.length) spec.n = nums.shift();
    if (nums.length) spec.a = nums[0];
  } else {
    if (kind === 'triangle' && nums.length === 3) kind = 'triangleSss';
    else if (kind === 'triangle' && nums.length) throw new Error('Треугольник по сторонам — три числа: «треугольник ABC 5 6 7» (AB, BC, AC)');
    keys.forEach((k, i) => { if (nums[i] != null) spec[k] = nums[i]; });
  }
  spec.kind = kind;
  const need = figureVertexCount(spec);

  if (names) {
    const have = names.filter((n) => model?.points?.[n]);
    // Все точки уже стоят — «треугольник ABC» просто обводит их контуром.
    if (have.length === names.length && !nums.length) {
      if (names.length < 3) throw new Error('Многоугольник — не меньше трёх точек');
      return { op: { id: newOpId(), type: 'polygon', pts: names } };
    }
    if (have.length) {
      throw new Error(`Точки ${have.map(prettyName).join(', ')} уже есть — фигура с размерами строится на новых буквах`);
    }
    if (names.length !== need) throw new Error(`Нужно ${need} буквы вершин, а не ${names.length}`);
  } else {
    names = nextFreeNames(model, need, 'free');
  }
  const r = figureOps(spec, names, freeOrigin(model));
  if (r.error) throw new Error(r.error);
  return { ops: r.ops };
}

// --- разбор -------------------------------------------------------------------------

/**
 * Разбирает команду.
 * @returns {{ op } | { ops } | { action: 'undo' } | { action: 'rename', from, to }
 *   | { action: 'style', names?, segments?, circles?, patch }
 *   | { action: 'hide', names, hide } | { action: 'label', name, angle } | { error }}
 */
export function parseCommand(text, model) {
  const raw = String(text || '').trim();
  if (!raw) return { error: 'Пустая команда' };
  const used = new Set(Object.keys(model?.points || {}));
  const auto = (name, kind = 'point') => {
    const n = name || nextFreeName(used, kind);
    used.add(n);
    return n;
  };
  const pair = (tok, what) => {
    const n = splitNames(tok);
    if (!n || n.length !== 2) throw new Error(what);
    return n;
  };

  try {
    const labeled = parseLabeled(raw, model);
    if (labeled) return labeled;

    const src = normalizeCommand(raw);
    const low = src.toLowerCase();
    if (/^(отмена|отменить|undo|назад)$/.test(low)) return { action: 'undo' };

    let m = new RegExp(`^(?:переименовать|rename)\\s+(${NAME})\\s+(?:в\\s+)?(${NAME})$`).exec(src);
    if (m) return { action: 'rename', from: m[1], to: m[2] };

    // --- оформление ---------------------------------------------------------
    m = /^(?:цвет|color)\s+(.+)\s+(\S+)$/i.exec(src);
    if (m) {
      const color = colorKeyFromWord(m[2]);
      if (color == null) throw new Error(COLOR_HINT);
      const kindWord = /^(точ|отрез|прям|сторон|лини|окружн)[а-яё]*\s+/i.exec(m[1]);
      const toks = m[1].replace(/^[а-яё]+\s+/i, (w) => (kindWord ? '' : w)).split(/[\s,]+/).filter(Boolean);
      if (toks.some(isCircleTok)) {
        return { action: 'style', circles: toks.map((t) => parseCircleRef(t, model)), patch: { color } };
      }
      if (kindWord && /^(отрез|прям|сторон|лини)/i.test(kindWord[1])) {
        return {
          action: 'style',
          segments: toks.map((t) => pair(t, 'Отрезок — двумя точками: «цвет отрезка AB красный»')),
          patch: { color },
        };
      }
      const names = splitNames(toks.join(''));
      if (!names) throw new Error('Цвет: «цвет MNB красный», «цвет отрезка AB красный», «цвет окр(O) синий»');
      return { action: 'style', names, patch: { color } };
    }

    m = /^(пунктир[а-яё]*|dash|сплошн[а-яё]*|solid)\s+(.+)$/i.exec(src);
    if (m) {
      const dash = /^(пунктир|dash)/i.test(m[1]);
      const toks = m[2].split(/[\s,]+/).filter(Boolean);
      const circles = toks.filter(isCircleTok).map((t) => parseCircleRef(t, model));
      const segments = toks.filter((t) => !isCircleTok(t))
        .map((t) => pair(t, 'Пунктир — для отрезка или окружности: «пунктир CH», «пунктир окр(O)»'));
      return { action: 'style', segments, circles, patch: { dash } };
    }

    m = /^(скрыть|спрятать|hide|показать|show)\s+(.+)$/i.exec(src);
    if (m) {
      const names = splitNames(m[2].replace(/[\s,]+/g, ''));
      if (!names) throw new Error('Какие точки: «скрыть O» (точка не рисуется, но на неё можно ссылаться)');
      return { action: 'hide', names, hide: /^(скрыть|спрятать|hide)/i.test(m[1]) };
    }

    m = new RegExp(`^(?:метка|буква)\\s+(${NAME})\\s+(.+)$`, 'i').exec(src);
    if (m) {
      const angle = parseLabelDir(m[2]);
      if (angle === undefined) throw new Error('Место буквы: «метка A 135» (угол в градусах), «метка A вверх-влево», «метка A авто»');
      return { action: 'label', name: m[1], angle };
    }

    // --- фигуры ---------------------------------------------------------------
    const fig = parseFigure(src, model);
    if (fig) return fig;

    // --- точки ------------------------------------------------------------------
    m = new RegExp(`^(?:точка\\s+)?(?:(${NAME})\\s*=?\\s*)?\\((${NUM});(${NUM})\\)$`, 'i').exec(src)
      || new RegExp(`^точка\\s+(${NAME})\\s+(${NUM})\\s+(${NUM})$`, 'i').exec(src);
    if (m) {
      return { op: { id: newOpId(), type: 'point', name: auto(m[1], 'free'), x: toNum(m[2]), y: toNum(m[3]) } };
    }

    m = new RegExp(`^(?:(${NAME})\\s*=\\s*)?серединный\\s+перпендикуляр\\s+(?:к\\s+)?(\\S+)$`, 'i').exec(src);
    if (m) {
      const n = pair(m[2], 'Серединный перпендикуляр — к отрезку: «серединный перпендикуляр AB»');
      const name = auto(m[1], 'mid');
      return {
        ops: [
          { id: newOpId(), type: 'pointOnLine', name, ref: n, t: 0.5, ratio: [1, 1] },
          { id: newOpId(), type: 'perp', through: name, ref: n },
        ],
      };
    }

    m = new RegExp(`^(?:(${NAME})\\s*=\\s*)?(?:середина|mid(?:point)?)\\s+(?:отрезка\\s+)?(\\S+)$`, 'i').exec(src);
    if (m) {
      const n = pair(m[2], 'Середина — двух точек: «середина AB»');
      return { op: { id: newOpId(), type: 'pointOnLine', name: auto(m[1], 'mid'), ref: n, t: 0.5, ratio: [1, 1] } };
    }

    m = new RegExp(`^(?:(${NAME})\\s*=\\s*)?центр\\s+(\\S+)$`, 'i').exec(src);
    if (m) {
      return { op: { id: newOpId(), type: 'center', name: auto(m[1], 'center'), circle: parseCircleRef(m[2], model) } };
    }

    m = new RegExp(`^(?:(${NAME})\\s*=\\s*)?(?:основание|проекция|foot)\\s+(${NAME})\\s+(?:на\\s+)?(\\S+)$`, 'i').exec(src);
    if (m) {
      return { op: { id: newOpId(), type: 'foot', name: auto(m[1], 'foot'), from: m[2], ref: parseLineRef(m[3]) } };
    }

    // Высота / перпендикуляр из точки: основание, отрезок и прямой угол.
    m = new RegExp(`^(?:(${NAME})\\s*=\\s*)?(?:высота|перпендикуляр|altitude|perp)\\s+(?:из\\s+)?(${NAME})\\s+(?:на\\s+|к\\s+)?(\\S+)$`, 'i').exec(src);
    if (m) return { ops: altitudeOps(auto(m[1], 'foot'), m[2], parseLineRef(m[3]), model) };

    m = new RegExp(`^(?:(${NAME})\\s*=\\s*)?(?:медиана|median)\\s+(?:из\\s+)?(${NAME})\\s+(?:на\\s+|к\\s+)?(\\S+)$`, 'i').exec(src);
    if (m) {
      const n = pair(m[3], 'Медиана — к стороне из двух точек: «медиана C AB»');
      const name = auto(m[1], 'mid');
      return {
        ops: [
          { id: newOpId(), type: 'pointOnLine', name, ref: n, t: 0.5, ratio: [1, 1] },
          { id: newOpId(), type: 'segment', ref: [m[2], name] },
        ],
      };
    }

    m = /^(?:биссектриса\s+угла|луч\s+биссектрис[а-яё]*|бис[а-яё]*\s+угла)\s+(\S+)$/i.exec(src);
    if (m) {
      const n = splitNames(m[1]);
      if (!n || n.length !== 3) throw new Error('Угол — тремя точками, вершина посередине: «биссектриса угла ABC»');
      return { op: { id: newOpId(), type: 'bisector', pts: n } };
    }

    // Биссектриса треугольника: точка на противоположной стороне и отрезок.
    m = new RegExp(`^(?:(${NAME})\\s*=\\s*)?(?:биссектриса|bisector)\\s+(\\S+)$`, 'i').exec(src);
    if (m) {
      const n = splitNames(m[2]);
      if (!n || n.length !== 3) throw new Error('Биссектриса — по углу из трёх точек: «биссектриса ABC» (вершина посередине)');
      return { ops: bisectorOps(auto(m[1], 'bis'), n) };
    }

    m = new RegExp(`^(?:(${NAME})\\s*=\\s*)?(?:касание|точка\\s+касания)\\s+(?:из\\s+)?(${NAME})\\s+(?:к\\s+)?(\\S+?)(?:\\s+([12]))?$`, 'i').exec(src);
    if (m) {
      const circle = parseCircleRef(m[3], model);
      const ks = m[4] ? [Number(m[4]) - 1] : [0, 1];
      return wrapOps(ks.map((k, i) => ({
        id: newOpId(), type: 'tangent', name: auto(i === 0 ? m[1] : null, 'tangent'), from: m[2], circle, k,
      })));
    }

    m = new RegExp(`^касательн[а-яё]*\\s+(?:из\\s+)?(${NAME})\\s+(?:к\\s+)?(\\S+?)(?:\\s+([12]))?$`, 'i').exec(src);
    if (m) {
      const circle = parseCircleRef(m[2], model);
      const ks = m[3] ? [Number(m[3]) - 1] : [0, 1];
      const ops = [];
      for (const k of ks) {
        const name = auto(null, 'tangent');
        ops.push({ id: newOpId(), type: 'tangent', name, from: m[1], circle, k });
        ops.push({ id: newOpId(), type: 'segment', ref: [m[1], name] });
      }
      return { ops };
    }

    // --- линии ------------------------------------------------------------------
    m = /^(?:отрезок|seg(?:ment)?)\s+(\S+)$/i.exec(src);
    if (m) return { op: { id: newOpId(), type: 'segment', ref: pair(m[1], 'Отрезок задаётся двумя точками: «отрезок MN»') } };

    m = new RegExp(`^(?:(?:прямая|line)\\s+)?(?:через\\s+)?(${NAME})\\s*(\\|\\||⊥|параллельно|перпендикулярно|par)\\s*(\\S+)$`, 'i').exec(src);
    if (m) {
      const type = /^(⊥|перп)/i.test(m[2]) ? 'perp' : 'parallel';
      return { op: { id: newOpId(), type, through: m[1], ref: parseLineRef(m[3]) } };
    }

    m = /^(прямая|line|луч|ray)\s+(\S+)$/i.exec(src);
    if (m) {
      const type = /^(луч|ray)/i.test(m[1]) ? 'ray' : 'line';
      return { op: { id: newOpId(), type, ref: pair(m[2], type === 'ray' ? 'Луч — из первой точки через вторую: «луч AB»' : 'Прямая задаётся двумя точками: «прямая MN»') } };
    }

    m = /^(?:многоугольник|контур|polygon)\s+(\S+)$/i.exec(src);
    if (m) {
      const n = splitNames(m[1]);
      if (!n || n.length < 3) throw new Error('Многоугольник — не меньше трёх точек: «многоугольник ABCD»');
      return { op: { id: newOpId(), type: 'polygon', pts: n } };
    }

    // --- окружности -----------------------------------------------------------
    m = new RegExp(`^(?:окружность|окр|circle)\\s+(${NAME})\\s+(?:(${NAME})|(${NUM}))$`, 'i').exec(src);
    if (m) {
      const circle = m[2] ? { k: 'cp', o: m[1], a: m[2] } : { k: 'cr', o: m[1], r: toNum(m[3]) };
      return { op: { id: newOpId(), type: 'circle', circle } };
    }

    m = new RegExp(`^(?:(${NAME})\\s*=\\s*)?(описанная|вписанная|circumcircle|incircle)(?:\\s+окружность)?\\s+(\\S+)$`, 'i').exec(src);
    if (m) {
      const n = splitNames(m[3]);
      if (!n || n.length !== 3) throw new Error('Окружность треугольника — по трём вершинам: «описанная ABC»');
      const circle = { k: /^(описанная|circum)/i.test(m[2]) ? 'circum' : 'in', pts: n };
      const ops = [{ id: newOpId(), type: 'circle', circle }];
      if (m[1]) ops.push({ id: newOpId(), type: 'center', name: auto(m[1], 'center'), circle });
      return wrapOps(ops);
    }

    if (isCircleTok(src) && !/\s/.test(src)) {
      return { op: { id: newOpId(), type: 'circle', circle: parseCircleRef(src, model) } };
    }

    m = /^(?:заливка|залить|закрасить|fill)\s+(\S+)$/i.exec(src);
    if (m) {
      const n = splitNames(m[1]);
      if (!n || n.length < 3) throw new Error('Заливка — не меньше трёх точек: «заливка ABC»');
      return { op: { id: newOpId(), type: 'fill', pts: n } };
    }

    // --- пометки ----------------------------------------------------------------
    m = /^(?:равны|равные|штрих[а-яё]*|tick)\s+(.+?)(?:\s+([123]))?$/i.exec(src);
    if (m) {
      const segs = m[1].split(/[\s,=]+/).filter(Boolean)
        .map((t) => pair(t, 'Равные отрезки: «равны AB CD» (в конце можно число штрихов: 1–3)'));
      let n = m[2] ? Number(m[2]) : 0;
      if (!n) {
        const maxN = Math.max(0, ...(model?.ticks || []).map((t) => t.n));
        n = (maxN % 3) + 1;
      }
      return { op: { id: newOpId(), type: 'tick', segs, n } };
    }

    // --- пересечения ----------------------------------------------------------
    m = new RegExp(`^(?:(${NAME})\\s*=\\s*)?${OPERAND}\\s*${OP_RE}\\s*${OPERAND}(?:\\s+([12]))?$`).exec(src);
    if (m) {
      const [, name, left, right, idx] = m;
      const lc = isCircleTok(left);
      const rc = isCircleTok(right);
      if (!lc && !rc) {
        return {
          op: { id: newOpId(), type: 'intersect', name: auto(name, 'cross'), l1: parseLineRef(left), l2: parseLineRef(right) },
        };
      }
      const A = lc ? { circle: parseCircleRef(left, model) } : { line: parseLineRef(left) };
      const B = rc ? { circle: parseCircleRef(right, model) } : { line: parseLineRef(right) };
      return wrapOps(circleCrossOps(A, B, model, (i) => auto(i === 0 ? name : null, 'cross'), idx ? Number(idx) - 1 : null));
    }

    // --- точка на прямой / окружности -------------------------------------------
    m = new RegExp(`^(?:точка\\s+)?(?:(${NAME})\\s+)?(?:на|∈|on|in)\\s+(\\S+)\\s*(.*)$`, 'i').exec(src);
    if (m) {
      if (isCircleTok(m[2])) {
        const a = m[3].trim();
        if (a && !new RegExp(`^${NUM}°?$`).test(a)) throw new Error('Точка на окружности — по углу в градусах: «K на окр(O) 30»');
        return {
          op: {
            id: newOpId(), type: 'pointOnCircle', name: auto(m[1]),
            circle: parseCircleRef(m[2], model), angle: a ? toNum(a.replace('°', '')) : 45,
          },
        };
      }
      const ref = parseLineRef(m[2], 'Точка на отрезке из двух точек: «M на AB 1:2»');
      const pos = parsePosition(m[3]);
      if (!pos) throw new Error('Положение: «1:2», «1/3», «0,25» или «середина»');
      const op = { id: newOpId(), type: 'pointOnLine', name: auto(m[1]), ref, t: pos.t };
      if (pos.ratio && Array.isArray(ref)) op.ratio = pos.ratio;
      return { op };
    }

    const names = splitNames(src);
    if (names && names.length === 2) return { op: { id: newOpId(), type: 'segment', ref: names } };
    if (names && names.length >= 3) {
      throw new Error(`Что сделать с ${names.map(prettyName).join('')}? Например: «многоугольник ${src}», «угол ${names.slice(0, 3).join('')}» или «заливка ${src}»`);
    }
    throw new Error('Не понял команду. Примеры: «треугольник ABC 5 6 7», «M на AB 1:2», «H = высота C AB», «X = AC ∩ BD»');
  } catch (e) {
    return { error: e.message };
  }
}

const wrapOps = (ops) => (ops.length === 1 ? { op: ops[0] } : { ops });

/**
 * Пересечение с окружностью (прямая × окружность или две окружности) →
 * операции. Номер точки не указан (idx == null) — берутся те точки, которых
 * на чертеже ещё нет: вторая точка прямой, уже проходящей через точку
 * окружности, или обе сразу.
 * @param a, b   — { line: ref } | { circle: ref } (хотя бы одна — окружность)
 * @param nameOf — (i) → имя i-й создаваемой точки
 */
export function circleCrossOps(a, b, model, nameOf, idx = null) {
  const both = a.circle && b.circle;
  const line = a.line || b.line;
  const circle = a.circle || b.circle;
  const make = (k, i) => (both
    ? { id: newOpId(), type: 'circleCircle', name: nameOf(i), c1: a.circle, c2: b.circle, k }
    : { id: newOpId(), type: 'lineCircle', name: nameOf(i), ref: line, circle, k });
  if (idx != null) return [make(idx ? 1 : 0, 0)];
  let hits = null;
  if (both) {
    const C1 = model?.circleOf?.(a.circle);
    const C2 = model?.circleOf?.(b.circle);
    const r = C1 && C2 ? circleCircle(C1, C2, model.tol) : null;
    if (r?.kind === 'points') hits = r.points;
  } else {
    const L = model?.lineOf?.(line);
    const C = model?.circleOf?.(circle);
    if (L && C) hits = lineCircle(L, C, model.tol).map((h) => h.point);
  }
  if (!hits || !hits.length) return [make(0, 0)]; // ошибку объяснит построение
  const taken = Object.values(model?.points || {}).filter((pt) => !pt.alias);
  const fresh = hits.map((p, k) => ({ p, k }))
    .filter((h) => !taken.some((pt) => dist(pt.pos, h.p) <= (model?.tol || 1e-6) * 10));
  if (!fresh.length) throw new Error('Точки пересечения уже отмечены на чертеже');
  return fresh.map((h, i) => make(h.k, i));
}


/** Высота из точки: основание H, отрезок и пометка прямого угла. */
export function altitudeOps(name, from, ref, model) {
  const ops = [
    { id: newOpId(), type: 'foot', name, from, ref },
    { id: newOpId(), type: 'segment', ref: [from, name] },
  ];
  // Прямой угол отмечается к той точке прямой, что дальше от основания.
  if (Array.isArray(ref)) {
    const L = model?.lineOf?.(ref);
    const P = model?.points?.[from]?.pos;
    let side = ref[0];
    if (L && P) {
      const t = ((P.x - L.p.x) * L.u.x + (P.y - L.p.y) * L.u.y) / (L.u.x * L.u.x + L.u.y * L.u.y);
      side = Math.abs(t) >= Math.abs(t - 1) ? ref[0] : ref[1];
    }
    ops.push({ id: newOpId(), type: 'angle', pts: [from, name, side], right: true });
  }
  return ops;
}

/** Биссектриса треугольника из вершины V угла AVB: точка на AB и отрезок. */
export function bisectorOps(name, [a, v, b]) {
  return [
    { id: newOpId(), type: 'intersect', name, l1: { k: 'bis', pts: [a, v, b] }, l2: [a, b] },
    { id: newOpId(), type: 'segment', ref: [v, name] },
  ];
}

/** Человеческое описание шага журнала. */
export function describeOp(op) {
  const P = prettyName;
  const names = (arr) => (arr || []).map(P).join('');
  switch (op?.type) {
    case 'point': return `Точка ${P(op.name)} (${fmt(op.x)}; ${fmt(op.y)})`;
    case 'pointOnLine': {
      const base = `${P(op.name)} ∈ ${lineRefPretty(op.ref)}`;
      if (op.ratio && Array.isArray(op.ref)) {
        if (op.ratio[0] === op.ratio[1]) return `${P(op.name)} — середина ${names(op.ref)}`;
        const [a, b] = op.ref;
        return `${base}, ${P(a)}${P(op.name)} : ${P(op.name)}${P(b)} = ${fmt(op.ratio[0])} : ${fmt(op.ratio[1])}`;
      }
      if (Array.isArray(op.ref) && Math.abs(op.t - 0.5) < 1e-9) return `${P(op.name)} — середина ${names(op.ref)}`;
      if (Array.isArray(op.ref) && (op.t < 0 || op.t > 1)) return `${base} (на продолжении)`;
      return base;
    }
    case 'pointOnCircle': return `${P(op.name)} на: ${circleRefPretty(op.circle)}`;
    case 'intersect': return `${P(op.name)} = ${lineRefPretty(op.l1)} ∩ ${lineRefPretty(op.l2)}`;
    case 'lineCircle': return `${P(op.name)} = ${lineRefPretty(op.ref)} ∩ ${circleRefPretty(op.circle)}`;
    case 'circleCircle': return `${P(op.name)} — точка пересечения окружностей`;
    case 'foot': return `${P(op.name)} — основание перпендикуляра из ${P(op.from)} на ${lineRefPretty(op.ref)}`;
    case 'center': return `${P(op.name)} — центр: ${circleRefPretty(op.circle)}`;
    case 'tangent': return `${P(op.name)} — точка касания из ${P(op.from)}`;
    case 'segment': return `Отрезок ${names(op.ref)}`;
    case 'line': return `Прямая ${names(op.ref)}`;
    case 'ray': return `Луч ${names(op.ref)}`;
    case 'parallel': return `Прямая через ${P(op.through)} ∥ ${lineRefPretty(op.ref)}`;
    case 'perp': return `Прямая через ${P(op.through)} ⊥ ${lineRefPretty(op.ref)}`;
    case 'bisector': return `Биссектриса ∠${names(op.pts)}`;
    case 'polygon': return `${op.pts?.length === 3 ? 'Треугольник' : op.pts?.length === 4 ? 'Четырёхугольник' : 'Многоугольник'} ${names(op.pts)}`;
    case 'circle': {
      const s = circleRefPretty(op.circle);
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    case 'fill': return `Заливка ${names(op.pts)}`;
    case 'angle': {
      const extra = [op.arcs > 1 ? `${op.arcs} дуги` : '', op.label || ''].filter(Boolean).join(', ');
      return `${op.right ? 'Прямой угол' : 'Угол'} ${names(op.pts)}${extra ? ` (${extra})` : ''}`;
    }
    case 'tick': return `Равные отрезки: ${(op.segs || []).map(names).join(' = ')}`;
    case 'measure': return `${names(op.ref)} = ${op.text}`;
    case 'text': return `Надпись «${op.text}»`;
    default: return String(op?.type || '?');
  }
}

/** Операция обратно в строку команды (правка шага и блок ```planim). */
export function opToCommand(op) {
  const n = (arr) => (Array.isArray(arr) ? arr.join('') : '');
  const L = lineRefText;
  const C = circleRefText;
  switch (op?.type) {
    case 'point': return `${op.name} = (${fmt(op.x)}; ${fmt(op.y)})`;
    case 'pointOnLine': {
      if (!L(op.ref)) return '';
      const pos = op.ratio && Array.isArray(op.ref) ? `${op.ratio[0]}:${op.ratio[1]}` : fmt(op.t);
      return `${op.name} на ${L(op.ref)} ${pos}`;
    }
    case 'pointOnCircle': return C(op.circle) ? `${op.name} на ${C(op.circle)} ${fmt(op.angle)}` : '';
    case 'intersect': return L(op.l1) && L(op.l2) ? `${op.name} = ${L(op.l1)} ∩ ${L(op.l2)}` : '';
    case 'lineCircle': return L(op.ref) && C(op.circle) ? `${op.name} = ${L(op.ref)} ∩ ${C(op.circle)} ${op.k ? 2 : 1}` : '';
    case 'circleCircle': return C(op.c1) && C(op.c2) ? `${op.name} = ${C(op.c1)} ∩ ${C(op.c2)} ${op.k ? 2 : 1}` : '';
    case 'foot': return L(op.ref) ? `${op.name} = основание ${op.from} ${L(op.ref)}` : '';
    case 'center': return C(op.circle) ? `${op.name} = центр ${C(op.circle)}` : '';
    case 'tangent': return C(op.circle) ? `${op.name} = касание ${op.from} ${C(op.circle)} ${op.k ? 2 : 1}` : '';
    case 'segment': return `отрезок ${n(op.ref)}`;
    case 'line': return `прямая ${n(op.ref)}`;
    case 'ray': return `луч ${n(op.ref)}`;
    case 'parallel': return L(op.ref) ? `прямая ${op.through} || ${L(op.ref)}` : '';
    case 'perp': return L(op.ref) ? `прямая ${op.through} ⊥ ${L(op.ref)}` : '';
    case 'bisector': return `биссектриса угла ${n(op.pts)}`;
    case 'polygon': return `многоугольник ${n(op.pts)}`;
    case 'circle': return C(op.circle) || '';
    case 'fill': return `заливка ${n(op.pts)}`;
    case 'angle': {
      const label = op.label ? String(op.label) : '';
      const arcs = op.arcs > 1 || /^[123]$/.test(label.split(/\s+/)[0] || '') ? ` ${op.arcs || 1}` : '';
      return `${op.right ? 'прямой угол' : 'угол'} ${n(op.pts)}${arcs}${label ? ` ${label}${atText(op.at)}` : ''}`;
    }
    case 'tick': return `равны ${(op.segs || []).map(n).join(' ')} ${op.n || 1}`;
    case 'measure': return `длина ${n(op.ref)} ${op.text}${atText(op.at)}`;
    case 'text': return `текст (${fmt(op.x)}; ${fmt(op.y)}) ${op.text}`;
    default: return '';
  }
}
