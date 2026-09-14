import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { App } from 'antd';
import MarathonWorksheetPrint from '../components/marathon/MarathonWorksheetPrint';
import {
  CUT_MM, FONT_PT_OPTIONS, HEAD_MM, PAGE_MM, PT_MM, WORK_COUNTS, CARD_COUNTS,
  DEFAULT_MARATHON_WORKSHEET_SETTINGS, MARATHON_WORKSHEET_PRESETS,
  applyMarathonWorksheetMode, blockHeightMm, contentWidthMm, countsFor,
  MAX_SHEETS, expandTasks, fillSlots, fillSummary, fitBlock, fontMmOf, gridLines,
  layoutBlock, lcm, normalizeMarathonWorksheetSettings,
  NUM_COL_MM, paginateBlocks, statementWidthMm,
} from '../utils/marathonWorksheet';

// Ключ хранения настроек листа — тот же, что в компоненте.
const STORAGE_KEY = 'marathon.worksheetSettings';

const wrapper = ({ children }) => <App>{children}</App>;

const task = (n) => ({
  id: `t${n}`,
  code: `M-${n}`,
  statement_md: `Найдите значение $${n} + ${n}$`,
  answer: String(n * 2),
});

const tasks = [task(1), task(2), task(3)];

describe('геометрия отрезного листа', () => {
  it('блоки и полосы разреза укладываются в лист без остатка', () => {
    for (const n of [...WORK_COUNTS, ...CARD_COUNTS]) {
      const total = blockHeightMm(n) * n + CUT_MM * (n - 1) + 2 * PAGE_MM.pad;
      expect(total).toBeCloseTo(PAGE_MM.h, 6);
    }
  });

  it('блок тем ниже, чем больше блоков на листе', () => {
    const heights = WORK_COUNTS.map(blockHeightMm);
    expect(heights).toEqual([...heights].sort((a, b) => b - a));
  });

  it('шапка, условие и место для решения не вылезают за блок', () => {
    for (const n of WORK_COUNTS) {
      const g = layoutBlock({ count: n, mode: 'work' });
      expect(g.headMm + g.condMm + g.solutionMm).toBeLessThanOrEqual(g.blockMm);
      expect(g.solutionMm).toBeGreaterThan(0);
    }
  });

  it('в режиме карточки места для решения нет, условию достаётся весь блок', () => {
    const g = layoutBlock({ count: 5, mode: 'card' });
    expect(g.solutionMm).toBe(0);
    expect(g.condMm).toBeCloseTo(g.blockMm - HEAD_MM - 3, 6);
  });

  it('без шапки условие получает её высоту', () => {
    const withHead = layoutBlock({ count: 5, mode: 'card', showHeader: true });
    const noHead = layoutBlock({ count: 5, mode: 'card', showHeader: false });
    expect(noHead.headMm).toBe(0);
    expect(noHead.condMm).toBeCloseTo(withHead.condMm + HEAD_MM, 6);
  });
});

describe('fitBlock — место для решения по реальной высоте условия', () => {
  const count = 3;

  it('без замера повторяет раскладку по доле', () => {
    expect(fitBlock({ count, mode: 'work' })).toEqual(layoutBlock({ count, mode: 'work' }));
  });

  it('короткому условию — меньше места, решению — больше', () => {
    const base = layoutBlock({ count, mode: 'work' });
    const short = fitBlock({ count, mode: 'work', condContentMm: 5 });
    expect(short.condMm).toBeLessThan(base.condMm);
    expect(short.solutionMm).toBeGreaterThan(base.solutionMm);
    expect(short.headMm + short.condMm + short.solutionMm).toBeLessThanOrEqual(short.blockMm);
  });

  it('длинное условие не съедает всё место для решения', () => {
    const long = fitBlock({ count, mode: 'work', condContentMm: 500 });
    expect(long.condMm).toBeLessThanOrEqual(long.blockMm * 0.5);
    expect(long.solutionMm).toBeGreaterThan(0);
  });

  it('условие короче минимума всё равно получает минимум', () => {
    const tiny = fitBlock({ count, mode: 'work', condContentMm: 0.5 });
    expect(tiny.condMm).toBeGreaterThanOrEqual(10);
  });

  it('в режиме карточки замер ничего не меняет — места для решения нет', () => {
    const card = fitBlock({ count: 5, mode: 'card', condContentMm: 12 });
    expect(card).toEqual(layoutBlock({ count: 5, mode: 'card' }));
  });

  it('ширина зоны измерения — ширина условия в блоке, а не листа', () => {
    expect(statementWidthMm()).toBeLessThan(contentWidthMm());
    expect(statementWidthMm()).toBeCloseTo(202 - 5 - NUM_COL_MM - 3.5, 6);
  });

  it('номер задачи — стандартный квадрат, от кегля не зависит', () => {
    // Номер — часть оформления листа, а не текста задачи: на всех листах
    // проекта он одного размера (print-sheet: 6.5 мм).
    expect(NUM_COL_MM).toBe(6.5);
  });
});

