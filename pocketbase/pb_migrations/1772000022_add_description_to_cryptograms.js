/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_cryptograms");

  collection.fields.add(new Field({
    "hidden": false,
    "id": "text_cgp_description",
    "max": 2000,
    "min": 0,
    "name": "description",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_cryptograms");
  const field = collection.fields.getByName("description");
  if (field) collection.fields.remove(field);
  return app.save(collection);
});
