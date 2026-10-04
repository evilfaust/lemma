/// <reference path="../pb_data/types.d.ts" />
// Статья теории по ссылке (v3.9.285).
//
// theory_articles.public — статья открыта по ссылке student.oipav.ru/t/<id>:
//   читается без входа (коллеги, ученики, родители — все, у кого есть ссылка).
//
// Правила: до миграции list/view были пустыми (читал кто угодно, «защита —
// UI-only»). Теперь чтение — учителям или открытой статье: иначе переключатель
// «по ссылке» ничего бы не значил — закрытую статью можно было прочитать тем же
// запросом. Запись не меняется (учитель не viewer). Категории остаются
// открытыми — их название показывается на странице статьи.
//
// 🚨 Сужение чтения: ученик, гость и учитель с протухшим токеном перестают
// видеть закрытые статьи. Других читателей у коллекции нет (теория живёт
// только в учительском приложении).

const TEACHER_OR_PUBLIC = '@request.auth.collectionName = "teachers" || public = true';

migrate((app) => {
  const articles = app.findCollectionByNameOrId("theory_articles");

  articles.fields.add(new BoolField({
    "id": "bool_theory_public",
    "name": "public",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));

  articles.listRule = TEACHER_OR_PUBLIC;
  articles.viewRule = TEACHER_OR_PUBLIC;
  app.save(articles);
  console.log("[1787700000] theory_articles: public — статья по ссылке; чтение — учителям или открытой");
}, (app) => {
  try {
    const articles = app.findCollectionByNameOrId("theory_articles");
    articles.listRule = "";
    articles.viewRule = "";
    articles.fields.removeById("bool_theory_public");
    app.save(articles);
  } catch (e) {
    console.log("[1787700000] откат:", e?.message);
  }
});
