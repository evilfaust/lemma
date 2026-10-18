import { describe, it, expect, beforeEach } from 'vitest';
import {
  emptyStructure, normalizeStructure, rowCount, structureTaskIds, addTasksAsPositions,
  setCell, removeRow, moveRow, addVariant, removeVariant, rowReference, emptyRows,
  variantTasks, withLayouts, structureFromPrintTest,
  moveCell, moveToVariant, dropEmptyRows, canDistribute, distributeToVariants,
} from '../utils/geometryWork';
import { geometryBasket } from '../utils/geometryBasket';

const grid = (s) => s.variants.map((v) => v.items.map((c) => c?.task || '·').join(' '));

describe('работа: сетка «позиции × варианты»', () => {
  it('нормализация: варианты одной длины, хвост пустых строк срезан', () => {
    const s = normalizeStructure({ variants: [{ items: [{ task: 'a' }, null, null] }, { items: [null, { task: 'b' }] }] });
    expect(grid(s)).toEqual(['a ·', '· b']);
    expect(normalizeStructure(null)).toEqual(emptyStructure(1));
    expect(normalizeStructure('{"variants":[{"items":[{"task":"x"}]}]}').variants[0].items).toEqual([{ task: 'x' }]);
  });

  it('задачи — новыми позициями в выбранный вариант, повторы пропускаются', () => {
    let s = addVariant(emptyStructure(1));
    let r = addTasksAsPositions(s, ['a', 'b']);
    expect(grid(r.structure)).toEqual(['a b', '· ·']);
    r = addTasksAsPositions(r.structure, ['b', 'c'], 1);
    expect(r.added).toEqual(['c']);
    expect(r.skipped).toEqual(['b']);
    s = r.structure;
    expect(grid(s)).toEqual(['a b ·', '· · c']);
    expect(structureTaskIds(s)).toEqual(['a', 'b', 'c']);
  });

  it('ячейки, перестановка и удаление позиций идут по всем вариантам', () => {
    let s = addTasksAsPositions(addVariant(emptyStructure(1)), ['a', 'b', 'c']).structure;
    s = setCell(s, 0, 1, 'a2');
    s = setCell(s, 2, 1, 'c2');
    expect(grid(s)).toEqual(['a b c', 'a2 · c2']);
    expect(emptyRows(s, 1)).toEqual([1]);
    expect(rowReference(s, 1)).toBe('b');
    s = moveRow(s, 2, 0);
    expect(grid(s)).toEqual(['c a b', 'c2 a2 ·']);
    s = removeRow(s, 1);
    expect(grid(s)).toEqual(['c b', 'c2 ·']);
    expect(moveRow(s, 0, 5)).toBe(s);
  });

  it('варианты: добавить пустой, последний не удаляется', () => {
    let s = addTasksAsPositions(emptyStructure(1), ['a']).structure;
    s = addVariant(s);
    expect(grid(s)).toEqual(['a', '·']);
    s = removeVariant(s, 0);
    expect(grid(s)).toEqual(['']); // единственная строка опустела — срезана
    expect(rowCount(s)).toBe(0);
    expect(removeVariant(s, 0)).toBe(s);
  });

  it('задачи варианта для печати — по позициям, без пустых', () => {
    let s = addTasksAsPositions(addVariant(emptyStructure(1)), ['a', 'b']).structure;
    s = setCell(s, 1, 1, 'b2');
    const byId = new Map([['a', { id: 'a' }], ['b', { id: 'b' }], ['b2', { id: 'b2' }]]);
    expect(variantTasks(s, 0, byId).map((t) => t.id)).toEqual(['a', 'b']);
    expect(variantTasks(s, 1, byId).map((t) => t.id)).toEqual(['b2']);
  });

  it('макеты хранятся только для задач работы', () => {
    let s = addTasksAsPositions(emptyStructure(1), ['a', 'b']).structure;
    s = withLayouts(s, { a: { x: 1 }, z: { x: 2 } });
    expect(s.layouts).toEqual({ a: { x: 1 } });
    s = withLayouts(removeRow(s, 0));
    expect(s.layouts).toEqual({});
  });

  it('работа из старого листа A5: порядок и макеты листа', () => {
    const s = structureFromPrintTest({
      tasks: ['b', 'a'], task_order: ['a', 'b'], layout_snapshot: JSON.stringify({ a: { image: {} } }),
    });
    expect(grid(s)).toEqual(['a b']);
    expect(Object.keys(s.layouts)).toEqual(['a']);
  });
});

