/// <reference path="../pb_data/types.d.ts" />

// Общий школьный календарь: мероприятия, видные ВСЕМ учителям (педсовет,
// каникулы, олимпиада, родительское собрание, пробник). Отдельная сущность, а
// НЕ урок с пустой группой: у мероприятия нет класса, КТП и посещаемости, зато
// оно бывает многодневным (каникулы, неделя математики) — `lessons` этого не умеет.
//
// Модель доступа: видят все учителя, правит и удаляет автор (или superadmin).
// Ученикам не видно вовсе — правила требуют логина учителя.
//
// 🚨 Аддитивно: новая коллекция, существующих правил не трогает.
// Down-миграция удаляет коллекцию.

const T = '@request.auth.collectionName = "teachers"';
const NV = '@request.auth.role != "viewer"';
const OWN = '(owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")';

migrate((app) => {
  const events = new Collection({
    "id": "pbc_school_events",
    "name": "school_events",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
      },
      {
        "hidden": false, "id": "rel_sevent_owner", "name": "owner", "presentable": false,
        "required": true, "system": false, "type": "relation",
        "collectionId": "pbc_teachers", "cascadeDelete": false, "minSelect": 1, "maxSelect": 1
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_sevent_title",
        "max": 500, "min": 1, "name": "title", "pattern": "",
        "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "select_sevent_kind", "maxSelect": 1, "name": "kind",
        "presentable": false, "required": false, "system": false, "type": "select",
        "values": ["meeting", "holiday", "olympiad", "exam", "parents", "other"]
      },
      {
        "hidden": false, "id": "date_sevent_start", "name": "date_start",
        "presentable": false, "required": true, "system": false, "type": "date", "min": "", "max": ""
      },
      {
        // Пусто = однодневное. Заполнено = диапазон (каникулы, неделя математики).
        "hidden": false, "id": "date_sevent_end", "name": "date_end",
        "presentable": false, "required": false, "system": false, "type": "date", "min": "", "max": ""
      },
      {
        "hidden": false, "id": "bool_sevent_allday", "name": "all_day",
        "presentable": false, "required": false, "system": false, "type": "bool"
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_sevent_note",
        "max": 10000, "min": 0, "name": "note_md", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        // Та же палитра, что у класса (teaching_groups.color, миграция 1785000000):
        // цвет — общий язык раздела, второй словарь заводить незачем.
        "hidden": false, "id": "select_sevent_color", "maxSelect": 1, "name": "color",
        "presentable": false, "required": false, "system": false, "type": "select",
        "values": [
          "blue", "indigo", "violet", "fuchsia", "pink", "rose", "orange",
          "amber", "lime", "green", "teal", "cyan", "slate"
        ]
      },
      {
        "hidden": false, "id": "autodate_sevent_created", "name": "created",
        "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate"
      },
      {
        "hidden": false, "id": "autodate_sevent_updated", "name": "updated",
        "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX idx_school_events_start ON school_events (date_start)",
      "CREATE INDEX idx_school_events_owner ON school_events (owner)"
    ],
    // Видно всем учителям; заводит любой, кроме viewer; правит и сносит автор.
    "listRule": T,
    "viewRule": T,
    "createRule": `${T} && ${NV}`,
    "updateRule": `${T} && ${NV} && ${OWN}`,
    "deleteRule": `${T} && ${NV} && ${OWN}`
  });
  app.save(events);
  console.log("[1786000000] Создана коллекция school_events (общий школьный календарь)");
}, (app) => {
  app.delete(app.findCollectionByNameOrId("pbc_school_events"));
  console.log("[1786000000] Откачена коллекция school_events");
});
