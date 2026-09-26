/// <reference path="../pb_data/types.d.ts" />

// Интенсив в журнале класса (v3.9.241): несколько дней подряд по одной теме
// (2–4 пары в день), в день несколько работ, у дня своя оценка, в конце
// зачётная работа с большим весом и итог, который ставит учитель.
//
//   journal_blocks        — сам интенсив: тема, даты, доля зачёта в расчёте
//                           итога. Живёт на классе конкретного года, как и
//                           колонки журнала.
//   journal_columns.block — колонка входит в интенсив;
//   journal_columns.role  — её место в нём: work (работа дня), day (оценка за
//                           день), final (зачётная работа), total (итог).
//
// Удаление интенсива колонки НЕ удаляет: связь не каскадная, колонки остаются
// обычными колонками журнала (PocketBase сам очищает ссылку). Отметки учителя
// так не пропадут от одного неосторожного клика.
//
// Доступ — как у колонок (миграция 1786500000): через класс, «owner = я» не
// пропуск, класс и владельца правкой не перевесить. Колонку нельзя приписать к
// интенсиву ДРУГОГО класса.
//
// Аддитивно: новая коллекция + два необязательных поля; прежние записи не
// меняются. Down удаляет поля и коллекцию.

const T = '@request.auth.collectionName = "teachers"';
const NV = '@request.auth.role != "viewer"';
const SA = '@request.auth.role = "superadmin"';
const AUTHOR = 'owner = @request.auth.id';
const CLASS = '(group.owner = @request.auth.id || group.co_teachers.id ?= @request.auth.id)';
const keep = (field) => `(@request.body.${field}:isset = false || @request.body.${field} = ${field})`;

// Интенсив колонки — того же класса, что и она сама.
const BLOCK_CREATE = '(@request.body.block:isset = false || @request.body.block = "" || @request.body.block.group = @request.body.group)';
const BLOCK_UPDATE = '(@request.body.block:isset = false || @request.body.block = "" || @request.body.block.group = group)';

migrate((app) => {
  const TEACHERS = app.findCollectionByNameOrId("teachers").id;
  const GROUPS = app.findCollectionByNameOrId("teaching_groups").id;

  const blocks = new Collection({
    "id": "pbc_journal_blocks", "name": "journal_blocks", "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
      },
      { "hidden": false, "id": "rel_jblk_owner", "name": "owner", "presentable": false, "required": true,
        "system": false, "type": "relation", "collectionId": TEACHERS, "cascadeDelete": false,
        "minSelect": 1, "maxSelect": 1 },
      { "hidden": false, "id": "rel_jblk_group", "name": "group", "presentable": false, "required": true,
        "system": false, "type": "relation", "collectionId": GROUPS, "cascadeDelete": true,
        "minSelect": 1, "maxSelect": 1 },
      { "autogeneratePattern": "", "hidden": false, "id": "text_jblk_title", "max": 200, "min": 1,
        "name": "title", "pattern": "", "presentable": true, "primaryKey": false, "required": true,
        "system": false, "type": "text" },
      // Пока один вид; поле — чтобы потом не мигрировать ради «модуля»/«четверти».
      { "hidden": false, "id": "select_jblk_kind", "maxSelect": 1, "name": "kind", "presentable": false,
        "required": false, "system": false, "type": "select", "values": ["intensive"] },
      { "hidden": false, "id": "date_jblk_from", "name": "date_from", "presentable": false,
        "required": false, "system": false, "type": "date", "min": "", "max": "" },
      { "hidden": false, "id": "date_jblk_to", "name": "date_to", "presentable": false,
        "required": false, "system": false, "type": "date", "min": "", "max": "" },
      // Доля зачётной работы в расчёте итога, %: дни делят остаток поровну.
      // Расчёт — только подсказка, итог ставит учитель.
      { "hidden": false, "id": "number_jblk_share", "name": "final_share", "presentable": false,
        "required": false, "system": false, "type": "number", "min": 0, "max": 90, "onlyInt": false },
      { "autogeneratePattern": "", "hidden": false, "id": "text_jblk_note", "max": 2000, "min": 0,
        "name": "note", "pattern": "", "presentable": false, "primaryKey": false, "required": false,
        "system": false, "type": "text" },
      { "hidden": false, "id": "ad_jblk_c", "name": "created", "onCreate": true, "onUpdate": false,
        "presentable": false, "system": false, "type": "autodate" },
      { "hidden": false, "id": "ad_jblk_u", "name": "updated", "onCreate": true, "onUpdate": true,
        "presentable": false, "system": false, "type": "autodate" }
    ],
    "indexes": [
      "CREATE INDEX idx_journal_blocks_group ON journal_blocks (`group`)"
    ],
    "listRule": `${T} && (${SA} || ${CLASS})`,
    "viewRule": `${T} && (${SA} || ${CLASS})`,
    "createRule": `${T} && ${NV} && ${AUTHOR} && (${SA} || ${CLASS})`,
    "updateRule": `${T} && ${NV} && ${keep('group')} && ${keep('owner')} && (${SA} || group.owner = @request.auth.id || (${AUTHOR} && ${CLASS}))`,
    "deleteRule": `${T} && ${NV} && (${SA} || group.owner = @request.auth.id || (${AUTHOR} && ${CLASS}))`
  });
  app.save(blocks);

  const columns = app.findCollectionByNameOrId("journal_columns");
  columns.fields.add(new RelationField({
    "id": "rel_jcol_block", "name": "block", "required": false,
    "collectionId": "pbc_journal_blocks", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
  }));
  columns.fields.add(new SelectField({
    "id": "select_jcol_role", "name": "role", "required": false, "maxSelect": 1,
    "values": ["work", "day", "final", "total"]
  }));
  columns.createRule = `${columns.createRule} && ${BLOCK_CREATE}`;
  columns.updateRule = `${columns.updateRule} && ${BLOCK_UPDATE}`;
  app.save(columns);

  console.log("[1786600000] Интенсив в журнале: journal_blocks + journal_columns.block/role");
}, (app) => {
  try {
    const columns = app.findCollectionByNameOrId("journal_columns");
    columns.fields.removeById("rel_jcol_block");
    columns.fields.removeById("select_jcol_role");
    columns.createRule = columns.createRule.replace(` && ${BLOCK_CREATE}`, "");
    columns.updateRule = columns.updateRule.replace(` && ${BLOCK_UPDATE}`, "");
    app.save(columns);
  } catch (e) {
    console.log("[1786600000] откат полей:", e?.message);
  }
  try {
    app.delete(app.findCollectionByNameOrId("pbc_journal_blocks"));
  } catch (e) {
    console.log("[1786600000] откат коллекции:", e?.message);
  }
});
