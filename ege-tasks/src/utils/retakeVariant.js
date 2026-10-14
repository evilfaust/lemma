import { shuffleArray } from './shuffle';

/**
 * Вариант для попытки, которую учитель выдаёт ученику вручную
 * («Другой вариант» в «Результатах»).
 *
 * Ключ варианта у обычной работы — id записи `variants`, у теста A/B/C/D —
 * номер варианта строкой (`attempts.mc_variant`): у теста нет записей
 * `variants`, варианты лежат в самом `mc_tests.variants`.
 *
 * Приоритет: варианты, которых у ученика ещё не было; внутри — наименее
 * выданные по всей выдаче; текущий вариант не повторяем, если есть другой.
 *
 * @param {string[]} keys — ключи всех вариантов
 * @param {object[]} attempts — все попытки выдачи
 * @param {object} attempt — попытка, от которой выдаём новую
 * @param {(a: object) => string} keyOf — ключ варианта попытки
 * @returns {string|null}
 */
export function pickRetakeVariant(keys, attempts, attempt, keyOf, shuffle = shuffleArray) {
  if (!keys?.length) return null;
  const count = {};
  keys.forEach((k) => { count[k] = 0; });
  (attempts || []).forEach((a) => {
    const k = keyOf(a);
    if (count[k] !== undefined) count[k]++;
  });

  const sameStudent = (a) => {
    if (attempt.student) return a.student === attempt.student;
    if (attempt.device_id) return a.device_id === attempt.device_id;
    return false;
  };
  const used = new Set((attempts || []).filter(sameStudent).map(keyOf).filter(Boolean));

  const leastAssigned = (ids) => {
    if (!ids.length) return [];
    const min = Math.min(...ids.map((k) => count[k]));
    return ids.filter((k) => count[k] === min);
  };

  let candidates = leastAssigned(keys.filter((k) => !used.has(k)));
  if (!candidates.length) candidates = leastAssigned(keys);
  const current = keyOf(attempt);
  if (candidates.length > 1 && candidates.some((k) => k !== current)) {
    candidates = candidates.filter((k) => k !== current);
  }
  return shuffle([...candidates])[0];
}

/** Ключ варианта попытки теста A/B/C/D. */
export const mcVariantKey = (a) => {
  const v = a?.mc_variant ?? '';
  return v === '' || v === null ? '' : String(v);
};
