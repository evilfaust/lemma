/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "",
    "deleteRule": "",
    "fields": [
      {
        "cascadeDelete": true,
        "collectionId": "pbc_tdf_sets",
        "hidden": false,
        "id": "rel_tdf_items_set",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "tdf_set",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "number_tdf_items_order",
        "max": null,
        "min": null,
        "name": "order",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "bool_tdf_items_is_section",
        "name": "is_section_header",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_tdf_items_section_title",
        "max": 300,
        "min": 0,
        "name": "section_title",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select_tdf_items_type",
        "maxSelect": 1,
        "name": "type",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": ["theorem", "definition", "formula", "axiom", "property"]
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_tdf_items_name",
        "max": 300,
        "min": 0,
        "name": "name",
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
        "id": "text_tdf_items_question",
        "max": 0,
        "min": 0,
        "name": "question_md",
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
        "id": "text_tdf_items_formulation",
        "max": 0,
        "min": 0,
        "name": "formulation_md",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "file_tdf_items_drawing",
        "maxSelect": 1,
        "maxSize": 5242880,
        "mimeTypes": ["image/png", "image/jpeg", "image/webp"],
        "name": "drawing_image",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": [],
        "type": "file"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_tdf_items_ggb_base64",
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
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_tdf_items_ggb_appname",
        "max": 50,
        "min": 0,
        "name": "geogebra_appname",
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
        "id": "text_tdf_items_notation",
        "max": 0,
        "min": 0,
        "name": "short_notation_md",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate_tdf_items_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate_tdf_items_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_tdf_items",
    "indexes": [],
    "listRule": "",
    "name": "tdf_items",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_tdf_items");
  return app.delete(collection);
});
