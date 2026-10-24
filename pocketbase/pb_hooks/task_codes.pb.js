/// <reference path="../pb_data/types.d.ts" />

/**
 * Коды задач раздаёт сервер (v3.9.397, TASK_CODES_PLAN.md).
 *
 * tasks, создание: код пустой → следующий номер в префиксе темы (П12-035).
 *   Явно переданный код остаётся (скрипты Гордина, импорт с готовым кодом);
 *   повтор не пропустит UNIQUE-индекс.
 * tasks, правка: тема сменилась → новый код по новой теме, прежний уходит в
 *   `old_codes` (по нему задачу находит поиск). У темы без префикса (Гордин,
 *   смешанная тема Мордковича) код не трогается. Учитель поменял код руками —
 *   прежний тоже в `old_codes`.
 * topics, создание: тема без номера экзамена получает `code_prefix` по первым
 *   буквам названия (КУ, И11), занятые обходятся цифрой.
 *
 * Номер берётся ОДНИМ оператором UPDATE с подзапросом max+1: запись в SQLite
 * идёт через одно соединение, два одновременных импорта один номер не получат.
 * Номер считается по самим кодам префикса, а не по code_seq — так он верен и
 * для кодов, проставленных до этого хука.
 *
 * ВАЖНО: обработчики хуков не видят переменные внешней области файла —
 * библиотеку и помощников подключаем внутри обработчика.
 */

onRecordCreate((e) => {
  const lib = require(`${__hooks}/task_codes_lib.js`);
  const rec = e.record;
  const code = rec.getString("code").trim();
  if (code) {
    const p = lib.parseCode(code);
    rec.set("code", code);
    rec.set("code_seq", p ? p.seq : 0);
  }
  e.next();
  if (code) return;

  const topicId = rec.getString("topic");
  if (!topicId) return;
  try {
    const t = e.app.findRecordById("topics", topicId);
    const prefix = lib.topicPrefix({
      id: t.id, exam_type: t.getString("exam_type"), ege_number: t.getInt("ege_number"),
      archived: t.getBool("archived"), code_prefix: t.getString("code_prefix"),
    });
    if (!prefix) return;
    const r = lib.codeRange(prefix);
    const next = "(SELECT coalesce(max(CAST(substr(code, {:start}) AS INTEGER)), 0) + 1"
      + " FROM tasks WHERE code >= {:lo} AND code < {:hi})";
    e.app.db().newQuery(
      "UPDATE tasks SET code = {:prefix} || '-' || printf('%03d', " + next + "),"
      + " code_seq = " + next + " WHERE id = {:id}"
    ).bind({ prefix: prefix, start: prefix.length + 2, lo: r.lo, hi: r.hi, id: rec.id }).execute();
    const fresh = e.app.findRecordById("tasks", rec.id);
    rec.set("code", fresh.getString("code"));
    rec.set("code_seq", fresh.getInt("code_seq"));
  } catch (err) {
    console.error("[task_codes] не присвоен код задаче", rec.id, String(err));
  }
}, "tasks");

onRecordUpdate((e) => {
  const lib = require(`${__hooks}/task_codes_lib.js`);
  const rec = e.record;
  const orig = rec.original();
  const readList = (r) => {
    try {
      const v = JSON.parse(r.getString("old_codes") || "[]");
      return Array.isArray(v) ? v : [];
    } catch (_) { return []; }
  };
  const topicOf = (id) => {
    if (!id) return "";
    try {
      const t = e.app.findRecordById("topics", id);
      return lib.topicPrefix({
        id: t.id, exam_type: t.getString("exam_type"), ege_number: t.getInt("ege_number"),
        archived: t.getBool("archived"), code_prefix: t.getString("code_prefix"),
      });
    } catch (_) { return ""; }
  };

  const oldCode = orig.getString("code");
  const code = rec.getString("code").trim();
  const topicChanged = orig.getString("topic") !== rec.getString("topic");
  let prefix = "";

  if (code !== oldCode) {
    // Код правили руками.
    if (oldCode) rec.set("old_codes", lib.withOldCode(readList(orig), oldCode));
    const p = lib.parseCode(code);
    rec.set("code", code);
    rec.set("code_seq", p ? p.seq : 0);
    if (!code) prefix = topicOf(rec.getString("topic"));
  } else if (topicChanged || !code) {
    prefix = topicOf(rec.getString("topic"));
    const cur = lib.parseCode(code);
    if (prefix && cur && cur.prefix === prefix) prefix = "";
    if (prefix && code) {
      rec.set("old_codes", lib.withOldCode(readList(orig), code));
      rec.set("code", "");
      rec.set("code_seq", 0);
    }
  }

  e.next();
  if (!prefix) return;

  try {
    const r = lib.codeRange(prefix);
    const next = "(SELECT coalesce(max(CAST(substr(code, {:start}) AS INTEGER)), 0) + 1"
      + " FROM tasks WHERE code >= {:lo} AND code < {:hi})";
    e.app.db().newQuery(
      "UPDATE tasks SET code = {:prefix} || '-' || printf('%03d', " + next + "),"
      + " code_seq = " + next + " WHERE id = {:id}"
    ).bind({ prefix: prefix, start: prefix.length + 2, lo: r.lo, hi: r.hi, id: rec.id }).execute();
    const fresh = e.app.findRecordById("tasks", rec.id);
    rec.set("code", fresh.getString("code"));
    rec.set("code_seq", fresh.getInt("code_seq"));
  } catch (err) {
    console.error("[task_codes] не переприсвоен код задаче", rec.id, String(err));
  }
}, "tasks");

onRecordCreate((e) => {
  const lib = require(`${__hooks}/task_codes_lib.js`);
  const rec = e.record;
  const own = rec.getString("code_prefix").trim().toUpperCase();
  const topic = {
    id: rec.id, exam_type: rec.getString("exam_type"), ege_number: rec.getInt("ege_number"),
    archived: rec.getBool("archived"), code_prefix: own,
  };
  if (own) rec.set("code_prefix", own);
  else if (!lib.topicPrefix(topic)) {
    try {
      const taken = e.app.findAllRecords("topics").map((t) => lib.topicPrefix({
        id: t.id, exam_type: t.getString("exam_type"), ege_number: t.getInt("ege_number"),
        archived: t.getBool("archived"), code_prefix: t.getString("code_prefix"),
      })).filter(Boolean);
      rec.set("code_prefix", lib.suggestPrefix(rec.getString("title"), taken));
    } catch (err) {
      console.error("[task_codes] не подобран префикс темы", String(err));
    }
  }
  e.next();
}, "topics");
