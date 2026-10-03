/// <reference path="../pb_data/types.d.ts" />
// Ссылка ученику на геометрическую работу (v3.9.284, GEOMETRY_TASKS_PLAN § 6).
//
// geometry_works:
//   public — работа открыта ученикам: student.oipav.ru/w/<id> читается без
//            входа (как пособие stereo_scenes.public). Ученику уходят только
//            условия и чертежи — ответы и решения страница не запрашивает.
//   groups — классы (и курсы), в кабинете которых работа появляется
//            (pb_hooks/stereo_feed.pb.js → works); ссылка открыта и без этого.
//
// Правила: к list/view добавляется «|| public = true» (аноним видит только
// открытые работы). Запись по-прежнему только у владельца. Учительские
// списки фильтруют своё сами (andOwner), чужие открытые работы в них не
// попадают.
//
// 🚨 Аддитивно: два необязательных поля + расширение правил чтения.

migrate((app) => {
  const works = app.findCollectionByNameOrId("pbc_geometry_works");
  const GROUPS = app.findCollectionByNameOrId("teaching_groups").id;

  works.fields.add(new BoolField({
    "id": "bool_gwork_public",
    "name": "public",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  works.fields.add(new RelationField({
    "id": "rel_gwork_groups",
    "name": "groups",
    "collectionId": GROUPS,
    "cascadeDelete": false,
    "minSelect": 0,
    "maxSelect": 50,
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));

  const open = (rule) => (rule && !rule.includes("public = true") ? `(${rule}) || public = true` : rule);
  works.listRule = open(works.listRule);
  works.viewRule = open(works.viewRule);
  app.save(works);
  console.log("[1787600000] geometry_works: public + groups — ссылка ученику на работу");
}, (app) => {
  try {
    const works = app.findCollectionByNameOrId("pbc_geometry_works");
    const close = (rule) => {
      const m = /^\((.*)\) \|\| public = true$/.exec(rule || "");
      return m ? m[1] : rule;
    };
    works.listRule = close(works.listRule);
    works.viewRule = close(works.viewRule);
    works.fields.removeById("bool_gwork_public");
    works.fields.removeById("rel_gwork_groups");
    app.save(works);
  } catch (e) {
    console.log("[1787600000] откат:", e?.message);
  }
});