describe('gridLines — линии считаются точно под блок', () => {
  it('клетка 5 мм: линий на одну меньше, чем клеток', () => {
    expect(gridLines({ heightMm: 50, widthMm: 100 })).toEqual({ h: 9, v: 19, step: 5 });
  });

  it('линейка — только горизонтальные, шаг 8 мм', () => {
    expect(gridLines({ heightMm: 40, widthMm: 100, fill: 'lines' })).toEqual({ h: 4, v: 0, step: 8 });
  });

  it('«пусто» не рисует ничего', () => {
    expect(gridLines({ heightMm: 40, widthMm: 100, fill: 'blank' })).toEqual({ h: 0, v: 0, step: 0 });
  });

  it('последняя линия не выходит за зону — иначе печать ужимается', () => {
    const heightMm = layoutBlock({ count: 3, mode: 'work' }).solutionMm;
    const { h, step } = gridLines({ heightMm, widthMm: contentWidthMm() });
    expect(h * step).toBeLessThan(heightMm);
  });

  it('вертикальные линии не выходят за полосу набора', () => {
    const { v, step } = gridLines({ heightMm: 50, widthMm: contentWidthMm() });
    expect(v * step).toBeLessThan(contentWidthMm());
  });
});

describe('paginateBlocks', () => {
  it('режет задачи по N с сохранением порядка', () => {
    const pages = paginateBlocks([1, 2, 3, 4, 5].map(n => task(n)), 2);
    expect(pages.map(p => p.tasks.length)).toEqual([2, 2, 1]);
    expect(pages.map(p => p.startIndex)).toEqual([0, 2, 4]);
  });

  it('пустой список — ни одного листа', () => {
    expect(paginateBlocks([], 3)).toEqual([]);
  });
});

describe('кегль условия', () => {
  it('шкала идёт по возрастанию и покрывает мелкие плотные листы', () => {
    expect(FONT_PT_OPTIONS).toEqual([...FONT_PT_OPTIONS].sort((a, b) => a - b));
    expect(FONT_PT_OPTIONS[0]).toBeLessThanOrEqual(7);
    expect(FONT_PT_OPTIONS.at(-1)).toBeGreaterThanOrEqual(16);
  });

  it('пункты переводятся в миллиметры', () => {
    expect(fontMmOf(10)).toBeCloseTo(10 * PT_MM, 6);
    expect(fontMmOf(14)).toBeGreaterThan(fontMmOf(10));
  });

  it('старые S/M/L переносятся в пункты, а не слетают в дефолт', () => {
    expect(normalizeMarathonWorksheetSettings({ textSize: 's' }).textSize).toBe(9);
    expect(normalizeMarathonWorksheetSettings({ textSize: 'm' }).textSize).toBe(10);
    expect(normalizeMarathonWorksheetSettings({ textSize: 'l' }).textSize).toBe(12);
  });

  it('кегль вне шкалы притягивается к ближайшему, а не сбрасывается', () => {
    expect(normalizeMarathonWorksheetSettings({ textSize: 13 }).textSize).toBe(12);
    expect(normalizeMarathonWorksheetSettings({ textSize: 100 }).textSize).toBe(FONT_PT_OPTIONS.at(-1));
    expect(normalizeMarathonWorksheetSettings({ textSize: 'большой' }).textSize)
      .toBe(DEFAULT_MARATHON_WORKSHEET_SETTINGS.textSize);
  });
});

