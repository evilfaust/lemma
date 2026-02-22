/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "id": "pbc_geometry_tasks",
    "name": "geometry_tasks",
    "type": "base",
    "system": false,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210257",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_geo_code",
        "max": 30,
        "min": 1,
        "name": "code",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_geo_title",
        "max": 500,
        "min": 0,
        "name": "title",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_geo_subtopic",
        "max": 200,
        "min": 0,
        "name": "subtopic",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "number_geo_difficulty",
        "max": 3,
        "min": 1,
        "name": "difficulty",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "select_geo_task_type",
        "maxSelect": 1,
        "name": "task_type",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": ["ready", "build", "mixed"]
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_geo_statement",
        "max": 50000,
        "min": 0,
        "name": "statement_md",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_geo_answer",
        "max": 500,
        "min": 0,
        "name": "answer",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_geo_solution",
        "max": 50000,
        "min": 0,
        "name": "solution_md",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_geo_ggb_base64",
        "max": 0,
        "min": 0,
        "name": "geogebra_base64",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select_geo_ggb_appname",
        "maxSelect": 1,
        "name": "geogebra_appname",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": ["geometry", "graphing", "classic", "3d"]
      },
      {
        "hidden": false,
        "id": "json_geo_hints",
        "maxSize": 0,
        "name": "hints",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_geo_source",
        "max": 200,
        "min": 0,
        "name": "source",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "number_geo_year",
        "max": null,
        "min": null,
        "name": "year",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "autodate_geo_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate_geo_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX idx_geometry_tasks_code ON geometry_tasks (code)",
      "CREATE INDEX idx_geometry_tasks_subtopic ON geometry_tasks (subtopic)",
      "CREATE INDEX idx_geometry_tasks_difficulty ON geometry_tasks (difficulty)"
    ],
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_geometry_tasks");
  return app.delete(collection);
});
