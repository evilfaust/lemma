/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_achievements")

  // Update rules to allow public access
  collection.createRule = ""
  collection.updateRule = ""
  collection.deleteRule = ""

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_achievements")

  // Revert to superuser only
  collection.createRule = null
  collection.updateRule = null
  collection.deleteRule = null

  return app.save(collection)
})
