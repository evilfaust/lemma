/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_work_sessions")

  // Add field: achievements_enabled (boolean, default false)
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "bool_achievements_enabled",
    "name": "achievements_enabled",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_work_sessions")

  // Remove field
  collection.fields.removeById("bool_achievements_enabled")

  return app.save(collection)
})
