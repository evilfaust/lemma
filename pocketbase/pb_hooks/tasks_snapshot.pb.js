/// <reference path="../pb_data/types.d.ts" />

/**
 * Банк задач одним запросом (аудит 25.10.2026, кэш — v3.9.411).
 *
 * GET /api/tasks/snapshot — лёгкий снимок для учительского приложения (фильтры,
 * счётчики, «Банк задач»): { fields: [...], rows: [[...], ...] }. Через REST это
 * 31 страница по 1000; одним SQL — ~0,3 с, а из кэша — миллисекунды.
 *
 * GET /api/tasks/stats — { withAnswer, withSolution, noAnswer, noSolution,
 * review }: два числа для шапки и «тема → сколько задач» для обзора банка.
 * Заменяет пять запросов-подсчётов по 1–1,5 с (каждый читал тексты всех задач).
 *
 * Сборка и кэш — tasks_snapshot_lib.js. Доступ — как у самих задач
 * (tasks.listRule публичный): новых данных ручки не открывают. Клиент при любой
 * ошибке откатывается на прежние запросы (pb/catalog.js).
 */
routerAdd("GET", "/api/tasks/snapshot", (c) => {
  const lib = require(`${__hooks}/tasks_snapshot_lib.js`);
  const body = lib.cached($app, "tasks.snapshot", lib.buildSnapshot);
  c.response.header().set("Cache-Control", "no-store");
  return c.blob(200, "application/json; charset=utf-8", toBytes(body));
});

routerAdd("GET", "/api/tasks/stats", (c) => {
  const lib = require(`${__hooks}/tasks_snapshot_lib.js`);
  const body = lib.cached($app, "tasks.stats", lib.buildStats);
  c.response.header().set("Cache-Control", "no-store");
  return c.blob(200, "application/json; charset=utf-8", toBytes(body));
});
