/**
 * Работа раздела «Геометрия» (`geometry_works.structure`, GEOMETRY_TASKS_PLAN.md § 4).
 *
 * Работа — сетка «позиции × варианты»: строка — позиция (№ задачи), столбец —
 * вариант, в ячейке задача или пусто. Все функции чистые: принимают структуру
 * и возвращают новую, исходную не трогают.
 *
 *   { variants: [{ items: [{ task: id } | null, …] }, …],
 *     layouts: { [taskId]: макет A5 } }   // макет печати — у работы, не у задачи
 */

const cell = (v) => (v && typeof v === 'object' && v.task ? { task: String(v.task) } : null);

/** Пустая работа на n вариантов. */
export function emptyStructure(variantCount = 1) {
  return { variants: Array.from({ length: Math.max(1, variantCount) }, () => ({ items: [] })), layouts: {} };
}

/**
 * Привести к канону: хотя бы один вариант, у всех вариантов одинаковое число
 * позиций (короткие дополняются пустыми ячейками), пустые строки в конце
 * срезаются, макеты — объект.
 */
export function normalizeStructure(raw) {
  let src = raw;
  if (typeof src === 'string') {
    try { src = JSON.parse(src); } catch { src = null; }
  }
  const variants = Array.isArray(src?.variants) && src.variants.length
    ? src.variants.map((v) => (Array.isArray(v?.items) ? v.items.map(cell) : []))
    : [[]];
  let rows = Math.max(0, ...variants.map((items) => items.length));
  while (rows > 0 && variants.every((items) => !items[rows - 1])) rows -= 1;
  const layouts = src?.layouts && typeof src.layouts === 'object' && !Array.isArray(src.layouts) ? { ...src.layouts } : {};
  return {
    variants: variants.map((items) => ({ items: Array.from({ length: rows }, (_, i) => items[i] || null) })),
    layouts,
  };
}

export const rowCount = (s) => s.variants[0]?.items.length || 0;
export const variantCount = (s) => s.variants.length;

/** Все задачи работы без повторов — по позициям, внутри позиции по вариантам. */
export function structureTaskIds(s) {
  const out = [];
  const seen = new Set();
  for (let r = 0; r < rowCount(s); r += 1) {
    for (const v of s.variants) {
      const id = v.items[r]?.task;
      if (id && !seen.has(id)) { seen.add(id); out.push(id); }
    }
  }
  return out;
}

const withVariants = (s, variants) => normalizeStructure({ ...s, variants });

/**
 * Новые позиции из списка задач: каждая задача — новая строка в варианте
 * `variant`, в остальных вариантах ячейки пустые (их заполняют параллелями).
 * Задачи, которые уже есть в работе, пропускаются.
 */
export function addTasksAsPositions(s, ids, variant = 0) {
  const used = new Set(structureTaskIds(s));
  const added = [];
  const skipped = [];
  for (const id of ids) {
    if (!id) continue;
    if (used.has(id)) { skipped.push(id); continue; }
    used.add(id);
    added.push(id);
  }
  const variants = s.variants.map((v, vi) => ({
    items: [...v.items, ...added.map((id) => (vi === variant ? { task: id } : null))],
  }));
  return { structure: withVariants(s, variants), added, skipped };
}

/** Поставить задачу в ячейку (null — очистить). */
export function setCell(s, row, variant, taskId) {
  const variants = s.variants.map((v, vi) => {
    if (vi !== variant) return v;
    const items = [...v.items];
    while (items.length <= row) items.push(null);
    items[row] = taskId ? { task: String(taskId) } : null;
    return { items };
  });
  return withVariants(s, variants);
}

/** Удалить позицию во всех вариантах. */
export function removeRow(s, row) {
  return withVariants(s, s.variants.map((v) => ({ items: v.items.filter((_, i) => i !== row) })));
}

/** Переставить позицию (во всех вариантах сразу). */
export function moveRow(s, from, to) {
  const n = rowCount(s);
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return s;
  return withVariants(s, s.variants.map((v) => {
    const items = [...v.items];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    return { items };
  }));
}

/** Добавить пустой вариант. */
export function addVariant(s) {
  return withVariants(s, [...s.variants, { items: Array(rowCount(s)).fill(null) }]);
}

/** Удалить вариант (последний оставшийся не удаляется). */
export function removeVariant(s, variant) {
  if (s.variants.length <= 1) return s;
  return withVariants(s, s.variants.filter((_, i) => i !== variant));
}

/** Задача-образец позиции: первая непустая ячейка строки (для подбора параллели). */
export function rowReference(s, row) {
  for (const v of s.variants) if (v.items[row]?.task) return v.items[row].task;
  return null;
}

/** Пустые ячейки варианта: номера позиций. */
export function emptyRows(s, variant) {
  return (s.variants[variant]?.items || []).map((c, i) => (c ? null : i)).filter((i) => i !== null);
}

/**
 * Задачи варианта по порядку позиций для печати. Пустые ячейки пропускаются,
 * номер задачи на листе — по порядку оставшихся.
 * @param {Map|object} byId — задачи по id
 */
export function variantTasks(s, variant, byId) {
  const get = (id) => (byId instanceof Map ? byId.get(id) : byId?.[id]);
  return (s.variants[variant]?.items || [])
    .map((c) => (c ? get(c.task) : null))
    .filter(Boolean);
}

/** Сохранить макеты печати; макеты задач, которых в работе уже нет, отбрасываются. */
export function withLayouts(s, patch = {}) {
  const used = new Set(structureTaskIds(s));
  const layouts = {};
  for (const [id, layout] of Object.entries({ ...s.layouts, ...patch })) {
    if (used.has(id) && layout) layouts[id] = layout;
  }
  return { ...s, layouts };
}

/** Подпись варианта. */
export const variantLabel = (i) => `Вариант ${i + 1}`;

/** Работа из сохранённого листа A5 (`geometry_print_tests`). */
export function structureFromPrintTest(test) {
  const order = Array.isArray(test?.task_order) && test.task_order.length ? test.task_order : (test?.tasks || []);
  const base = addTasksAsPositions(emptyStructure(1), order).structure;
  let snapshot = test?.layout_snapshot;
  if (typeof snapshot === 'string') {
    try { snapshot = JSON.parse(snapshot); } catch { snapshot = null; }
  }
  return withLayouts(base, snapshot && typeof snapshot === 'object' ? snapshot : {});
}
