/// <reference path="../pb_data/types.d.ts" />
// Календарь учителя по подписке (v3.9.352).
//
// teachers.calendar_token — секрет ссылки на ленту iCalendar
// (`/api/calendar/feed/<токен>.ics`, хук calendar_feed.pb.js). Выдаёт и меняет
// его только хук (`/api/calendar/link`).
//
// 🚨 Поле hidden: teachers.listRule открыт любому учителю (передача учеников,
// v3.9.120), и без hidden коллега прочёл бы чужой токен и подписался на
// чужой календарь. Hidden-поле не отдаёт и не фильтрует обычный API — только
// суперпользователь и $app в хуках.
//
// 🚨 Аддитивно: одно необязательное поле, пустое у всех. Правила не меняются.

migrate((app) => {
  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.fields.add(new TextField({
    "id": "text_teacher_calendar_token",
    "name": "calendar_token",
    "required": false,
    "hidden": true,
    "presentable": false,
    "system": false,
    "max": 64,
    "min": 0,
    "pattern": "^[a-z0-9]*$",
  }));
  teachers.addIndex(
    "idx_teachers_calendar_token",
    true,
    "calendar_token",
    "calendar_token != ''",
  );
  app.save(teachers);
  console.log("[1788700000] teachers: calendar_token — ссылка на календарь по подписке");
}, (app) => {
  try {
    const teachers = app.findCollectionByNameOrId("teachers");
    teachers.removeIndex("idx_teachers_calendar_token");
    teachers.fields.removeById("text_teacher_calendar_token");
    app.save(teachers);
  } catch (e) {
    console.log("[1788700000] откат:", e?.message);
  }
});
