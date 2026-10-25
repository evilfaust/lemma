// textDiff.js — построчное сравнение двух текстов с подсветкой слов внутри
// изменённых строк. Чистые функции; нужны окну «Перепарсить с Решу ЕГЭ»
// (RefreshFromSdamgiaModal), чтобы учитель видел, ЧТО именно заменится в его
// уже поправленном руками условии/решении.

/** LCS-таблица → список операций same/del/add для двух массивов. */
function lcsOps(a, b, eq = (x, y) => x === y) {
  const n = a.length;
  const m = b.length;
  // dp[i][j] — длина LCS суффиксов a[i:], b[j:]
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { ops.push({ type: 'same', a: a[i], b: b[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'del', a: a[i] }); i++; }
    else { ops.push({ type: 'add', b: b[j] }); j++; }
  }
  while (i < n) ops.push({ type: 'del', a: a[i++] });
  while (j < m) ops.push({ type: 'add', b: b[j++] });
  return ops;
}

/** Слова вместе с пробелами после них — чтобы склейка давала исходный текст. */
const tokenize = (s) => String(s || '').match(/\S+\s*|\s+/g) || [];

/**
 * Пословное сравнение одной строки.
 * @returns {Array<{type:'same'|'del'|'add', text:string}>} соседние куски одного типа склеены
 */
export function diffWords(a, b) {
  const ops = lcsOps(tokenize(a), tokenize(b), (x, y) => x.trim() === y.trim());
  const out = [];
  for (const op of ops) {
    const text = op.type === 'add' ? op.b : op.a;
    const last = out[out.length - 1];
    if (last && last.type === op.type) last.text += text;
    else out.push({ type: op.type, text });
  }
  return out;
}

/**
 * Построчное сравнение. Подряд идущие удалённые и добавленные строки
 * склеиваются в пары «было → стало» с пословной подсветкой (`words`).
 * @returns {Array<{type:'same', text} | {type:'del', text} | {type:'add', text}
 *                 | {type:'change', from, to, words}>}
 */
export function diffLines(a, b) {
  const ops = lcsOps(String(a || '').split('\n'), String(b || '').split('\n'));
  const out = [];
  let k = 0;
  while (k < ops.length) {
    if (ops[k].type === 'same') { out.push({ type: 'same', text: ops[k].a }); k++; continue; }
    const dels = [];
    const adds = [];
    while (k < ops.length && ops[k].type !== 'same') {
      if (ops[k].type === 'del') dels.push(ops[k].a); else adds.push(ops[k].b);
      k++;
    }
    const pairs = Math.min(dels.length, adds.length);
    for (let p = 0; p < pairs; p++) {
      out.push({ type: 'change', from: dels[p], to: adds[p], words: diffWords(dels[p], adds[p]) });
    }
    for (const t of dels.slice(pairs)) out.push({ type: 'del', text: t });
    for (const t of adds.slice(pairs)) out.push({ type: 'add', text: t });
  }
  return out;
}

/** Сколько строк реально поменялось (для подписи «изменено N строк»). */
export function changedLineCount(diff) {
  return diff.filter(d => d.type !== 'same').length;
}
