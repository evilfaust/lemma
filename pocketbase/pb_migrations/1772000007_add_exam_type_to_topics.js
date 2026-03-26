/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const topics = app.findCollectionByNameOrId("topics");

  // Добавляем поле exam_type
  const examTypeField = new Field({
    "id": "select_topics_exam_type",
    "name": "exam_type",
    "type": "select",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
    "maxSelect": 1,
    "values": ["ege_base", "mordkovich", "oral", "vpr", "other"]
  });

  topics.fields.add(examTypeField);
  app.save(topics);
  console.log('Added exam_type field to topics');

  // Проставляем значения для существующих записей
  const db = app.db();

  // ЕГЭ базовый (номера 1-21)
  db.newQuery(
    "UPDATE topics SET exam_type = 'ege_base' WHERE ege_number >= 1 AND ege_number <= 21"
  ).execute();
  console.log('Set exam_type=ege_base for ege_number 1-21');

  // Мордкович и учебниковые (ege_number = 0)
  db.newQuery(
    "UPDATE topics SET exam_type = 'mordkovich' WHERE ege_number = 0"
  ).execute();
  console.log('Set exam_type=mordkovich for ege_number 0');

  // Устный счёт (ege_number 30-31)
  db.newQuery(
    "UPDATE topics SET exam_type = 'oral' WHERE ege_number >= 30 AND ege_number <= 31"
  ).execute();
  console.log('Set exam_type=oral for ege_number 30-31');

  // ВПР (ege_number >= 77)
  db.newQuery(
    "UPDATE topics SET exam_type = 'vpr' WHERE ege_number >= 77"
  ).execute();
  console.log('Set exam_type=vpr for ege_number >= 77');

}, (app) => {
  // Откат: удаляем поле exam_type
  const topics = app.findCollectionByNameOrId("topics");
  const field = topics.fields.getByName("exam_type");
  if (field) {
    topics.fields.remove(field);
    app.save(topics);
    console.log('Removed exam_type field from topics');
  }
});
