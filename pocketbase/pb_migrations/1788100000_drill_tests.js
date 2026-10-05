/// <reference path="../pb_data/types.d.ts" />
// Тренировки из генераторов без задач в банке (v3.9.296).
//
// Раньше «Тест A/B/C/D» из генератора создавал запись в `tasks` на каждое
// задание каждого варианта (source='trig_generator'): ответ ученика
// (`attempt_answers.task`) обязан ссылаться на задачу. Так банк и векторный
// индекс засорялись примерами устного счёта. Теперь задания живут только в
// снимке теста (`mc_tests.variants`, ключ задания `v2-q7`), а ответы — в самой
// попытке:
//
// mc_tests.answer_mode    — 'choice' (выбор из A/B/C/D) | 'input' (вписать
//                           ответ, проверка по значению). Пусто = 'choice'.
// attempts.drill_answers  — [{ key, given, correct }] ответы на тренировку.
//                           В attempt_answers они НЕ пишутся — поэтому не
//                           попадают в решаемость задач и профиль слабостей.
//
// 🚨 Аддитивно: два новых поля, данные не трогаются.

migrate((app) => {
  const tests = app.findCollectionByNameOrId("mc_tests");
  tests.fields.add(new TextField({
    "id": "text_mct_answer_mode",
    "name": "answer_mode",
    "max": 20,
    "min": 0,
    "pattern": "^[a-z]*$",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  app.save(tests);

  const attempts = app.findCollectionByNameOrId("attempts");
  attempts.fields.add(new JSONField({
    "id": "json_att_drill_answers",
    "name": "drill_answers",
    "maxSize": 200000,
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  app.save(attempts);

  console.log("[1788100000] mc_tests.answer_mode + attempts.drill_answers");
}, (app) => {
  try {
    const tests = app.findCollectionByNameOrId("mc_tests");
    tests.fields.removeById("text_mct_answer_mode");
    app.save(tests);
  } catch (e) { console.log("[1788100000] откат mc_tests:", e?.message); }
  try {
    const attempts = app.findCollectionByNameOrId("attempts");
    attempts.fields.removeById("json_att_drill_answers");
    app.save(attempts);
  } catch (e) { console.log("[1788100000] откат attempts:", e?.message); }
});
