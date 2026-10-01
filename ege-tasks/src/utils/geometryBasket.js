/**
 * Подборка геометрических задач (GEOMETRY_TASKS_PLAN.md § 4) — «корзина»,
 * из которой собирается работа. Живёт в браузере учителя (localStorage) и
 * общая для страниц раздела: банк, поиск, карточка задачи, редактор работы.
 * Это черновик, а не данные: потеря подборки ничего не ломает.
 *
 * Элемент — { id, code }: код нужен, чтобы показать подборку без запроса.
 */

const KEY = 'geometry.basket.v1';
const listeners = new Set();
let items = load();

function load() {
  try {
    const raw = JSON.parse(globalThis.localStorage?.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === 'string') : [];
  } catch {
    return [];
  }
}

function commit(next) {
  items = next;
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(items)); } catch { /* приватный режим */ }
  listeners.forEach((fn) => fn());
}

export const geometryBasket = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getSnapshot: () => items,
  has: (id) => items.some((x) => x.id === id),
  /** Добавить задачи (дубли пропускаются); возвращает число добавленных. */
  add(tasks) {
    const have = new Set(items.map((x) => x.id));
    const fresh = (Array.isArray(tasks) ? tasks : [tasks])
      .filter((t) => t?.id && !have.has(t.id) && have.add(t.id))
      .map((t) => ({ id: t.id, code: t.code || '' }));
    if (fresh.length) commit([...items, ...fresh]);
    return fresh.length;
  },
  remove(id) {
    if (items.some((x) => x.id === id)) commit(items.filter((x) => x.id !== id));
  },
  toggle(task) {
    if (geometryBasket.has(task.id)) { geometryBasket.remove(task.id); return false; }
    geometryBasket.add(task);
    return true;
  },
  move(from, to) {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    commit(next);
  },
  clear() {
    if (items.length) commit([]);
  },
  /** Для тестов: перечитать из хранилища. */
  _reload() {
    items = load();
    listeners.forEach((fn) => fn());
  },
};
