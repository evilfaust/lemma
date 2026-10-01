/// <reference path="../pb_data/types.d.ts" />
// Работы раздела «Геометрия» (GEOMETRY_TASKS_PLAN.md § 4, этап 2).
//
// Раздел «Геометрия» намеренно отдельный от обычных задач (решение
// пользователя 01.10.2026): работа ссылается на geometry_tasks, а не на tasks,
// и в works/variants не попадает.
//
// geometry_works — работа учителя с вариантами:
//   tasks      — все задачи всех вариантов (для expand и обратного поиска
//                «в каких работах задача»); синхронизируется клиентом из structure
//   structure  — { variants: [{ items: [{ task } | null] }], layouts: { taskId: макет A5 } }
//                позиция i варианта v — ячейка сетки «позиции × варианты»;
//                макет печати хранится в работе, а не в задаче
//   print      — настройки печати (раскладка, текст, клетка, заголовки)
//
// Доступ — как у stereo_scenes: учитель видит свои (superadmin — все),
// viewer только читает, owner не перевесить.
//
// 🚨 Аддитивно: новая коллекция, существующие данные не трогаются.

migrate((app) => {
  const T = '@request.auth.collectionName = "teachers"';
  const NV = '@request.auth.role != "viewer"';
  const SA = '@request.auth.role = "superadmin"';
  const OWN = `(${SA} || owner = @request.auth.id)`;
  const keepOwner = '(@request.body.owner:isset = false || @request.body.owner = owner)';

  const works = new Collection({
    "id": "pbc_geometry_works",
    "name": "geometry_works",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
      },
      {
        "hidden": false, "id": "rel_gwork_owner", "name": "owner", "presentable": false,
        "required": true, "system": false, "type": "relation",
        "collectionId": "pbc_teachers", "cascadeDelete": false, "minSelect": 1, "maxSelect": 1
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_gwork_title",
        "max": 200, "min": 1, "name": "title", "pattern": "",
        "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "number_gwork_class", "name": "class", "presentable": false,
        "required": false, "system": false, "type": "number", "min": 1, "max": 11, "onlyInt": true
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_gwork_note",
        "max": 2000, "min": 0, "name": "note", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "rel_gwork_tasks", "name": "tasks", "presentable": false,
        "required": false, "system": false, "type": "relation",
        "collectionId": "pbc_geometry_tasks", "cascadeDelete": false, "minSelect": 0, "maxSelect": 999
      },
      {
        "hidden": false, "id": "json_gwork_structure", "maxSize": 2000000, "name": "structure",
        "presentable": false, "required": false, "system": false, "type": "json"
      },
      {
        "hidden": false, "id": "json_gwork_print", "maxSize": 20000, "name": "print",
        "presentable": false, "required": false, "system": false, "type": "json"
      },
      {
        "hidden": false, "id": "autodate_gwork_created", "name": "created",
        "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate"
      },
      {
        "hidden": false, "id": "autodate_gwork_updated", "name": "updated",
        "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX idx_geometry_works_owner ON geometry_works (owner)"
    ],
    "listRule": `${T} && ${OWN}`,
    "viewRule": `${T} && ${OWN}`,
    "createRule": `${T} && ${NV} && owner = @request.auth.id`,
    "updateRule": `${T} && ${NV} && ${OWN} && ${keepOwner}`,
    "deleteRule": `${T} && ${NV} && ${OWN}`
  });
  app.save(works);
  console.log("[1787300000] geometry_works: работы раздела «Геометрия»");
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("pbc_geometry_works"));
  } catch (e) {
    console.log("[1787300000] откат:", e?.message);
  }
});
