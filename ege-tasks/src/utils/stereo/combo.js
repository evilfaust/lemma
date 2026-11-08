// Комбинации тел: где стоит следующее тело относительно уже поставленных.
// Сама группа (видимость, имена, каркас) — group.js; здесь только
// размещение: слово блока ```stereo / пункт формы ⇄ сдвиг части `at`.
//
//   внутри (общий центр) — шар в кубе, цилиндр в шаре, конус в цилиндре;
//   на дне / вверху      — внутри, но донышком (верхом) к донышку (верху):
//                          цилиндр в конусе, шар, вписанный в конус;
//                          конус, вписанный в шар, — вершиной вверху;
//   справа, слева, сзади — рядом, донышки на одном уровне (две кружки);
//   сверху / снизу       — поставить на тело / под тело (конус на цилиндре,
//                          два конуса с общим основанием).
//
// Ручное размещение хранится как `at`; размещение восстанавливает
// bodyParts — так форма «Новый чертёж» и выгрузка текста показывают
// «на дне», а не «сдвиг 0 0 -1.5». Для вписывания дополнительно хранится связь.

import { normalizeBodySpec, buildBody } from './bodies';
import { fitBodyPair, isInscription } from './inscription';

export const INSCRIPTION_PLACEMENTS = [
  { key: 'inscribed', label: 'Вписать в первое тело', word: 'вписано' },
  { key: 'circumscribed', label: 'Описать вокруг первого тела', word: 'описано' },
];

export const PLACEMENTS = [
  { key: 'center', label: 'Внутри, общий центр', word: '' },
  { key: 'floor', label: 'Внутри, на дне', word: 'на дне' },
  { key: 'ceil', label: 'Внутри, вверху', word: 'вверху' },
  { key: 'right', label: 'Справа', word: 'справа' },
  { key: 'left', label: 'Слева', word: 'слева' },
  { key: 'back', label: 'Сзади', word: 'сзади' },
  { key: 'top', label: 'Сверху (на нём)', word: 'сверху' },
  { key: 'below', label: 'Снизу (под ним)', word: 'снизу' },
];

// Слова блока → размещение. Фразы из нескольких слов — первыми.
export const PLACE_WORDS = [
  ...INSCRIPTION_PLACEMENTS.map(({ key, word }) => [word, key]),
  ['на дне', 'floor'], ['на основании', 'floor'], ['внизу', 'floor'],
  ['вверху', 'ceil'], ['наверху', 'ceil'],
  ['справа', 'right'], ['рядом', 'right'], ['слева', 'left'], ['сзади', 'back'],
  ['сверху', 'top'], ['снизу', 'below'],
  ['в центре', 'center'], ['центре', 'center'], ['внутри', 'center'],
];

const MAX_PARTS = 4;
export { MAX_PARTS as MAX_BODY_PARTS };

const r3 = (x) => Math.round(x * 1000) / 1000;

/** Габарит тела в его собственных координатах. */
function extentOf(spec) {
  const b = buildBody(spec);
  const pts = b.extent || b.order.map((n) => b.vertices[n]);
  const lo = { x: Infinity, y: Infinity, z: Infinity };
  const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of pts) {
    lo.x = Math.min(lo.x, p.x); lo.y = Math.min(lo.y, p.y); lo.z = Math.min(lo.z, p.z);
    hi.x = Math.max(hi.x, p.x); hi.y = Math.max(hi.y, p.y); hi.z = Math.max(hi.z, p.z);
  }
  return { lo, hi };
}

const partSpec = ({ at, frame, fit, ...ps }) => { void at; void frame; void fit; return ps; };

/**
 * Сдвиг нового тела при размещении рядом с уже стоящими частями.
 * @param placed — [{ ...описание, at }]
 */
