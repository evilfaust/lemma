// Работа → «Марафон»: какие задачи уезжают в марафон и в каком порядке.
//
// Марафон — общий банк задач класса (ученик выбирает любую карточку), поэтому
// из работы он берёт УНИКАЛЬНЫЕ задачи: в вариантах часть задач совпадает, а
// две одинаковые карточки на столе — брак.
//
// Вариант приходит в двух видах: сырой записью PocketBase (`tasks` — массив id,
// задачи в `expand.tasks`, порядок в `order`) и нормализованным из редактора
// работы (`tasks` — уже объекты в нужном порядке). Обе формы разбирает
// `variantTasks`.

// Марафон хранит задачи relation'ом с maxSelect=200 (миграция 1772000015).
export const MARATHON_TASKS_LIMIT = 200;

// Задачи одного варианта в порядке, в котором их видит ученик.
export function variantTasks(variant) {
  if (!variant) return [];

  const raw = variant.expand?.tasks;
  const expanded = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const byId = new Map(expanded.map((t) => [t.id, t]));

  const list = Array.isArray(variant.tasks) ? variant.tasks : [];
  let tasks = list
    .map((t) => (typeof t === 'string' ? byId.get(t) : t))
    .filter((t) => t && t.id);

  // Сырой вариант без `tasks` (или со списком id, который не раскрылся).
  if (tasks.length === 0) tasks = expanded.filter((t) => t && t.id);

  // Порядок задаётся `order` только у сырой записи; нормализованный вариант
  // уже отсортирован, и его порядок мы не трогаем.
  const order = Array.isArray(variant.order) ? variant.order : [];
  if (order.length > 0) {
    const positionById = new Map(order.map((o) => [o.taskId, o.position]));
    tasks = [...tasks].sort(
      (a, b) => (positionById.get(a.id) ?? 999) - (positionById.get(b.id) ?? 999),
    );
  }

  return tasks;
}

// Задачи работы для марафона. `variantNumber` = null → все варианты подряд,
// число → только этот вариант.
export function collectMarathonTasks(variants = [], variantNumber = null) {
  const list = Array.isArray(variants) ? variants : [];
  const picked = variantNumber == null
    ? list
    : list.filter((v) => Number(v?.number) === Number(variantNumber));

  const seen = new Set();
  const result = [];
  for (const variant of picked) {
    for (const task of variantTasks(variant)) {
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      result.push(task);
    }
  }
  return result;
}
