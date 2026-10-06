/// <reference path="../pb_data/types.d.ts" />
// Показ условий работы ученикам (v3.9.306): работа из «Моих работ» без
// выдачи — для разбора в классе или как ДЗ, решение в тетради.
//
// works:
//   show_open   — условия открыты: student.oipav.ru/r/<id> (?v=N — свой
//                 вариант) читается без входа. Ученику уходят только условия
//                 и картинки — ответы и решения страница не запрашивает.
//   show_groups — классы (и курсы), в кабинете которых работа появляется
//                 (pb_hooks/stereo_feed.pb.js → shows); ссылка открыта и без этого.
//
// Правила НЕ меняются: works.viewRule, variants и tasks читаются по id без
// входа с мультиучительства (ученик так открывает выдачу). Закрытую работу
// страница не показывает сама (show_open = false → «Работа недоступна») —
// та же UI-only защита, что у всей платформы.
//
// 🚨 Аддитивно: два необязательных поля. Выдачи, попытки и результаты не тронуты.

migrate((app) => {
  const works = app.findCollectionByNameOrId("works");
  const GROUPS = app.findCollectionByNameOrId("teaching_groups").id;

  works.fields.add(new BoolField({
    "id": "bool_work_show_open",
    "name": "show_open",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  works.fields.add(new RelationField({
    "id": "rel_work_show_groups",
    "name": "show_groups",
    "collectionId": GROUPS,
    "cascadeDelete": false,
    "minSelect": 0,
    "maxSelect": 50,
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  app.save(works);
  console.log("[1788200000] works: show_open + show_groups — показ условий ученикам");
}, (app) => {
  try {
    const works = app.findCollectionByNameOrId("works");
    works.fields.removeById("bool_work_show_open");
    works.fields.removeById("rel_work_show_groups");
    app.save(works);
  } catch (e) {
    console.log("[1788200000] откат:", e?.message);
  }
});
