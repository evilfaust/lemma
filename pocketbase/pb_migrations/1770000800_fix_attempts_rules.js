/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_attempts")

  // Fix view rule: unauth users (admins) see all, students see only their attempts
  collection.viewRule = "@request.auth.id = '' || @request.auth.collectionName != 'students' || student = @request.auth.id || student = ''"

  // Fix list rule: unauth users (admins) see all, students see only their attempts
  collection.listRule = "@request.auth.id = '' || @request.auth.collectionName != 'students' || student = @request.auth.id || student = ''"

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_attempts")

  // Restore previous rules
  collection.viewRule = "@request.auth.id != '' && (student = @request.auth.id || student = '')"
  collection.listRule = "@request.auth.id != '' && (student = @request.auth.id || student = '')"

  return app.save(collection)
})
