import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import PrintSheet from '../components/print-sheet/PrintSheet';
import {
  MM, SOLUTION_GAP_MM, SOLUTION_SPACE_MM, SOLUTION_SPACE_OPTIONS, isOwnSolution, paginateFixedCount,
  stepTaskSolution, taskSolutionLabel, taskSolutionMm,
} from '../components/print-sheet/geometry';
import {
  emptyStructure, addTasksAsPositions, withLayouts, sheetOptionsOf,
} from '../utils/geometryWork';
import { variantOrder, withOrderExtras } from '../utils/variantOrder';

// Место для решения у отдельной задачи листа (v3.9.384)

const wrapper = ({ children }) => <App>{children}</App>;
const task = (n, extra = {}) => ({
  id: `t${n}`, code: `G-${n}`, statement_md: `Задача $${n}$`, answer: String(n), ...extra,
});
const meta = { title: 'Лист', showStudentFields: false };
const sheet = (tasks, options = {}, editing) => render(
  <PrintSheet
    variants={[{ number: 1, tasks }]}
    meta={meta}
    headerMode="compact"
    layout="workbook"
    options={{ answerStyle: 'none', solutionSpace: 's', ...options }}
    editing={editing}
  />,
  { wrapper },
);
const zones = (container) => [...container.querySelectorAll('.ps-page .ps-task')]
  .map((el) => el.querySelector('.ps-solution')?.style.height || '—');

describe('место для решения задачи — правила', () => {
  it('шкала стала шире: XS и XXL', () => {
    expect(SOLUTION_SPACE_OPTIONS.map((o) => o.value)).toEqual(['none', 'xs', 's', 'm', 'l', 'xl', 'xxl']);
    expect(SOLUTION_SPACE_MM.xs).toBeLessThan(SOLUTION_SPACE_MM.s);
    expect(SOLUTION_SPACE_MM.xxl).toBeGreaterThan(SOLUTION_SPACE_MM.xl);
  });

  it('своё место перебивает лист; «как на листе» — нет', () => {
    expect(taskSolutionMm({}, 22)).toBe(22);
    expect(taskSolutionMm({ solutionSpace: 'auto' }, 22)).toBe(22);
    expect(taskSolutionMm({ solutionSpace: 'answer' }, 22)).toBe(0);
    expect(taskSolutionMm({ solutionSpace: 'none' }, 22)).toBe(0);
    expect(taskSolutionMm({ solutionSpace: 'xl' }, 22)).toBe(82);
    expect(taskSolutionMm({ solutionSpace: 45 }, 22)).toBe(45);
    expect(taskSolutionMm({ solutionSpace: 9999 }, 22)).toBe(240);
    expect(isOwnSolution({ solutionSpace: null })).toBe(false);
    expect(isOwnSolution({ solutionSpace: 0 })).toBe(true);
  });

  it('±1 клетка — от текущей высоты, до нуля — «без места»', () => {
    expect(stepTaskSolution({}, 22, 1)).toBe(25); // 22 мм ≈ 4 кл. → 5 кл.
    expect(stepTaskSolution({ solutionSpace: 'm' }, 22, -1)).toBe(35);
    expect(stepTaskSolution({ solutionSpace: 5 }, 22, -1)).toBe('none');
    expect(stepTaskSolution({ solutionSpace: 'none' }, 22, 1)).toBe(5);
  });

  it('подписи кнопки', () => {
    expect(taskSolutionLabel({})).toBe('место');
    expect(taskSolutionLabel({ solutionSpace: 'answer' })).toBe('только ответ');
    expect(taskSolutionLabel({ solutionSpace: 'none' })).toBe('без места');
    expect(taskSolutionLabel({ solutionSpace: 'xs' })).toBe('XS');
    expect(taskSolutionLabel({ solutionSpace: 30 })).toBe('6 кл.');
  });

  it('«N на лист»: задачи со своим местом в делёж остатка не входят', () => {
    const items = [{ __key: 'a', solutionSpace: 'answer' }, { __key: 'b', solutionSpace: 'answer' }, { __key: 'c' }];
    const zero = new Map(items.map((i) => [i.__key, 0]));
    const cap = 200 * MM;
    const [page] = paginateFixedCount(items, zero, 3, cap, cap, 0);
    // весь остаток — одной задаче «как на листе»
    expect(page.solutionMm).toBeCloseTo(200 - SOLUTION_GAP_MM, 0);
    // своё место (L) вычитается из страницы до дележа
    const withL = [{ __key: 'a', solutionSpace: 'l' }, { __key: 'b' }];
    const [p2] = paginateFixedCount(withL, new Map([['a', 0], ['b', 0]]), 2, cap, cap, 0);
    expect(p2.solutionMm).toBeCloseTo(200 - SOLUTION_SPACE_MM.l - 2 * SOLUTION_GAP_MM, 0);
  });
});

