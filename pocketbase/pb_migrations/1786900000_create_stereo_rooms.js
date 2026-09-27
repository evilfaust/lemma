/// <reference path="../pb_data/types.d.ts" />
// Живые стереочертежи, этап 2 — «эфир» (v3.9.245, план STEREO_LIVE_PLAN.md).
//
// stereo_rooms — постоянная комната учителя (обычно — на класс). Учитель
// строит чертёж в редакторе, запись хранит текущую сцену; ученики открывают
// student.oipav.ru/b/<code> без логина и получают обновления по realtime.
//
//   code   — короткий код для ссылки на доске («10a»), уникален глобально;
//   scene  — { body, ops }: тело + журнал операций (модель пересчитывает
//            клиент, поэтому запись маленькая);
//   camera — { yaw, pitch, zoom, seq } — «смотрите отсюда»;
//   pulse  — { points, lines, seq } — «смотрите на MN»;
//   notice — { text, seq } — «MN и AD скрещиваются»;
//   live   — эфир включён.
//
// Доступ: учитель — свои комнаты (superadmin — все). Аноним читает запись
// ТОЛЬКО пока идёт эфир (list/view = … || live = true): без эфира комнату не
// найти. Персональных данных в комнате нет. Урок марафона (1784700000):
// PocketBase сверяет viewRule и при ДОСТАВКЕ realtime, поэтому выключенный
// эфир ученик узнаёт опросом, а не событием.
//
// group — только для имени/кода по умолчанию; к году не привязано (код
// переживает перевод класса, п. 14 CLAUDE.md здесь не нужен).
//
// 🚨 Аддитивно: новая коллекция, существующие данные не трогаются.

migrate((app) => {
  const T = '@request.auth.collectionName = "teachers"';
  const NV = '@request.auth.role != "viewer"';
  const SA = '@request.auth.role = "superadmin"';
  const OWN = `(${SA} || owner = @request.auth.id)`;
  const keepOwner = '(@request.body.owner:isset = false || @request.body.owner = owner)';
  const GROUPS = app.findCollectionByNameOrId("teaching_groups").id;

  const rooms = new Collection({
    "id": "pbc_stereo_rooms",
    "name": "stereo_rooms",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
      },
      {
        "hidden": false, "id": "rel_stroom_owner", "name": "owner", "presentable": false,
        "required": true, "system": false, "type": "relation",
        "collectionId": "pbc_teachers", "cascadeDelete": false, "minSelect": 1, "maxSelect": 1
      },
      {
        "hidden": false, "id": "rel_stroom_group", "name": "group", "presentable": false,
        "required": false, "system": false, "type": "relation",
        "collectionId": GROUPS, "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_stroom_code",
        "max": 24, "min": 1, "name": "code", "pattern": "^[a-z0-9-]+$",
        "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text"
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_stroom_title",
        "max": 200, "min": 0, "name": "title", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "json_stroom_scene", "maxSize": 1000000, "name": "scene",
        "presentable": false, "required": false, "system": false, "type": "json"
      },
      {
        "hidden": false, "id": "json_stroom_camera", "maxSize": 2000, "name": "camera",
        "presentable": false, "required": false, "system": false, "type": "json"
      },
      {
        "hidden": false, "id": "json_stroom_pulse", "maxSize": 20000, "name": "pulse",
        "presentable": false, "required": false, "system": false, "type": "json"
      },
      {
        "hidden": false, "id": "json_stroom_notice", "maxSize": 4000, "name": "notice",
        "presentable": false, "required": false, "system": false, "type": "json"
      },
      {
        "hidden": false, "id": "bool_stroom_live", "name": "live", "presentable": false,
        "required": false, "system": false, "type": "bool"
      },
      {
        "hidden": false, "id": "autodate_stroom_created", "name": "created",
        "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate"
      },
      {
        "hidden": false, "id": "autodate_stroom_updated", "name": "updated",
        "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX idx_stereo_rooms_code ON stereo_rooms (code)",
      "CREATE INDEX idx_stereo_rooms_owner ON stereo_rooms (owner)"
    ],
    "listRule": `(${T} && ${OWN}) || live = true`,
    "viewRule": `(${T} && ${OWN}) || live = true`,
    "createRule": `${T} && ${NV} && owner = @request.auth.id`,
    "updateRule": `${T} && ${NV} && ${OWN} && ${keepOwner}`,
    "deleteRule": `${T} && ${NV} && ${OWN}`
  });
  app.save(rooms);
  console.log("[1786900000] stereo_rooms: комнаты эфира стереочертежей");
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("pbc_stereo_rooms"));
  } catch (e) {
    console.log("[1786900000] откат:", e?.message);
  }
});
