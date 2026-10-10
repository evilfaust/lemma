/// <reference path="../pb_data/types.d.ts" />
// Зачёт и экзамен в журнале класса (v3.9.334). Контрольное мероприятие на
// пару, две пары или весь учебный день: внутри несколько частей — письменных
// и устных (устный счёт, работа на остаточные знания, задачи, билет), у
// мероприятия своя оценка и обратная связь. Устроено как интенсив: блок
// колонок `journal_blocks`, части — колонки с ролью work, итог — total.
//
//   journal_blocks.kind      + 'credit' (зачёт), 'exam' (экзамен);
//                              пусто / 'intensive' — интенсив, как раньше;
//   journal_columns.format   — 'written' | 'oral': письменная или устная
//                              часть (пусто — не указано). Нужна подписи в
//                              журнале и обратной связи («билет отвечал устно»).
//
// 🚨 Аддитивно: два значения select и одно необязательное поле. Записи и
// правила не тронуты. Down переводит зачёты/экзамены в интенсивы (данные и
// колонки остаются) и снимает поле.

const KINDS_OLD = ["intensive"];
const KINDS_NEW = ["intensive", "credit", "exam"];

migrate((app) => {
  const blocks = app.findCollectionByNameOrId("journal_blocks");
  const kind = blocks.fields.getByName("kind");
  kind.values = KINDS_NEW;
  app.save(blocks);

  const cols = app.findCollectionByNameOrId("journal_columns");
  cols.fields.add(new SelectField({
    "id": "select_jcol_format",
    "name": "format",
    "values": ["written", "oral"],
    "maxSelect": 1,
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  app.save(cols);
  console.log("[1788600000] журнал: зачёт/экзамен (journal_blocks.kind) + journal_columns.format");
}, (app) => {
  try {
    app.db().newQuery("UPDATE journal_blocks SET kind = 'intensive' WHERE kind IN ('credit', 'exam')").execute();
    const blocks = app.findCollectionByNameOrId("journal_blocks");
    blocks.fields.getByName("kind").values = KINDS_OLD;
    app.save(blocks);
  } catch (e) {
    console.log("[1788600000] откат kind:", e?.message);
  }
  try {
    const cols = app.findCollectionByNameOrId("journal_columns");
    cols.fields.removeById("select_jcol_format");
    app.save(cols);
  } catch (e) {
    console.log("[1788600000] откат format:", e?.message);
  }
});
