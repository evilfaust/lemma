import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import KimTaskContent, {
  KimAnswer, kimFigureLayout, hasKimFigure, kimSizeIsNatural,
} from '../components/worksheet/KimTaskContent';
import VariantRenderer from '../components/worksheet/VariantRenderer';
import { splitAnswerTable } from '../utils/kimAnswerTable';
import { parseTableDirective } from '../utils/remarkTableModifiers';

// КИМ-буклет: бланк «А Б В Г» встаёт в строку «Ответ:» (одно место для
// ответа вместо двух), графики получают размер S/M/L/XL и место
// «слева / под условием / справа» с обтеканием текстом.

const MATCHING = [
  'Установите соответствие между величинами и их возможными значениями.',
  '',
  '| ВЕЛИЧИНЫ | ВОЗМОЖНЫЕ ЗНАЧЕНИЯ |',
  '| --- | --- |',
  '| А) крейсерская скорость самолёта | 1) 80 км/ч |',
  '| Б) скорость мотоциклиста | 2) 900 км/ч |',
  '',
  'Запишите в ответ цифры, расположив их в порядке, соответствующем буквам: ',
  '',
  '| A | Б | В | Г |',
  '| --- | --- | --- | --- |',
  '|  |  |  |  |',
  '',
].join('\n');

const PLOT = '```plot\nx -2 8\ny -3 5\nsize 320\nf x^2/4-2\n```';
const GRAPH_TASK = `На рисунке изображён график функции. Точки задают интервалы.\n\n${PLOT}\n\nПоставьте в соответствие.`;

describe('splitAnswerTable — бланк «А Б В Г» из условия', () => {
  it('вынимает бланк, буквы — из шапки (латинская A от «Решу» тоже)', () => {
    const r = splitAnswerTable(MATCHING);
    expect(r.letters).toEqual(['A', 'Б', 'В', 'Г']);
    expect(r.text).toContain('| ВЕЛИЧИНЫ | ВОЗМОЖНЫЕ ЗНАЧЕНИЯ |');
    expect(r.text).toContain('соответствующем буквам:');
    expect(r.text).not.toContain('| A | Б |');
    expect(r.text.endsWith('буквам:')).toBe(true);
  });

  it('директива {бланк} уходит вместе с таблицей', () => {
    const r = splitAnswerTable('Текст.\n\n{бланк}\n\n| А | Б | В |\n| --- | --- | --- |\n|  |  |  |');
    expect(r.letters).toEqual(['А', 'Б', 'В']);
    expect(r.text).toBe('Текст.');
  });

  it('таблица соответствия и таблица с данными — не бланк', () => {
    expect(splitAnswerTable('| А) x | 1) y |\n| --- | --- |\n| Б) z | 2) w |')).toBeNull();
    expect(splitAnswerTable('| x | 1 | 2 |\n| --- | --- | --- |\n| y | 3 | 4 |')).toBeNull();
    expect(splitAnswerTable('| А | Б |\n| --- | --- |\n| 1 | 2 |')).toBeNull();
    expect(splitAnswerTable('Без таблиц')).toBeNull();
  });

  it('два бланка — ничего не трогаем', () => {
    const two = '| А | Б |\n| --- | --- |\n|  |  |\n\nи\n\n| А | Б |\n| --- | --- |\n|  |  |';
    expect(splitAnswerTable(two)).toBeNull();
  });
});

describe('KimTaskContent + KimAnswer — одно место для ответа', () => {
  it('бланк печатается в строке «Ответ:», а из условия уходит', () => {
    const task = { id: 'm1', statement_md: MATCHING };
    const { container } = render(
      <div>
        <KimTaskContent task={task} answerTable />
        <KimAnswer task={task} />
      </div>,
    );
    const tables = container.querySelectorAll('table');
    expect(tables).toHaveLength(2); // соответствие + бланк в ответе
    const answer = container.querySelector('.kim-book-answer.kim-answer-table');
    expect(answer).not.toBeNull();
    expect([...answer.querySelectorAll('th')].map((th) => th.textContent)).toEqual(['A', 'Б', 'В', 'Г']);
    expect(answer.querySelectorAll('td')).toHaveLength(4);
    // черты «Ответ: ____» нет — ответ пишется в клетки
    expect(container.querySelector('.kim-book-answer-line')).toBeNull();
    expect(container.querySelector('.kim-book-task-content td.md-cell--blank')).toBeNull();
  });

  it('без бланка — прежняя черта', () => {
    const task = { id: 'm2', statement_md: 'Найдите $x$.' };
    const { container } = render(<KimAnswer task={task} />);
    expect(container.querySelector('.kim-book-answer-line')).not.toBeNull();
  });

  it('часть 2 (без строки ответа) бланк из условия не вынимает', () => {
    const { container } = render(<KimTaskContent task={{ id: 'm3', statement_md: MATCHING }} />);
    expect(container.querySelector('td.md-cell--blank')).not.toBeNull();
  });
});

