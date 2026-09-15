import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import MarathonRatingPrint from '../components/marathon/MarathonRatingPrint';
import { RATING_SETTINGS_KEY } from '../utils/marathonRating';

const wrapper = ({ children }) => <App>{children}</App>;

const students = (n) => Array.from({ length: n }, (_, i) => `Ученик ${i + 1}`);
const tasks = (n) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, code: `M-${i}` }));

const sheet = (studentCount, taskCount, settings) => {
  if (settings) localStorage.setItem(RATING_SETTINGS_KEY, JSON.stringify(settings));
  return render(
    <MarathonRatingPrint
      students={students(studentCount)}
      tasks={tasks(taskCount)}
      title="Марафон"
      classNumber={9}
      onBack={() => {}}
    />,
    { wrapper },
  );
};

describe('бланк рейтинга', () => {
  beforeEach(() => localStorage.clear());

  it('строк на листе — ученики плюс пустые', () => {
    const { container } = sheet(12, 17, { extraRows: 2 });
    expect(container.querySelectorAll('.mrp-sheet')).toHaveLength(1);
    // строки без шапки
    expect(container.querySelectorAll('.mrp-row:not(.mrp-row--head)')).toHaveLength(14);
  });

  it('в клетке столько квадратиков, сколько попыток', () => {
    const { container } = sheet(2, 3, { extraRows: 0, attempts: 4 });
    const cells = container.querySelectorAll('.mrp-cell--task');
    expect(cells).toHaveLength(2 * 3);
    expect(cells[0].querySelectorAll('.mrp-mark')).toHaveLength(4);
  });

  it('колонка «Итого» стоит только на последнем листе блока задач', () => {
    const { container } = sheet(6, 40, { extraRows: 0 });
    const sheets = [...container.querySelectorAll('.mrp-sheet')];
    expect(sheets.length).toBeGreaterThan(1);
    const withTotal = sheets.filter(el => el.querySelector('.mrp-cell--total'));
    expect(withTotal).toHaveLength(1);
    expect(withTotal[0]).toBe(sheets[sheets.length - 1]);
  });

  it('легенда и колонка № отключаются', () => {
    const { container, unmount } = sheet(3, 5, { extraRows: 0 });
    expect(container.querySelector('.mrp-legend')).toBeTruthy();
    expect(container.querySelector('.mrp-cell--index')).toBeTruthy();
    unmount();

    const bare = sheet(3, 5, { extraRows: 0, showLegend: false, showIndex: false });
    expect(bare.container.querySelector('.mrp-legend')).toBeNull();
    expect(bare.container.querySelector('.mrp-cell--index')).toBeNull();
  });

  it('ориентация листа попадает в корневой класс — от неё зависит печать', () => {
    const { container, unmount } = sheet(3, 5, { extraRows: 0 });
    expect(container.querySelector('.mrp-root--landscape')).toBeTruthy();
    unmount();

    const portrait = sheet(3, 5, { extraRows: 0, orientation: 'portrait' });
    expect(portrait.container.querySelector('.mrp-root--portrait')).toBeTruthy();
  });

  it('в шапке листа видно класс, число задач и максимум баллов', () => {
    sheet(3, 17, { extraRows: 0, attempts: 3 });
    expect(screen.getAllByText('9 класс').length).toBeGreaterThan(0);
    expect(screen.getAllByText('17 задач').length).toBeGreaterThan(0);
    expect(screen.getAllByText('максимум 51').length).toBeGreaterThan(0);
  });
});
