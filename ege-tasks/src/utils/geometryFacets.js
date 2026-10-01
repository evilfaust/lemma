/**
 * Фасеты своих геометрических задач (GEOMETRY_TASKS_PLAN.md § 3).
 *
 * Фасеты (`geometry_tags`: объект / метод / факт) общие для своих задач и
 * банка МЦНМО. У банка они размечены вручную авторами, у своих задач их нет —
 * подсказываем по соседям: похожие задачи МЦНМО (векторный поиск) голосуют
 * своими фасетами, вес голоса — похожесть. Решает учитель: подсказка лишь
 * отмечает галочками самые уверенные.
 */

export const FACET_KINDS = ['object', 'method', 'fact'];

export const FACET_LABELS = { object: 'Объект', method: 'Метод', fact: 'Факт' };

/** Фасеты задачи по видам: { object: [id], method: [id], fact: [id], other: [id] }. */
export function splitFacets(tagIds = [], tagById) {
  const out = { object: [], method: [], fact: [], other: [] };
  for (const id of tagIds || []) {
    const kind = tagById.get(id)?.kind;
    (FACET_KINDS.includes(kind) ? out[kind] : out.other).push(id);
  }
  return out;
}

/** Обратно в одно поле tags (фасеты других видов — «имя», «источник» — сохраняются). */
export function joinFacets(parts) {
  return [...new Set([...(parts.object || []), ...(parts.method || []), ...(parts.fact || []), ...(parts.other || [])])];
}

/**
 * Подсказка фасетов по соседям.
 * @param {Array<{pct:number, tags:string[]}>} neighbors — похожие задачи (pct 0..100)
 * @param {Map<string,{kind,name}>} tagById — справочник фасетов
 * @param {object} [opts]
 * @param {string[]} [opts.have] — фасеты, которые у задачи уже есть (не предлагаются)
 * @param {number} [opts.top=6] — сколько предложений на вид
 * @returns {{ object, method, fact }} — [{ id, name, kind, votes, score, preselect }] по убыванию
 */
export function suggestFacets(neighbors, tagById, { have = [], top = 6 } = {}) {
  const haveSet = new Set(have);
  const n = neighbors.length;
  const acc = new Map();
  for (const nb of neighbors) {
    const w = Math.max(0, Math.min(100, Number(nb.pct) || 0)) / 100;
    for (const id of new Set(nb.tags || [])) {
      const tag = tagById.get(id);
      if (!tag || !FACET_KINDS.includes(tag.kind) || haveSet.has(id)) continue;
      const a = acc.get(id) || { id, name: tag.name, kind: tag.kind, votes: 0, score: 0 };
      a.votes += 1;
      a.score += w;
      acc.set(id, a);
    }
  }
  // Уверенно: фасет есть хотя бы у трети соседей (и минимум у двух)
  const need = Math.max(2, Math.ceil(n / 3));
  const out = { object: [], method: [], fact: [] };
  for (const kind of FACET_KINDS) {
    out[kind] = [...acc.values()]
      .filter((a) => a.kind === kind)
      .sort((a, b) => b.score - a.score || b.votes - a.votes || a.name.localeCompare(b.name, 'ru'))
      .slice(0, top)
      .map((a, i) => ({ ...a, score: Math.round(a.score * 100) / 100, preselect: i < 3 && a.votes >= need }));
  }
  return out;
}
