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

  it('страница 296mm, за последней разрыва нет', () => {
    expect(css).toContain('min-height: 296mm');
    expect(css).toMatch(/\.gsp-print-root > \*:last-child/);
  });
});
