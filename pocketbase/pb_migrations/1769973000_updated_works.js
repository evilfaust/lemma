/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1034140840")

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "bool_archived",
    "name": "archived",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1034140840")

  // remove field
  collection.fields.removeById("bool_archived")

  return app.save(collection)
})