describe('плотные листы', () => {
  it('у карточек больше вариантов плотности, чем у листа с местом для решения', () => {
    expect(CARD_COUNTS.at(-1)).toBeGreaterThan(WORK_COUNTS.at(-1));
    expect(CARD_COUNTS).toContain(12);
    expect(WORK_COUNTS).toContain(6);
  });

  it('на самом плотном листе карточка всё ещё вмещает условие', () => {
    const g = layoutBlock({ count: CARD_COUNTS.at(-1), mode: 'card', showHeader: false });
    expect(g.condMm).toBeGreaterThan(fontMmOf(FONT_PT_OPTIONS[0]) * 2);
  });

  it('место для решения не исчезает на самом плотном work-листе', () => {
    const g = fitBlock({ count: WORK_COUNTS.at(-1), mode: 'work', condContentMm: 4 });
    expect(g.solutionMm).toBeGreaterThan(10);
    expect(g.headMm + g.condMm + g.solutionMm).toBeLessThanOrEqual(g.blockMm);
  });
});

describe('добивка листа до целых листов', () => {
  // Ситуация учителя: 17 задач по 8 на лист — третий лист почти пустой.
  const taskCount = 17;
  const count = 8;

  it('без добивки последний лист остаётся неполным', () => {
    const s = fillSummary({ taskCount, count, fill: 'none' });
    expect(s.slots).toBe(17);
    expect(s.sheets).toBe(3);
    expect(s.empty).toBe(7);
  });

  it('«до целых листов» — набор повторяется, пока пачка не кончится на краю листа', () => {
    const s = fillSummary({ taskCount, count, fill: 'repeat' });
    expect(s.slots).toBe(lcm(taskCount, count));   // 136
    expect(s.sheets).toBe(17);
    expect(s.copiesEach).toBe(8);                  // всем задачам поровну
    expect(s.empty).toBe(0);
  });

  it('«до целых листов» ничего не меняет, когда задачи и так укладываются', () => {
    const s = fillSummary({ taskCount: 16, count: 8, fill: 'repeat' });
    expect(s.slots).toBe(16);
    expect(s.sheets).toBe(2);
    expect(s.copiesEach).toBe(1);
  });

  it('«столько копий» печатает заданное число копий и добивает хвост', () => {
    const s = fillSummary({ taskCount, count, fill: 'copies', copies: 25 });
    expect(s.slots).toBe(432);      // 25 × 17 = 425 → до кратного 8
    expect(s.sheets).toBe(54);
    expect(s.empty).toBe(0);
  });

  it('пачка не разрастается дальше потолка', () => {
    const s = fillSummary({ taskCount, count, fill: 'copies', copies: 200 });
    expect(s.capped).toBe(true);
    expect(s.sheets).toBeLessThanOrEqual(MAX_SHEETS);
  });

  it('пустой марафон не ломает расчёт', () => {
    expect(fillSlots({ taskCount: 0, count: 8, fill: 'repeat' })).toBe(0);
    expect(expandTasks([], { fill: 'repeat', count: 8 })).toEqual([]);
  });
});

describe('expandTasks — повторы задач', () => {
  const tasks17 = Array.from({ length: 17 }, (_, i) => task(i + 1));

  it('номер карточки — номер задачи в марафоне, а не позиция на листе', () => {
    const slots = expandTasks(tasks17, { fill: 'repeat', count: 8 });
    expect(slots).toHaveLength(136);
    expect(slots[0].no).toBe(1);
    expect(slots[16].no).toBe(17);
    expect(slots[17].no).toBe(1);          // пошёл второй круг
    expect(slots.at(-1).no).toBe(17);
    expect(Math.max(...slots.map(s => s.no))).toBe(17);
  });

  it('задачи идут друг за другом, кругами, без перемешивания', () => {
    const slots = expandTasks(tasks17, { fill: 'repeat', count: 8 });
    expect(slots.slice(0, 17).map(s => s.task.id)).toEqual(tasks17.map(t => t.id));
    expect(slots.slice(17, 34).map(s => s.task.id)).toEqual(tasks17.map(t => t.id));
  });

  it('у каждой позиции свой ключ — повторы не схлопнутся в React', () => {
    const slots = expandTasks(tasks17, { fill: 'repeat', count: 8 });
    expect(new Set(slots.map(s => s.key)).size).toBe(slots.length);
  });

  it('без добивки — ровно исходный список', () => {
    const slots = expandTasks(tasks17, { fill: 'none', count: 8 });
    expect(slots.map(s => s.no)).toEqual(tasks17.map((_, i) => i + 1));
  });
});

