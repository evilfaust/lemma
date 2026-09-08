/// <reference path="../pb_data/types.d.ts" />

// Учебные годы, шаг 1: история членства в группах (group_memberships).
//
// До сих пор связь «ученик ↔ группа» жила ОДНИМ полем students.teaching_group,
// т.е. хранила только «где он сейчас». При переводе на новый учебный год это
// поле перезаписывается — и прошлогодняя группа мгновенно пустеет: журнал
// сдачи, ростер посещаемости, летние программы и списки за прошлый год
// показывать становится некого.
//
// Здесь заводим журнал членства: строка на (ученик, группа) с годом, датами
// входа/выхода и статусом. Состав группы читается ИЗ НЕГО, а
// students.teaching_group остаётся денормализованным указателем «текущая
// группа» (пикеры, подсказки) — весь существующий код продолжает работать.
//
// status: active — учится сейчас; transferred — переведён в следующую группу;
//         graduated — выпустился; left — выбыл (перестал заниматься).
//
// 🚨 Аддитивно: новая коллекция + бэкфилл из текущих связей. Существующие
// данные не изменяются. Down-миграция удаляет коллекцию целиком.

const TEACHERS = "pbc_teachers";

// Правила — как у прочих личных сущностей «Моего пространства»
// (см. 1783300000_multiteacher_rules.js, блок WORKSPACE_OWNED).
const T = '@request.auth.collectionName = "teachers"';
const NV = '@request.auth.role != "viewer"';
const OWN = '(owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")';

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
function text(id, name, max) {
  return {
    "autogeneratePattern": "", "hidden": false, "id": id, "max": max, "min": 0,
    "name": name, "pattern": "", "presentable": false, "primaryKey": false,
    "required": false, "system": false, "type": "text"
  };
}
function date(id, name) {
  return {
    "hidden": false, "id": id, "max": "", "min": "", "name": name,
    "presentable": false, "required": false, "system": false, "type": "date"
  };
}
function created(id) { return { "hidden": false, "id": id, "name": "created", "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate" }; }
function updated(id) { return { "hidden": false, "id": id, "name": "updated", "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate" }; }

migrate((app) => {
  const STUDENTS = app.findCollectionByNameOrId("students").id;
  const GROUPS = app.findCollectionByNameOrId("teaching_groups").id;

  const memberships = new Collection({
    "id": "pbc_group_memberships", "name": "group_memberships", "type": "base",
    "fields": [
      pk(),
      rel("rel_gm_owner", "owner", TEACHERS, { required: true }),
      rel("rel_gm_student", "student", STUDENTS, { required: true, cascade: true }),
      rel("rel_gm_group", "group", GROUPS, { required: true, cascade: true }),
      // Копия teaching_groups.year на момент зачисления: год группы не меняется,
      // но денормализация избавляет от expand в каждом списке за год.
      text("text_gm_year", "year", 20),
      date("date_gm_joined", "joined"),
      date("date_gm_left", "left"),
      {
        "hidden": false, "id": "select_gm_status", "maxSelect": 1, "name": "status",
        "presentable": false, "required": false, "system": false, "type": "select",
        "values": ["active", "transferred", "graduated", "left"]
      },
      text("text_gm_note", "note", 300),
      created("ad_gm_c"), updated("ad_gm_u")
    ],
    "indexes": [
      "CREATE INDEX idx_group_memberships_group ON group_memberships (`group`)",
      "CREATE INDEX idx_group_memberships_student ON group_memberships (student)",
      "CREATE INDEX idx_group_memberships_year ON group_memberships (year)",
      // Одна строка на пару (ученик, группа): вернулся в ту же группу —
      // переоткрываем существующую, а не плодим дубли.
      "CREATE UNIQUE INDEX idx_group_memberships_student_group ON group_memberships (student, `group`)"
    ],
    "listRule": `${T} && ${OWN}`,
    "viewRule": `${T} && ${OWN}`,
    "createRule": `${T} && ${NV}`,
    "updateRule": `${T} && ${NV} && ${OWN}`,
    "deleteRule": `${T} && ${NV} && ${OWN}`
  });
  app.save(memberships);

  // ── Бэкфилл: текущие связи students.teaching_group → активное членство ────
  const col = app.findCollectionByNameOrId("pbc_group_memberships");
  const groups = {};
  for (const g of app.findRecordsByFilter("teaching_groups", "id != ''", "", 0, 0)) {
    groups[g.id] = g;
  }

  // «2025/2026» → 2025-09-01: осмысленная дата зачисления вместо даты
  // регистрации аккаунта (ученик мог завестись раньше или позже).
  function joinedFromYear(year, fallback) {
    const m = String(year || "").match(/^(\d{4})/);
    return m ? `${m[1]}-09-01 00:00:00.000Z` : fallback;
  }

  let n = 0;
  for (const s of app.findRecordsByFilter("students", "teaching_group != ''", "", 0, 0)) {
    const g = groups[s.get("teaching_group")];
    if (!g) continue; // висячая ссылка на удалённую группу — пропускаем
    const rec = new Record(col);
    rec.set("owner", g.get("owner"));
    rec.set("student", s.id);
    rec.set("group", g.id);
    rec.set("year", g.get("year") || "");
    rec.set("joined", joinedFromYear(g.get("year"), s.get("created")));
    rec.set("status", "active");
    app.save(rec);
    n += 1;
  }
  console.log(`[1784300000] Создана коллекция group_memberships, бэкфилл: ${n} членств`);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("pbc_group_memberships"));
  } catch (e) {
    console.log("[1784300000] откат:", e?.message);
  }
  console.log("[1784300000] Откачена коллекция group_memberships");
});
