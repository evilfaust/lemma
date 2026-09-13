/// <reference path="../pb_data/types.d.ts" />
// topics.archived — тема снята с боевой нумерации ЕГЭ, но задачи в ней живы.
//
// Понадобилось при переходе профильного ЕГЭ на структуру 2027: задание
// «Наибольшее и наименьшее значение функций» (старое №12) из КИМа убрали, а
// развёрнутая финансовая задача (старое №16) заменена на упрощённую в части 1.
// Задачи этих тем остаются в каталоге и в генераторе листов, но не участвуют
// в сборке полного варианта ЕГЭ.
//
// 🚨 Аддитивно: новое поле со значением false по умолчанию, записи не трогаются.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("topics");
  if (!collection.fields.getByName("archived")) {
    collection.fields.add(new Field({
      name: "archived",
      type: "bool",
    }));
    app.save(collection);
    console.log("[1784800000] topics.archived добавлено");
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("topics");
  const field = collection.fields.getByName("archived");
  if (field) {
    collection.fields.removeById(field.id);
    app.save(collection);
    console.log("[1784800000] откат: topics.archived удалено");
  }
});
