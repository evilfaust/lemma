/// <reference path="../pb_data/types.d.ts" />

// Цвет группы: учитель выбирает оттенок класса руками, а не получает его по
// хешу id. Цвет — «язык» идентичности группы во всех экранах (Календарь,
// Сегодня, Журнал, КТП, Заметки, Дела), поэтому хранится у самой группы.
//
// Пустое значение = авто (детерминированный цвет по id, как было до v3.9.203).
// Список значений дублирует палитру фронта — `src/shared/utils/groupColors.js`.
//
// 🚨 Аддитивно: одно новое опциональное поле. Существующие данные не меняются.
// down-миграция удаляет поле.

migrate((app) => {
  const col = app.findCollectionByNameOrId("teaching_groups");

  if (!col.fields.getByName("color")) {
    col.fields.add(new Field({
      "hidden": false, "id": "select_group_color", "maxSelect": 1, "name": "color",
      "presentable": false, "required": false, "system": false, "type": "select",
      "values": [
        "blue", "indigo", "violet", "fuchsia", "pink", "rose", "orange",
        "amber", "lime", "green", "teal", "cyan", "slate"
      ]
    }));
    app.save(col);
  }

  console.log("[1785000000] teaching_groups: добавлен color (цвет класса)");
}, (app) => {
  const col = app.findCollectionByNameOrId("teaching_groups");
  const f = col.fields.getByName("color");
  if (f) {
    col.fields.removeById(f.id);
    app.save(col);
  }
  console.log("[1785000000] teaching_groups: откат color");
});
