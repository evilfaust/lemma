/// <reference path="../pb_data/types.d.ts" />
// Добавляем значение 'classify' в select generator_sheets.kind.
//
// Третья форма снимка листа — «Сортировщик» (лист на классификацию уравнений):
// в tasks_data лежат не «варианты × задания», а { buckets, items } — карманы
// с типами и банк уравнений с разметкой учителя.
//
// 🚨 Аддитивно: правится только список допустимых значений, записи не трогаются.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_generator_sheets");
  const field = collection.fields.getByName("kind");
  if (field && !field.values.includes("classify")) {
    field.values = [...field.values, "classify"];
    app.save(collection);
    console.log("[1784400000] generator_sheets.kind += classify");
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_generator_sheets");
  const field = collection.fields.getByName("kind");
  if (field) {
    field.values = field.values.filter((v) => v !== "classify");
    app.save(collection);
    console.log("[1784400000] откат: убрано classify");
  }
});
