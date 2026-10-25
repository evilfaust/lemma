// «Перепарсить с Решу ЕГЭ»: сравнение текстов (utils/textDiff.js), правила
// окна (utils/sdamgiaRefresh.js) и само окно RefreshFromSdamgiaModal.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { diffLines, diffWords, changedLineCount } from '../utils/textDiff';
import {
  defaultSelection, canApply, isChanged, pickSelected, reviewFlagAfter,
  brokenFormulaCount, freshFromProblem,
} from '../utils/sdamgiaRefresh';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ aiEnabled: true }) }));
vi.mock('../services/pocketbase', () => ({
  default: { collection: () => ({ getFullList: async () => [], delete: async () => {} }) },
  api: { getTaskImages: async () => ({ condition: [], solution: [], criteria: [] }), getTaskImageRecordUrl: () => '', createTaskImage: async () => {} },
  aiHeaders: () => ({}),
}));
const { default: RefreshFromSdamgiaModal } = await import('../components/RefreshFromSdamgiaModal');

describe('textDiff', () => {
  it('пословная подсветка внутри изменённой строки', () => {
    expect(diffWords('при всех a', 'при всех $a$')).toEqual([
      { type: 'same', text: 'при всех ' },
      { type: 'del', text: 'a' },
      { type: 'add', text: '$a$' },
    ]);
  });
  it('строки: совпавшие, пара «было → стало», добавленная', () => {
    const d = diffLines('один\nдва\nтри', 'один\nДВА\nтри\nчетыре');
    expect(d.map(x => x.type)).toEqual(['same', 'change', 'same', 'add']);
    expect(d[1].from).toBe('два');
    expect(d[1].to).toBe('ДВА');
    expect(changedLineCount(d)).toBe(2);
  });
  it('одинаковые тексты — без изменений', () => {
    expect(changedLineCount(diffLines('a\nb', 'a\nb'))).toBe(0);
  });
});

describe('sdamgiaRefresh', () => {
  const current = { statement_md: 'Найдите a', answer: '5', solution_md: 'Решение', criteria_md: '', max_score: 4 };
  const fresh = { statement_md: 'Найдите $a$', answer: '5', solution_md: '  Решение \n', criteria_md: '', max_score: 4 };

  it('пробелы и переносы — не изменение; пустое с «Решу» не подставляется', () => {
    expect(isChanged('Решение', '  Решение \n')).toBe(false);
    expect(canApply('текст', '')).toBe(false);
    expect(defaultSelection(current, fresh)).toEqual({
      statement_md: true, answer: false, solution_md: false, criteria_md: false, max_score: false,
    });
  });

  it('выбранное → поля формы; балл числом', () => {
    expect(pickSelected({ ...fresh, max_score: 3 }, { statement_md: true, max_score: true }))
      .toEqual({ statement_md: 'Найдите $a$', max_score: 3 });
  });

  it('флаг LaTeX — по итоговому тексту, без текстовых полей не трогаем', () => {
    expect(brokenFormulaCount('$\\frac{1}{$ и $x$')).toBe(1);
    expect(reviewFlagAfter(current, { statement_md: '$\\frac{1}{2$' })).toBe(true);
    expect(reviewFlagAfter(current, { statement_md: '$\\frac{1}{2}$' })).toBe(false);
    expect(reviewFlagAfter(current, { max_score: 3 })).toBeNull();
  });

  it('ответ сервера → поля задачи', () => {
    const f = freshFromProblem({ condition: 'У', solution: 'Р', answer: 'О', criteria_md: '', max_score: 2 });
    expect(f).toMatchObject({ statement_md: 'У', solution_md: 'Р', answer: 'О', max_score: 2, latex_needs_review: false });
  });
});

describe('RefreshFromSdamgiaModal', () => {
  const task = { id: 't1', sdamgia_id: '548492', sdamgia_url: 'https://math-ege.sdamgia.ru/problem?id=548492' };
  const current = { statement_md: 'Найдите все значения a', answer: '', solution_md: 'Старое решение', criteria_md: '', max_score: 4 };
  const problem = {
    condition: 'Найдите все значения $a$',
    answer: '$a \\ne 0$',
    solution: 'Новое решение',
    criteria_md: '',
    max_score: 4,
    condition_images: [], solution_images: [], criteria_images: [],
  };

  beforeEach(() => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ problems: [problem] }) }));
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('сразу качает задачу и подставляет выбранное в форму, не в базу', async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <App>
        <RefreshFromSdamgiaModal task={task} current={current} images={{}} open onClose={onClose} onApply={onApply} />
      </App>,
    );
    const btn = await screen.findByRole('button', { name: /Подставить в форму: условие, ответ, решение/ });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/parse-sdamgia$/);
    // Снимаем галочку с решения — его учитель уже правил руками
    fireEvent.click(screen.getByRole('checkbox', { name: 'Решение' }));
    fireEvent.click(await screen.findByRole('button', { name: /Подставить в форму: условие, ответ$/ }));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    const [fields, meta] = onApply.mock.calls[0];
    expect(fields).toEqual({ statement_md: 'Найдите все значения $a$', answer: '$a \\ne 0$' });
    expect(meta).toEqual({ needsReview: false, imagesReloaded: false });
    expect(onClose).toHaveBeenCalled();
    // В базу — ни одного запроса, кроме разбора страницы
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(btn).toBeTruthy();
  });

  it('вид «Что поменяется» показывает строки было/стало', async () => {
    render(
      <App>
        <RefreshFromSdamgiaModal task={task} current={current} images={{}} open onClose={() => {}} onApply={() => {}} />
      </App>,
    );
    await screen.findByText('Что поменяется');
    fireEvent.click(screen.getByText('Что поменяется'));
    await waitFor(() => expect(document.querySelector('.rfs-line--del')).toBeTruthy());
    const dels = [...document.querySelectorAll('.rfs-line--del del')].map(n => n.textContent);
    const inss = [...document.querySelectorAll('.rfs-line--add ins')].map(n => n.textContent);
    expect(dels).toEqual(['a', 'Старое ']);
    expect(inss).toEqual(['$a$', 'Новое ']);
  });
});
