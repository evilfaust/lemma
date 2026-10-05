/// <reference path="../pb_data/types.d.ts" />
// Расписание и ДЗ в кабинете ученика — для обычных классов (v3.9.291).
//
// teaching_groups.student_schedule — класс показывает ученикам расписание и ДЗ.
//   Включается вручную на каждый класс (решение пользователя 05.10.2026), чтобы
//   ученики не увидели разом темы уроков всех классов. У курсов (kind='course')
//   кабинет есть всегда, флаг им не нужен.
// lessons.hidden_from_students — урок не показывается ученикам. Раньше этот
//   флаг жил в копии урока (lesson_publications.published) и только у курсов;
//   теперь ученик читает уроки через хук /api/lessons/my прямо из lessons,
//   поэтому флаг переезжает в сам урок. Перенос значений — ниже.
//
// 🚨 Аддитивно: два bool-поля + копирование флага из lesson_publications.

migrate((app) => {
  const groups = app.findCollectionByNameOrId("teaching_groups");
  groups.fields.add(new BoolField({
    "id": "bool_tg_student_schedule",
    "name": "student_schedule",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  app.save(groups);

  const lessons = app.findCollectionByNameOrId("lessons");
  lessons.fields.add(new BoolField({
    "id": "bool_lessons_hidden_students",
    "name": "hidden_from_students",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  app.save(lessons);

  // Скрытые занятия курсов: published=false в витрине → флаг в самом уроке.
  let moved = 0;
  try {
    const hidden = app.findRecordsByFilter("lesson_publications", "published != true", "", 10000, 0);
    for (const pub of hidden) {
      try {
        const lesson = app.findRecordById("lessons", pub.getString("lesson"));
        lesson.set("hidden_from_students", true);
        app.saveNoValidate(lesson);
        moved++;
      } catch (e) { /* урок удалён — витрина уйдёт каскадом */ }
    }
  } catch (e) {
    console.log("[1787800000] lesson_publications не прочитать:", e?.message);
  }
  console.log("[1787800000] student_schedule + hidden_from_students; скрытых уроков перенесено: " + moved);
}, (app) => {
  try {
    const groups = app.findCollectionByNameOrId("teaching_groups");
    groups.fields.removeById("bool_tg_student_schedule");
    app.save(groups);
  } catch (e) { console.log("[1787800000] откат teaching_groups:", e?.message); }
  try {
    const lessons = app.findCollectionByNameOrId("lessons");
    lessons.fields.removeById("bool_lessons_hidden_students");
    app.save(lessons);
  } catch (e) { console.log("[1787800000] откат lessons:", e?.message); }
});
