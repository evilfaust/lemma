/// <reference path="../pb_data/types.d.ts" />
// Исправление: geogebra_base64 max=0 → max=null (без ограничений)
// max=0 в PocketBase означает "максимум 0 символов", что блокировало сохранение чертежей
migrate((app) => {
  const collection = app.findCollectionByNameOrId("geometry_tasks");

  const field = collection.fields.getByName("geogebra_base64");
  field.max = null;

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("geometry_tasks");

  const field = collection.fields.getByName("geogebra_base64");
  field.max = 0;

  return app.save(collection);
});
