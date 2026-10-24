/// <reference path="../pb_data/types.d.ts" />
// Коды задач с буквой экзамена (v3.9.397, TASK_CODES_PLAN.md).
//
// topics.code_prefix — префикс кодов темы без номера экзамена (КУ, ПЛ, И11).
//   У экзаменационных тем пусто: префикс вычисляется (П12, Б5, ОГ3, ПА12,
//   В7.15) — хук task_codes.pb.js, правило в task_codes_lib.js. Уникален
//   среди тем (частичный индекс).
// tasks.old_codes — прежние коды задачи (перенумерация, перенос в другую
//   тему, правка руками): по ним поиск находит задачу со старой распечатки.
// tasks.code_seq — номер в теме числом: сортировка 999 → 1000 и подсказка
//   «следующий номер» без разбора строки.
//
// 🚨 Аддитивно: три необязательных поля, пустые у всех. Правила не меняются.
// Данные переводит SQL-скрипт перевода кодов, уникальность кода —
// следующая миграция (1789000100), только после перевода.

migrate((app) => {
  const topics = app.findCollectionByNameOrId("topics");
  topics.fields.add(new TextField({
    "id": "text_topic_code_prefix",
    "name": "code_prefix",
    "required": false,
    "presentable": false,
    "system": false,
    "max": 16,
    "min": 0,
    "pattern": "^[A-ZА-ЯЁ0-9.]*$",
  }));
  topics.addIndex("idx_topics_code_prefix", true, "code_prefix", "code_prefix != ''");
  app.save(topics);

  const tasks = app.findCollectionByNameOrId("tasks");
  tasks.fields.add(new JSONField({
    "id": "json_task_old_codes",
    "name": "old_codes",
    "required": false,
    "presentable": false,
    "system": false,
    "maxSize": 4000,
  }));
  tasks.fields.add(new NumberField({
    "id": "number_task_code_seq",
    "name": "code_seq",
    "required": false,
    "presentable": false,
    "system": false,
    "onlyInt": true,
    "min": 0,
    "max": null,
  }));
  app.save(tasks);
  console.log("[1789000000] topics.code_prefix, tasks.old_codes, tasks.code_seq");
}, (app) => {
  try {
    const topics = app.findCollectionByNameOrId("topics");
    topics.removeIndex("idx_topics_code_prefix");
    topics.fields.removeById("text_topic_code_prefix");
    app.save(topics);
    const tasks = app.findCollectionByNameOrId("tasks");
    tasks.fields.removeById("json_task_old_codes");
    tasks.fields.removeById("number_task_code_seq");
    app.save(tasks);
  } catch (e) {
    console.log("[1789000000] откат:", e?.message);
  }
});
