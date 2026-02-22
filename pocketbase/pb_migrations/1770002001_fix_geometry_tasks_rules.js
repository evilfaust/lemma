/// <reference path="../pb_data/types.d.ts" />
// Исправление: установить пустые правила доступа для geometry_tasks
// (аналогично коллекции tasks — доступно для учителя как анонима)
migrate((app) => {
  const collection = app.findCollectionByNameOrId("geometry_tasks");

  collection.listRule   = "";
  collection.viewRule   = "";
  collection.createRule = "";
  collection.updateRule = "";
  collection.deleteRule = "";

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("geometry_tasks");

  collection.listRule   = null;
  collection.viewRule   = null;
  collection.createRule = null;
  collection.updateRule = null;
  collection.deleteRule = null;

  return app.save(collection);
});
