/// <reference path="../pb_data/types.d.ts" />
// PocketBase в текущей версии трактует text.max = null как дефолтный лимит (5000).
// Для GeoGebra base64 задаем явный большой лимит.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("geometry_tasks");
  const field = collection.fields.getByName("geogebra_base64");

  field.max = 2000000;

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("geometry_tasks");
  const field = collection.fields.getByName("geogebra_base64");

  field.max = null;

  return app.save(collection);
});
