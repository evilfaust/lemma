/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_geometry_tasks");

  // Удаляем старое текстовое поле subtopic
  collection.fields.removeById("text_geo_subtopic");

  // Добавляем relation на тему
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

  // Добавляем relation на подтему
  collection.fields.add(new RelationField({
    "id": "rel_geo_subtopic",
    "name": "subtopic",
    "collectionId": "pbc_geometry_subtopics",
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

  // Откат: убираем relation-поля
  collection.fields.removeById("rel_geo_topic");
  collection.fields.removeById("rel_geo_subtopic");

  // Возвращаем текстовое поле subtopic
  collection.fields.add(new TextField({
    "id": "text_geo_subtopic",
    "name": "subtopic",
    "max": 200,
    "min": 0,
    "presentable": false,
    "required": false,
    "system": false
  }));

  return app.save(collection);
});
