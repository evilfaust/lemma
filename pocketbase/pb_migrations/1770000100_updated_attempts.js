/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_attempts")

  // add field: achievement (relation to achievements, optional)
  collection.fields.addAt(9, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_achievements",
    "hidden": false,
    "id": "rel_achievement",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "achievement",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field: unlocked_achievements (relation to achievements, multiple)
  collection.fields.addAt(10, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_achievements",
    "hidden": false,
    "id": "rel_unlocked_achievements",
    "maxSelect": 999,
    "minSelect": 0,
    "name": "unlocked_achievements",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field: duration_seconds (number)
  collection.fields.addAt(11, new Field({
    "hidden": false,
    "id": "num_duration_seconds",
    "max": null,
    "min": 0,
    "name": "duration_seconds",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_attempts")

  // remove fields
  collection.fields.removeById("rel_achievement")
  collection.fields.removeById("rel_unlocked_achievements")
  collection.fields.removeById("num_duration_seconds")

  return app.save(collection)
})
