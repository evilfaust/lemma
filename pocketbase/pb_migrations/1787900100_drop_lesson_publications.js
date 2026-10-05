/// <reference path="../pb_data/types.d.ts" />
// Удаление витрины уроков курсов lesson_publications (v3.9.293).
//
// С v3.9.291 ученик читает уроки хуком /api/lessons/my прямо из lessons, а
// флаг «показывать ученикам» живёт в lessons.hidden_from_students (перенесён
// миграцией 1787800000). Витрина была производной копией уроков — её никто не
// читает, фронт с v3.9.293 её и не пишет.
//
// Откат пересоздаёт пустую коллекцию с прежней схемой и правилами: данные в
// ней были копией уроков (восстанавливать нечего).

const TEACHER = '@request.auth.collectionName = "teachers"';
const STUDENTS = '@request.auth.collectionName = "students"';
const NV = '@request.auth.role != "viewer"';

migrate((app) => {
  try {
    app.delete(app.findCollectionByNameOrId("lesson_publications"));
    console.log("[1787900100] lesson_publications удалена");
  } catch (e) {
    console.log("[1787900100] lesson_publications уже нет:", e?.message);
  }
}, (app) => {
  const GROUPS = app.findCollectionByNameOrId("teaching_groups").id;
  const LESSONS = app.findCollectionByNameOrId("lessons").id;
  const TEACHERS = app.findCollectionByNameOrId("teachers").id;
  const rel = (id, name, collectionId, cascade) => ({
    "hidden": false, "id": id, "name": name, "presentable": false, "required": true,
    "system": false, "type": "relation", "collectionId": collectionId,
    "cascadeDelete": cascade, "minSelect": 1, "maxSelect": 1,
  });
  const txt = (id, name, max) => ({
    "autogeneratePattern": "", "hidden": false, "id": id, "max": max, "min": 0, "name": name,
    "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text",
  });
  const col = new Collection({
    "id": "pbc_lesson_publications", "name": "lesson_publications", "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text",
      },
      rel("rel_lp_owner", "owner", TEACHERS, false),
      rel("rel_lp_group", "group", GROUPS, true),
      rel("rel_lp_lesson", "lesson", LESSONS, true),
      txt("txt_lp_title", "title", 500),
      { "hidden": false, "id": "dt_lp_date", "name": "date_plan", "presentable": false, "required": false, "system": false, "type": "date", "max": "", "min": "" },
      txt("txt_lp_slot", "time_slot", 20),
      txt("txt_lp_conf", "conference_url", 1000),
      { "hidden": false, "id": "json_lp_items", "name": "items", "maxSize": 500000, "presentable": false, "required": false, "system": false, "type": "json" },
      { "hidden": false, "id": "bool_lp_published", "name": "published", "presentable": false, "required": false, "system": false, "type": "bool" },
      { "hidden": false, "id": "ad_lp_c", "name": "created", "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate" },
      { "hidden": false, "id": "ad_lp_u", "name": "updated", "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate" },
    ],
    "indexes": [
      "CREATE INDEX idx_lesson_pub_group ON lesson_publications (`group`)",
      "CREATE INDEX idx_lesson_pub_date ON lesson_publications (date_plan)",
      "CREATE UNIQUE INDEX idx_lesson_pub_lesson ON lesson_publications (lesson)",
    ],
    "listRule": `${TEACHER} || ${STUDENTS}`,
    "viewRule": `${TEACHER} || ${STUDENTS}`,
    "createRule": `${TEACHER} && ${NV}`,
    "updateRule": `${TEACHER} && ${NV}`,
    "deleteRule": `${TEACHER} && ${NV}`,
  });
  app.save(col);
  console.log("[1787900100] откат: lesson_publications пересоздана пустой");
});
