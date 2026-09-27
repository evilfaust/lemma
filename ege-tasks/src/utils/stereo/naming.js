// Автоимена новых точек: буквы, которых нет среди вершин и построенных.
// Порядок — привычный для сечений: сначала M, N, K, L, P…, следы — X, Y, Z
// идут в общей очереди (учитель переименует, если хочет иначе).

const SEQUENCE = ['M', 'N', 'K', 'L', 'P', 'Q', 'R', 'T', 'X', 'Y', 'Z', 'E', 'F', 'G', 'H', 'U', 'V', 'W', 'I', 'J', 'O'];

function usedNames(modelOrNames) {
  if (!modelOrNames) return new Set();
  if (modelOrNames instanceof Set) return modelOrNames;
  if (Array.isArray(modelOrNames)) return new Set(modelOrNames);
  return new Set(Object.keys(modelOrNames.points || {}));
}

export function nextFreeName(modelOrNames) {
  const used = usedNames(modelOrNames);
  for (const n of SEQUENCE) if (!used.has(n)) return n;
  for (let k = 2; k < 100; k++) {
    for (const n of SEQUENCE) if (!used.has(`${n}${k}`)) return `${n}${k}`;
  }
  return `Q${Date.now() % 1000}`;
}
