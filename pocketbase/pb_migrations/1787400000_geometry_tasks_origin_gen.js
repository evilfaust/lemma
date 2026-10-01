/// <reference path="../pb_data/types.d.ts" />
// Генератор сечений (GEOMETRY_TASKS_PLAN.md § 5, этап 4).
//
// Сгенерированные задачи сохраняются обычными записями geometry_tasks — так
// они без переделок работают в карточке, подборке, работах, печати и ключе
// ответов. Чтобы не смешиваться со своими задачами и банком МЦНМО, у них своё
// происхождение: origin = 'gen' (в банке — отдельная область «Генератор»).
//
// 🚨 Аддитивно: к значениям select-поля origin добавляется 'gen'; записи и
// правила не трогаются.

migrate((app) => {
  const col = app.findCollectionByNameOrId("geometry_tasks");
  const field = col.fields.getByName("origin");
  if (!field.values.includes("gen")) field.values = [...field.values, "gen"];
  app.save(col);
  console.log("[1787400000] geometry_tasks.origin: + gen (генератор сечений)");
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("geometry_tasks");
    const field = col.fields.getByName("origin");
    field.values = field.values.filter((v) => v !== "gen");
    app.save(col);
  } catch (e) {
    console.log("[1787400000] откат:", e?.message);
  }
});
