import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import {
  circleNum, circleIndex, referencedIndexes, resolveStatement, chainIssues,
  normalizeRouteSettings, solveHeightMm, solveWidthMm, contentWidthMm,
  instructionText, DEFAULT_INSTRUCTION,
} from '../utils/routeSheet';
import RouteSheetPrintLayout from '../components/route-sheet/RouteSheetPrintLayout';

const chain = [
  { id: 'a', statement_md: 'Найдите 12 % от 400.', answer: '48' },
  { id: 'b', statement_md: 'Сторона квадрата равна [①]. Найдите площадь.', answer: '2304' },
  { id: 'c', statement_md: 'Уменьшите [②] в [①] раз.', answer: '48' },
];

describe('routeSheet — номера и плейсхолдеры', () => {
  it('номер задачи кружковой цифрой, дальше 20-й — в скобках', () => {
    expect(circleNum(0)).toBe('①');
    expect(circleNum(19)).toBe('⑳');
    expect(circleNum(20)).toBe('(21)');
  });

  it('circleIndex обратен circleNum', () => {
    expect(circleIndex('③')).toBe(2);
    expect(circleIndex('X')).toBe(-1);
  });

  it('находит номера задач, на которые ссылается условие (без повторов)', () => {
    expect(referencedIndexes('Возьмите [②] и ещё раз [②], плюс [①]')).toEqual([0, 1]);
    expect(referencedIndexes('без ссылок')).toEqual([]);
  });

  it('видит ссылки на задачи после девятой', () => {
    expect(referencedIndexes('хвост цепочки: [⑫]')).toEqual([11]);
  });
});

describe('routeSheet — подстановка ответов', () => {
  it('подставляет ответы предыдущих задач', () => {
    expect(resolveStatement(chain[1].statement_md, chain, 1))
      .toBe('Сторона квадрата равна 48. Найдите площадь.');
  });

  it('не заглядывает вперёд: ссылка на задачу ниже остаётся плейсхолдером', () => {
    expect(resolveStatement('Возьмите [③]', chain, 1)).toBe('Возьмите [③]');
  });

  it('плейсхолдер без ответа остаётся собой', () => {
    const tasks = [{ id: 'a', statement_md: 'x', answer: '' }, { id: 'b', statement_md: '[①]' }];
    expect(resolveStatement('[①]', tasks, 1)).toBe('[①]');
  });
});

describe('routeSheet — разрывы цепочки', () => {
  it('целая цепочка замечаний не даёт', () => {
    expect(chainIssues(chain)).toEqual([]);
  });

  it('ловит ссылку на задачу ниже по листу', () => {
    const broken = [
      { id: 'a', statement_md: 'Возьмите [②]', answer: '1' },
      { id: 'b', statement_md: 'что-то', answer: '2' },
    ];
    expect(chainIssues(broken).some(t => t.includes('ниже по листу'))).toBe(true);
  });

  it('ловит ссылку на несуществующую задачу', () => {
    const broken = [{ id: 'a', statement_md: 'Возьмите [⑤]', answer: '1' }];
    expect(chainIssues(broken).some(t => t.includes('такой задачи в листе нет'))).toBe(true);
  });

  it('ловит задачу без ответа и обрыв цепочки', () => {
    const broken = [
      { id: 'a', statement_md: 'первая', answer: '' },
      { id: 'b', statement_md: 'вторая сама по себе', answer: '5' },
    ];
    const issues = chainIssues(broken);
    expect(issues.some(t => t.includes('не задан ответ'))).toBe(true);
    expect(issues.some(t => t.includes('нигде не используется'))).toBe(true);
  });
});

describe('routeSheet — настройки и геометрия', () => {
  it('лист без настроек получает дефолты', () => {
    const s = normalizeRouteSettings(undefined);
    expect(s.fill).toBe('grid');
    expect(s.solveCells).toBe(6);
    expect(s.showKey).toBe(true);
  });

  it('мусор в настройках чинится, а не роняет лист', () => {
    const s = normalizeRouteSettings({ fill: 'dots', fontSize: 'xxl', solveCells: -3 });
    expect(s.fill).toBe('grid');
    expect(s.fontSize).toBe('s');
    expect(s.solveCells).toBe(0);
  });

  it('высота места для решения кратна клетке, 0 клеток = нет места', () => {
    expect(solveHeightMm({ solveCells: 5 })).toBe(25);
    expect(solveHeightMm({ solveCells: 0 })).toBe(0);
  });

  it('ширина клеточного поля меньше ширины полосы набора на колонку номера', () => {
    expect(contentWidthMm()).toBe(194);
    expect(solveWidthMm()).toBe(183);
  });

  it('инструкция по умолчанию заменяется своей', () => {
    expect(instructionText({})).toBe(DEFAULT_INSTRUCTION);
    expect(instructionText({ instruction: '  Своя  ' })).toBe('Своя');
  });
});

