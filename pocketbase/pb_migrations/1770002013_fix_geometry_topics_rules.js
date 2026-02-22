/// <reference path="../pb_data/types.d.ts" />
// Исправляем listRule/viewRule/createRule/updateRule/deleteRule для новых
// geometry-коллекций: NULL → "" (пустая строка = публичный доступ,
// как у geometry_print_tests и остальных geometry_* коллекций)
migrate((app) => {
  for (const name of ['geometry_topics', 'geometry_subtopics']) {
    const collection = app.findCollectionByNameOrId(name);
    collection.listRule = '';
    collection.viewRule = '';
    collection.createRule = '';
    collection.updateRule = '';
    collection.deleteRule = '';
    app.save(collection);
  }
}, (app) => {
  for (const name of ['geometry_topics', 'geometry_subtopics']) {
    const collection = app.findCollectionByNameOrId(name);
    collection.listRule = null;
    collection.viewRule = null;
    collection.createRule = null;
    collection.updateRule = null;
    collection.deleteRule = null;
    app.save(collection);
  }
});
