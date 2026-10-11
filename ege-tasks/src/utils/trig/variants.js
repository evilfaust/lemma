/**
 * Сборка вариантов без повторов для генераторов «тип → задание».
 *
 * `makeOne()` возвращает задание `{ exprLatex, resultLatex }` или null
 * (случайные числа не подошли). Сначала ищется задание, которого нет на всём
 * листе, потом — которого нет в варианте; повтор внутри варианта не берётся
 * никогда. Задание «?» не печатается: позиция, для которой генератор ничего
 * не нашёл, просто пропускается (до v3.9.348 на лист выходил «?»).
 */
export function buildUniqueVariants({ variantsCount, count, makeOne, tries = 60 }) {
  const onSheet = new Set();
  const variants = Array.from({ length: variantsCount }, () => {
    const tasks = [];
    const inVariant = new Set();
    for (let i = 0; i < count; i++) {
      let fallback = null;
      let picked = null;
      for (let t = 0; t < tries && !picked; t++) {
        const q = makeOne(i);
        if (!q || !q.exprLatex) continue;
        if (inVariant.has(q.exprLatex)) continue;
        if (!onSheet.has(q.exprLatex)) picked = q;
        else if (!fallback) fallback = q;
      }
      const q = picked || fallback;
      if (q) {
        tasks.push(q);
        inVariant.add(q.exprLatex);
        onSheet.add(q.exprLatex);
      }
    }
    return tasks;
  });
  // с такими настройками генератору нечего выдать — пустой лист, а не «?»
  return variants.every(v => v.length === 0) ? [] : variants;
}