// Расчёт может быть верным, а блок не попасть в разметку — печать проверяется
// по отрендеренному HTML (тот же приём, что в classifyPrint.test.jsx).
//
// 🚨 Всё считаем ВНУТРИ `.rs-page`: рядом живёт зона измерения `.rs-measure`
// с копией шапки и задач, и запрос по всему контейнеру удваивает счётчики.
describe('RouteSheetPrintLayout — печать', () => {
  const renderSheet = (settings = {}) => render(
    <RouteSheetPrintLayout title="Маршрут по процентам" tasks={chain} settings={settings} />,
  );

  const pages = (container) => [...container.querySelectorAll('.rs-page')];
  const studentPages = (container) => pages(container).filter(p => !p.classList.contains('rs-page--key'));

  it('печатает шапку, инструкцию и все задачи', () => {
    const { container } = renderSheet();
    expect(container.querySelector('.rs-root')).not.toBeNull();
    const page = studentPages(container)[0];
    expect(page.querySelector('.rs-title').textContent).toBe('Маршрут по процентам');
    expect(page.querySelector('.rs-note-text').textContent).toBe(DEFAULT_INSTRUCTION);
    expect(page.querySelectorAll('.rs-task')).toHaveLength(3);
  });

  it('каждая задача печатается ровно один раз', () => {
    const { container } = renderSheet();
    const printed = studentPages(container)
      .flatMap(p => [...p.querySelectorAll('.rs-task-text')])
      .map(el => el.textContent);
    expect(printed).toHaveLength(3);
    expect(new Set(printed).size).toBe(3);
  });

  it('шапка только на первой странице, дальше колонтитул', () => {
    const { container } = renderSheet();
    const [first, ...rest] = studentPages(container);
    expect(first.querySelector('.rs-head')).not.toBeNull();
    expect(first.querySelector('.rs-runhead')).toBeNull();
    rest.forEach((p) => {
      expect(p.querySelector('.rs-head')).toBeNull();
      expect(p.querySelector('.rs-runhead')).not.toBeNull();
    });
  });

  it('у каждой задачи есть место для решения с клеткой и рамка ответа', () => {
    const { container } = renderSheet({ solveCells: 4 });
    const page = studentPages(container)[0];
    const solve = page.querySelectorAll('.rs-solve');
    expect(solve).toHaveLength(3);
    expect(solve[0].style.height).toBe('20mm');
    // 20мм по высоте и 183мм по ширине — 3 горизонтальных и 36 вертикальных линий
    expect(solve[0].querySelectorAll('.pfill-h')).toHaveLength(3);
    expect(solve[0].querySelectorAll('.pfill-v')).toHaveLength(36);
    expect(page.querySelectorAll('.rs-answer-box')).toHaveLength(3);
  });

  it('в зоне измерения задача «голая» — без места для решения', () => {
    const { container } = renderSheet({ solveCells: 6 });
    const measure = container.querySelector('.rs-measure');
    expect(measure).not.toBeNull();
    expect(measure.querySelectorAll('.rs-solve')).toHaveLength(0);
    expect(measure.querySelectorAll('.rs-task')).toHaveLength(3);
  });

  it('🚨 рамка ответа стоит в строке условия, а не отдельным блоком под клеткой', () => {
    const { container } = renderSheet({ solveCells: 6 });
    const task = studentPages(container)[0].querySelector('.rs-task');
    const row = task.querySelector('.rs-task-row');
    // Условие и ответ — в одной строке: отдельной строкой ответ съедал ~12 мм
    // на каждой задаче.
    expect(row.querySelector('.rs-task-text')).not.toBeNull();
    expect(row.querySelector('.rs-answer')).not.toBeNull();
    // Клетка идёт следующим блоком, ПОСЛЕ строки с ответом
    expect(task.querySelector('.rs-task-main').children[1].className).toBe('rs-solve');
  });

  it('0 клеток — места для решения нет вовсе', () => {
    const { container } = renderSheet({ solveCells: 0 });
    const page = studentPages(container)[0];
    expect(page.querySelectorAll('.rs-solve')).toHaveLength(0);
    expect(page.querySelectorAll('.rs-answer-box')).toHaveLength(3);
  });

  it('страницы получают поля сами — padding из PAGE_MM', () => {
    const { container } = renderSheet();
    pages(container).forEach((p) => {
      // jsdom схлопывает одинаковые левое и правое поля: «8mm 8mm 6mm»
      expect(p.style.padding).toBe('8mm 8mm 6mm');
    });
  });

  it('ключ учителя печатает ответы и подставляет их в условия', () => {
    const { container } = renderSheet({ showKey: true });
    const key = container.querySelector('.rs-page--key');
    expect(key).not.toBeNull();
    expect(key.querySelectorAll('.rs-key-cell')).toHaveLength(3);
    expect(key.querySelector('.rs-key-grid').textContent).toContain('2304');
    expect(key.querySelectorAll('.rs-task')[1].textContent)
      .toContain('Сторона квадрата равна 48');
  });

  it('ключ отключается настройкой', () => {
    const { container } = renderSheet({ showKey: false });
    expect(container.querySelector('.rs-page--key')).toBeNull();
  });

  it('поле «Класс» и инструкция убираются настройками', () => {
    const { container } = renderSheet({ showClassField: false, showInstruction: false });
    const page = studentPages(container)[0];
    expect(page.querySelector('.rs-note')).toBeNull();
    expect(page.querySelectorAll('.rs-field')).toHaveLength(2);
  });

  it('экранный предпросмотр — тот же лист, но в другом корне', () => {
    const { container } = render(
      <RouteSheetPrintLayout title="x" tasks={chain} settings={{}} screenMode />,
    );
    expect(container.querySelector('.rs-screen-root')).not.toBeNull();
    expect(container.querySelector('.rs-root')).toBeNull();
    expect(container.querySelectorAll('.rs-page').length).toBeGreaterThan(0);
  });
});

