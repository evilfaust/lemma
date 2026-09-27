/// <reference path="../pb_data/types.d.ts" />
// Живые стереочертежи, этап 3 — библиотека чертежей (v3.9.247,
// план STEREO_LIVE_PLAN.md).
//
// stereo_scenes — сохранённый чертёж учителя: тело + журнал шагов с
// подписями + ракурс. Из библиотеки чертёж открывается в редакторе (и
// оттуда — в эфир), а с флагом `public` становится пошаговым пособием для
// ученика по ссылке student.oipav.ru/s/<id> (без логина).
//
// Доступ: учитель — свои (superadmin — все), owner не перевесить. Аноним
// читает запись ТОЛЬКО с public = true. Персональных данных в записи нет;
// журнал шагов — это и есть решение задачи, поэтому ссылку учитель открывает
// сам и сознательно (решение пользователя 12.07.2026 — решения задач банка
// ученику не показываем; пособие — материал учителя, не банк).
//
// 🚨 Аддитивно: новая коллекция, существующие данные не трогаются.

migrate((app) => {
  const T = '@request.auth.collectionName = "teachers"';
  const NV = '@request.auth.role != "viewer"';
  const SA = '@request.auth.role = "superadmin"';
  const OWN = `(${SA} || owner = @request.auth.id)`;
  const keepOwner = '(@request.body.owner:isset = false || @request.body.owner = owner)';

  const scenes = new Collection({
    "id": "pbc_stereo_scenes",
    "name": "stereo_scenes",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
      },
      {
        "hidden": false, "id": "rel_stscn_owner", "name": "owner", "presentable": false,
        "required": true, "system": false, "type": "relation",
        "collectionId": "pbc_teachers", "cascadeDelete": false, "minSelect": 1, "maxSelect": 1
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_stscn_title",
        "max": 200, "min": 1, "name": "title", "pattern": "",
        "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text"
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_stscn_note",
        "max": 2000, "min": 0, "name": "note", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "json_stscn_scene", "maxSize": 1000000, "name": "scene",
        "presentable": false, "required": false, "system": false, "type": "json"
      },
      {
        "hidden": false, "id": "json_stscn_camera", "maxSize": 2000, "name": "camera",
        "presentable": false, "required": false, "system": false, "type": "json"
      },
      {
        "hidden": false, "id": "bool_stscn_public", "name": "public", "presentable": false,
        "required": false, "system": false, "type": "bool"
      },
      {
        "hidden": false, "id": "autodate_stscn_created", "name": "created",
        "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate"
      },
      {
        "hidden": false, "id": "autodate_stscn_updated", "name": "updated",
        "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX idx_stereo_scenes_owner ON stereo_scenes (owner)"
    ],
    "listRule": `(${T} && ${OWN}) || public = true`,
    "viewRule": `(${T} && ${OWN}) || public = true`,
    "createRule": `${T} && ${NV} && owner = @request.auth.id`,
    "updateRule": `${T} && ${NV} && ${OWN} && ${keepOwner}`,
    "deleteRule": `${T} && ${NV} && ${OWN}`
  });
  app.save(scenes);
  console.log("[1787000000] stereo_scenes: библиотека стереочертежей");
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("pbc_stereo_scenes"));
  } catch (e) {
    console.log("[1787000000] откат:", e?.message);
  }
});
