/// <reference path="../pb_data/types.d.ts" />

/**
 * Эфир и чертежи в личном кабинете ученика (v3.9.283).
 *
 *   GET /api/stereo/my  →  { rooms: [{ code, title, updated }],
 *                            scenes: [{ id, title, note, kind, updated }],
 *                            works: [{ id, title, class, updated }] }
 *
 * rooms  — эфиры, которые идут СЕЙЧАС (live = true) и адресованы классам ученика;
 * scenes — открытые пособия (public = true), отмеченные классами ученика;
 * works  — открытые геометрические работы (geometry_works.public, v3.9.284),
 *          отмеченные классами ученика; открываются по /w/<id> (только условия).
 *
 * Почему хук, а не правила коллекций: классы ученика надо собрать из
 * group_memberships, а их ученик читать не может (там заметки учителя).
 * Классы ученика = указатель students.teaching_group
 *                + членства active / transferred (переведённый с классом на
 *                  новый год видит адресованное прошлогоднему классу — п. 14
 *                  CLAUDE.md; ушедший из класса — уже нет)
 *                + курсы (course_members, active != false).
 * Журнал шагов (scene) не отдаётся: пособие ученик открывает по /s/<id>,
 * эфир — по /b/<код>; обе ссылки и без кабинета открыты всем.
 *
 * ВАЖНО: обработчики хуков не видят переменные внешней области файла.
 */

routerAdd("GET", "/api/stereo/my", (c) => {
  const auth = c.requestInfo().auth;
  if (!auth || auth.collection().name !== "students") {
    return c.json(401, { error: "Нужен вход ученика" });
  }
  const sid = auth.id;
  const groups = {};
  const add = (id) => { if (id) groups[id] = true; };
  add(auth.getString("teaching_group"));

  // Коллекции может не быть (старая база) — тогда просто без этого источника.
  const each = (collection, filter, fn) => {
    try {
      for (const r of $app.findRecordsByFilter(collection, filter, "", 500, 0, { s: sid })) fn(r);
    } catch (err) {
      console.warn("[stereo-feed] " + collection + ": " + String(err));
    }
  };
  each("group_memberships", "student = {:s} && (status = 'active' || status = 'transferred')",
    (r) => add(r.getString("group")));
  each("course_members", "student = {:s} && active != false", (r) => add(r.getString("course")));

  const ids = Object.keys(groups).slice(0, 60);
  if (!ids.length) return c.json(200, { rooms: [], scenes: [], works: [] });

  // Мульти-relation — только через .id: `groups ?= x` в PB 0.36 молча пуст.
  const params = {};
  const any = ids.map((id, i) => { params["g" + i] = id; return "groups.id ?= {:g" + i + "}"; }).join(" || ");

  const find = (collection, filter, sort, limit) => {
    try {
      return $app.findRecordsByFilter(collection, filter + " && (" + any + ")", sort, limit, 0, params);
    } catch (err) {
      console.warn("[stereo-feed] " + collection + ": " + String(err));
      return [];
    }
  };

  const rooms = [];
  for (const r of find("stereo_rooms", "live = true", "-updated", 20)) {
    rooms.push({ code: r.getString("code"), title: r.getString("title"), updated: r.getString("updated") });
  }
  const scenes = [];
  for (const r of find("stereo_scenes", "public = true", "-updated", 300)) {
    scenes.push({
      id: r.id,
      title: r.getString("title"),
      note: r.getString("note"),
      kind: r.getString("kind"),
      updated: r.getString("updated"),
    });
  }
  const works = [];
  for (const r of find("geometry_works", "public = true", "-updated", 100)) {
    works.push({
      id: r.id,
      title: r.getString("title"),
      class: r.getInt("class") || null,
      updated: r.getString("updated"),
    });
  }
  return c.json(200, { rooms: rooms, scenes: scenes, works: works });
});
