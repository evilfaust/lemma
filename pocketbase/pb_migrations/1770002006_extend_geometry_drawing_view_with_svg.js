/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("geometry_tasks");
  const field = collection.fields.getByName("drawing_view");
  field.values = ["image", "geogebra", "svg"];
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("geometry_tasks");
  const field = collection.fields.getByName("drawing_view");
  field.values = ["image", "geogebra"];
  return app.save(collection);
});
