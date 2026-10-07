import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render, screen, fireEvent, waitFor, cleanup,
} from '@testing-library/react';
import { App as AntApp } from 'antd';
import { mergeScanReads, normalizeRead } from '../utils/scanBlank';

// v3.9.313: бланк читается сразу после съёмки и дважды — расхождения
// подсвечиваются; на телефоне окно во весь экран, «Записать» внизу.

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
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));
vi.mock('../components/MathRenderer', () => ({ default: ({ text }) => <span>{text}</span> }));
vi.mock('../hooks/useIsMobile', () => ({ default: () => true }));
// canvas и createImageBitmap в jsdom нет — сжатие подменяем готовым dataURL
vi.mock('../utils/imageProcessing', () => ({
  compressImage: vi.fn(async () => 'data:image/jpeg;base64,AAAA'),
}));

// eslint-disable-next-line import/first
import ScanBlankModal from '../components/worksheet/ScanBlankModal';

describe('mergeScanReads', () => {
  it('одно прочтение — как раньше: поля, сомнения модели, замены', () => {
    const res = mergeScanReads([
      { fields: { 1: '17', 3: '-2,5' }, uncertain: [3], replacements: [{ task: 3, value: '-2,5' }] },
    ], 4);
    expect(res.answers).toEqual({ 1: '17', 2: '', 3: '-2,5', 4: '' });
    expect(res.uncertain).toEqual([3]);
    expect(res.alternatives).toEqual({});
    expect(res.replacements).toEqual([{ task: 3, value: '-2,5' }]);
    expect(res.reads).toBe(1);
  });

  it('два прочтения: расхождение → сомнение и второй вариант', () => {
    const res = mergeScanReads([
      { fields: { 1: '0,5', 2: '86', 3: '13' }, uncertain: [] },
      { fields: { 1: '0.5', 2: '-86', 3: '12' }, uncertain: [1] },
    ], 3);
    // «0,5» и «0.5» — одно и то же, но модель сама усомнилась в поле 1
    expect(res.uncertain).toEqual([1, 2, 3]);
    expect(res.alternatives).toEqual({ 2: '-86', 3: '12' });
    expect(res.answers).toEqual({ 1: '0,5', 2: '86', 3: '13' });
    expect(res.reads).toBe(2);
  });

  it('пропуск в одном прочтении: берём непустое, «или пусто» не предлагаем', () => {
    const res = mergeScanReads([
      { fields: { 1: '4' } },
      { fields: { 1: '4', 2: '9' } },
    ], 2);
    expect(res.answers).toEqual({ 1: '4', 2: '9' });
    expect(res.uncertain).toEqual([2]);
    expect(res.alternatives).toEqual({});
  });

  it('упавшее прочтение (null) не мешает, номера вне варианта отбрасываются', () => {
    const res = mergeScanReads([null, { fields: { 1: '3' }, uncertain: [1, 9] }], 2);
    expect(res.reads).toBe(1);
    expect(res.answers).toEqual({ 1: '3', 2: '' });
    expect(res.uncertain).toEqual([1]);
  });

  it('normalizeRead: пробелы, точка и типографский минус', () => {
    expect(normalizeRead(' −2.5 ')).toBe(normalizeRead('-2,5'));
    expect(normalizeRead('1 000')).toBe('1000');
  });
});

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
      <ScanBlankModal open work={WORK} onClose={() => {}} scanEnabled {...props} />
    </AntApp>,
  );
}

async function pickStudent(name) {
  fireEvent.mouseDown(document.querySelector('.sbm-student .ant-select-selector'));
  const option = await waitFor(() => {
    const el = [...document.querySelectorAll('.ant-select-item-option-content')]
      .find((n) => n.textContent.includes(name));
    if (!el) throw new Error('нет варианта');
    return el;
  });
  fireEvent.click(option);
}

function takePhoto() {
  const input = document.querySelector('input[type="file"][capture]');
  const file = new File(['x'], 'blank.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  localStorage.setItem('scanBlank.group', 'g10');
  mockApi.getVariantsByWork.mockResolvedValue([VARIANT]);
  mockApi.getSessionsByWork.mockResolvedValue([]);
  mockApi.getStudents.mockResolvedValue(CLASS);
  mockApi.getTeachingGroups.mockResolvedValue([{ id: 'g10', name: '10 А' }]);
  mockApi.getStudentsByGroup.mockResolvedValue(CLASS);
  mockApi.getAttemptsBySessionsWithStudent.mockResolvedValue([]);
  mockApi.createSession.mockResolvedValue({ id: 'sess1', created: '2026-10-07 10:00:00Z' });
  mockApi.createAttempt.mockImplementation(async (d) => ({ id: `a-${d.student}` }));
  mockApi.batchCreateAttemptAnswers.mockResolvedValue([]);
  mockApi.updateAttempt.mockResolvedValue({});
  mockApi.getJournalColumns.mockResolvedValue([]);
  mockApi.createJournalColumn.mockResolvedValue({ id: 'col1' });
  mockApi.scanBlank
    .mockResolvedValueOnce({ fields: { 1: '0,5', 2: '5', 3: '13' }, uncertain: [], replacements: [] })
    .mockResolvedValueOnce({ fields: { 1: '0.5', 2: '5', 3: '12' }, uncertain: [], replacements: [] });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockApi.scanBlank.mockReset();
  localStorage.clear();
});

