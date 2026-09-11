/// <reference path="../pb_data/types.d.ts" />
// Снимок задач маршрутного листа.
//
// Маршрут — цепочка на один урок, а не пополнение банка: задачи вида «уменьшите
// [②] в [①] раз» вне своей цепочки бессмысленны. Поэтому импортированные и
// сочинённые ИИ задачи живут снимком в самом листе (как `generator_sheets`),
// а relation `tasks` остаётся для задач, взятых из каталога, — у них есть
// собственная жизнь в банке.
//
// Старые листы приходят без поля; фронт тогда читает состав из `tasks`
// (см. loadFromSaved в hooks/useRouteSheet.js).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("route_sheets");

  collection.fields.add(new Field({
    "hidden": false,
    "id": "json_rs_tasks_data",
    "maxSize": 0,
    "name": "tasks_data",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }));

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("route_sheets");
  const field = collection.fields.getByName("tasks_data");
  if (field) collection.fields.remove(field);
  app.save(collection);
});
