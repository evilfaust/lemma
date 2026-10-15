/// <reference path="../pb_data/types.d.ts" />
// Что видит ученик к задачам открытой геометрической работы (v3.9.377).
//
// geometry_works.drawings (json) — уровень показа чертежа:
//   { default: 'none'|'image'|'live'|'steps', tasks: { <taskId>: уровень } }
//   none — только условие, image — картинка, live — интерактивный чертёж,
//   steps — чертёж + шаги построения. Пусто = 'live' (как было до поля:
//   стереочертёж крутится, остальное картинкой).
// Ученик получает работу хуком pb_hooks/geometry_work.pb.js — чертёж, который
// учитель скрыл, в ответ сервера не попадает.
//
// 🚨 Аддитивно: одно необязательное поле, правила не меняются.

migrate((app) => {
  const works = app.findCollectionByNameOrId("pbc_geometry_works");
  works.fields.add(new JSONField({
    "id": "json_gwork_drawings",
    "name": "drawings",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
    "maxSize": 200000,
  }));
  app.save(works);
  console.log("[1788800000] geometry_works: drawings — уровни показа чертежей ученику");
}, (app) => {
  try {
    const works = app.findCollectionByNameOrId("pbc_geometry_works");
    works.fields.removeById("json_gwork_drawings");
    app.save(works);
  } catch (e) {
    console.log("[1788800000] откат:", e?.message);
  }
});
