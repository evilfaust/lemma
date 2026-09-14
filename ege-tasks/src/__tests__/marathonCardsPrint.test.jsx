import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import MarathonCardsPrint from '../components/marathon/MarathonCardsPrint';
import { CARD_SETTINGS_KEY, cardGrid } from '../utils/marathonCards';

const wrapper = ({ children }) => <App>{children}</App>;

const task = (n) => ({
  id: `t${n}`,
  code: `M-${n}`,
  statement_md: `Решите неравенство $x^2 > ${n}$`,
  answer: `x > ${n}`,
});

const sheet = (tasks, settings) => {
  if (settings) localStorage.setItem(CARD_SETTINGS_KEY, JSON.stringify(settings));
  return render(
    <MarathonCardsPrint tasks={tasks} title="Марафон" onBack={() => {}} />,
    { wrapper },
  );
};

describe('лист карточек марафона', () => {
  beforeEach(() => localStorage.clear());

  it('режет задачи по листам и добивает последний лист пустыми местами', () => {
    const tasks = Array.from({ length: 7 }, (_, i) => task(i + 1));
    const { container } = sheet(tasks, { count: 6 });

    expect(container.querySelectorAll('.mcp-sheet')).toHaveLength(2);
    expect(container.querySelectorAll('.mcp-card:not(.mcp-card--empty)')).toHaveLength(7);
    expect(container.querySelectorAll('.mcp-card--empty')).toHaveLength(5);
  });

  it('номер на карточке — номер задачи в марафоне', () => {
    const { container } = sheet([task(1), task(2), task(3)], { count: 2 });
    const nums = [...container.querySelectorAll('.mcp-num')].map(el => el.textContent);
    expect(nums).toEqual(['1', '2', '3']);
  });

  it('плотность листа задаёт число колонок сетки', () => {
    const tasks = Array.from({ length: 9 }, (_, i) => task(i + 1));
    const { container } = sheet(tasks, { count: 9 });
    const grid = container.querySelector('.mcp-grid');
    expect(grid.style.gridTemplateColumns).toContain(`repeat(${cardGrid(9).cols}`);
    expect(container.querySelectorAll('.mcp-sheet')).toHaveLength(1);
  });

  it('добивка «столько копий» печатает каждую задачу нужное число раз', () => {
    const { container } = sheet([task(1), task(2)], { count: 4, fill: 'copies', copies: 3 });
    // 2 задачи × 3 копии = 6 карточек → два листа по 4 места
    expect(container.querySelectorAll('.mcp-card:not(.mcp-card--empty)')).toHaveLength(8);
    expect(container.querySelectorAll('.mcp-sheet')).toHaveLength(2);
  });

  it('поле «Ответ» и код печатаются по настройке, а не всегда', () => {
    const { container, unmount } = sheet([task(1)], { count: 4 });
    expect(container.querySelector('.mcp-answer')).toBeNull();
    expect(container.querySelector('.mcp-code')).toBeNull();
    unmount();

    const second = sheet([task(1)], { count: 4, showAnswer: true, showCode: true });
    expect(second.container.querySelector('.mcp-answer')).toBeTruthy();
    expect(second.container.querySelector('.mcp-code').textContent).toBe('M-1');
  });

  it('название марафона печатается в шапке карточки', () => {
    const { container } = sheet([task(1)], { count: 4 });
    expect(container.querySelector('.mcp-head-title').textContent).toBe('Марафон');
  });

  it('в тулбаре видно, сколько выйдет листов', () => {
    const tasks = Array.from({ length: 5 }, (_, i) => task(i + 1));
    sheet(tasks, { count: 4 });
    expect(screen.getByText(/2 листа/)).toBeTruthy();
  });
});
