/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_geo_print_tests");

  // Тема листа (текст-снэпшот, чтобы заголовок не менялся при переименовании темы)
  collection.fields.add(new TextField({
    "id": "text_geo_print_sheet_topic",
    "name": "sheet_topic",
    "max": 200,
    "min": 0,
    "presentable": false,
    "required": false,
    "system": false
  }));

  // Подтема листа (текст-снэпшот)
  collection.fields.add(new TextField({
    "id": "text_geo_print_sheet_subtopic",
    "name": "sheet_subtopic",
    "max": 200,
    "min": 0,
    "presentable": false,
    "required": false,
    "system": false
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_geo_print_tests");
  collection.fields.removeById("text_geo_print_sheet_topic");
  collection.fields.removeById("text_geo_print_sheet_subtopic");
  return app.save(collection);
});
