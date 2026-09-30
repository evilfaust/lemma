// Автоимена точек планиметрического чертежа. Вершины и свободные точки идут
// по алфавиту (A, B, C, D…), построенные — привычными буквами: основание
// высоты H, центр O, середина M, точка биссектрисы L, точка касания T.

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const COMMON = ['M', 'N', 'K', 'L', 'P', 'Q', 'R', 'T', 'X', 'Y', 'Z', 'E', 'F', 'G', 'H', 'U', 'V', 'W'];

const PREFERRED = {
  free: ALPHA,
  point: COMMON,
  mid: ['M', 'N', 'K'],
  foot: ['H'],
  center: ['O', 'I', 'Q'],
  bis: ['L'],
  tangent: ['T'],
  cross: ['O', 'P', 'Q', 'K', 'X', 'Y'],
};

function usedNames(modelOrNames) {
  if (!modelOrNames) return new Set();
  if (modelOrNames instanceof Set) return new Set(modelOrNames);
  if (Array.isArray(modelOrNames)) return new Set(modelOrNames);
  return new Set(Object.keys(modelOrNames.points || {}));
}

/**
 * Несколько свободных имён подряд (вершины фигуры, две точки пересечения).
 * @param kind — free | point | mid | foot | center | bis | tangent | cross
 */
export function nextFreeNames(modelOrNames, n = 1, kind = 'point') {
  const used = usedNames(modelOrNames);
  const out = [];
  const take = (name) => { used.add(name); out.push(name); };
  const pref = PREFERRED[kind] || COMMON;
  while (out.length < n) {
    let name = pref.find((x) => !used.has(x));
    // «H» занято — H1, H2…: привычнее, чем случайная буква.
    if (!name && kind !== 'free' && kind !== 'point') {
      for (let k = 1; k < 10 && !name; k++) {
        const c = `${pref[0]}${k}`;
        if (!used.has(c)) name = c;
      }
    }
    if (!name) name = (kind === 'free' ? ALPHA : COMMON).find((x) => !used.has(x));
    if (!name) name = ALPHA.find((x) => !used.has(x));
    for (let k = 1; k < 100 && !name; k++) {
      name = ALPHA.map((x) => `${x}${k}`).find((x) => !used.has(x));
    }
    take(name || `Q${Date.now() % 1000}`);
  }
  return out;
}

export function nextFreeName(modelOrNames, kind = 'point') {
  return nextFreeNames(modelOrNames, 1, kind)[0];
}
