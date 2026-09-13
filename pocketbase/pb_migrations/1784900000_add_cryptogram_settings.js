/// <reference path="../pb_data/types.d.ts" />
// Настройки печатного листа шифровки (формат «2 на листе», шапка, колонки,
// поля, кегль, поле ответа, ключ учителя, тексты шапки). Хранятся вместе с
// шифровкой: «две копии на A4 с компактной шапкой» — свойство конкретного
// листа, а не общий вкус учителя.
//
// Старые шифровки приходят без поля вовсе; фронт нормализует их через
// `normalizeCryptogramSettings` (ege-tasks/src/utils/cryptogram.js).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_cryptograms");

  collection.fields.add(new Field({
    "hidden": false,
    "id": "json_cgp_settings",
    "maxSize": 0,
    "name": "settings",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }));

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_cryptograms");
  const field = collection.fields.getByName("settings");
  if (field) collection.fields.remove(field);
  app.save(collection);
});
