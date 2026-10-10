import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import WorkPrintPreview, { WORK_PRINT_DEFAULTS } from '../components/worksheet/WorkPrintPreview';
import { api } from '../services/pocketbase';
import { variantOrder, withOrderExtras } from '../utils/variantOrder';

const wrapper = ({ children }) => <App>{children}</App>;

const RESHU_URL = 'https://ege.sdamgia.ru/get_file?id=12345';

// Задачи «со всех редакторов»: чертёж планиметрии и стереометрии, график,
// диаграмма, числовая прямая в ячейке, поле в клетку, картинка «Решу».
const tasks = [
  { id: 't1', code: '1-001', statement_md: 'Найдите $2 + 2$.', answer: '4' },
  { id: 't2', code: '2-001', statement_md: 'Треугольник:\n\n```planim\nтреугольник ABC 5 6 7\n```\n\nНайдите угол $A$.', answer: '30' },
  { id: 't3', code: '3-001', statement_md: 'Куб:\n\n```stereo\nкуб 4\n```\n\nНайдите диагональ.', answer: '4\\sqrt{3}' },
  { id: 't4', code: '4-001', statement_md: 'По графику:\n\n```plot\nx -3 3\ny -3 3\nf x^2-1\n```', answer: '1' },
  { id: 't5', code: '5-001', statement_md: 'Осадки:\n\n```chart\nтип столбцы\nx 1 2 3\ny 0 10 2\nданные 1 4; 2 8; 3 6\n```', answer: '8' },
  { id: 't6', code: '6-001', statement_md: '| А | Б |\n| --- | --- |\n| `numline: domain -2 2; point 1` | `numline: domain -2 2; point -1` |', answer: '12' },
  { id: 't7', code: '7-001', statement_md: `Найдите площадь.\n\n![image](${RESHU_URL})`, answer: '6' },
];

const work = { id: 'w1', title: 'Контрольная по теме' };
const variants = [{ number: 1, tasks }];

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(api, 'getShownTaskImages').mockResolvedValue([
    { id: 'img1', collectionId: 'task_images', collectionName: 'task_images', task: 't7', file: 'local.png', original_url: RESHU_URL, role: 'condition' },
  ]);
});
afterEach(() => vi.restoreAllMocks());

const open = (props = {}) => render(
  <WorkPrintPreview work={work} variants={variants} onClose={() => {}} {...props} />,
  { wrapper },
);

// Страницы листа (рядом живёт зона измерения с копией задач).
const pages = (c) => c.querySelectorAll('.ps-page:not(.ps-measure .ps-page)');

describe('WorkPrintPreview — печать работы листом Генератора', () => {
  it('рисует лист движка print-sheet: шапка с названием работы и ключ ответов', () => {
    const { container } = open();
    expect(container.querySelector('.ps-root')).not.toBeNull();
    expect(pages(container).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Контрольная по теме').length).toBeGreaterThan(0);
    expect(container.querySelector('.ps-key-title')).not.toBeNull();
  });

  it('по умолчанию — лицо прежнего режима: N на лист, чистое место без рамки', () => {
    expect(WORK_PRINT_DEFAULTS).toMatchObject({
      solutionSpace: 'fit', tasksPerPage: 4, solutionFill: 'blank', solutionFrame: false, answerStyle: 'none',
    });
    const { container } = open();
    const root = container.querySelector('.ps-root');
    expect(root.classList.contains('ps-root--noframe')).toBe(true);
    expect(root.classList.contains('ps-root--italic')).toBe(false);
  });

  it('чертежи всех редакторов доходят до листа SVG-ом', () => {
    const { container } = open();
    const sheet = container.querySelector('.ps-root');
    const task = (code) => [...sheet.querySelectorAll('.ps-task')]
      .find((el) => el.closest('.ps-measure') == null && el.textContent.includes(code === 't2' ? 'Треугольник' : code));
    expect(task('t2').querySelector('svg')).not.toBeNull();       // ```planim
    expect(task('Куб').querySelector('svg')).not.toBeNull();      // ```stereo
    expect(task('По графику').querySelector('svg')).not.toBeNull(); // ```plot
    expect(task('Осадки').querySelector('svg')).not.toBeNull();   // ```chart
    expect(sheet.querySelectorAll('td svg').length).toBeGreaterThanOrEqual(2); // `numline:` в ячейках
  });

  it('картинка «Решу» в условии подменяется своим файлом', async () => {
    const { container } = open();
    await waitFor(() => {
      const imgs = [...container.querySelectorAll('.ps-task img')].map((i) => i.getAttribute('src'));
      expect(imgs.some((s) => s.includes('local.png'))).toBe(true);
      expect(imgs.some((s) => s === RESHU_URL)).toBe(false);
    });
    expect(api.getShownTaskImages).toHaveBeenCalledWith(['t7']);
  });

  it('курсив и рамка решения — из панели «Оформление», выбор запоминается', () => {
    const { container } = open();
    fireEvent.click(screen.getByText('Курсив'));
    expect(container.querySelector('.ps-root').classList.contains('ps-root--italic')).toBe(true);
    fireEvent.click(screen.getByText('Рамка решения').closest('.ant-space').querySelector('button'));
    expect(container.querySelector('.ps-root').classList.contains('ps-root--noframe')).toBe(false);
    const saved = JSON.parse(localStorage.getItem('workPrint.v2'));
    expect(saved).toMatchObject({ italic: true, solutionFrame: true });
    // Название — своё у каждой работы, в общее оформление не пишется.
    expect(saved.meta.title).toBeUndefined();
  });

  it('размер чертежа отдельной задачи уходит в работу', () => {
    const onSetTaskOption = vi.fn();
    const { container } = open({ onSetTaskOption });
    const planimTask = [...container.querySelectorAll('.ps-task')]
      .find((el) => el.closest('.ps-measure') == null && el.textContent.includes('Треугольник'));
    fireEvent.click([...planimTask.querySelectorAll('.ant-segmented-item-label')].find((el) => el.textContent === 'L'));
    expect(onSetTaskOption).toHaveBeenCalledWith(0, 1, 'kimImageSize', 'l');
  });
});

describe('variantOrder — личные настройки задачи в order', () => {
  it('пишет и читает размер и место чертежа', () => {
    const order = variantOrder([{ id: 'a' }, { id: 'b', kimImageSize: 'l', figurePlacement: 'right' }]);
    expect(order).toEqual([
      { taskId: 'a', position: 0 },
      { taskId: 'b', position: 1, imageSize: 'l', figurePlacement: 'right' },
    ]);
    const plain = { id: 'a' };
    expect(withOrderExtras(plain, order[0])).toBe(plain);
    expect(withOrderExtras({ id: 'b' }, order[1])).toEqual({ id: 'b', kimImageSize: 'l', figurePlacement: 'right' });
  });
});
