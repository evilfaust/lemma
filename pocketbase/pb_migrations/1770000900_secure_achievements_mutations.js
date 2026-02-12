/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_achievements")

  // Оставляем публичное чтение, но закрываем изменения для обычных клиентов.
  collection.createRule = null
  collection.updateRule = null
  collection.deleteRule = null

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_achievements")

  // Откат к предыдущему поведению (публичные изменения).
  collection.createRule = ""
  collection.updateRule = ""
  collection.deleteRule = ""

  return app.save(collection)
})
