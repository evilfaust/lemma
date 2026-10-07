/// <reference path="../pb_data/types.d.ts" />
// ТДФ для алгебры (v3.9.308): листы вида «Корень n-й степени» — определение с
// пропусками, свойства списком со скобкой условий, тождества, графики,
// таблицы значений, соответствие «формула ↔ график».
//
// tdf_items.type — четыре новых значения: identity · graph · table · matching.
// formulation_md / short_notation_md — явный потолок 100 000 символов: у полей
// стоял `max: 0`, а в PB 0.36 это НЕ «без лимита», а дефолт 5000 (см.
// pocketbase/CLAUDE.md § Лимит text-полей). Пункт с графиками ```plot и
// блоком соответствия упирался бы в него.
//
// 🚨 Аддитивно: значения select только добавляются, лимиты только растут.
// Разметка (пропуски [[…]], ```свойства, ```соответствие, ```plot пропуск)
// живёт в тексте пункта и схемы не требует — utils/tdfMarkup.js.

const NEW_TYPES = ["identity", "graph", "table", "matching"];
const TEXT_MAX = 100000;

migrate((app) => {
  const items = app.findCollectionByNameOrId("tdf_items");

  const typeField = items.fields.getByName("type");
  if (!typeField) throw new Error('Field "type" not found in tdf_items');
  const values = Array.isArray(typeField.values) ? [...typeField.values] : [];
  for (const v of NEW_TYPES) if (!values.includes(v)) values.push(v);
  typeField.values = values;

  for (const name of ["formulation_md", "short_notation_md", "question_md"]) {
    const f = items.fields.getByName(name);
    if (f && (!f.max || f.max < TEXT_MAX)) f.max = TEXT_MAX;
  }

  app.save(items);
}, (app) => {
  // Откат значения select не снимает: пункты новых типов иначе не сохранить.
  // Лимиты тоже не уменьшаются — длинный текст обрезался бы при правке.
});