describe('KimTaskContent — размер и место графика', () => {
  it('без выбора — график как в условии: ни размера, ни выноса', () => {
    const task = { id: 'g1', statement_md: GRAPH_TASK };
    expect(hasKimFigure(task)).toBe(true);
    expect(kimSizeIsNatural(task)).toBe(true);
    const { container } = render(<KimTaskContent task={task} />);
    const root = container.querySelector('.kim-book-task-content');
    expect(root.classList.contains('kim-book-task-content--sized')).toBe(false);
    expect(container.querySelector('.kim-book-task-aside')).toBeNull();
    expect(kimFigureLayout(task).placement).toBe('below');
  });

  it('размер выбран — график берёт долю полосы (CSS-переменные)', () => {
    const { container } = render(<KimTaskContent task={{ id: 'g2', statement_md: GRAPH_TASK, kimImageSize: 's' }} />);
    const root = container.querySelector('.kim-book-task-content');
    expect(root.classList.contains('kim-book-task-content--sized')).toBe(true);
    expect(root.style.getPropertyValue('--kim-fig-w')).toBe('35%');
    expect(root.style.getPropertyValue('--kim-fig-side-w')).toBe('30%');
  });

  it('слева — график первым в разметке, текст обтекает', () => {
    const task = { id: 'g3', statement_md: GRAPH_TASK, figurePlacement: 'left' };
    const { container } = render(<KimTaskContent task={task} />);
    const root = container.querySelector('.kim-book-task-content');
    expect(root.classList.contains('kim-book-task-content--side-left')).toBe(true);
    const aside = root.firstElementChild;
    expect(aside.classList.contains('kim-book-task-aside')).toBe(true);
    expect(aside.classList.contains('kim-book-task-aside--drawing')).toBe(true);
    expect(aside.querySelector('.coordplot svg')).not.toBeNull();
    // в тексте графика больше нет — он только сбоку
    expect(root.querySelectorAll('.coordplot')).toHaveLength(1);
    expect(root.textContent).toContain('Поставьте в соответствие.');
  });

  it('несколько рисунков (прямые в ячейках) — выносить нечего', () => {
    const md = '| А) $x>1$ | 1) `numline: domain 0 3; ray right 1 open` |\n| --- | --- |\n| Б) $x<1$ | 2) `numline: domain 0 3; ray left 1 open` |';
    const task = { id: 'g4', statement_md: md, figurePlacement: 'right' };
    expect(hasKimFigure(task)).toBe(true);
    expect(kimFigureLayout(task).placement).toBeNull();
    const { container } = render(<KimTaskContent task={task} />);
    expect(container.querySelector('.kim-book-task-aside')).toBeNull();
  });

  it('чертёж редактора: по умолчанию справа, «под условием» — в тексте', () => {
    const PLANIM = '```planim\nтреугольник ABC 5 6 7\n```';
    const base = { id: 'g5', statement_md: `Найдите BH.\n\n${PLANIM}` };
    expect(kimFigureLayout(base).side).toBe('right');
    expect(kimFigureLayout({ ...base, figurePlacement: 'below' }).side).toBeNull();
    expect(kimFigureLayout({ ...base, figurePlacement: 'left' }).side).toBe('left');
  });
});

describe('VariantRenderer в режиме КИМ — переключатели', () => {
  const variant = (task) => ({ number: 1, tasks: [{ code: '7-091', ...task }] });

  it('у задачи с графиком — размер (не выбран) и место чертежа', () => {
    const { container } = render(
      <VariantRenderer
        variant={variant({ id: 'r1', statement_md: GRAPH_TASK })}
        variantIndex={0}
        solutionSpace="none"
        onSetImageSize={() => {}}
        onSetFigurePlacement={() => {}}
      />,
    );
    const segs = container.querySelectorAll('.ant-segmented');
    expect(segs).toHaveLength(2);
    // размер не выбран — ни одна кнопка не нажата
    expect(segs[0].querySelector('.ant-segmented-item-selected')).toBeNull();
    // экран показывает то же, что буклет
    expect(container.querySelector('.kim-screen-task .kim-book-task-content')).not.toBeNull();
  });
});

