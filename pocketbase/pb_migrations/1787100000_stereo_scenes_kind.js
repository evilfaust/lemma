/// <reference path="../pb_data/types.d.ts" />
// Библиотека планиметрических чертежей (v3.9.267, план PLANIM_PLAN.md).
//
// Планиметрические чертежи живут в той же коллекции stereo_scenes, что и
// стереочертежи: те же поля (название, заметка, сцена-журнал, public для
// пособия ученика по ссылке student.oipav.ru/s/<id>) и те же правила доступа.
// Отличает их поле kind:
//   ''       — стереочертёж (все записи, сохранённые до этой миграции)
//   'planim' — планиметрический чертёж
// Библиотека стерео фильтрует kind != "planim", библиотека планиметрии —
// kind = "planim"; пособие ученика выбирает холст по kind.
//
// 🚨 Аддитивно: новое необязательное текстовое поле + индекс. Существующие
// записи не трогаются (kind у них пустой = стерео), правила не меняются.

migrate((app) => {
  const col = app.findCollectionByNameOrId("pbc_stereo_scenes");
  col.fields.add(new TextField({
    "id": "text_stscn_kind",
    "name": "kind",
    "max": 20,
    "min": 0,
    "pattern": "^[a-z]*$",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  col.indexes = [
    ...col.indexes.filter((i) => !i.includes("idx_stereo_scenes_owner_kind")),
    "CREATE INDEX idx_stereo_scenes_owner_kind ON stereo_scenes (owner, kind)",
  ];
  app.save(col);
  console.log("[1787100000] stereo_scenes.kind: библиотека планиметрических чертежей");
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("pbc_stereo_scenes");
    col.indexes = col.indexes.filter((i) => !i.includes("idx_stereo_scenes_owner_kind"));
    col.fields.removeById("text_stscn_kind");
    app.save(col);
  } catch (e) {
    console.log("[1787100000] откат:", e?.message);
  }
});
