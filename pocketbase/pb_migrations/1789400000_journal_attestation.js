/// <reference path="../pb_data/types.d.ts" />
// Аттестация в журнале класса (v3.9.414): колонка «I четверть», «Год»… —
// оценка за период, который выбирает учитель. В пустой клетке — средний
// ученика за период (подсказка), «Выставить по среднему» пишет округлённые
// оценки обычными отметками.
//
// journal_columns.period — '2026-09-01..2026-10-26' (концы включительно, тот
// же формат, что у периода в тулбаре журнала); пусто — обычная колонка.
//
// 🚨 Аддитивно: одно необязательное поле. Отметки и правила не тронуты.

migrate((app) => {
  const cols = app.findCollectionByNameOrId("journal_columns");
  cols.fields.add(new TextField({
    "id": "text_jcol_period",
    "name": "period",
    "max": 32,
    "min": 0,
    "pattern": "",
    "required": false,
    "presentable": false,
    "primaryKey": false,
    "autogeneratePattern": "",
    "hidden": false,
    "system": false,
  }));
  app.save(cols);
  console.log("[1789400000] journal_columns: period — аттестация за период");
}, (app) => {
  try {
    const cols = app.findCollectionByNameOrId("journal_columns");
    cols.fields.removeById("text_jcol_period");
    app.save(cols);
  } catch (e) {
    console.log("[1789400000] откат:", e?.message);
  }
});
