import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import MarathonTeacherSheet from '../components/marathon/MarathonTeacherSheet';
import { answerSheetColumns, hasAnyFigure } from '../utils/marathonWorksheet';

const wrapper = ({ children }) => <App>{children}</App>;

const plain = (n) => ({
  id: `t${n}`,
  code: `M-${n}`,
  statement_md: `Решите неравенство $x^2 > ${n}$`,
  answer: `x \\in (-\\infty; -${n}) \\cup (${n}; +\\infty)`,
});
const withFigure = (n) => ({ ...plain(n), image_url: `https://example.com/fig${n}.png` });

describe('hasAnyFigure', () => {
  it('видит локальный файл и внешний URL — так же, как getTaskImageUrl', () => {
    expect(hasAnyFigure([plain(1), withFigure(2)])).toBe(true);
    expect(hasAnyFigure([{ ...plain(3), image: 'fig.png' }])).toBe(true);
  });

  it('на задачах без чертежей — false (марафон по неравенствам)', () => {
    expect(hasAnyFigure([plain(1), plain(2), plain(3)])).toBe(false);
    expect(hasAnyFigure([])).toBe(false);
  });
});

describe('answerSheetColumns', () => {
  it('без чертежей карточек в ряд больше', () => {
    expect(answerSheetColumns(17, false)).toBeGreaterThanOrEqual(answerSheetColumns(17, true) - 1);
    expect(answerSheetColumns(6, false)).toBe(2);
    expect(answerSheetColumns(17, false)).toBe(3);
  });

  it('колонок не больше четырёх — длинный ответ неравенства не должен ломаться', () => {
    expect(answerSheetColumns(100, false)).toBeLessThanOrEqual(4);
  });

  it('с чертежами раскладка прежняя', () => {
    expect(answerSheetColumns(6, true)).toBe(2);
    expect(answerSheetColumns(12, true)).toBe(3);
    expect(answerSheetColumns(20, true)).toBe(4);
    expect(answerSheetColumns(30, true)).toBe(5);
  });
});

describe('лист ответов учителя', () => {
  const sheet = (tasks) => render(
    <MarathonTeacherSheet tasks={tasks} title="Марафон" onBack={() => {}} />,
    { wrapper },
  );

  it('на задачах без чертежей открывается сразу без них — только номер и ответ', () => {
    const { container } = sheet([plain(1), plain(2), plain(3)]);
    expect(container.querySelector('.mtas-sheet--nofig')).toBeTruthy();
    expect(container.querySelectorAll('.mtas-card__img-wrap')).toHaveLength(0);
    expect(container.querySelectorAll('.mtas-card__no-img')).toHaveLength(0);
    expect(container.querySelectorAll('.mtas-card__num')).toHaveLength(3);
    expect(container.querySelectorAll('.mtas-card__answer')).toHaveLength(3);
  });

  it('если чертежи есть — лист открывается с ними', () => {
    const { container } = sheet([plain(1), withFigure(2)]);
    expect(container.querySelector('.mtas-sheet--nofig')).toBeNull();
    expect(container.querySelectorAll('.mtas-card__img-wrap')).toHaveLength(2);
    // у задачи без чертежа — прочерк на своём месте
    expect(container.querySelectorAll('.mtas-card__no-img')).toHaveLength(1);
  });

  it('тумблер выключает чертежи вручную', () => {
    const { container } = sheet([withFigure(1), withFigure(2)]);
    expect(container.querySelectorAll('.mtas-card__img-wrap')).toHaveLength(2);

    fireEvent.click(screen.getByRole('switch'));

    expect(container.querySelector('.mtas-sheet--nofig')).toBeTruthy();
    expect(container.querySelectorAll('.mtas-card__img-wrap')).toHaveLength(0);
    expect(container.querySelectorAll('.mtas-card__answer')).toHaveLength(2);
  });

  it('номера карточек — порядковые номера задач марафона', () => {
    const { container } = sheet([plain(1), plain(2), plain(3)]);
    const nums = [...container.querySelectorAll('.mtas-card__num')].map(el => el.textContent);
    expect(nums).toEqual(['№1', '№2', '№3']);
  });

  it('экранная обвязка помечена no-print', () => {
    const { container } = sheet([plain(1)]);
    const toolbar = container.querySelector('.mtas-toolbar');
    expect(toolbar.classList.contains('no-print')).toBe(true);
  });
});
