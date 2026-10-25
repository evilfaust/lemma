/**
 * mapLimit — как Promise.all(items.map(fn)), но одновременно в полёте не больше
 * `limit` вызовов. Результаты — в порядке items. Ошибки не прерывают остальные:
 * возвращается `{ results, errors }`, где errors — `[{ index, item, error }]`,
 * а results[index] у упавших — undefined.
 *
 * Зачем: запросы подряд (await в цикле) — это сумма задержек сети, а все сразу
 * могут упереться в лимиты браузера/сервера. Несколько параллельно — середина.
 */
export async function mapLimit(items, limit, fn) {
  const list = Array.from(items || []);
  const results = new Array(list.length);
  const errors = [];
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const index = next++;
      try {
        results[index] = await fn(list[index], index);
      } catch (error) {
        errors.push({ index, item: list[index], error });
      }
    }
  };
  const n = Math.max(1, Math.min(limit || 1, list.length));
  await Promise.all(Array.from({ length: n }, worker));
  errors.sort((a, b) => a.index - b.index);
  return { results, errors };
}
