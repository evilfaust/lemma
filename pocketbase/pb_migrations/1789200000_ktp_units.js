/// <reference path="../pb_data/types.d.ts" />
// КТП по парам (v3.9.409).
//
// courses.unit     — единица плана: 'lesson' (урок 45 мин, по умолчанию) или
//                    'pair' (пара 90 мин). Число в ktp_entries.hours — в этих
//                    единицах; меняются только подписи («Пары», «68 пар (136 ч)»).
// courses.per_week — занятий в неделю: по нему «Расставить недели» и шаблон.
// Пусто = как раньше (уроки, 2 в неделю). Фронт без миграции работает: поля
// просто не сохраняются.
// 🚨 Аддитивно, правила не трогаются.

migrate((app) => {
  const courses = app.findCollectionByNameOrId("courses");
  courses.fields.add(new TextField({
    "id": "text_course_unit",
    "name": "unit",
    "max": 10,
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  courses.fields.add(new NumberField({
    "id": "num_course_per_week",
    "name": "per_week",
    "min": 0,
    "max": 40,
    "onlyInt": false,
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  app.save(courses);
  console.log("[1789200000] courses.unit + courses.per_week — КТП по парам");
}, (app) => {
  try {
    const courses = app.findCollectionByNameOrId("courses");
    courses.fields.removeById("text_course_unit");
    courses.fields.removeById("num_course_per_week");
    app.save(courses);
  } catch (e) { console.log("[1789200000] откат:", e?.message); }
});