// ─── Пагинация ───────────────────────────────────────────────────────────────
// В jsdom `offsetHeight` всегда 0, и без подмены пагинация молча сваливает всё
// на одну страницу — то есть проверяет ровно ничего. Подставляем правдоподобные
// высоты и считаем реальное разбиение.
describe('RouteSheetPrintLayout — разбиение на страницы', () => {
  const TASK_PX = 100;   // «голая» задача: условие + строка ответа
  const HEAD_PX = 190;   // шапка с полями и инструкцией

  let restore;
  beforeEach(() => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        if (this.querySelector?.('.rs-head')) return HEAD_PX;
        if (this.querySelector?.('.rs-task')) return TASK_PX;
        return 0;
      },
    });
    restore = () => (original
      ? Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original)
      : delete HTMLElement.prototype.offsetHeight);
  });
  afterEach(() => restore());

  const longChain = (n) => Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    statement_md: i === 0 ? 'Первая задача цепочки.' : `Задача ${i + 1}, берём [${circleNum(i - 1)}].`,
    answer: String(i + 1),
  }));

  it('длинная цепочка разносится по страницам, задачи не теряются и не двоятся', () => {
    const tasks = longChain(8);
    const { container } = render(
      <RouteSheetPrintLayout title="Длинный маршрут" tasks={tasks} settings={{ solveCells: 6 }} />,
    );

    const pages = [...container.querySelectorAll('.rs-page')]
      .filter(p => !p.classList.contains('rs-page--key'));
    expect(pages.length).toBeGreaterThan(1);

    // Номера задач идут подряд и ровно по разу: номер печатается по позиции в
    // цепочке, а не по месту на странице — иначе плейсхолдеры перестанут
    // указывать на свои задачи.
    const numbers = pages.flatMap(p => [...p.querySelectorAll('.rs-task-num')].map(el => el.textContent));
    expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('на первой странице помещается меньше задач, чем на следующих: там шапка', () => {
    const tasks = longChain(8);
    const { container } = render(
      <RouteSheetPrintLayout title="Длинный маршрут" tasks={tasks} settings={{ solveCells: 6 }} />,
    );
    const pages = [...container.querySelectorAll('.rs-page')]
      .filter(p => !p.classList.contains('rs-page--key'));
    const counts = pages.map(p => p.querySelectorAll('.rs-task').length);
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(8);
  });

  it('без места для решения на страницу входит больше задач', () => {
    const tasks = longChain(8);
    const withSolve = render(
      <RouteSheetPrintLayout title="x" tasks={tasks} settings={{ solveCells: 6 }} />,
    ).container.querySelectorAll('.rs-page:not(.rs-page--key)').length;
    const without = render(
      <RouteSheetPrintLayout title="x" tasks={tasks} settings={{ solveCells: 0 }} />,
    ).container.querySelectorAll('.rs-page:not(.rs-page--key)').length;
    expect(without).toBeLessThan(withSolve);
  });
});
