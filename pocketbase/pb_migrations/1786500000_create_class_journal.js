/// <reference path="../pb_data/types.d.ts" />

// Журнал класса (v3.9.236): рабочий журнал учителя, в котором сходятся
// онлайн-работы Lemma и бумажные работы, проверенные вручную.
//
//   journal_columns — колонка журнала (одна проверка: устный счёт, интенсив,
//                     опрос, онлайн-работа). Колонка живёт на классе КОНКРЕТНОГО
//                     учебного года: новый год = чистый журнал. Историю ученика
//                     собирает его карточка — по `journal_marks.student`.
//   journal_marks   — клетка «колонка × ученик». Для ручных колонок это сама
//                     отметка, для онлайн-колонок — ручная правка поверх
//                     результата из попыток («переписал на бумаге»).
//
// Модель значений клетки: `value` — ТЕКСТ в каноническом виде («18», «7.5»,
// «1»/«0» у зачёта, «н» — не был). Числовое поле PocketBase не отличает
// «пусто» от нуля, а 0 баллов — законная отметка; разбор и валидация —
// `ege-tasks/src/utils/classJournal.js`.
//
// Доступ — ЧЕРЕЗ КЛАСС (как посещаемость, миграции 1786200000/1786300000):
// видят и ставят отметки владелец класса и его со-учителя; настройки и удаление
// колонки — автор колонки или владелец класса. 🚨 У мульти-relation `.id`
// обязателен: `co_teachers ?= x` в PB 0.36 молча не совпадает никогда.
//
// 🚨 «owner = я» здесь НЕ пропуск: иначе любой учитель завёл бы колонку или
// отметку в чужом классе, просто подставив себя владельцем. Создание требует
// доступа к классу И owner = автор; правка не может перевесить запись на другой
// класс, колонку, ученика или владельца.
//
// Аддитивно: две новые коллекции, существующие правила не трогаются.
// Down-миграция удаляет обе коллекции (отметки уходят вместе с колонками).

const T = '@request.auth.collectionName = "teachers"';
const NV = '@request.auth.role != "viewer"';
const SA = '@request.auth.role = "superadmin"';
const AUTHOR = 'owner = @request.auth.id';
// Класс колонки: владелец или со-учитель.
const CLASS_COL = '(group.owner = @request.auth.id || group.co_teachers.id ?= @request.auth.id)';
// Класс отметки — через её колонку.
const CLASS_MARK = '(col.group.owner = @request.auth.id || col.group.co_teachers.id ?= @request.auth.id)';
// Поле, которое правкой менять нельзя (перевесить запись в чужой класс/колонку).
const keep = (field) => `(@request.body.${field}:isset = false || @request.body.${field} = ${field})`;

function pk() {
  return {
    "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
    "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
    "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
  };
}
function rel(id, name, collectionId, { required = false, cascade = false } = {}) {
  return {
    "hidden": false, "id": id, "name": name, "presentable": false,
    "required": required, "system": false, "type": "relation",
    "collectionId": collectionId, "cascadeDelete": cascade,
    "minSelect": required ? 1 : 0, "maxSelect": 1
  };
}
function text(id, name, max, { required = false, presentable = false } = {}) {
  return {
    "autogeneratePattern": "", "hidden": false, "id": id, "max": max,
    "min": required ? 1 : 0, "name": name, "pattern": "", "presentable": presentable,
    "primaryKey": false, "required": required, "system": false, "type": "text"
  };
}
function created(id) { return { "hidden": false, "id": id, "name": "created", "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate" }; }
function updated(id) { return { "hidden": false, "id": id, "name": "updated", "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate" }; }

