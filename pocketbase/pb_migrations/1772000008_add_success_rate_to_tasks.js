/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const tasks = app.findCollectionByNameOrId("tasks");

  const successRateField = new Field({
    "id": "number_tasks_success_rate",
    "name": "success_rate",
    "type": "number",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
    "min": null,
    "max": null
  });

  tasks.fields.add(successRateField);
  app.save(tasks);
  console.log('[migration] Added success_rate field to tasks');

  // Заполняем для задач, у которых есть attempt_answers
  const db = app.db();
  db.newQuery(`
    UPDATE tasks
    SET success_rate = (
      SELECT CAST(SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)
      FROM attempt_answers aa
      WHERE aa.task = tasks.id
    )
    WHERE id IN (SELECT DISTINCT task FROM attempt_answers)
  `).execute();
  console.log('[migration] Backfilled success_rate from attempt_answers');

}, (app) => {
  const tasks = app.findCollectionByNameOrId("tasks");
  const field = tasks.fields.getByName("success_rate");
  if (field) {
    tasks.fields.remove(field);
    app.save(tasks);
    console.log('[migration] Removed success_rate field from tasks');
  }
});