describe('CSS буклета', () => {
  const css = readFileSync(resolve(__dirname, '../components/EgeVariantGenerator.css'), 'utf8');

  it('строка с чертежом выравнивается по середине, левый столбец соответствия — влево', () => {
    expect(css).toMatch(/tr:has\([^)]*\.numline[^)]*\)\s*>\s*td[^{]*\{\s*vertical-align:\s*middle/);
    expect(css).toMatch(/table\.md-table--plain td\s*\{\s*text-align:\s*left/);
  });

  it('правило размера по svg — только внутри .coordplot/.numline (радикал KaTeX цел)', () => {
    const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = (plain.match(/[^{}]+\{/g) || [])
      .flatMap((s) => s.replace('{', '').split(','))
      .map((s) => s.trim())
      .filter((s) => /\bsvg$/.test(s) && /kim-book-task-content--sized|kim-book-task-aside/.test(s));
    expect(selectors.length).toBeGreaterThan(0);
    selectors.forEach((sel) => expect(sel).toMatch(/(coordplot|numline) > svg$/));
  });

  it('{по центру} — модификатор таблицы', () => {
    expect(parseTableDirective('{без линий, по центру}')).toEqual(['plain', 'center']);
  });
});

describe('«Как в печати» — буклет на экране', async () => {
  const { KimProfileVariantPrint } = await import('../components/EgeProfileKimPrint');
  const { fireEvent } = await import('@testing-library/react');
  const kimMeta = { classNum: 11, brand: '© Лемма' };
  const variant = {
    number: 1,
    tasks: [
      { id: 'p1', statement_md: GRAPH_TASK },
      { id: 'p2', statement_md: 'Найдите $x$.' },
    ],
  };

  it('без preview буклет без панелей правки', () => {
    const { container } = render(<KimProfileVariantPrint variant={variant} kimMeta={kimMeta} />);
    expect(container.querySelector('.kim-booklet')).not.toBeNull();
    expect(container.querySelector('.kim-booklet--preview')).toBeNull();
    expect(container.querySelector('.kim-task-tools')).toBeNull();
  });

  it('preview: у каждой задачи панель, правка уходит с позицией задачи', () => {
    const calls = [];
    const editing = {
      variantIndex: 3,
      onSetImageSize: (...a) => calls.push(['size', ...a]),
      onSetFigurePlacement: (...a) => calls.push(['place', ...a]),
      onEditTask: () => {},
      onReplaceTask: () => {},
    };
    const { container } = render(
      <KimProfileVariantPrint variant={variant} kimMeta={kimMeta} preview editing={editing} />,
    );
    expect(container.querySelector('.kim-booklet.kim-booklet--preview')).not.toBeNull();
    const tools = container.querySelectorAll('.kim-task-tools');
    expect(tools).toHaveLength(2);
    // у задачи с графиком — размер и место, у текстовой — только правка/замена
    expect(tools[0].querySelectorAll('.ant-segmented')).toHaveLength(2);
    expect(tools[1].querySelectorAll('.ant-segmented')).toHaveLength(0);
    const right = [...tools[0].querySelectorAll('.ant-segmented-item')]
      .find((el) => el.querySelector('.anticon-pic-right'));
    fireEvent.click(right);
    expect(calls).toContainEqual(['place', 3, 0, 'right']);
  });
});

describe('Лист ответов учителю (КИМ)', async () => {
  const { default: KimAnswersSheet } = await import('../components/worksheet/KimAnswersSheet');
  const variants = [
    { number: 1, tasks: [
      { id: 'a1', code: '1-001', answer: '6' },
      { id: 'a2', code: '2-248', answer: '2143' },
      { id: 'a3', code: '14-002', answer: '$\\frac{\\pi}{3}$', solution_md: 'Решение.', max_score: 2 },
    ] },
    { number: 2, tasks: [{ id: 'b1', code: '1-002', answer: '' }] },
  ];

  it('ответы одним столбцом: № в квадрате, ответ, код; пятая строка отбита', () => {
    const many = { number: 1, tasks: Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, code: `${i}`, answer: `${i}` })) };
    const { container } = render(<KimAnswersSheet variants={[many]} kimMeta={{ classNum: 11 }} title="Пробник" />);
    const rows = container.querySelectorAll('.kas-table tbody tr');
    expect(rows).toHaveLength(6);
    expect(rows[0].querySelectorAll('td')).toHaveLength(3);
    expect(rows[4].classList.contains('kas-row--group')).toBe(true);
    expect(container.querySelector('.kas-title').textContent).toBe('Пробник');
  });

  it('часть 2 — решения с баллами; номер варианта как в буклете; пустой ответ подписан', () => {
    const { container } = render(
      <KimAnswersSheet variants={variants} kimMeta={{ variantNumberOverride: '305' }} part1Last={2} />,
    );
    const [v1, v2] = container.querySelectorAll('.kas-variant');
    expect(v1.querySelectorAll('.kas-table tbody tr')).toHaveLength(2);
    expect(v1.querySelector('.kas-solution .kas-score').textContent).toBe('2 б.');
    expect(v1.querySelector('.kas-variant-no').textContent).toBe('Вариант 305');
    expect(v2.querySelector('.kas-empty').textContent).toBe('ответ не задан');
  });

  it('на экране — только в режиме «Как в печати»', () => {
    const { container, rerender } = render(<KimAnswersSheet variants={variants} />);
    expect(container.querySelector('.kim-answers-sheet--preview')).toBeNull();
    rerender(<KimAnswersSheet variants={variants} preview />);
    expect(container.querySelector('.kim-answers-sheet.kim-answers-sheet--preview')).not.toBeNull();
  });
});
