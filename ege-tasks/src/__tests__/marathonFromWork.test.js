import { describe, it, expect } from 'vitest';
import { variantTasks, collectMarathonTasks, MARATHON_TASKS_LIMIT } from '../utils/marathonFromWork';

// Сырой вариант PocketBase: tasks — id, задачи в expand, порядок в order.
const rawVariant = (number, ids, order = null) => ({
  number,
  tasks: ids,
  order: order || ids.map((id, position) => ({ taskId: id, position })),
  expand: { tasks: ids.map((id) => ({ id, code: `c-${id}` })) },
});

// Нормализованный вариант из редактора работы: tasks — объекты по порядку.
const editorVariant = (number, ids) => ({
  number,
  tasks: ids.map((id) => ({ id, code: `c-${id}` })),
});

describe('variantTasks', () => {
  it('раскрывает id через expand', () => {
    expect(variantTasks(rawVariant(1, ['a', 'b'])).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('уважает порядок order, а не порядок relation', () => {
    const v = rawVariant(1, ['a', 'b', 'c'], [
      { taskId: 'c', position: 0 },
      { taskId: 'a', position: 1 },
      { taskId: 'b', position: 2 },
    ]);
    expect(variantTasks(v).map((t) => t.id)).toEqual(['c', 'a', 'b']);
  });

  it('берёт задачи-объекты редактора как есть', () => {
    expect(variantTasks(editorVariant(1, ['x', 'y'])).map((t) => t.id)).toEqual(['x', 'y']);
  });

  it('переживает пустой и битый вариант', () => {
    expect(variantTasks(null)).toEqual([]);
    expect(variantTasks({ number: 1 })).toEqual([]);
    expect(variantTasks({ number: 1, tasks: ['a'], expand: {} })).toEqual([]);
  });

  it('падает на expand, когда списка tasks нет', () => {
    const v = { number: 1, expand: { tasks: [{ id: 'a' }, { id: 'b' }] } };
    expect(variantTasks(v).map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('collectMarathonTasks', () => {
  it('склеивает варианты без повторов — карточка задачи в марафоне одна', () => {
    const vars = [rawVariant(1, ['a', 'b']), rawVariant(2, ['b', 'c'])];
    expect(collectMarathonTasks(vars).map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('берёт один вариант по номеру', () => {
    const vars = [rawVariant(1, ['a', 'b']), rawVariant(2, ['c', 'd'])];
    expect(collectMarathonTasks(vars, 2).map((t) => t.id)).toEqual(['c', 'd']);
    expect(collectMarathonTasks(vars, '2').map((t) => t.id)).toEqual(['c', 'd']);
  });

  it('несуществующий вариант даёт пустой список, а не все задачи', () => {
    expect(collectMarathonTasks([rawVariant(1, ['a'])], 9)).toEqual([]);
  });

  it('пустой вход безопасен', () => {
    expect(collectMarathonTasks()).toEqual([]);
    expect(collectMarathonTasks(null)).toEqual([]);
  });

  it('лимит марафона совпадает с maxSelect коллекции', () => {
    expect(MARATHON_TASKS_LIMIT).toBe(200);
  });
});