describe('настройки листа', () => {
  it('мусор чинится до дефолтов', () => {
    const s = normalizeMarathonWorksheetSettings({
      mode: 'x', count: 99, attempts: 42, textSize: 'xxl',
      solutionFill: 'dots', fontFamily: 'comic',
    });
    expect(s.mode).toBe('work');
    expect(s.count).toBe(MARATHON_WORKSHEET_PRESETS.work.count);
    expect(s.attempts).toBe(0);
    expect(s.textSize).toBe(DEFAULT_MARATHON_WORKSHEET_SETTINGS.textSize);
    expect(s.solutionFill).toBe('grid');
    expect(s.fontFamily).toBe('serif');
  });

  it('плотность из чужого режима не протекает', () => {
    // 8 блоков бывает только у карточек
    expect(normalizeMarathonWorksheetSettings({ mode: 'work', count: 8 }).count)
      .toBe(MARATHON_WORKSHEET_PRESETS.work.count);
    expect(normalizeMarathonWorksheetSettings({ mode: 'card', count: 8 }).count).toBe(8);
  });

  it('режим тянет пресет, прочие правки остаются', () => {
    const custom = normalizeMarathonWorksheetSettings({ textSize: 12, drawingSize: 'xl' });
    const card = applyMarathonWorksheetMode(custom, 'card');
    expect(card.mode).toBe('card');
    expect(card.count).toBe(MARATHON_WORKSHEET_PRESETS.card.count);
    expect(card.attempts).toBe(0);
    expect(card.showName).toBe(false);
    expect(card.textSize).toBe(12);
    expect(card.drawingSize).toBe('xl');

    const back = applyMarathonWorksheetMode(card, 'work');
    expect(back.count).toBe(MARATHON_WORKSHEET_PRESETS.work.count);
    expect(back.attempts).toBe(2);
    expect(back.showName).toBe(true);
  });

  it('пустой вход даёт дефолты', () => {
    expect(normalizeMarathonWorksheetSettings()).toEqual(DEFAULT_MARATHON_WORKSHEET_SETTINGS);
  });

  it('countsFor различает режимы', () => {
    expect(countsFor('work')).toEqual(WORK_COUNTS);
    expect(countsFor('card')).toEqual(CARD_COUNTS);
  });
});

