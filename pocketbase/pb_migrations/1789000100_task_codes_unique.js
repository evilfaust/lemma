/// <reference path="../pb_data/types.d.ts" />
// Уникальный код задачи (v3.9.397, TASK_CODES_PLAN.md).
//
// До перевода кодов на буквы экзамена 8,6 тыс. кодов носили сразу несколько
// задач (5-001 — в базе, профиле, ОГЭ и ВПР), поэтому индекс был обычным.
// 🚨 Применять ТОЛЬКО после SQL-перевода кодов: при дублях миграция упадёт и
// PocketBase не запустится. Индекс частичный — задачи без кода (маршрутные
// листы без темы) не мешают друг другу.

migrate((app) => {
  const tasks = app.findCollectionByNameOrId("tasks");
  tasks.removeIndex("idx_tasks_code");
  tasks.addIndex("idx_tasks_code", true, "code", "code != ''");
  app.save(tasks);
  console.log("[1789000100] tasks.code — уникальный");
}, (app) => {
  try {
    const tasks = app.findCollectionByNameOrId("tasks");
    tasks.removeIndex("idx_tasks_code");
    tasks.addIndex("idx_tasks_code", false, "code", "");
    app.save(tasks);
  } catch (e) {
    console.log("[1789000100] откат:", e?.message);
  }
});
