/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const tdfSets = app.findCollectionByNameOrId("tdf_sets");

  const collection = new Collection({
    "createRule": "",
    "deleteRule": "",
    "fields": [
      {
        "cascadeDelete": true,
        "collectionId": tdfSets.id,
        "hidden": false,
        "id": "rel_tdf_variants_set",
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
        "id": "number_tdf_variants_number",
        "max": null,
        "min": null,
        "name": "number",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_tdf_variants_title",
        "max": 300,
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
        "hidden": false,
        "id": "json_tdf_variants_item_ids",
        "maxSize": 0,
        "name": "item_ids",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "autodate_tdf_variants_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate_tdf_variants_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_tdf_variants",
    "indexes": [],
    "listRule": "",
    "name": "tdf_variants",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_tdf_variants");
  return app.delete(collection);
});
