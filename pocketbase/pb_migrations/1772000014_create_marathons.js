/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "",
    "deleteRule": "",
    "fields": [
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_mar_title",
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
        "id": "number_mar_class_number",
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
        "cascadeDelete": false,
        "collectionId": "pbc_2602490748",
        "hidden": false,
        "id": "relation_mar_tasks",
        "maxSelect": null,
        "minSelect": 0,
        "name": "tasks",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "json_mar_task_order",
        "maxSize": 0,
        "name": "task_order",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "json_mar_students",
        "maxSize": 0,
        "name": "students",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "json_mar_tracking_data",
        "maxSize": 0,
        "name": "tracking_data",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "autodate_mar_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate_mar_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_marathons",
    "indexes": [],
    "listRule": "",
    "name": "marathons",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_marathons");
  return app.delete(collection);
});
