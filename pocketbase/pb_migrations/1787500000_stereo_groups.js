/// <reference path="../pb_data/types.d.ts" />
// Эфир и чертежи — в личном кабинете ученика (v3.9.283).
//
// groups — классы (и курсы), которым адресован эфир / чертёж:
//   stereo_rooms.groups  — пока идёт эфир, он виден в кабинете учеников этих
//                          классов (ссылка /b/<код> по-прежнему открыта всем);
//   stereo_scenes.groups — открытое пособие (public = true) появляется в
//                          кабинете этих классов: младшие не видят чертежей
//                          старшей школы. Ссылка /s/<id> — по-прежнему всем.
//
// Кабинет собирает ученик НЕ через правила коллекций, а хуком
// pb_hooks/stereo_feed.pb.js (GET /api/stereo/my): классы ученика — указатель
// + членства (active / transferred — переведённый с классом на новый год
// видит прошлогоднее, п. 14 CLAUDE.md) + курсы. Правила коллекций не меняются.
//
// Старое stereo_rooms.group (один класс, код/название по умолчанию) остаётся;
// бэкфилл: groups = [group] у комнат, где класс был выбран.
//
// 🚨 Аддитивно: два необязательных поля + бэкфилл нового поля.

migrate((app) => {
  const GROUPS = app.findCollectionByNameOrId("teaching_groups").id;
  const field = (id) => new RelationField({
    "id": id,
    "name": "groups",
    "collectionId": GROUPS,
    "cascadeDelete": false,
    "minSelect": 0,
    "maxSelect": 50,
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  });

  const rooms = app.findCollectionByNameOrId("pbc_stereo_rooms");
  rooms.fields.add(field("rel_stroom_groups"));
  app.save(rooms);

  const scenes = app.findCollectionByNameOrId("pbc_stereo_scenes");
  scenes.fields.add(field("rel_stscn_groups"));
  app.save(scenes);

  let filled = 0;
  for (const r of app.findRecordsByFilter("stereo_rooms", "group != ''", "", 0, 0)) {
    r.set("groups", [r.getString("group")]);
    app.saveNoValidate(r);
    filled++;
  }
  console.log(`[1787500000] stereo_rooms/stereo_scenes.groups: классы эфира и пособий (комнат с классом: ${filled})`);
}, (app) => {
  try {
    for (const [col, id] of [["pbc_stereo_rooms", "rel_stroom_groups"], ["pbc_stereo_scenes", "rel_stscn_groups"]]) {
      const c = app.findCollectionByNameOrId(col);
      c.fields.removeById(id);
      app.save(c);
    }
  } catch (e) {
    console.log("[1787500000] откат:", e?.message);
  }
});
