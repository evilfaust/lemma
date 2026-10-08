import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const fetchSdamgiaProblems = vi.fn();
vi.mock('../utils/importReshuProblem', () => ({
  fetchSdamgiaProblems: (...a) => fetchSdamgiaProblems(...a),
  createTaskFromSdamgia: vi.fn(),
}));
const getTasksBySdamgiaIds = vi.fn();
vi.mock('../services/pocketbase', () => ({
  api: { getTasksBySdamgiaIds: (...a) => getTasksBySdamgiaIds(...a) },
}));

const { useReshuWorkImport } = await import('../hooks/useReshuWorkImport');

const topics = [
  { id: 'p8', exam_type: 'ege_profile', ege_number: 8, title: 'Производная' },
  { id: 'b7', exam_type: 'ege_base', ege_number: 7, title: 'Анализ графиков' },
];

describe('useReshuWorkImport.resolve', () => {
  beforeEach(() => {
    fetchSdamgiaProblems.mockReset();
    getTasksBySdamgiaIds.mockReset();
  });

  it('задача, которой нет на сайте профиля, находится на сайте базы и встаёт в тему базы', async () => {
    getTasksBySdamgiaIds.mockResolvedValue([
      { id: 't1', code: '8-310', topic: 'p8', sdamgia_id: '509836', answer: '5' },
    ]);
    fetchSdamgiaProblems.mockImplementation(async (url) => (
      url.startsWith('https://mathb-ege.sdamgia.ru/problem?id=512722')
        ? [{ id: 512722, type_label: '7', condition: 'Установите соответствие', answer: '3241' }]
        : []
    ));

    const { result } = renderHook(() => useReshuWorkImport({ topics }));
    let summary;
    await act(async () => {
      summary = await result.current.resolve('1\t509836\t5\n2\t512722\t3241', 'ege_profile');
    });

    expect(summary).toMatchObject({ total: 2, bank: 1, reshu: 1, missing: 0 });
    const [bank, reshu] = result.current.rows;
    expect(bank).toMatchObject({ status: 'bank', exam: 'ege_profile', keyAnswer: '5' });
    expect(reshu).toMatchObject({ status: 'reshu', exam: 'ege_base', topicId: 'b7', typeLabel: '7' });
    // сначала спросили профиль, потом базу
    expect(fetchSdamgiaProblems.mock.calls.map(([u]) => u)).toEqual([
      'https://ege.sdamgia.ru/problem?id=512722',
      'https://mathb-ege.sdamgia.ru/problem?id=512722',
    ]);
  });

  it('закрытый вариант (test?id= без задач) попадает в notes.closedVariants', async () => {
    fetchSdamgiaProblems.mockResolvedValue([]);
    const { result } = renderHook(() => useReshuWorkImport({ topics }));
    let summary;
    await act(async () => {
      summary = await result.current.resolve('https://math-ege.sdamgia.ru/test?id=93061341', 'ege_profile');
    });
    expect(summary).toMatchObject({ total: 0, closed: 1 });
    expect(result.current.notes.closedVariants).toEqual(['https://math-ege.sdamgia.ru/test?id=93061341']);
  });
});
