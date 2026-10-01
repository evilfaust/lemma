import { describe, it, expect, beforeEach } from 'vitest';
import {
  emptyStructure, normalizeStructure, rowCount, structureTaskIds, addTasksAsPositions,
  setCell, removeRow, moveRow, addVariant, removeVariant, rowReference, emptyRows,
  variantTasks, withLayouts, structureFromPrintTest,
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
