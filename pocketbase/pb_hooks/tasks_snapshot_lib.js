// Снимок и счётчики банка задач с кэшем в памяти PocketBase (v3.9.411).
// Подключается из tasks_snapshot.pb.js через require внутри обработчика
// (обработчики JSVM не видят функций, объявленных в файле вне них).
//
// Кэш — в $app.store() (общий для всех VM пула). Ключ свежести — «сколько
// задач и когда менялась последняя» (`stamp`): правка, создание и удаление
// задачи меняют его, и следующий запрос пересобирает ответ. Страховка от
// правок мимо PocketBase (SQL на VPS не трогает `updated`) — срок жизни TTL_MS.
// 🚨 На VPS класть ОБА файла в /opt/pocketbase/pb_hooks/ + restart.

const TTL_MS = 10 * 60 * 1000;
const BASE = "source != 'trig_generator'";

function scalar(app, sql) {
  const row = new DynamicModel({ data: "" });
  app.db().newQuery(sql).one(row);
  return row.data || "";
}

function stamp(app) {
  // Два подзапроса, а не один SELECT: так max берётся по индексу
  // idx_tasks_updated, а count — по самому узкому индексу (миграция 1789300000).
  return scalar(app,
    "SELECT (SELECT count(*) FROM tasks) || '|' || coalesce((SELECT max(updated) FROM tasks), '') AS data");
}

// Строка JSON, собранная `build`, из кэша — пока не изменились задачи.
function cached(app, key, build) {
  const store = app.store();
  const now = Date.now();
  const s = stamp(app);
  if (store.has(key) && store.get(key + ":stamp") === s && now - Number(store.get(key + ":at")) < TTL_MS) {
    return store.get(key);
  }
  const body = build(app);
  store.set(key, body);
  store.set(key + ":stamp", s);
  store.set(key + ":at", String(now));
  return body;
}

// Лёгкий снимок: строки [id, тема, подтемы, теги, сложность, картинка, источник, год].
function buildSnapshot(app) {
  const rows = scalar(app,
    "SELECT json_group_array(json_array(" +
    "  id, topic, json(CASE WHEN json_valid(subtopic) THEN subtopic ELSE '[]' END)," +
    "  json(CASE WHEN json_valid(tags) THEN tags ELSE '[]' END)," +
    "  difficulty, has_image, source, year" +
    ")) AS data FROM tasks WHERE " + BASE);
  return '{"fields":["id","topic","subtopic","tags","difficulty","has_image","source","year"],"rows":' +
    (rows || "[]") + "}";
}

// Счётчики «с ответом / с решением» и по темам — задачи без ответа, без
// решения, с битым LaTeX (обзор «Банка задач»). Та же выборка, что у снимка.
function buildStats(app) {
  const byTopic = (cond) =>
    "(SELECT coalesce(json_group_object(topic, n), '{}') FROM " +
    "(SELECT topic, count(*) AS n FROM tasks WHERE " + BASE + " AND " + cond + " GROUP BY topic))";
  return scalar(app,
    "SELECT json_object(" +
    "'withAnswer', (SELECT count(*) FROM tasks WHERE " + BASE + " AND answer != '')," +
    "'withSolution', (SELECT count(*) FROM tasks WHERE " + BASE + " AND solution_md != '')," +
    "'noAnswer', json(" + byTopic("answer = ''") + ")," +
    "'noSolution', json(" + byTopic("solution_md = ''") + ")," +
    "'review', json(" + byTopic("latex_needs_review = 1") + ")" +
    ") AS data") || "{}";
}

module.exports = { TTL_MS, stamp, cached, buildSnapshot, buildStats };
