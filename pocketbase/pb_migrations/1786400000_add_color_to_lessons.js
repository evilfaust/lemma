/// <reference path="../pb_data/types.d.ts" />

// Свой цвет урока без класса (v3.9.228). Урок с группой красится цветом
// группы — этот выбор у него не спрашивается; урок БЕЗ группы (кружок,
// консультация, олимпиадная пара) раньше получал цвет по хешу пустой строки,
// то есть всегда синий. Теперь учитель выбирает оттенок сам.
//
// Пустое значение = авто. Список значений дублирует палитру фронта —
// `src/shared/utils/groupColors.js` (как у `teaching_groups.color`).
//
// 🚨 Аддитивно: одно новое опциональное поле. down-миграция удаляет поле.

migrate((app) => {
  const col = app.findCollectionByNameOrId("lessons");

  if (!col.fields.getByName("color")) {
    col.fields.add(new Field({
      "hidden": false, "id": "select_lesson_color", "maxSelect": 1, "name": "color",
      "presentable": false, "required": false, "system": false, "type": "select",
      "values": [
        "blue", "indigo", "violet", "fuchsia", "pink", "rose", "orange",
        "amber", "lime", "green", "teal", "cyan", "slate"
      ]
    }));
    app.save(col);
  }

  console.log("[1786400000] lessons: добавлен color (цвет урока без класса)");
}, (app) => {
  const col = app.findCollectionByNameOrId("lessons");
  const f = col.fields.getByName("color");
  if (f) {
    col.fields.removeById(f.id);
    app.save(col);
  }
  console.log("[1786400000] lessons: откат color");
});