describe('вёрстка листа', () => {
  beforeEach(() => { localStorage.clear(); });

  const sheet = (props = {}) => render(
    <MarathonWorksheetPrint tasks={tasks} title="Марафон 8А" onBack={() => {}} {...props} />,
    { wrapper },
  );

  it('по умолчанию печатает отрезные блоки с местом для решения', () => {
    const { container } = sheet();
    const page = container.querySelector('.mwsp-sheet');
    expect(page).toBeTruthy();
    expect(page.querySelectorAll('.mwsp-block:not(.mwsp-block--empty)')).toHaveLength(tasks.length);
    expect(page.querySelectorAll('.mwsp-grid')).toHaveLength(tasks.length);
    // Линии разреза — между блоками, не перед первым.
    expect(page.querySelectorAll('.mwsp-cut-line')).toHaveLength(tasks.length - 1);
  });

  it('шапка блока несёт поле ФИ и клетки попыток', () => {
    const { container } = sheet();
    const block = container.querySelector('.mwsp-block');
    expect(block.querySelector('.mwsp-name-line')).toBeTruthy();
    expect(block.querySelectorAll('.mwsp-attempt-box')).toHaveLength(2);
  });

  it('режим «только карточка»: места для решения нет, разрез остался', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      applyMarathonWorksheetMode(DEFAULT_MARATHON_WORKSHEET_SETTINGS, 'card'),
    ));
    const { container } = sheet();
    const page = container.querySelector('.mwsp-sheet');
    expect(page.querySelectorAll('.mwsp-grid')).toHaveLength(0);
    expect(page.querySelectorAll('.mwsp-cut-line').length).toBeGreaterThan(0);
    // Пресет карточки убирает ФИ и попытки — остаётся чистое условие.
    expect(page.querySelector('.mwsp-name-line')).toBeNull();
    expect(page.querySelectorAll('.mwsp-attempt-box')).toHaveLength(0);
  });

  it('неполный лист добивается пустыми блоками — блоки не растягиваются', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      normalizeMarathonWorksheetSettings({ mode: 'card', count: 5 }),
    ));
    const { container } = sheet();
    const page = container.querySelector('.mwsp-sheet');
    expect(page.querySelectorAll('.mwsp-block--empty')).toHaveLength(5 - tasks.length);
  });

  it('высоты стоят в миллиметрах — печать не зависит от масштаба экрана', () => {
    const { container } = sheet();
    const block = container.querySelector('.mwsp-block');
    expect(block.getAttribute('style')).toMatch(/height:\s*[\d.]+mm/);
    const grid = container.querySelector('.mwsp-grid');
    expect(grid.getAttribute('style')).toMatch(/height:\s*[\d.]+mm/);
    const line = container.querySelector('.mwsp-h-line');
    expect(line.getAttribute('style')).toMatch(/top:\s*[\d.]+mm/);
  });

  it('число линий клетки совпадает с расчётом по высоте зоны', () => {
    const { container } = sheet();
    const g = layoutBlock({ count: DEFAULT_MARATHON_WORKSHEET_SETTINGS.count, mode: 'work' });
    const expected = gridLines({ heightMm: g.solutionMm, widthMm: contentWidthMm() });
    const grid = container.querySelector('.mwsp-grid');
    expect(grid.querySelectorAll('.mwsp-h-line')).toHaveLength(expected.h);
    expect(grid.querySelectorAll('.mwsp-v-line')).toHaveLength(expected.v);
  });

  it('зона измерения условий живёт вне листа', () => {
    const { container } = sheet();
    const measure = container.querySelector('.mwsp-measure');
    expect(measure).toBeTruthy();
    expect(measure.querySelector('.mwsp-block')).toBeNull();
    expect(container.querySelector('.mwsp-sheet .mwsp-measure')).toBeNull();
  });

  it('с добивкой «до целых листов» пустых блоков не остаётся', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      // count=4 — из допустимых плотностей карточек (2 нормализация не пропустит)
      normalizeMarathonWorksheetSettings({ mode: 'card', count: 4, fill: 'repeat' }),
    ));
    const { container } = render(
      <MarathonWorksheetPrint tasks={[task(1), task(2), task(3)]} title="Марафон" onBack={() => {}} />,
      { wrapper },
    );
    // 3 задачи по 4 на лист → 12 карточек, 3 листа, ни одного пустого места
    expect(container.querySelectorAll('.mwsp-sheet')).toHaveLength(3);
    expect(container.querySelectorAll('.mwsp-block--empty')).toHaveLength(0);
    const numbers = [...container.querySelectorAll('.mwsp-sheet .mwsp-task-num')].map(el => el.textContent);
    expect(numbers).toEqual(['1', '2', '3', '1', '2', '3', '1', '2', '3', '1', '2', '3']);
  });

  it('экранная часть не идёт в печать', () => {
    const { container } = sheet();
    const screenPart = container.querySelector('.no-print');
    expect(screenPart).toBeTruthy();
    expect(screenPart.textContent).toContain('Печать');
    expect(screenPart.querySelector('.mwsp-sheet')).toBeNull();
  });

  it('битые настройки в localStorage лист не роняют', () => {
    localStorage.setItem(STORAGE_KEY, '{не json');
    const { container } = sheet();
    expect(container.querySelectorAll('.mwsp-block:not(.mwsp-block--empty)')).toHaveLength(tasks.length);
  });
});
