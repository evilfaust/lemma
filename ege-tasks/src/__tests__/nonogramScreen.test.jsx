import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockApi = vi.hoisted(() => ({
  getPixelArtImages: vi.fn(async () => []),
  createPixelArtImage: vi.fn(async (d) => ({ id: 'img1', ...d })),
  getGeneratorSheets: vi.fn(async () => []),
  getGeneratorSheet: vi.fn(),
}));
vi.mock('../services/pocketbase', () => ({ api: mockApi, default: {} }));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

import { useNonogram } from '../hooks/useNonogram';
import NonogramGenerator from '../components/nonogram/NonogramGenerator';
import { cluesOf } from '../utils/nonogram/solver';

const pic = (rows) => rows.map(s => [...s].map(ch => ch === '#'));
const DIAG = pic(['#....', '.#...', '..#..', '...#.', '....#']);

describe('useNonogram', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('новая картинка: готовые клетки подобраны, примеры собраны сами', () => {
    const { result } = renderHook(() => useNonogram());
    act(() => result.current.setPicture(DIAG));
    expect(result.current.analysis.result.status).toBe('unique');
    expect(result.current.givens.length).toBeGreaterThan(0);
    expect(result.current.stale).toBe(true);
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.stale).toBe(false);
    expect(result.current.variants).toHaveLength(2);
    expect(result.current.variants[0].rows.map(l => l.map(q => q.value))).toEqual(cluesOf(DIAG).rows);
    expect(result.current.tasksData.matrix).toBe(DIAG);
  });

  it('клик по клетке снимает готовую клетку — логика встаёт', () => {
    const { result } = renderHook(() => useNonogram());
    act(() => result.current.setPicture(DIAG));
    const g = result.current.givens[0];
    act(() => result.current.toggleGiven(g.r, g.c));
    expect(result.current.givens.some(x => x.r === g.r && x.c === g.c)).toBe(false);
    act(() => result.current.completeGivens());
    expect(result.current.analysis.result.status).toBe('unique');
  });

  it('смена уровня пересобирает примеры, готовые клетки — нет', () => {
    const { result } = renderHook(() => useNonogram());
    act(() => result.current.setPicture(DIAG));
    act(() => { vi.advanceTimersByTime(300); });
    const before = result.current.givens;
    act(() => result.current.updateSetting('level', 3));
    expect(result.current.stale).toBe(true);
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.stale).toBe(false);
    expect(result.current.givens).toBe(before);
  });

  it('сохранённый лист открывается как был — без пересборки', () => {
    const { result } = renderHook(() => useNonogram());
    act(() => result.current.setPicture(DIAG));
    act(() => { vi.advanceTimersByTime(300); });
    const saved = result.current.tasksData;
    const settings = result.current.settings;
    const first = saved.variants[0].rows[0][0].exprLatex;

    const other = renderHook(() => useNonogram());
    act(() => other.result.current.applySheet({ title: 'Лист', settings, tasksData: saved }));
    act(() => { vi.advanceTimersByTime(300); });
    expect(other.result.current.stale).toBe(false);
    expect(other.result.current.variants[0].rows[0][0].exprLatex).toBe(first);
    expect(other.result.current.givens).toEqual(saved.givens);
    expect(other.result.current.title).toBe('Лист');
  });

  it('«Подправить картинку» убирает неоднозначность без готовых клеток', () => {
    const { result } = renderHook(() => useNonogram());
    act(() => result.current.setPicture(pic(['#.', '.#'])));
    let res;
    act(() => { res = result.current.fixPicture(); });
    expect(res.result.status).toBe('unique');
    expect(result.current.flipped).toBeGreaterThan(0);
  });
});

describe('экран генератора', () => {
  it('открывается пустым, с подсказкой и настройками', () => {
    render(<MemoryRouter><NonogramGenerator /></MemoryRouter>);
    expect(screen.getByText(/Загрузите картинку, выберите из библиотеки или нарисуйте/)).toBeTruthy();
    expect(screen.getByText('Библиотека')).toBeTruthy();
    expect(screen.getByText('Нарисовать')).toBeTruthy();
    expect(screen.getByText('Целые числа')).toBeTruthy();
    expect(screen.getByText('Логарифмы')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Печать/ }).disabled).toBe(true);
  });
});
