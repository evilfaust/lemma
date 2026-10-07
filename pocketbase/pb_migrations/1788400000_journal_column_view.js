/// <reference path="../pb_data/types.d.ts" />
// Вид колонки журнала (v3.9.312): что показывать в клетках — баллы, проценты
// или оценку. Вводятся значения по-прежнему в шкале колонки (`scale`), вид
// меняет только показ: баллы из 20 можно смотреть процентами или оценкой по
// порогам колонки.
//
// journal_columns.view — 'points' | 'percent' | 'grade'; пусто — как общий
// переключатель журнала «Баллы / % / Оценки».
//
// 🚨 Аддитивно: одно необязательное поле. Отметки и правила не тронуты.

migrate((app) => {
  const cols = app.findCollectionByNameOrId("journal_columns");
  cols.fields.add(new SelectField({
    "id": "select_jcol_view",
    "name": "view",
    "values": ["points", "percent", "grade"],
    "maxSelect": 1,
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  app.save(cols);
  console.log("[1788400000] journal_columns: view — вид клеток колонки");
}, (app) => {
  try {
    const cols = app.findCollectionByNameOrId("journal_columns");
    cols.fields.removeById("select_jcol_view");
    app.save(cols);
  } catch (e) {
    console.log("[1788400000] откат:", e?.message);
  }
});
