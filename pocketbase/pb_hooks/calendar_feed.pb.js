/// <reference path="../pb_data/types.d.ts" />

/**
 * Календарь учителя по подписке (v3.9.352): уроки, школьные события и дела
 * в формате iCalendar — iPhone / Mac / Google / Яндекс подписываются по ссылке
 * и сами перечитывают её. Синхронизация ОДНОСТОРОННЯЯ: из Lemma в телефон.
 *
 *   GET  /api/calendar/feed/<токен>.ics  — лента (без входа: календарное
 *        приложение логиниться не умеет, доступ = секретный токен в ссылке)
 *   GET  /api/calendar/link              — токен учителя (создаётся при
 *        первом запросе); нужен вход учителя
 *   POST /api/calendar/link              — новый токен, старая ссылка
 *        перестаёт работать («ссылка утекла»)
 *
 * Токен — teachers.calendar_token (миграция 1788700000), поле hidden: его не
 * видят ни коллеги (teachers.listRule открыт всем учителям), ни сам учитель
 * через обычный API — только через эту ручку.
 *
 * Что в ленте (то же, что в календаре «Моего пространства»):
 *   - уроки: свои + классов, где я второй учитель, + расшаренные мне
 *     (как api.getLessons: owner / group.co_teachers / shared_with);
 *   - школьные события — все (они общие для всех учителей);
 *   - мои открытые дела со сроком.
 * Окно: −60 … +365 дней. Сборка текста — calendar_feed_lib.js (под тестом).
 *
 * ВАЖНО: обработчики хуков не видят переменные внешней области файла —
 * библиотеку подключаем require внутри обработчика.
 */

routerAdd("GET", "/api/calendar/feed/{token}", (c) => {
  const lib = require(`${__hooks}/calendar_feed_lib.js`);
  const token = lib.tokenFromPath(c.request.pathValue("token"));
  if (!token) return c.json(404, { error: "Календарь не найден" });

  let teacher;
  try {
    teacher = $app.findFirstRecordByFilter("teachers", "calendar_token = {:t}", { t: token });
  } catch (err) {
    return c.json(404, { error: "Календарь не найден" });
  }
  const tid = teacher.id;

  const DAY = 24 * 3600 * 1000;
  const pbDate = (ms) => new Date(ms).toISOString().replace("T", " ");
  const now = Date.now();
  const from = pbDate(now - lib.WINDOW_PAST_DAYS * DAY);
  const to = pbDate(now + lib.WINDOW_FUTURE_DAYS * DAY);

  const find = (collection, filter, params) => {
    try {
      return $app.findRecordsByFilter(collection, filter, "", 5000, 0, params);
    } catch (err) {
      console.warn("[calendar-feed] " + collection + ": " + String(err));
      return [];
    }
  };
  const nameCache = {};
  const nameOf = (collection, id) => {
    if (!id) return "";
    const key = collection + ":" + id;
    if (key in nameCache) return nameCache[key];
    let name = "";
    try {
      const r = $app.findRecordById(collection, id);
      name = r.getString("name") || r.getString("username");
    } catch (err) { name = ""; }
    nameCache[key] = name;
    return name;
  };

  // 🚨 У мульти-relation — только через .id (`co_teachers ?= x` молча пуст).
  const lessons = find(
    "lessons",
    "(owner = {:t} || group.co_teachers.id ?= {:t} || shared_with.id ?= {:t})"
      + " && date_plan >= {:from} && date_plan <= {:to}",
    { t: tid, from: from, to: to },
  ).map((r) => ({
    id: r.id,
    title: r.getString("title"),
    date_plan: r.getString("date_plan"),
    time_slot: r.getString("time_slot"),
    status: r.getString("status"),
    owner: r.getString("owner"),
    updated: r.getString("updated"),
    groupName: nameOf("teaching_groups", r.getString("group")),
    ownerName: r.getString("owner") !== tid ? nameOf("teachers", r.getString("owner")) : "",
  }));

  // Многодневное событие попадает в окно, если пересекается с ним.
  const events = find(
    "school_events",
    "date_start <= {:to} && ((date_end = '' && date_start >= {:from}) || date_end >= {:from})",
    { from: from, to: to },
  ).map((r) => ({
    id: r.id,
    title: r.getString("title"),
    kind: r.getString("kind"),
    date_start: r.getString("date_start"),
    date_end: r.getString("date_end"),
    all_day: r.getBool("all_day"),
    note_md: r.getString("note_md"),
    updated: r.getString("updated"),
  }));

  const todos = find(
    "teacher_todos",
    "owner = {:t} && done != true && due_date != '' && due_date >= {:from} && due_date <= {:to}",
    { t: tid, from: from, to: to },
  ).map((r) => ({
    id: r.id,
    title: r.getString("title"),
    due_date: r.getString("due_date"),
    updated: r.getString("updated"),
    groupName: nameOf("teaching_groups", r.getString("group")),
  }));

  const ics = lib.buildIcs({
    teacher: { id: tid, name: teacher.getString("name") || teacher.getString("username") },
    lessons: lessons,
    events: events,
    todos: todos,
    nowMs: now,
  });

  const h = c.response.header();
  h.set("Content-Type", "text/calendar; charset=utf-8");
  h.set("Content-Disposition", 'inline; filename="lemma.ics"');
  h.set("Cache-Control", "private, max-age=300");
  return c.string(200, ics);
});

routerAdd("GET", "/api/calendar/link", (c) => {
  const auth = c.requestInfo().auth;
  if (!auth || auth.collection().name !== "teachers") {
    return c.json(401, { error: "Нужен вход учителя" });
  }
  const teacher = $app.findRecordById("teachers", auth.id);
  let token = teacher.getString("calendar_token");
  if (!token) {
    token = $security.randomStringWithAlphabet(40, "abcdefghijklmnopqrstuvwxyz0123456789");
    teacher.set("calendar_token", token);
    $app.save(teacher);
  }
  return c.json(200, { token: token });
});

routerAdd("POST", "/api/calendar/link", (c) => {
  const auth = c.requestInfo().auth;
  if (!auth || auth.collection().name !== "teachers") {
    return c.json(401, { error: "Нужен вход учителя" });
  }
  const teacher = $app.findRecordById("teachers", auth.id);
  const token = $security.randomStringWithAlphabet(40, "abcdefghijklmnopqrstuvwxyz0123456789");
  teacher.set("calendar_token", token);
  $app.save(teacher);
  return c.json(200, { token: token });
});
