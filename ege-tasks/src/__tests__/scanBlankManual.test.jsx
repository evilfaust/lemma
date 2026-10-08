import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render, screen, fireEvent, waitFor, cleanup, within,
} from '@testing-library/react';
import { App as AntApp } from 'antd';
import dayjs from 'dayjs';

// Результаты бумажной работы (v3.9.311): ответы вписываются руками без фото,
// ученики — из класса, работа сама встаёт колонкой в журнал этого класса.

const mockApi = vi.hoisted(() => ({
  getVariantsByWork: vi.fn(),
  getSessionsByWork: vi.fn(),
  getStudents: vi.fn(),
  getTeachingGroups: vi.fn(),
  getStudentsByGroup: vi.fn(),
  getAttemptsBySessionsWithStudent: vi.fn(),
  createSession: vi.fn(),
  createAttempt: vi.fn(),
  batchCreateAttemptAnswers: vi.fn(),
  updateAttempt: vi.fn(),
  getJournalColumns: vi.fn(),
  createJournalColumn: vi.fn(),
  scanBlank: vi.fn(),
  setSessionsResultsHidden: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));
vi.mock('../components/MathRenderer', () => ({ default: ({ text }) => <span>{text}</span> }));

// eslint-disable-next-line import/first
import ScanBlankModal from '../components/worksheet/ScanBlankModal';

const WORK = { id: 'w1', title: 'Контрольная 10 кл' };
const VARIANT = {
  id: 'v1',
  number: 1,
  order: ['t2', 't1', 't3'],
  expand: {
    tasks: [
      { id: 't1', answer: '5' },
      { id: 't2', answer: '0,5' },
      { id: 't3', answer: '12' },
    ],
  },
};
const CLASS = [
  { id: 's1', name: 'Анна Белова' },
  { id: 's2', name: 'Борис Волков' },
];

function setup(props = {}) {
  return render(
    <AntApp>
      <ScanBlankModal open work={WORK} onClose={() => {}} scanEnabled={false} {...props} />
    </AntApp>,
  );
}

async function pickStudent(name) {
  const box = document.querySelectorAll('.ant-select-selector')[3];
  fireEvent.mouseDown(box);
  const option = await waitFor(() => {
    const el = [...document.querySelectorAll('.ant-select-item-option-content')]
      .find((n) => n.textContent.includes(name));
    if (!el) throw new Error('нет варианта');
    return el;
  });
  fireEvent.click(option);
}

const answerInputs = () => document.querySelectorAll('.ant-table-tbody input');

beforeEach(() => {
  localStorage.setItem('scanBlank.group', 'g10');
  mockApi.getVariantsByWork.mockResolvedValue([VARIANT]);
  mockApi.getSessionsByWork.mockResolvedValue([]);
  mockApi.getStudents.mockResolvedValue([...CLASS, { id: 's9', name: 'Чужой Ученик' }]);
  mockApi.getTeachingGroups.mockResolvedValue([{ id: 'g10', name: '10 А' }]);
  mockApi.getStudentsByGroup.mockResolvedValue(CLASS);
  mockApi.getAttemptsBySessionsWithStudent.mockResolvedValue([]);
  mockApi.createSession.mockResolvedValue({ id: 'sess1', created: '2026-10-07 10:00:00Z' });
  mockApi.createAttempt.mockImplementation(async (d) => ({ id: `a-${d.student}` }));
  mockApi.batchCreateAttemptAnswers.mockResolvedValue([]);
  mockApi.getJournalColumns.mockResolvedValue([]);
  mockApi.createJournalColumn.mockResolvedValue({ id: 'col1' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('ScanBlankModal — ручной ввод', () => {
  it('без фото: ответы руками → попытка, ответы и колонка журнала', async () => {
    setup();
    await screen.findByText('Ввести ответы вручную');
    // Без ИИ нет зоны для фото, но ручной ввод есть
    expect(screen.queryByText(/сфотографируйте/)).toBeNull();
    await waitFor(() => expect(mockApi.getStudentsByGroup).toHaveBeenCalledWith('g10'));

    await pickStudent('Анна Белова');
    fireEvent.click(screen.getByText('Ввести ответы вручную'));

    const inputs = answerInputs();
    expect(inputs).toHaveLength(3);
    // Порядок задач — как в варианте ученика: t2, t1, t3
    fireEvent.change(inputs[0], { target: { value: '0.5' } });
    fireEvent.change(inputs[1], { target: { value: '5' } });
    fireEvent.change(inputs[2], { target: { value: '13' } });
    expect(screen.getByText('Результат: 2 из 3')).toBeTruthy();

    fireEvent.click(screen.getByText('Записать результат'));
    await waitFor(() => expect(mockApi.batchCreateAttemptAnswers).toHaveBeenCalled());

    const today = dayjs().format('DD.MM');
    expect(mockApi.createSession).toHaveBeenCalledWith(expect.objectContaining({
      work: 'w1', is_open: false, student_title: `Контрольная 10 кл (бумага, ${today})`,
    }));
    expect(mockApi.createAttempt).toHaveBeenCalledWith(expect.objectContaining({
      session: 'sess1', student: 's1', score: 2, total: 3, source: 'scan', status: 'submitted',
    }));
    const rows = mockApi.batchCreateAttemptAnswers.mock.calls[0][0];
    expect(rows.map((r) => [r.task, r.is_correct])).toEqual([['t2', true], ['t1', true], ['t3', false]]);
    // Фото нет — файл не заливаем
    expect(mockApi.updateAttempt).not.toHaveBeenCalled();

    await waitFor(() => expect(mockApi.createJournalColumn).toHaveBeenCalledWith(expect.objectContaining({
      group: 'g10', source: 'work', work: 'w1', assigned: true,
      date: `${dayjs().format('YYYY-MM-DD')} 12:00:00.000Z`,
    })));
  });

  it('после записи — следующий ученик класса, таблица снова пустая, колонка не дублируется', async () => {
    setup();
    await screen.findByText('Ввести ответы вручную');
    await waitFor(() => expect(mockApi.getStudentsByGroup).toHaveBeenCalled());
    await pickStudent('Анна Белова');
    fireEvent.click(screen.getByText('Ввести ответы вручную'));
    fireEvent.change(answerInputs()[0], { target: { value: '0,5' } });
    fireEvent.click(screen.getByText('Записать результат'));
    await waitFor(() => expect(mockApi.createJournalColumn).toHaveBeenCalledTimes(1));

    // Ручной режим остаётся, поля пустые, выбран Борис
    await waitFor(() => expect(answerInputs()[0].value).toBe(''));
    const selected = document.querySelectorAll('.ant-select-selection-item');
    expect([...selected].some((n) => n.textContent === 'Борис Волков')).toBe(true);

    fireEvent.change(answerInputs()[2], { target: { value: '12' } });
    fireEvent.click(screen.getByText('Записать результат'));
    await waitFor(() => expect(mockApi.createAttempt).toHaveBeenCalledTimes(2));
    expect(mockApi.createAttempt.mock.calls[1][0]).toMatchObject({ student: 's2', session: 'sess1', score: 1 });
    // Вторая выдача не создаётся, колонка журнала — одна
    expect(mockApi.createSession).toHaveBeenCalledTimes(1);
    expect(mockApi.createJournalColumn).toHaveBeenCalledTimes(1);
  });

  it('клик по значку засчитывает ответ вручную', async () => {
    setup();
    await screen.findByText('Ввести ответы вручную');
    fireEvent.click(screen.getByText('Ввести ответы вручную'));
    fireEvent.change(answerInputs()[0], { target: { value: '1/2' } });
    fireEvent.change(answerInputs()[2], { target: { value: '13' } });
    expect(screen.getByText('Результат: 1 из 3')).toBeTruthy();
    const row = answerInputs()[2].closest('tr');
    fireEvent.click(within(row).getByRole('img', { hidden: true }).closest('span[style]'));
    await waitFor(() => expect(within(row).getByText('вручную')).toBeTruthy());
    expect(screen.getByText('Результат: 2 из 3')).toBeTruthy();
    // Повторный клик снимает ручное решение
    fireEvent.click(within(row).getByRole('img', { hidden: true }).closest('span[style]'));
    await waitFor(() => expect(within(row).queryByText('вручную')).toBeNull());
    expect(screen.getByText('Результат: 1 из 3')).toBeTruthy();
  });

  it('колонка уже есть в журнале — новую не заводим', async () => {
    mockApi.getJournalColumns.mockResolvedValue([{ id: 'c0', work: 'w1' }]);
    setup();
    await screen.findByText('Ввести ответы вручную');
    await waitFor(() => expect(mockApi.getStudentsByGroup).toHaveBeenCalled());
    await pickStudent('Анна Белова');
    fireEvent.click(screen.getByText('Ввести ответы вручную'));
    fireEvent.click(screen.getByText('Записать результат'));
    await waitFor(() => expect(mockApi.getJournalColumns).toHaveBeenCalledWith('g10'));
    expect(mockApi.createJournalColumn).not.toHaveBeenCalled();
  });

  it('«Не показывать результаты»: новая выдача создаётся закрытой (v3.9.321)', async () => {
    setup();
    await screen.findByText('Ввести ответы вручную');
    await waitFor(() => expect(mockApi.getStudentsByGroup).toHaveBeenCalled());
    fireEvent.click(screen.getByText(/Не показывать результаты ученикам/));
    expect(mockApi.setSessionsResultsHidden).not.toHaveBeenCalled();
    await pickStudent('Анна Белова');
    fireEvent.click(screen.getByText('Ввести ответы вручную'));
    fireEvent.change(answerInputs()[0], { target: { value: '0,5' } });
    fireEvent.click(screen.getByText('Записать результат'));
    await waitFor(() => expect(mockApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ work: 'w1', results_hidden: true }),
    ));
  });

  it('по умолчанию результаты публикуются; у существующей выдачи галочка пишет сразу', async () => {
    mockApi.getSessionsByWork.mockResolvedValue([{ id: 'old', created: '2026-10-06 10:00:00Z' }]);
    mockApi.setSessionsResultsHidden.mockResolvedValue([{ id: 'old', results_hidden: true }]);
    setup();
    await screen.findByText('Ввести ответы вручную');
    const box = screen.getByText(/Не показывать результаты ученикам/).closest('label').querySelector('input');
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    await waitFor(() => expect(mockApi.setSessionsResultsHidden).toHaveBeenCalledWith(['old'], true));
    await waitFor(() => expect(box.checked).toBe(true));
  });
});