describe('ScanBlankModal на телефоне', () => {
  it('знакомый класс — настройки свёрнуты в строку, сразу кнопка камеры', async () => {
    setup();
    await screen.findByText('Сфотографировать бланк');
    expect(document.querySelector('.sbm-root--mobile')).toBeTruthy();
    expect(document.querySelector('.sbm-setup-fields')).toBeNull();
    expect(screen.getByText(/10 А · .* · новая выдача/)).toBeTruthy();
    // Строка разворачивается по тапу
    fireEvent.click(document.querySelector('.sbm-setup-sum'));
    expect(document.querySelector('.sbm-setup-fields')).toBeTruthy();
  });

  it('снимок → два прочтения → «или …» → запись → следующий ученик', async () => {
    setup();
    await screen.findByText('Сфотографировать бланк');
    await waitFor(() => expect(mockApi.getStudentsByGroup).toHaveBeenCalledWith('g10'));
    await pickStudent('Анна Белова');

    takePhoto();
    // Распознавание стартует само, без кнопки «Распознать», и дважды
    await waitFor(() => expect(document.querySelectorAll('.sbm-row')).toHaveLength(3));
    expect(mockApi.scanBlank).toHaveBeenCalledTimes(2);
    expect(mockApi.scanBlank).toHaveBeenCalledWith({ imageBase64: 'data:image/jpeg;base64,AAAA', tasksCount: 3 });

    // Поле 3 прочитано по-разному — подсвечено, предложен второй вариант
    const rows = document.querySelectorAll('.sbm-row');
    expect(rows[2].classList.contains('sbm-row--warn')).toBe(true);
    expect(rows[0].classList.contains('sbm-row--warn')).toBe(false);
    expect(screen.getByText(/Сверьте с фото поля: 3/)).toBeTruthy();
    expect(document.querySelector('.sbm-foot-big').textContent).toBe('2');

    fireEvent.click(screen.getByText('или 12'));
    await waitFor(() => expect(document.querySelector('.sbm-foot-big').textContent).toBe('3'));
    // Меняются местами: теперь можно вернуть прочитанное первым
    expect(screen.getByText('или 13')).toBeTruthy();

    fireEvent.click(screen.getByText('Записать'));
    await waitFor(() => expect(mockApi.batchCreateAttemptAnswers).toHaveBeenCalled());
    expect(mockApi.createAttempt).toHaveBeenCalledWith(expect.objectContaining({
      student: 's1', score: 3, total: 3, source: 'scan',
    }));
    // Фото бланка уходит в попытку
    await waitFor(() => expect(mockApi.updateAttempt).toHaveBeenCalled());

    // Снова экран съёмки, выбран следующий ученик, видно, кого записали
    await screen.findByText('Сфотографировать бланк');
    expect(document.querySelector('.sbm-saved').textContent).toContain('Анна Белова: 3 из 3');
    expect(document.querySelector('.sbm-student .ant-select-selection-item').textContent).toBe('Борис Волков');
    expect(screen.getByText('Внесено 1 из 2')).toBeTruthy();
  });

  it('одно прочтение упало — ответы по второму, без подсветки расхождений', async () => {
    mockApi.scanBlank.mockReset();
    mockApi.scanBlank
      .mockRejectedValueOnce(new Error('AI gateway HTTP 502'))
      .mockResolvedValueOnce({ fields: { 1: '0,5', 2: '5', 3: '12' }, uncertain: [], replacements: [] });
    setup();
    await screen.findByText('Сфотографировать бланк');
    takePhoto();
    await waitFor(() => expect(document.querySelectorAll('.sbm-row')).toHaveLength(3));
    expect(document.querySelectorAll('.sbm-row--warn')).toHaveLength(0);
    expect(document.querySelector('.sbm-alt')).toBeNull();
    expect(document.querySelector('.sbm-foot-big').textContent).toBe('3');
  });

  it('без ИИ — только ручной ввод, кнопки камеры нет', async () => {
    setup({ scanEnabled: false });
    await screen.findByText('Ввести ответы вручную');
    expect(screen.queryByText('Сфотографировать бланк')).toBeNull();
    fireEvent.click(screen.getByText('Ввести ответы вручную'));
    expect(document.querySelectorAll('.sbm-row input')).toHaveLength(3);
    expect(mockApi.scanBlank).not.toHaveBeenCalled();
  });
});
