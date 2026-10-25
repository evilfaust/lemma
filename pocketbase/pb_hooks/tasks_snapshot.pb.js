/// <reference path="../pb_data/types.d.ts" />

/**
 * GET /api/tasks/snapshot — лёгкий снимок банка задач одним запросом
 * (аудит 25.10.2026).
 *
 * Учительское приложение на старте берёт по каждой задаче id, тему, подтемы,
 * теги, сложность, картинку, источник и год (фильтры, счётчики, «Банк задач»).
 * Через REST это 31 страница по 1000: ~0,25 с сервера на страницу на одном ядре
 * VPS, около 8 с на учителя. Один SQL-запрос с json_group_array — ~0,1 с.
 *
 * Ответ — компактные строки: { fields: [...], rows: [[...], ...] }, порядок
 * полей в rows = fields. Клиент собирает из них прежние объекты
 * (pb/catalog.js::getTasksStatsSnapshot) и при любой ошибке этой ручки
 * откатывается на постраничную загрузку.
 *
 * Доступ — как у самих задач: tasks.listRule публичный, новых данных ручка не
 * открывает. Задачи генераторов (source = "trig_generator") не входят — та же
 * выборка, что и раньше.
 */
routerAdd("GET", "/api/tasks/snapshot", (c) => {
  const result = new DynamicModel({ data: "" });
  $app.db().newQuery(
    "SELECT json_group_array(json_array(" +
    "  id, topic, json(CASE WHEN json_valid(subtopic) THEN subtopic ELSE '[]' END)," +
    "  json(CASE WHEN json_valid(tags) THEN tags ELSE '[]' END)," +
    "  difficulty, has_image, source, year" +
    ")) AS data FROM tasks WHERE source != 'trig_generator'"
  ).one(result);
  const body = '{"fields":["id","topic","subtopic","tags","difficulty","has_image","source","year"],"rows":' +
    (result.data || "[]") + "}";
  c.response.header().set("Cache-Control", "no-store");
  return c.blob(200, "application/json; charset=utf-8", toBytes(body));
});
