/// <reference path="../pb_data/types.d.ts" />

/**
 * Уроки и ДЗ в кабинете ученика (v3.9.291).
 *
 *   GET /api/lessons/my?from=<ISO>&to=<ISO>
 *     → { groups:  [{ id, name, kind, subject, color, conference_url, board_url }],
 *         lessons: [{ id, group, owner, title, date_plan, time_slot, status,
 *                     conference_url, items: [...] }] }
 *
 * Классы ученика — как в stereo_feed.pb.js: указатель students.teaching_group
 * + членства active / transferred (п. 14 CLAUDE.md) + курсы (course_members).
 * Из них берутся курсы и классы с включённым «Расписанием для учеников»
 * (teaching_groups.student_schedule), архивные — нет.
 *
 * Урок отдаётся ПРОЕКЦИЕЙ (lessons_feed_lib.projectItems): ни заметки урока,
 * ни скрытых файлов, ни учительских работ. Скрытые уроки
 * (hidden_from_students) не отдаются вовсе. Читать lessons напрямую ученик
 * по-прежнему не может — правила коллекции не менялись.
 *
 * Окно дат: по умолчанию −60 … +120 дней от сегодня, и нижняя граница ещё
 * сдвигается на 35 дней: ДЗ «к следующему уроку» ученик видит у урока-цели,
 * а задано оно на уроке раньше окна. Куда оно относится, считает клиент
 * (utils/homework.js — одна функция и для учителя, и для ученика).
 *
 * ВАЖНО: обработчики хуков не видят переменные внешней области файла —
 * библиотеку подключаем require внутри обработчика.
 */

routerAdd("GET", "/api/lessons/my", (c) => {
  const lib = require(`${__hooks}/lessons_feed_lib.js`);
  const info = c.requestInfo();
  const auth = info.auth;
  if (!auth || auth.collection().name !== "students") {
    return c.json(401, { error: "Нужен вход ученика" });
  }
  const sid = auth.id;
  const DAY = 24 * 3600 * 1000;
  const parse = (v, fallback) => {
    const t = v ? Date.parse(v) : NaN;
    return isNaN(t) ? fallback : t;
  };
  const now = Date.now();
  let to = parse(info.query["to"], now + 120 * DAY);
  let from = parse(info.query["from"], now - 60 * DAY);
  if (to - from > 400 * DAY) from = to - 400 * DAY;
  from -= 35 * DAY;

  const ids = {};
  const add = (id) => { if (id) ids[id] = true; };
  add(auth.getString("teaching_group"));
  const each = (collection, filter, fn) => {
    try {
      for (const r of $app.findRecordsByFilter(collection, filter, "", 500, 0, { s: sid })) fn(r);
    } catch (err) {
      console.warn("[lessons-feed] " + collection + ": " + String(err));
    }
  };
  each("group_memberships", "student = {:s} && (status = 'active' || status = 'transferred')",
    (r) => add(r.getString("group")));
  each("course_members", "student = {:s} && active != false", (r) => add(r.getString("course")));

  const groups = [];
  const isCourse = {};
  for (const id of Object.keys(ids).slice(0, 60)) {
    let g;
    try { g = $app.findRecordById("teaching_groups", id); } catch (err) { continue; }
    if (g.getBool("archived")) continue;
    const course = g.getString("kind") === "course";
    if (!course && !g.getBool("student_schedule")) continue;
    isCourse[id] = course;
    groups.push({
      id: id,
      name: g.getString("name"),
      kind: course ? "course" : "class",
      subject: g.getString("subject"),
      color: g.getString("color"),
      conference_url: course ? g.getString("conference_url") : "",
      board_url: course ? g.getString("board_url") : "",
    });
  }
  if (!groups.length) return c.json(200, { groups: [], lessons: [] });

  const params = { from: lib.pbDate(from), to: lib.pbDate(to) };
  const any = groups.map((g, i) => { params["g" + i] = g.id; return "group = {:g" + i + "}"; }).join(" || ");
  let records = [];
  try {
    records = $app.findRecordsByFilter(
      "lessons",
      "(" + any + ") && date_plan >= {:from} && date_plan <= {:to} && hidden_from_students != true",
      "date_plan", 2000, 0, params,
    );
  } catch (err) {
    console.warn("[lessons-feed] lessons: " + String(err));
  }

  const confOf = {};
  for (const g of groups) confOf[g.id] = g.conference_url;
  const lessons = [];
  for (const r of records) {
    const group = r.getString("group");
    let materials = [];
    try { materials = JSON.parse(r.getString("materials") || "[]"); } catch (err) { materials = []; }
    lessons.push({
      id: r.id,
      group: group,
      owner: r.getString("owner"),
      title: r.getString("title"),
      date_plan: r.getString("date_plan").replace(" ", "T"),
      time_slot: r.getString("time_slot"),
      status: r.getString("status"),
      conference_url: isCourse[group] ? (r.getString("conference_url") || confOf[group] || "") : "",
      items: lib.projectItems(materials, !!isCourse[group]),
    });
  }
  return c.json(200, { groups: groups, lessons: lessons });
});
