/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Создать коллекцию mc_tests
  const collection = new Collection({
    "createRule": "",
    "deleteRule": "",
    "fields": [
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_mct_title",
        "max": 300,
        "min": 0,
        "name": "title",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_mct_description",
        "max": 2000,
        "min": 0,
        "name": "description",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_2800040823",
        "hidden": false,
        "id": "rel_mct_topics",
        "maxSelect": 999,
        "minSelect": 0,
        "name": "topics",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "number_mct_options_count",
        "max": 8,
        "min": 2,
        "name": "options_count",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_mct_shuffle_mode",
        "max": 20,
        "min": 0,
        "name": "shuffle_mode",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "json_mct_variants",
        "maxSize": 0,
        "name": "variants",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "number_mct_class",
        "max": null,
        "min": null,
        "name": "class_number",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "autodate_mct_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate_mct_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_mc_tests",
    "indexes": [],
    "listRule": "",
    "name": "mc_tests",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });
  app.save(collection);
  console.log('[migration] Created mc_tests collection');

  // 2. Добавить поле mc_test в work_sessions (опциональная relation)
  const workSessions = app.findCollectionByNameOrId("work_sessions");
  const mcTestField = new Field({
    "id": "rel_ws_mc_test",
    "name": "mc_test",
    "type": "relation",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
    "collectionId": "pbc_mc_tests",
    "cascadeDelete": false,
    "maxSelect": 1,
    "minSelect": 0
  });
  workSessions.fields.add(mcTestField);
  app.save(workSessions);
  console.log('[migration] Added mc_test field to work_sessions');

}, (app) => {
  // Откат
  try {
    const workSessions = app.findCollectionByNameOrId("work_sessions");
    const field = workSessions.fields.getByName("mc_test");
    if (field) {
      workSessions.fields.remove(field);
      app.save(workSessions);
    }
  } catch (e) { console.log('[rollback] mc_test field:', e.message); }

  try {
    const collection = app.findCollectionByNameOrId("pbc_mc_tests");
    app.delete(collection);
  } catch (e) { console.log('[rollback] mc_tests:', e.message); }
});
