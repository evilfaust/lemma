/// <reference path="../pb_data/types.d.ts" />
// Добавляем значение 'nonogram' в select generator_sheets.kind.
//
// Четвёртая форма снимка листа — японский кроссворд: в tasks_data лежат
// { matrix, givens, variants: [{ rows, cols }] } — картинка, готовые клетки и
// подсказки-примеры по вариантам (ege-tasks/src/utils/nonogram/sheet.js).
//
// 🚨 Аддитивно: правится только список допустимых значений, записи не трогаются.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_generator_sheets");
  const field = collection.fields.getByName("kind");
  if (field && !field.values.includes("nonogram")) {
    field.values = [...field.values, "nonogram"];
    app.save(collection);
    console.log("[1789500000] generator_sheets.kind += nonogram");
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_generator_sheets");
  const field = collection.fields.getByName("kind");
  if (field) {
    field.values = field.values.filter((v) => v !== "nonogram");
    app.save(collection);
    console.log("[1789500000] откат: убрано nonogram");
  }
});
