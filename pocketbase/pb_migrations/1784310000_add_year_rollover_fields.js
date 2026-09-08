/// <reference path="../pb_data/types.d.ts" />

// Учебные годы, шаг 2: поля для перевода на новый учебный год.
//
// students.status   — active (пусто = active) | graduated | left.
//                     Выпускник не удаляется и не отвязывается: его карточка,
//                     попытки, результаты «Решу ЕГЭ» и летние программы целы,
//                     он лишь пропадает из пикеров и активных списков.
// students.grad_year — учебный год выпуска/выбытия («2025/2026»).
// teaching_groups.prev_group — предшественник в цепочке лет («8→9→10→11»):
//                     новая группа года ссылается на прошлогоднюю.
//
// 🚨 Аддитивно: три nullable-поля. Существующие данные не изменяются
// (пустой status = active). Down-миграция удаляет поля.

migrate((app) => {
  const students = app.findCollectionByNameOrId("students");
  if (!students.fields.getByName("status")) {
    students.fields.add(new Field({
      "hidden": false, "id": "select_student_status", "maxSelect": 1, "name": "status",
      "presentable": false, "required": false, "system": false, "type": "select",
      "values": ["active", "graduated", "left"]
    }));
  }
  if (!students.fields.getByName("grad_year")) {
    students.fields.add(new Field({
      "autogeneratePattern": "", "hidden": false, "id": "text_student_grad_year",
      "max": 20, "min": 0, "name": "grad_year", "pattern": "", "presentable": false,
      "primaryKey": false, "required": false, "system": false, "type": "text"
    }));
  }
  app.save(students);

  const groups = app.findCollectionByNameOrId("teaching_groups");
  if (!groups.fields.getByName("prev_group")) {
    groups.fields.add(new Field({
      "hidden": false, "id": "rel_group_prev", "name": "prev_group",
      "presentable": false, "required": false, "system": false, "type": "relation",
      "collectionId": groups.id, "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
    }));
    app.save(groups);
  }
  console.log("[1784310000] students.status/grad_year + teaching_groups.prev_group добавлены");
}, (app) => {
  const students = app.findCollectionByNameOrId("students");
  for (const name of ["status", "grad_year"]) {
    const f = students.fields.getByName(name);
    if (f) students.fields.removeById(f.id);
  }
  app.save(students);

  const groups = app.findCollectionByNameOrId("teaching_groups");
  const prev = groups.fields.getByName("prev_group");
  if (prev) {
    groups.fields.removeById(prev.id);
    app.save(groups);
  }
  console.log("[1784310000] Откачены поля перевода на новый год");
});