describe('перенос задач между вариантами', () => {
  // Шесть задач собраны в вариант 1, вариант 2 пуст (как на скриншоте 18.10.2026)
  const list = () => addVariant(addTasksAsPositions(emptyStructure(1), ['a', 'b', 'c', 'd', 'e', 'f']).structure);

  it('перетаскивание: в пустую — перенос, опустевшая позиция убирается', () => {
    const s = moveCell(list(), { row: 3, variant: 0 }, { row: 0, variant: 1 });
    expect(grid(s)).toEqual(['a b c e f', 'd · · · ·']);
  });

  it('перетаскивание: в занятую — обмен местами; на себя и из пустой — ничего', () => {
    const s0 = normalizeStructure({ variants: [{ items: [{ task: 'a' }, { task: 'b' }] }, { items: [{ task: 'x' }, null] }] });
    expect(grid(moveCell(s0, { row: 1, variant: 0 }, { row: 0, variant: 1 }))).toEqual(['a x', 'b ·']);
    expect(moveCell(s0, { row: 0, variant: 0 }, { row: 0, variant: 0 })).toBe(s0);
    expect(moveCell(s0, { row: 1, variant: 1 }, { row: 0, variant: 0 })).toBe(s0);
    expect(moveCell(s0, { row: 5, variant: 0 }, { row: 0, variant: 1 })).toBe(s0);
  });

  it('«В вариант 2» кликами: каждая задача — в первую свободную ячейку сверху', () => {
    let s = list();
    s = moveToVariant(s, 3, 0, 1); // d
    s = moveToVariant(s, 3, 0, 1); // e (после d позиции сдвинулись)
    s = moveToVariant(s, 3, 0, 1); // f
    expect(grid(s)).toEqual(['a b c', 'd e f']);
  });

  it('«В вариант N» без свободных ячеек — новой позицией в конце', () => {
    const s0 = normalizeStructure({ variants: [{ items: [{ task: 'a' }, { task: 'b' }] }, { items: [{ task: 'x' }, { task: 'y' }] }] });
    expect(grid(moveToVariant(s0, 0, 0, 1))).toEqual(['· b ·', 'x y a']);
    expect(moveToVariant(s0, 0, 0, 0)).toBe(s0);
  });

  it('пустые позиции убираются, заполненные остаются', () => {
    const s0 = normalizeStructure({ variants: [{ items: [{ task: 'a' }, null, { task: 'b' }] }, { items: [null, null, { task: 'c' }] }] });
    expect(grid(dropEmptyRows(s0))).toEqual(['a b', '· c']);
  });

  it('разложить по вариантам: по очереди и блоками', () => {
    expect(canDistribute(list())).toBe(true);
    expect(grid(distributeToVariants(list(), 'alternate'))).toEqual(['a c e', 'b d f']);
    expect(grid(distributeToVariants(list(), 'blocks'))).toEqual(['a b c', 'd e f']);
    // нечётное число — последняя ячейка пустая
    const five = addVariant(addTasksAsPositions(emptyStructure(1), ['a', 'b', 'c', 'd', 'e']).structure);
    expect(grid(distributeToVariants(five, 'alternate'))).toEqual(['a c e', 'b d ·']);
    expect(grid(distributeToVariants(five, 'blocks'))).toEqual(['a b c', 'd e ·']);
  });

  it('раскладка недоступна, когда параллели уже есть или вариант один', () => {
    const paired = moveCell(list(), { row: 1, variant: 0 }, { row: 0, variant: 1 });
    expect(canDistribute(paired)).toBe(false);
    expect(canDistribute(addTasksAsPositions(emptyStructure(1), ['a', 'b']).structure)).toBe(false);
  });
});

describe('подборка', () => {
  beforeEach(() => {
    localStorage.clear();
    geometryBasket._reload();
  });

  it('добавляет без дублей, хранит порядок и переживает перезагрузку', () => {
    expect(geometryBasket.add([{ id: 'a', code: 'GEO-1' }, { id: 'b' }, { id: 'a' }])).toBe(2);
    expect(geometryBasket.add({ id: 'b' })).toBe(0);
    geometryBasket.move(1, 0);
    expect(geometryBasket.getSnapshot().map((x) => x.id)).toEqual(['b', 'a']);
    geometryBasket._reload();
    expect(geometryBasket.getSnapshot()).toEqual([{ id: 'b', code: '' }, { id: 'a', code: 'GEO-1' }]);
  });

  it('toggle, remove, clear и подписчики', () => {
    let calls = 0;
    const off = geometryBasket.subscribe(() => { calls += 1; });
    expect(geometryBasket.toggle({ id: 'x' })).toBe(true);
    expect(geometryBasket.has('x')).toBe(true);
    expect(geometryBasket.toggle({ id: 'x' })).toBe(false);
    geometryBasket.add({ id: 'y' });
    geometryBasket.clear();
    off();
    geometryBasket.add({ id: 'z' });
    expect(calls).toBe(4);
  });
});
