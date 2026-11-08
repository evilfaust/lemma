import { categoryPlan } from './questionPlan';

export function generateUniqueTextTask(make, label, usedModels, usedStatements = new Set()) {
  for (let attempt = 0; attempt < 160; attempt++) {
    const task = make();
    if (!task || usedModels.has(task.modelKey) || usedStatements.has(task.statement_md)) continue;
    usedModels.add(task.modelKey);
    const { statement_md, answer } = task;
    return { statement_md, answer };
  }
  throw new Error(`Не удалось получить новую задачу типа «${label}»`);
}

export function generateTextTaskVariants({ categories, categoryCounts, questionsCount, variantsCount }, types, generateTask) {
  const enabled = Object.keys(types).filter(type => categories?.[type]);
  const plan = categoryPlan(enabled, questionsCount, categoryCounts);
  if (!plan.length) return [];
  for (const type of enabled) {
    const { maxTasks, label } = types[type];
    if (maxTasks && plan.filter(cat => cat === type).length * variantsCount > maxTasks) {
      throw new Error(`Для типа «${label}» можно собрать до ${maxTasks} разных задач на весь лист. Уменьшите квоту типа или число вариантов.`);
    }
  }
  const usedModels = new Set();
  return Array.from({ length: variantsCount }, (_, variantIndex) =>
    plan.map((cat, taskIndex) => ({
      ...generateTask(cat, usedModels),
      cat,
      id: `${variantIndex + 1}-${taskIndex + 1}`,
    })),
  );
}
