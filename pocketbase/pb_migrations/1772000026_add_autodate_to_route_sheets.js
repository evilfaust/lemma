/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("route_sheets");

  collection.fields.add(new Field({
    "hidden": false,
    "id": "autodate_rs_created",
    "name": "created",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }));

  collection.fields.add(new Field({
    "hidden": false,
    "id": "autodate_rs_updated",
    "name": "updated",
    "onCreate": true,
    "onUpdate": true,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }));

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("route_sheets");
  const created = collection.fields.getByName("created");
  if (created) collection.fields.remove(created);
  const updated = collection.fields.getByName("updated");
  if (updated) collection.fields.remove(updated);
  app.save(collection);
});
