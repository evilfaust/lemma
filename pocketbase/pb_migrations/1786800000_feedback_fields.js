/// <reference path="../pb_data/types.d.ts" />

// Обратная связь по интенсиву (v3.9.243): черновик пишет LLM, имён ей не
// отправляем — обращение подставляется у нас.
//
//   students.short_name        — как учитель обращается к ученику («Ксюша»,
//                                «Лёня»). Пусто — обращение из словаря по имени.
//   teachers.feedback_examples — образцы стиля обратной связи учителя
//                                (кафедры); пусто — образцы по умолчанию.
//
// Аддитивно: два необязательных текстовых поля, правила не меняются.

migrate((app) => {
  const students = app.findCollectionByNameOrId("students");
  students.fields.add(new TextField({
    "id": "text_student_short_name", "name": "short_name", "required": false, "max": 60,
  }));
  app.save(students);

  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.fields.add(new TextField({
    "id": "text_teacher_fb_examples", "name": "feedback_examples", "required": false, "max": 20000,
  }));
  app.save(teachers);
  console.log("[1786800000] students.short_name + teachers.feedback_examples");
}, (app) => {
  for (const [col, id] of [["students", "text_student_short_name"], ["teachers", "text_teacher_fb_examples"]]) {
    try {
      const c = app.findCollectionByNameOrId(col);
      c.fields.removeById(id);
      app.save(c);
    } catch (e) {
      console.log("[1786800000] откат:", e?.message);
    }
  }
});
