/// <reference path="../pb_data/types.d.ts" />
// Раздел геометрической задачи (GEOMETRY_TASKS_PLAN.md § 1, этап 1).
//
// В банке «Геометрия» планиметрия и стереометрия лежат вперемешку: у своих
// задач раздел угадывается по теме, у банка МЦНМО (17,6 тыс.) — только по
// фасетам. Поле section даёт фильтр верхнего уровня «Планиметрия /
// Стереометрия» на сервере, без загрузки всего банка.
//   'planim' — планиметрия, 'stereo' — стереометрия, '' — ещё не размечена.
//
// Заполняется отдельно, SQL-транзакцией по эвристике
// ege-tasks/src/utils/geometrySection.js (скрипт scripts/geometry/).
//
// 🚨 Аддитивно: новое необязательное поле + индекс. Записи и правила не
// трогаются; фронт до этой миграции поле просто не шлёт.

migrate((app) => {
  const col = app.findCollectionByNameOrId("geometry_tasks");
  col.fields.add(new SelectField({
    "id": "select_geo_section",
    "name": "section",
    "required": false,
    "maxSelect": 1,
    "values": ["planim", "stereo"],
  }));
  col.indexes = [
    ...col.indexes.filter((i) => !i.includes("idx_geometry_tasks_section")),
    "CREATE INDEX idx_geometry_tasks_section ON geometry_tasks (section, origin)",
  ];
  app.save(col);
  console.log("[1787200000] geometry_tasks.section: планиметрия / стереометрия");
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("geometry_tasks");
    col.indexes = col.indexes.filter((i) => !i.includes("idx_geometry_tasks_section"));
    col.fields.removeById("select_geo_section");
    app.save(col);
  } catch (e) {
    console.log("[1787200000] откат:", e?.message);
  }
});
