/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_attempts")

  // Add field: student (relation to students collection)
  collection.fields.addAt(2, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_students",
    "hidden": false,
    "id": "relation_student",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "student",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // Update view rule: students see only their attempts, admins see all
  collection.viewRule = "@request.auth.id = '' || @request.auth.collectionName != 'students' || student = @request.auth.id || student = ''"

  // Update list rule: students see only their attempts, admins see all
  collection.listRule = "@request.auth.id = '' || @request.auth.collectionName != 'students' || student = @request.auth.id || student = ''"

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_attempts")

  // Remove field
  collection.fields.removeById("relation_student")

  // Restore old rules
  collection.viewRule = ""
  collection.listRule = ""

  return app.save(collection)
})
