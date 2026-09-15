/// <reference path="../pb_data/types.d.ts" />

// Совместная работа учителей — два поля доступа:
//
// • `teaching_groups.co_teachers` — учителя, которые ведут класс вместе с
//   владельцем. В школе практикуется «два учителя на класс» (ведущий +
//   помощник), и помощнику нужны уроки, ученики и журнал этого класса.
// • `lessons.shared_with` — точечный доступ к ОДНОМУ уроку (разовая замена,
//   открытый урок), когда весь класс отдавать не нужно.
//
// Оба поля заводятся сразу, одной миграцией: правила (1786200000) ссылаются на
// них вместе, а править правила боевого PB лишний раз — дороже, чем завести
// поле впрок.
//
// 🚨 Это ЕДИНСТВЕННЫЙ источник со-ведения: правила уроков, посещаемости,
// учеников и членств (миграция 1786200000) обходят relation до группы и
// спрашивают этот список. Убрали коллегу отсюда — доступ пропал везде.
//
// 🚨 Аддитивно: одно новое опциональное поле. Существующие данные не меняются.
// Сами правила расширяет следующая миграция — эта только заводит поле.
// Down-миграция удаляет поле.

migrate((app) => {
  const groups = app.findCollectionByNameOrId("teaching_groups");

  if (!groups.fields.getByName("co_teachers")) {
    groups.fields.add(new Field({
      "hidden": false, "id": "rel_group_coteachers", "name": "co_teachers",
      "presentable": false, "required": false, "system": false, "type": "relation",
      "collectionId": "pbc_teachers", "cascadeDelete": false,
      // maxSelect > 1 = мульти-relation. Десяти хватит с запасом:
      // практика — двое на класс (ведущий + помощник).
      "minSelect": 0, "maxSelect": 10
    }));
    app.save(groups);
  }

  const lessons = app.findCollectionByNameOrId("lessons");
  if (!lessons.fields.getByName("shared_with")) {
    lessons.fields.add(new Field({
      "hidden": false, "id": "rel_lesson_sharedwith", "name": "shared_with",
      "presentable": false, "required": false, "system": false, "type": "relation",
      "collectionId": "pbc_teachers", "cascadeDelete": false,
      "minSelect": 0, "maxSelect": 10
    }));
    app.save(lessons);
  }

  console.log("[1786100000] teaching_groups.co_teachers + lessons.shared_with добавлены");
}, (app) => {
  const groups = app.findCollectionByNameOrId("teaching_groups");
  const co = groups.fields.getByName("co_teachers");
  if (co) {
    groups.fields.removeById(co.id);
    app.save(groups);
  }

  const lessons = app.findCollectionByNameOrId("lessons");
  const sh = lessons.fields.getByName("shared_with");
  if (sh) {
    lessons.fields.removeById(sh.id);
    app.save(lessons);
  }

  console.log("[1786100000] Откачены co_teachers и shared_with");
});