function placeAt(placed, spec, placement) {
  if (placement?.kind === 'shift') return placement.at.map((x) => r3(Number(x) || 0));
  const U = { lo: { x: Infinity, y: Infinity, z: Infinity }, hi: { x: -Infinity, y: -Infinity, z: -Infinity } };
  for (const p of placed) {
    const e = extentOf(partSpec(p));
    ['x', 'y', 'z'].forEach((k, i) => {
      U.lo[k] = Math.min(U.lo[k], e.lo[k] + p.at[i]);
      U.hi[k] = Math.max(U.hi[k], e.hi[k] + p.at[i]);
    });
  }
  const e2 = extentOf(spec);
  const gap = 0.25 * Math.max(U.hi.x - U.lo.x, e2.hi.x - e2.lo.x, 1);
  let at;
  switch (placement?.kind) {
    case 'floor': at = [0, 0, U.lo.z - e2.lo.z]; break;
    case 'ceil': at = [0, 0, U.hi.z - e2.hi.z]; break;
    case 'right': at = [U.hi.x - e2.lo.x + gap, 0, U.lo.z - e2.lo.z]; break;
    case 'left': at = [U.lo.x - e2.hi.x - gap, 0, U.lo.z - e2.lo.z]; break;
    case 'back': at = [0, U.hi.y - e2.lo.y + gap, U.lo.z - e2.lo.z]; break;
    case 'top': at = [0, 0, U.hi.z - e2.lo.z]; break;
    case 'below': at = [0, 0, U.lo.z - e2.hi.z]; break;
    default: at = [0, 0, 0];
  }
  return at.map(r3);
}

/** Части тела: у одиночного — одна, с сдвигом 0. */
function placedParts(bodySpec) {
  const cur = normalizeBodySpec(bodySpec);
  return cur.kind === 'group'
    ? cur.parts
    : [{ ...cur, at: [0, 0, 0], ...(bodySpec?.frame ? { frame: true } : {}) }];
}

function appendPart(parts, spec, placement, frame) {
  const style = frame ? { frame: true } : {};
  if (isInscription(placement?.kind)) {
    if (parts.length !== 1) return false;
    const fit = fitBodyPair(parts[0], spec, placement.kind);
    if (!fit) return false;
    parts[0] = { ...parts[0], ...fit.sizes[0] };
    parts.push({ ...spec, ...fit.sizes[1], ...style, at: fit.at, fit: placement.kind });
  } else {
    const at = parts.length ? placeAt(parts, spec, placement) : [0, 0, 0];
    parts.push({ ...spec, ...style, at });
  }
  return true;
}

/** Добавить тело к чертежу: внутри, на дне, рядом, сверху, снизу или со сдвигом. */
export function addPart(bodySpec, spec, placement = { kind: 'center' }, frame = false) {
  const parts = placedParts(bodySpec);
  if (!appendPart(parts, normalizeBodySpec(spec), placement, frame)) return null;
  return normalizeBodySpec({ kind: 'group', parts });
}

const sameAt = (a, b) => a.every((x, i) => Math.abs(x - b[i]) <= 2e-3);

/**
 * Тело → список частей с размещением (обратное к bodyFromParts).
 * Размещение узнаётся пересчётом: какое слово дало бы тот же сдвиг;
 * не узнали — { kind: 'shift', at } (сдвиг от первого тела).
 * @returns {{ spec, placement, frame }[]}
 */
export function bodyParts(bodySpec) {
  const parts = placedParts(bodySpec);
  const base = parts[0].at;
  const rel = parts.map((p) => ({ ...p, at: p.at.map((x, i) => (p.fit ? x - base[i] : r3(x - base[i]))) }));
  return rel.map((p, i) => {
    const spec = partSpec(p);
    const frame = !!p.frame;
    if (i === 0) return { spec, placement: { kind: 'center' }, frame };
    if (p.fit) return { spec, placement: { kind: p.fit }, frame };
    const before = rel.slice(0, i);
    const hit = PLACEMENTS.find(({ key }) => sameAt(placeAt(before, spec, { kind: key }), p.at));
    return { spec, placement: hit ? { kind: hit.key } : { kind: 'shift', at: p.at }, frame };
  });
}

/** Список частей → описание тела (одна часть — само тело). */
export function bodyFromParts(list) {
  const items = (list || []).filter((p) => p?.spec).slice(0, MAX_PARTS);
  if (!items.length) return normalizeBodySpec();
  if (items.length === 1) return normalizeBodySpec(items[0].spec);
  const placed = [];
  for (const { spec, placement, frame } of items) {
    if (!appendPart(placed, normalizeBodySpec(spec), placement, frame)) return null;
  }
  return normalizeBodySpec({ kind: 'group', parts: placed });
}

/** Слово блока для размещения части (центр — без слова). */
export function placementWord(placement) {
  if (placement?.kind === 'shift') {
    const f = (x) => String(Math.round(Number(x) * 100) / 100);
    return `сдвиг ${placement.at.map(f).join(' ')}`;
  }
  return [...PLACEMENTS, ...INSCRIPTION_PLACEMENTS].find((p) => p.key === placement?.kind)?.word || '';
}
