/// <reference path="../pb_data/types.d.ts" />
// Фикс: миграция 2011 не создала поле topic — добавляем его явно
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_geometry_tasks");

  // Проверяем, нет ли уже поля topic
  const existing = collection.fields.find(f => f.name === "topic");
  if (existing) {
    console.log("Field 'topic' already exists, skipping");
    return;
  }

  collection.fields.add(new RelationField({
    "id": "rel_geo_topic",
    "name": "topic",
    "collectionId": "pbc_geometry_topics",
    "cascadeDelete": false,
    "maxSelect": 1,
    "minSelect": 0,
    "presentable": false,
    "required": false,
    "system": false
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_geometry_tasks");
  collection.fields.removeById("rel_geo_topic");
  return app.save(collection);
});