describe('место для решения задачи — на листе', () => {
  it('у задачи своё место: «только ответ» — строка «Ответ» без клетки, XL — выше листа', () => {
    const { container } = sheet([
      task(1, { solutionSpace: 'answer' }),
      task(2, { solutionSpace: 'none' }),
      task(3, { solutionSpace: 'xl' }),
      task(4),
    ]);
    expect(zones(container)).toEqual(['—', '—', `${SOLUTION_SPACE_MM.xl}mm`, `${SOLUTION_SPACE_MM.s}mm`]);
    const answers = [...container.querySelectorAll('.ps-page .ps-task')].map((el) => !!el.querySelector('.ps-answer'));
    // на листе строки ответа нет — «только ответ» её добавляет
    expect(answers).toEqual([true, false, false, false]);
  });

  it('на листе «набор задач» (без места) своё место не появляется', () => {
    const { container } = render(
      <PrintSheet variants={[{ number: 1, tasks: [task(1, { solutionSpace: 'xl' })] }]} meta={meta} layout="sheet" />,
      { wrapper },
    );
    expect(container.querySelector('.ps-page .ps-solution')).toBeNull();
  });

  it('меню у задачи: выбор уходит в onSetSolutionSpace', async () => {
    const onSetSolutionSpace = vi.fn();
    sheet([task(1), task(2, { solutionSpace: 'm' })], {}, { onSetSolutionSpace });
    const buttons = screen.getAllByLabelText('Место для решения');
    expect(buttons.map((b) => b.textContent)).toEqual(['место', 'M']);
    fireEvent.click(buttons[0]);
    fireEvent.click(await screen.findByText(/^Только ответ/));
    expect(onSetSolutionSpace).toHaveBeenLastCalledWith(0, 0, 'answer');
    fireEvent.click(buttons[1]);
    fireEvent.click((await screen.findAllByText(/^Как на листе/)).at(-1));
    expect(onSetSolutionSpace).toHaveBeenLastCalledWith(0, 1, null);
    fireEvent.click(buttons[1]);
    fireEvent.click((await screen.findAllByText(/^Больше на клетку/)).at(-1));
    expect(onSetSolutionSpace).toHaveBeenLastCalledWith(0, 1, 45); // M 38 мм ≈ 8 кл. → 9 кл. = 45 мм
  });
});

describe('где хранится выбор', () => {
  it('геометрическая работа: structure.layouts[id].sheet, место на карточке не затирается', () => {
    let s = addTasksAsPositions(emptyStructure(1), ['a', 'b']).structure;
    s = withLayouts(s, { a: { place: 'left' } });
    s = withLayouts(s, { a: { sheet: { solutionSpace: 'answer', kimImageSize: 'l' } } });
    expect(s.layouts.a).toEqual({ place: 'left', sheet: { solutionSpace: 'answer', kimImageSize: 'l' } });
    s = withLayouts(s, { a: { place: 'top' } });
    expect(sheetOptionsOf(s)).toEqual({ a: { solutionSpace: 'answer', kimImageSize: 'l' } });
    expect(s.layouts.a.place).toBe('top');
  });

  it('обычная работа: variants.order туда и обратно', () => {
    const order = variantOrder([{ id: 'x', solutionSpace: 'answer' }, { id: 'y', solutionSpace: 30 }, { id: 'z', solutionSpace: null }]);
    expect(order).toEqual([
      { taskId: 'x', position: 0, solutionSpace: 'answer' },
      { taskId: 'y', position: 1, solutionSpace: 30 },
      { taskId: 'z', position: 2 },
    ]);
    expect(withOrderExtras({ id: 'y' }, order[1]).solutionSpace).toBe(30);
  });
});
