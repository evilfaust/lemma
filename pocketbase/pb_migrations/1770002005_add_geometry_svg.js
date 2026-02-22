/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("geometry_tasks");

  collection.fields.addAt(13, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_geo_ggb_svg",
    "max": 2000000,
    "min": 0,
    "name": "geogebra_svg",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("geometry_tasks");
  collection.fields.removeById("text_geo_ggb_svg");
  return app.save(collection);
});
