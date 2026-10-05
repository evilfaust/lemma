/// <reference path="../pb_data/types.d.ts" />
// Курс завершён (v3.9.293).
//
// teaching_groups.completed — курс (kind='course') закончился: ученики больше
// не видят его уроков и ДЗ в «Уроках» (хук lessons_feed.pb.js), а учителю он
// не предлагается в пикерах групп (`getTeachingGroups()` без allYears /
// includeArchived). В отличие от архива курс остаётся в «Моих классах» —
// с участниками, журналом и уроками в календаре. Решение пользователя
// 05.10.2026: закончившийся интенсив не должен смешиваться с уроками класса.

migrate((app) => {
  const groups = app.findCollectionByNameOrId("teaching_groups");
  groups.fields.add(new BoolField({
    "id": "bool_tg_completed",
    "name": "completed",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  app.save(groups);
  console.log("[1787900000] teaching_groups.completed — курс завершён");
}, (app) => {
  try {
    const groups = app.findCollectionByNameOrId("teaching_groups");
    groups.fields.removeById("bool_tg_completed");
    app.save(groups);
  } catch (e) { console.log("[1787900000] откат:", e?.message); }
});
