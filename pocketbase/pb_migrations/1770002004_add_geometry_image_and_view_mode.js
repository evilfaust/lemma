/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("geometry_tasks");

  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_geo_ggb_image_base64",
    "max": 2000000,
    "min": 0,
    "name": "geogebra_image_base64",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }));

  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "select_geo_drawing_view",
    "maxSelect": 1,
    "name": "drawing_view",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": ["image", "geogebra"]
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("geometry_tasks");

  collection.fields.removeById("text_geo_ggb_image_base64");
  collection.fields.removeById("select_geo_drawing_view");

  return app.save(collection);
});
