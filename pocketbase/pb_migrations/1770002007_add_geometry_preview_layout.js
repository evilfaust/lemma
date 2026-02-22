/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("geometry_tasks");

  collection.fields.addAt(14, new Field({
    "hidden": false,
    "id": "json_geo_preview_layout",
    "maxSize": 0,
    "name": "preview_layout",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("geometry_tasks");
  collection.fields.removeById("json_geo_preview_layout");
  return app.save(collection);
});
