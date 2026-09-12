/// <reference path="../pb_data/types.d.ts" />
// Live-дашборд марафона: «эфир» (v3.9.190).
//
// Проблема: миграция 1783300000 (мультиучительство, этап 2) закрыла marathons
// правилом viewRule = `@request.auth.collectionName = "teachers"`. Но
// live-дашборд живёт в УЧЕНИЧЕСКОМ приложении
// (/student/marathon-live/{id} → student.oipav.ru) и открывается анонимно →
// getMarathon отдавал 404, а realtime-события не доставлялись вовсе
// (PocketBase сверяет viewRule при доставке; subscribe при этом не падает,
// поэтому бейдж LIVE горел и врал).
//
// Решение: поле marathons.live_public — тумблер «📡 В эфир» в трекере.
// viewRule = учитель ИЛИ эфир включён. Дашборд читается с любого устройства,
// но только пока учитель сам открыл эфир; вне эфира марафон снова приватен.
//
// 🚨 Аддитивно: поле новое (default false), записи не трогаются.

migrate((app) => {
  const col = app.findCollectionByNameOrId("pbc_marathons");

  if (!col.fields.getByName("live_public")) {
    col.fields.add(new Field({
      "hidden": false, "id": "bool_mar_live_public", "name": "live_public",
      "presentable": false, "required": false, "system": false, "type": "bool"
    }));
  }

  col.viewRule = '@request.auth.collectionName = "teachers" || live_public = true';
  app.save(col);
  console.log('[1784700000] marathons: +live_public, viewRule += эфир');
}, (app) => {
  const col = app.findCollectionByNameOrId("pbc_marathons");

  const f = col.fields.getByName("live_public");
  if (f) col.fields.removeById(f.id);

  col.viewRule = '@request.auth.collectionName = "teachers"';
  app.save(col);
  console.log('[1784700000] откат: marathons.live_public убрано, viewRule = только учитель');
});
