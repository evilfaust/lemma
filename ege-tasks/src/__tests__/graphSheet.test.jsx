import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from 'antd';
import GraphSheetPrintLayout from '../components/functions/GraphSheetPrintLayout';
import GraphTasksGenerator from '../components/functions/GraphTasksGenerator';
import { DEFAULT_SETTINGS_GRAPH, generateGraphVariants } from '../utils/derivativeGraphTasks';

const wrapper = ({ children }) => <MemoryRouter><App>{children}</App></MemoryRouter>;

const sheet = (settings = {}, props = {}) => {
  const s = { ...DEFAULT_SETTINGS_GRAPH, variantsCount: 2, questionsCount: 3, ...settings };
  const tasksData = generateGraphVariants(s);
  const { container } = render(
    <GraphSheetPrintLayout
      tasksData={tasksData}
      settings={s}
      title="Производная и график"
      layout={[]}
      instruction="Рассмотрите рисунок и ответьте на вопрос:"
      {...props}
    />, { wrapper },
  );
  return { container, tasksData };
};

describe('лист заданий по графику', () => {
  it('на каждое задание — номер, условие, чертёж и строка ответа', () => {
    const { container } = sheet();
    expect(container.querySelectorAll('.gsp-page')).toHaveLength(2);
    expect(container.querySelectorAll('.gsp-task')).toHaveLength(6);
    expect(container.querySelectorAll('.gsp-figure svg')).toHaveLength(6);
    expect(container.querySelectorAll('.gsp-answer-line')).toHaveLength(6);
  });

  it('чертёж вписан в одну коробку: высокое окно не раздувает ряд', () => {
    const { container } = sheet({ variantsCount: 3, questionsCount: 8 });
    const svgs = [...container.querySelectorAll('.gsp-task > .gsp-task-body > .gsp-figure svg')];
    expect(svgs.length).toBe(24);
    for (const svg of svgs) {
      expect(Number(svg.getAttribute('height'))).toBeLessThanOrEqual(180);
      expect(Number(svg.getAttribute('width'))).toBeLessThanOrEqual(300);
    }
  });

  it('шапка — одной строкой: вариант, фамилия, класс, дата', () => {
    const { container } = sheet({ showClassField: true });
    const head = container.querySelector('.gsp-head');
    expect(head.textContent).toMatch(/Вариант 1.*Фамилия, имя:.*Класс:.*Дата:/);
    expect(container.querySelector('.gsp-head-row')).toBeNull();
  });

  it('соответствие «точки ↔ характеристики»: два списка и клетки под буквами', () => {
    const { container } = sheet({
      categories: { f_sign_match: true }, questionsCount: 1, variantsCount: 1,
    });
    const cols = container.querySelectorAll('.gsp-match-col');
    expect(cols).toHaveLength(2);
    expect(cols[0].querySelector('.gsp-match-head').textContent).toBe('ТОЧКИ');
    expect(cols[1].querySelector('.gsp-match-head').textContent)
      .toBe('ХАРАКТЕРИСТИКИ ФУНКЦИИ И ПРОИЗВОДНОЙ');
    // фраза должна переноситься — колонку с текстом помечаем модификатором
    expect(container.querySelector('.gsp-match--text')).toBeTruthy();
    expect(container.querySelectorAll('.gsp-cell')).toHaveLength(4);
    expect(container.querySelector('.gsp-answer-line')).toBeNull();
  });

  it('соответствие «графики ↔ характеристики»: четыре чертежа с буквами и один список', () => {
    const { container } = sheet({
      categories: { b_char_match: true }, questionsCount: 1, variantsCount: 1,
    });
    const cells = container.querySelectorAll('.gsp-figure-cell');
    expect(cells).toHaveLength(4);
    expect([...cells].map((c) => c.querySelector('.gsp-figure-letter').textContent))
      .toEqual(['А)', 'Б)', 'В)', 'Г)']);
    expect(container.querySelectorAll('.gsp-figure svg')).toHaveLength(4);
    // списка точек нет — буквы уже стоят под чертежами
    expect(container.querySelectorAll('.gsp-match-col')).toHaveLength(1);
    expect(container.querySelectorAll('.gsp-cell')).toHaveLength(4);
  });

  it('соответствие «интервалы ↔ характеристики»: интервалы печатаются формулой', () => {
    const { container } = sheet({
      categories: { b_interval_match: true }, questionsCount: 1, variantsCount: 1,
    });
    const cols = container.querySelectorAll('.gsp-match-col');
    expect(cols[0].querySelector('.gsp-match-head').textContent).toBe('ИНТЕРВАЛЫ');
    // «$(a; b)$» обязано дойти до KaTeX, а не напечататься долларами
    expect(cols[0].textContent).not.toContain('$');
    expect(cols[0].querySelectorAll('.katex').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.gsp-cell')).toHaveLength(4);
  });

  it.each(['b_tangent_graphs', 'b_linear_slope'])('%s печатает четыре чертежа и список значений', (cat) => {
    const { container } = sheet({
      categories: { [cat]: true }, questionsCount: 1, variantsCount: 1,
    });
    expect(container.querySelectorAll('.gsp-figure-cell')).toHaveLength(4);
    expect(container.querySelectorAll('.gsp-figure svg')).toHaveLength(4);
    expect(container.querySelectorAll('.gsp-match-col')).toHaveLength(1);
    expect(container.querySelectorAll('.gsp-cell')).toHaveLength(4);
  });

  it('лист учителя включён по умолчанию и несёт ответы всех вариантов', () => {
    expect(DEFAULT_SETTINGS_GRAPH.showTeacherKey).toBe(true);
    const { container, tasksData } = sheet();
    const key = container.querySelector('.gsp-key-page');
    expect(key).toBeTruthy();
    expect(key.querySelectorAll('.gsp-key-variant')).toHaveLength(2);
    expect(key.querySelectorAll('.gsp-key-row')).toHaveLength(6);
    // ответы — те же, что у заданий, и в том же порядке
    const shown = [...key.querySelectorAll('.gsp-key-variant')].map(
      (v) => [...v.querySelectorAll('.gsp-key-row')].map((r) => r.textContent),
    );
    tasksData.forEach((variant, vi) => variant.forEach((task, ti) => {
      expect(shown[vi][ti]).toContain(String(task.answerValue).replace('.', ','));
    }));
  });

  it('ключ выключается настройкой', () => {
    const { container } = sheet({ showTeacherKey: false });
    expect(container.querySelector('.gsp-key-page')).toBeNull();
  });

  it('галочка в генераторе управляет ключом', () => {
    const { container } = render(<GraphTasksGenerator />, { wrapper });
    fireEvent.click(screen.getByText('Сформировать'));
    // по умолчанию ключ уже есть (экранный предпросмотр + печатная вёрстка)
    expect(container.querySelectorAll('.gsp-key-page').length).toBe(2);
    fireEvent.click(screen.getByText('Лист ответов (учитель)'));
    expect(container.querySelectorAll('.gsp-key-page').length).toBe(0);
  });
});

// Печатная вёрстка живёт в CSS, и сломать её можно, не тронув ни строчки JS.
// Эти правила — канон печатного стека (см. print-sheet/printSheet.css): без
// них лист печатается в ~60 % масштаба, а хвост (в том числе лист ответов)
// обрезается оболочкой приложения.
describe('печатный CSS: канон', () => {
  const css = readFileSync('src/components/functions/graphSheet.css', 'utf8');

  it('жёсткая ширина документа и скрытые порталы Ant', () => {
    expect(css).toMatch(/html:has\(\.gsp-print-root\)/);
    expect(css).toContain('width: 210mm !important');
    expect(css).toMatch(/body:has\(\.gsp-print-root\) \.ant-tooltip/);
  });

  it('экранный предпросмотр в печать не идёт', () => {
    expect(css).toMatch(/body:has\(\.gsp-print-root\) \.gsp-screen-root \{ display: none !important; \}|\.gsp-screen-root \{ display: none !important; \}/);
  });

  it('сброс position/overflow у любого предка листа', () => {
    expect(css).toMatch(/\*:has\(\.gsp-print-root\)/);
    expect(css).toContain('overflow: visible !important');
  });

  it('продолжение варианта на следующем листе — тоже с полями', () => {
    expect(css).toContain('box-decoration-break: clone');
  });

  it('страница 296mm, за последней разрыва нет', () => {
    expect(css).toContain('min-height: 296mm');
    expect(css).toMatch(/\.gsp-print-root > \*:last-child/);
  });
});
