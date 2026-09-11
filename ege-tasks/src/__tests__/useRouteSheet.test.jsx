import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const createRouteSheet = vi.fn().mockResolvedValue({ id: 'sheet-1' });
const updateRouteSheet = vi.fn().mockResolvedValue({ id: 'sheet-1' });

vi.mock('../services/pocketbase', () => ({
  api: { createRouteSheet, updateRouteSheet },
}));

const { default: useRouteSheet } = await import('../hooks/useRouteSheet');

const bankTask = { id: 'bank-1', statement_md: 'Найдите 12 % от 400.', answer: '48' };

describe('useRouteSheet — состав листа', () => {
  beforeEach(() => {
    createRouteSheet.mockClear();
    updateRouteSheet.mockClear();
  });

  it('🚨 в relation уходят ТОЛЬКО задачи банка, снимок — вся цепочка', async () => {
    const { result } = renderHook(() => useRouteSheet());

    act(() => { result.current.addTask(bankTask); });
    act(() => {
      result.current.addLocalTasks([
        { statement_md: 'Сторона квадрата равна [①] см. Найдите площадь.', answer: '2304' },
      ]);
    });

    await act(async () => { await result.current.save(); });

    const payload = createRouteSheet.mock.calls[0][0];
    // Локальный id в relation = 400 от PocketBase: такой записи в базе нет.
    expect(payload.tasks).toEqual(['bank-1']);
    expect(payload.tasks_data).toHaveLength(2);
    expect(payload.tasks_data[0].task).toBe('bank-1');
    expect(payload.tasks_data[1].task).toBeNull();
    expect(payload.tasks_data[1].answer).toBe('2304');
  });

  it('снимок хранит порядок цепочки', async () => {
    const { result } = renderHook(() => useRouteSheet());
    act(() => { result.current.addLocalTasks([{ statement_md: 'A', answer: '1' }, { statement_md: 'B', answer: '2' }]); });
    act(() => { result.current.moveTask(1, 0); });

    await act(async () => { await result.current.save(); });
    const payload = createRouteSheet.mock.calls[0][0];
    expect(payload.tasks_data.map(t => t.statement_md)).toEqual(['B', 'A']);
  });

  it('настройки печати уходят вместе с листом', async () => {
    const { result } = renderHook(() => useRouteSheet());
    act(() => { result.current.addLocalTasks([{ statement_md: 'A', answer: '1' }]); });
    act(() => { result.current.updateSetting('solveCells', 10); });

    await act(async () => { await result.current.save(); });
    expect(createRouteSheet.mock.calls[0][0].settings.solveCells).toBe(10);
  });

  it('загрузка: порядок из снимка, текст задачи банка — свежий из relation', () => {
    const { result } = renderHook(() => useRouteSheet());
    act(() => {
      result.current.loadFromSaved({
        id: 'sheet-1',
        title: 'Маршрут',
        settings: { solveCells: 8 },
        expand: { tasks: [{ ...bankTask, statement_md: 'Исправленное условие' }] },
        tasks_data: [
          { statement_md: 'Своя задача', answer: '7', task: null },
          { statement_md: 'устаревшая копия', answer: '48', task: 'bank-1' },
        ],
      });
    });

    expect(result.current.tasks.map(t => t.statement_md))
      .toEqual(['Своя задача', 'Исправленное условие']);
    expect(result.current.settings.solveCells).toBe(8);
  });

  it('лист, сохранённый до снимка, читается из relation', () => {
    const { result } = renderHook(() => useRouteSheet());
    act(() => {
      result.current.loadFromSaved({ id: 'old', title: 'Старый', expand: { tasks: bankTask } });
    });
    // PocketBase на одном relation отдаёт объект, а не массив
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].id).toBe('bank-1');
    expect(result.current.settings.solveCells).toBe(6);
  });

  it('replaceTasks меняет цепочку целиком', () => {
    const { result } = renderHook(() => useRouteSheet());
    act(() => { result.current.addTask(bankTask); });
    act(() => { result.current.replaceTasks([{ statement_md: 'Новая', answer: '5' }]); });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].__local).toBe(true);
  });

  it('разрывы цепочки видны сразу', () => {
    const { result } = renderHook(() => useRouteSheet());
    act(() => {
      result.current.addLocalTasks([
        { statement_md: 'Возьмите [②].', answer: '1' },
        { statement_md: 'Вторая.', answer: '2' },
      ]);
    });
    expect(result.current.issues.some(t => t.includes('ниже по листу'))).toBe(true);
  });
});
