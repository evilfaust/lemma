/// <reference path="../pb_data/types.d.ts" />
// Статьи теории — личные, коллегам видны только открытые (v3.9.390).
//
// До миграции теория была общим банком: любой учитель читал и правил любую
// статью (правило чтения — «учитель || public», запись — editor+). Теперь:
// • theory_articles.owner → teachers — автор статьи;
// • читать: открытую (`public`, «Поделиться») — все, как и раньше по ссылке;
//   закрытую — только автор и superadmin;
// • править/удалять — только автор и superadmin (открытая статья коллеги —
//   только для чтения).
// Статья без owner (создана задеплоенным фронтом до v3.9.390) ведёт себя как
// прежде — видна и правится всеми учителями; так же устроен OWN в 1783300000.
//
// Бэкфилл: автор — из audit_log (create theory_articles, первым по времени),
// иначе evilfaust (он писал теорию до появления журнала).

const T  = '@request.auth.collectionName = "teachers"';
const NV = '@request.auth.role != "viewer"';
const OWN = '(owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")';
const READ = `public = true || (${T} && ${OWN})`;
const WRITE = `${T} && ${NV} && ${OWN}`;

// Правила до миграции (1787700000 + 1783300000) — для отката
const PREV_READ = '@request.auth.collectionName = "teachers" || public = true';
const PREV_WRITE = `${T} && ${NV}`;

migrate((app) => {
  const articles = app.findCollectionByNameOrId("theory_articles");
  const teachers = app.findCollectionByNameOrId("teachers");

  if (!articles.fields.getByName("owner")) {
    articles.fields.add(new Field({
      "hidden": false, "id": "rel_theory_articles_owner", "name": "owner",
      "presentable": false, "required": false, "system": false, "type": "relation",
      "collectionId": teachers.id, "cascadeDelete": false, "minSelect": 0, "maxSelect": 1,
    }));
    app.save(articles);
  }

  let fallback = "e2aibf5o17ko6ai"; // прод-id evilfaust
  try {
    fallback = app.findFirstRecordByFilter("teachers", "username = 'evilfaust'").id;
  } catch (_) { /* оставляем прод-id */ }

  app.db().newQuery(`
    UPDATE theory_articles SET owner = COALESCE((
      SELECT a.teacher_id FROM audit_log a
      JOIN teachers t ON t.id = a.teacher_id
      WHERE a.collection_name = 'theory_articles' AND a.action = 'create'
        AND a.record_id = theory_articles.id
      ORDER BY a.created LIMIT 1
    ), {:fallback})
    WHERE owner = '' OR owner IS NULL
  `).bind({ fallback }).execute();

  const col = app.findCollectionByNameOrId("theory_articles");
  col.listRule = READ;
  col.viewRule = READ;
  col.updateRule = WRITE;
  col.deleteRule = WRITE;
  app.save(col);
  console.log("[1788900000] theory_articles: owner + чтение «своё или открытое», запись — автору");
}, (app) => {
  const col = app.findCollectionByNameOrId("theory_articles");
  col.listRule = PREV_READ;
  col.viewRule = PREV_READ;
  col.updateRule = PREV_WRITE;
  col.deleteRule = PREV_WRITE;
  const f = col.fields.getByName("owner");
  if (f) col.fields.removeById(f.id);
  app.save(col);
});
