/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_students")

  // Allow teacher (unauth app) and admins to update students.
  // Student self-update remains allowed via id check.
  collection.updateRule = "@request.auth.id = '' || @request.auth.collectionName != 'students' || id = @request.auth.id"

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_students")

  // Restore stricter student-only self-update rule.
  collection.updateRule = "id = @request.auth.id"

  return app.save(collection)
})
