/// <reference path="../pb_data/types.d.ts" />
// Настройки печати маршрутного листа (клетка/линейка, высота места решения,
// кегль, ключ учителя, своя инструкция). Хранятся вместе с листом: лист на
// 4 задачи с клеткой и лист на 12 устных — это разные листы, а не разные
// предпочтения учителя.
//
// Старые листы приходят без поля вовсе; фронт нормализует их через
// `normalizeRouteSettings` (ege-tasks/src/utils/routeSheet.js).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("route_sheets");

  collection.fields.add(new Field({
    "hidden": false,
    "id": "json_rs_settings",
    "maxSize": 0,
    "name": "settings",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }));

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("route_sheets");
  const field = collection.fields.getByName("settings");
  if (field) collection.fields.remove(field);
  app.save(collection);
});