migrate((app) => {
  // ID коллекций досхемной эры резолвим в рантайме (надёжнее хардкода).
  const TEACHERS = app.findCollectionByNameOrId("teachers").id;
  const GROUPS = app.findCollectionByNameOrId("teaching_groups").id;
  const STUDENTS = app.findCollectionByNameOrId("students").id;
  const WORKS = app.findCollectionByNameOrId("works").id;
  const SESSIONS = app.findCollectionByNameOrId("work_sessions").id;
  const LESSONS = app.findCollectionByNameOrId("lessons").id;

  const columns = new Collection({
    "id": "pbc_journal_columns", "name": "journal_columns", "type": "base",
    "fields": [
      pk(),
      rel("rel_jcol_owner", "owner", TEACHERS, { required: true }),
      // Удалили класс — его журнал уходит вместе с ним.
      rel("rel_jcol_group", "group", GROUPS, { required: true, cascade: true }),
      text("text_jcol_title", "title", 200, { required: true, presentable: true }),
      { "hidden": false, "id": "date_jcol_date", "name": "date", "presentable": false,
        "required": false, "system": false, "type": "date", "min": "", "max": "" },
      // Свободный текст («Устный счёт», «Интенсив») — подсказки живут на фронте.
      text("text_jcol_category", "category", 60),
      { "hidden": false, "id": "select_jcol_scale", "maxSelect": 1, "name": "scale",
        "presentable": false, "required": false, "system": false, "type": "select",
        "values": ["points", "grade", "pass", "percent"] },
      { "hidden": false, "id": "number_jcol_max", "name": "max_score", "presentable": false,
        "required": false, "system": false, "type": "number", "min": 0, "max": null, "onlyInt": false },
      // Пороги перевода в оценку: { "5": 85, "4": 65, "3": 45 } (проценты).
      { "hidden": false, "id": "json_jcol_thresholds", "name": "thresholds", "presentable": false,
        "required": false, "system": false, "type": "json", "maxSize": 2000 },
      // Вес в среднем: пусто/0 читается как 1 (числовое поле PB не отличает
      // пусто от нуля), поэтому «не учитывать» — отдельный флаг no_avg.
      { "hidden": false, "id": "number_jcol_weight", "name": "weight", "presentable": false,
        "required": false, "system": false, "type": "number", "min": 0, "max": 10, "onlyInt": false },
      { "hidden": false, "id": "bool_jcol_noavg", "name": "no_avg", "presentable": false,
        "required": false, "system": false, "type": "bool" },
      // manual — отметки ставит учитель; work / session — онлайн-работа Lemma
      // (значения из попыток, записи journal_marks — ручные правки).
      { "hidden": false, "id": "select_jcol_source", "maxSelect": 1, "name": "source",
        "presentable": false, "required": false, "system": false, "type": "select",
        "values": ["manual", "work", "session"] },
      rel("rel_jcol_work", "work", WORKS),
      rel("rel_jcol_session", "session", SESSIONS),
      // Онлайн-работа выдана ВСЕМУ классу (учитель сам завёл колонку): тот, кто
      // не сдал к сроку, — должник. Колонка, закреплённая ради правки одной
      // клетки найденной работы, этого флага не получает: работа могла быть
      // персональной (летняя программа), и долг ляжет на весь класс зря.
      { "hidden": false, "id": "bool_jcol_assigned", "name": "assigned", "presentable": false,
        "required": false, "system": false, "type": "bool" },
      // Урок календаря (интенсив, пара) — дата и посещаемость; этап 2.
      rel("rel_jcol_lesson", "lesson", LESSONS),
      // Ссылка на материал без своей связи: лист генератора, марафон
      // ({ type, id, title, generator }); этапы 2–3.
      { "hidden": false, "id": "json_jcol_ref", "name": "ref", "presentable": false,
        "required": false, "system": false, "type": "json", "maxSize": 4000 },
      { "hidden": false, "id": "bool_jcol_hidden", "name": "hidden", "presentable": false,
        "required": false, "system": false, "type": "bool" },
      text("text_jcol_note", "note", 2000),
      created("ad_jcol_c"), updated("ad_jcol_u")
    ],
    "indexes": [
      "CREATE INDEX idx_journal_columns_group ON journal_columns (`group`)",
      "CREATE INDEX idx_journal_columns_owner ON journal_columns (owner)",
      // Одна колонка на онлайн-работу в классе: иначе две вкладки браузера
      // успели бы «закрепить» одну и ту же работу дважды.
      "CREATE UNIQUE INDEX idx_journal_columns_group_work ON journal_columns (`group`, work) WHERE work != ''",
      "CREATE UNIQUE INDEX idx_journal_columns_group_session ON journal_columns (`group`, session) WHERE session != ''"
    ],
    "listRule": `${T} && (${SA} || ${CLASS_COL})`,
    "viewRule": `${T} && (${SA} || ${CLASS_COL})`,
    "createRule": `${T} && ${NV} && ${AUTHOR} && (${SA} || ${CLASS_COL})`,
    // Настройки колонки меняет её автор (пока ведёт класс) или владелец класса,
    // но не любой со-учитель.
    "updateRule": `${T} && ${NV} && ${keep('group')} && ${keep('owner')} && (${SA} || group.owner = @request.auth.id || (${AUTHOR} && ${CLASS_COL}))`,
    "deleteRule": `${T} && ${NV} && (${SA} || group.owner = @request.auth.id || (${AUTHOR} && ${CLASS_COL}))`
  });
  app.save(columns);

  const marks = new Collection({
    "id": "pbc_journal_marks", "name": "journal_marks", "type": "base",
    "fields": [
      pk(),
      rel("rel_jmark_owner", "owner", TEACHERS, { required: true }),
      rel("rel_jmark_col", "col", "pbc_journal_columns", { required: true, cascade: true }),
      // Удалить ученика с клиента нельзя (только хуки): students_admin отказывает,
      // пока есть отметки, merge_students переносит их на оставшийся аккаунт.
      rel("rel_jmark_student", "student", STUDENTS, { required: true, cascade: true }),
      text("text_jmark_value", "value", 16),
      text("text_jmark_comment", "comment", 1000),
      created("ad_jmark_c"), updated("ad_jmark_u")
    ],
    "indexes": [
      "CREATE UNIQUE INDEX idx_journal_marks_col_student ON journal_marks (col, student)",
      "CREATE INDEX idx_journal_marks_student ON journal_marks (student)"
    ],
    // Отметки ставит и правит любой, кто ведёт класс (владелец и со-учителя).
    "listRule": `${T} && (${SA} || ${CLASS_MARK})`,
    "viewRule": `${T} && (${SA} || ${CLASS_MARK})`,
    "createRule": `${T} && ${NV} && ${AUTHOR} && (${SA} || ${CLASS_MARK})`,
    "updateRule": `${T} && ${NV} && ${keep('col')} && ${keep('student')} && ${keep('owner')} && (${SA} || ${CLASS_MARK})`,
    "deleteRule": `${T} && ${NV} && (${SA} || ${CLASS_MARK})`
  });
  app.save(marks);

  console.log("[1786500000] Созданы коллекции journal_columns и journal_marks (журнал класса)");
}, (app) => {
  for (const id of ["pbc_journal_marks", "pbc_journal_columns"]) {
    try {
      app.delete(app.findCollectionByNameOrId(id));
    } catch (e) {
      console.log("[1786500000] откат:", e?.message);
    }
  }
  console.log("[1786500000] Откачены коллекции журнала класса");
});
