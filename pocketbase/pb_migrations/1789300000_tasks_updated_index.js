/// <reference path="../pb_data/types.d.ts" />
// Индекс tasks(updated) (v3.9.411): ключ свежести кэша снимка банка
// (pb_hooks/tasks_snapshot_lib.js::stamp — «сколько задач и когда менялась
// последняя») считается на каждый запрос снимка; без индекса max(updated) —
// полный просмотр 30 тыс. строк (30–60 мс), с индексом — миллисекунды.
// Только индекс, данные не меняются.

migrate((app) => {
  const tasks = app.findCollectionByNameOrId('tasks');
  tasks.removeIndex('idx_tasks_updated');
  tasks.addIndex('idx_tasks_updated', false, '`updated`', '');
  app.save(tasks);
}, (app) => {
  const tasks = app.findCollectionByNameOrId('tasks');
  tasks.removeIndex('idx_tasks_updated');
  app.save(tasks);
});
