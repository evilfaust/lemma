/// <reference path="../pb_data/types.d.ts" />
// Ручное закрытие результатов выдачи (v3.9.321).
//
// work_sessions.results_hidden — учитель пока не публикует результаты:
// ученик видит «работа сдана», но не баллы и не ответы (главная кабинета,
// «Прогресс», страница результата, каникулярная программа). По умолчанию
// поле пустое = результаты видны сразу, как и раньше; закрывают только
// отдельные работы (переключатель в «Результатах» и в окне ввода бланков).
//
// Правила НЕ меняются — та же UI-only защита, что у всей платформы
// (attempts читаются учеником напрямую).
//
// 🚨 Аддитивно: одно необязательное поле. Выдачи и попытки не тронуты.

migrate((app) => {
  const sessions = app.findCollectionByNameOrId("work_sessions");
  sessions.fields.add(new BoolField({
    "id": "bool_session_results_hidden",
    "name": "results_hidden",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  app.save(sessions);
  console.log("[1788500000] work_sessions: results_hidden — результаты закрыты вручную");
}, (app) => {
  try {
    const sessions = app.findCollectionByNameOrId("work_sessions");
    sessions.fields.removeById("bool_session_results_hidden");
    app.save(sessions);
  } catch (e) {
    console.log("[1788500000] откат:", e?.message);
  }
});
