/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "",
    "deleteRule": "",
    "fields": [
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_tmt_title",
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
        "hidden": false,
        "id": "number_tmt_class",
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
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_tmt_gen_type",
        "max": 60,
        "min": 0,
        "name": "generator_type",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "number_tmt_options_count",
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
        "id": "text_tmt_shuffle_mode",
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
        "id": "json_tmt_settings",
        "maxSize": 0,
        "name": "settings",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "json_tmt_variants",
        "maxSize": 0,
        "name": "variants",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "autodate_tmt_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate_tmt_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_trig_mc_tests",
    "indexes": [],
    "listRule": "",
    "name": "trig_mc_tests",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });
  app.save(collection);
  console.log('[migration] Created trig_mc_tests collection');

}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("trig_mc_tests");
    app.delete(collection);
    console.log('[rollback] Deleted trig_mc_tests collection');
  } catch (e) {
    console.log('[rollback] trig_mc_tests not found:', e.message);
  }
});
