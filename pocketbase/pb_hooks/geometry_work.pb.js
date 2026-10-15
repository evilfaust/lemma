/// <reference path="../pb_data/types.d.ts" />

/**
 * Геометрическая работа для ученика (v3.9.377): student.oipav.ru/w/<id>.
 *
 *   GET /api/geometry/work/<id>  →  { id, title, class, updated,
 *                                     variants: [[taskId|null, …], …],
 *                                     tasks: [{ id, code, statement_md, level,
 *                                               kind, has_drawing, drawing_svg?,
 *                                               geogebra_image_base64? }] }
 *
 * Без входа, только открытые работы (public = true; иначе 404 — закрытую от
 * несуществующей аноним не отличит, так и было). Ответ, решение, указания НЕ
 * отдаются никогда; чертёж — по уровню показа (geometry_works.drawings):
 * учитель скрыл чертёж — его нет и в ответе сервера, не только на экране.
 * Правила уровней — geometry_work_lib.js (CommonJS, под тестом
 * ege-tasks/src/__tests__/geometryDrawings.test.js).
 *
 * Банк geometry_tasks читается публично (так было и до этого хука) — хук
 * защищает выдачу ученику, а не банк. Закрыть банк — отдельная задача.
 *
 * ВАЖНО: обработчики хуков не видят переменные внешней области файла —
 * библиотеку подключаем require внутри обработчика.
 */

routerAdd("GET", "/api/geometry/work/{id}", (c) => {
  const lib = require(`${__hooks}/geometry_work_lib.js`);
  const id = String(c.request.pathValue("id") || "");
  if (!/^[a-z0-9]{15}$/.test(id)) return c.json(404, { error: "Работа недоступна" });

  let work;
  try {
    work = $app.findRecordById("geometry_works", id);
  } catch (err) {
    return c.json(404, { error: "Работа недоступна" });
  }
  if (!work.getBool("public")) return c.json(404, { error: "Работа недоступна" });

  const parse = (field) => {
    try { return JSON.parse(work.getString(field) || "null"); } catch (err) { return null; }
  };
  const variants = lib.variantsOf(parse("structure"));
  const drawings = parse("drawings");

  const ids = {};
  variants.forEach((v) => v.forEach((t) => { if (t) ids[t] = true; }));
  const list = Object.keys(ids);

  const tasks = [];
  if (list.length) {
    let recs = [];
    try {
      recs = $app.findRecordsByIds("geometry_tasks", list);
    } catch (err) {
      console.warn("[geometry-work] tasks: " + String(err));
    }
    for (const r of recs) {
      tasks.push(lib.projectTask({
        id: r.id,
        code: r.getString("code"),
        statement_md: r.getString("statement_md"),
        drawing_view: r.getString("drawing_view"),
        drawing_svg: r.getString("drawing_svg"),
        image_role: r.getString("image_role"),
        geogebra_image_base64: r.getString("geogebra_image_base64"),
      }, drawings));
    }
  }

  return c.json(200, {
    id: work.id,
    title: work.getString("title"),
    class: work.getInt("class") || null,
    updated: work.getString("updated"),
    variants: variants,
    tasks: tasks,
  });
});
