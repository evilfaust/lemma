import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';

const apiMock = vi.hoisted(() => ({
  getTeachingGroups: vi.fn(),
  getStudentsByGroup: vi.fn(),
  getCourseMembers: vi.fn(),
  getJournalColumns: vi.fn(),
  getJournalMarks: vi.fn(),
  getJournalStudentsByIds: vi.fn(),
  getJournalAttempts: vi.fn(),
  getJournalWorkDeadlines: vi.fn(),
  saveJournalMark: vi.fn(),
  createJournalColumn: vi.fn(),
  updateJournalColumn: vi.fn(),
  deleteJournalColumn: vi.fn(),
  getWorks: vi.fn(),
}));

vi.mock('../shared/services/pocketbase', () => ({ api: apiMock }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ teacher: { id: 't1' }, isSuperAdmin: false, canEdit: true, canDelete: true }),
}));

// eslint-disable-next-line import/first
import JournalGrid from '../components/workspace/journal/JournalGrid';
// eslint-disable-next-line import/first
import ClassJournal from '../components/workspace/journal/ClassJournal';
// eslint-disable-next-line import/first
import { buildGrid, indexMarks } from '../utils/classJournal';

// ── Сетка сама по себе ──────────────────────────────────────────────────────

const students = [{ id: 's1', name: 'Алексеева Мария' }, { id: 's2', name: 'Борисов Илья' }];
const cols = [
  { id: 'c1', key: 'm:c1', online: false, scale: 'points', max_score: 20, title: 'Устный счёт 1', day: '2026-09-09' },
  { id: 'c2', key: 'm:c2', online: false, scale: 'grade', title: 'Опрос', day: '2026-09-23' },
];

function renderGrid(props = {}) {
  const grid = buildGrid(students, cols, indexMarks([{ col: 'c1', student: 's1', value: '18' }]), new Map());
  const onCommit = vi.fn(() => null);
  const onPaste = vi.fn();
  const utils = render(
    <AntApp>
      <JournalGrid
        rows={grid.rows}
        columns={cols}
        colStats={grid.colStats}
        canEdit
        menuFor={() => []}
        onMenu={() => {}}
        onCommit={onCommit}
        onPaste={onPaste}
        {...props}
      />
    </AntApp>,
  );
  const region = utils.container.querySelector('.cj-scroll');
  const cell = (r, c) => utils.container.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
  return { ...utils, onCommit: props.onCommit || onCommit, onPaste, region, cell };
}

describe('JournalGrid — ввод как в таблице', () => {
  it('цифра открывает ввод поверх, Enter записывает и уходит вниз', () => {
    const { region, cell, onCommit } = renderGrid();
    fireEvent.mouseDown(cell(0, 1));
    expect(cell(0, 1).className).toMatch(/is-sel/);
    fireEvent.keyDown(region, { key: '5' });
    const input = cell(0, 1).querySelector('input');
    expect(input.value).toBe('5');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(1, 0, '5');
    expect(cell(1, 1).className).toMatch(/is-sel/);
    expect(cell(0, 1).querySelector('input')).toBeNull();
  });

  it('ошибка шкалы — редактор остаётся, причина видна', () => {
    const onCommit = vi.fn(() => 'Баллы — число от 0 до 20');
    const { region, cell, container } = renderGrid({ onCommit });
    fireEvent.mouseDown(cell(1, 0));
    fireEvent.keyDown(region, { key: '9' });
    const input = cell(1, 0).querySelector('input');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(cell(1, 0).querySelector('input')).not.toBeNull();
    expect(input.className).toMatch(/is-err/);
    expect(container.querySelector('.cj-status').textContent).toMatch(/Борисов Илья.*от 0 до 20/);
  });

  it('Enter на заполненной клетке — правка стоящего значения', () => {
    const { region, cell } = renderGrid();
    fireEvent.mouseDown(cell(0, 0));
    fireEvent.keyDown(region, { key: 'Enter' });
    expect(cell(0, 0).querySelector('input').value).toBe('18');
  });

  it('Esc отменяет, Delete очищает, стрелки двигают', () => {
    const { region, cell, onCommit } = renderGrid();
    fireEvent.mouseDown(cell(0, 0));
    fireEvent.keyDown(region, { key: '1' });
    fireEvent.keyDown(cell(0, 0).querySelector('input'), { key: 'Escape' });
    expect(cell(0, 0).querySelector('input')).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.keyDown(region, { key: 'Delete' });
    expect(onCommit).toHaveBeenCalledWith(0, 0, '');

    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(cell(0, 1).className).toMatch(/is-sel/);
    fireEvent.keyDown(region, { key: 'ArrowDown' });
    expect(cell(1, 1).className).toMatch(/is-sel/);
  });

  it('Ctrl+V блока из таблицы уходит родителю от выбранной клетки', () => {
    const { region, cell, onPaste } = renderGrid();
    fireEvent.mouseDown(cell(1, 0));
    fireEvent.paste(region, { clipboardData: { getData: () => '15\n17' } });
    expect(onPaste).toHaveBeenCalledWith(1, 0, '15\n17');
  });

  it('сводка строки и подвал: средний и «внесено»', () => {
    const { container } = renderGrid();
    const firstRow = container.querySelector('tbody tr');
    expect(within(firstRow).getByText('5,0')).toBeInTheDocument();
    expect(container.querySelector('tfoot').textContent).toMatch(/1\/2/);
  });
});

// ── Экран целиком на моках API ─────────────────────────────────────────────

const session = {
  id: 'sess1', work: 'w1', created: '2026-09-11 09:00:00.000Z', deadline: '', passing_score: 0,
  expand: { work: { id: 'w1', title: 'Тест: степени' } },
};

beforeEach(() => {
  Object.values(apiMock).forEach((fn) => fn.mockReset());
  localStorage.clear();
  apiMock.getTeachingGroups.mockResolvedValue([{ id: 'g1', name: '10 кл', year: '2026/2027', owner: 't1' }]);
  apiMock.getStudentsByGroup.mockResolvedValue(students);
  apiMock.getJournalColumns.mockResolvedValue([
    { id: 'c1', group: 'g1', owner: 't1', source: 'manual', title: 'Устный счёт 1', date: '2026-09-09 12:00:00.000Z', scale: 'points', max_score: 20, created: '1' },
  ]);
  apiMock.getJournalMarks.mockResolvedValue([{ id: 'm1', col: 'c1', student: 's1', value: '18', comment: '' }]);
  apiMock.getJournalStudentsByIds.mockResolvedValue([]);
  apiMock.getJournalAttempts.mockResolvedValue([
    { id: 'a1', student: 's1', session: 'sess1', status: 'submitted', score: 8, total: 10, submitted_at: '2026-09-11 10:00:00.000Z', expand: { session } },
  ]);
  apiMock.getJournalWorkDeadlines.mockResolvedValue(new Map());
  apiMock.saveJournalMark.mockImplementation(async (entry) => ({ id: 'new', col: entry.colId, student: entry.studentId, value: entry.value, comment: entry.comment }));
  apiMock.createJournalColumn.mockImplementation(async (data) => ({ id: 'c9', owner: 't1', created: '9', ...data }));
});

function renderScreen() {
  return render(
    <MemoryRouter>
      <AntApp>
        <ClassJournal />
      </AntApp>
    </MemoryRouter>,
  );
}

describe('ClassJournal — экран на моках API', () => {
  it('ручная и онлайн-колонки в одной сетке; попытки берутся за учебный год класса', async () => {
    const { container } = renderScreen();
    await screen.findByText('Алексеева Мария');
    expect(screen.getByText('Устный счёт 1')).toBeInTheDocument();
    expect(screen.getByText('Тест: степени')).toBeInTheDocument();
    expect(container.querySelector('td[data-r="0"][data-c="0"]').textContent).toBe('18');
    expect(container.querySelector('td[data-r="0"][data-c="1"]').textContent).toBe('80%');
    expect(apiMock.getJournalAttempts).toHaveBeenCalledWith(
      ['s1', 's2'],
      { from: '2026-08-01 00:00:00.000Z', to: '2027-08-01 00:00:00.000Z' },
    );
  });

  it('ввод в пустую ручную клетку пишет отметку', async () => {
    const { container } = renderScreen();
    await screen.findByText('Борисов Илья');
    const region = container.querySelector('.cj-scroll');
    fireEvent.mouseDown(container.querySelector('td[data-r="1"][data-c="0"]'));
    fireEvent.keyDown(region, { key: '1' });
    const input = container.querySelector('td[data-r="1"][data-c="0"] input');
    fireEvent.change(input, { target: { value: '15' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    await waitFor(() => expect(apiMock.saveJournalMark).toHaveBeenCalledWith(
      { colId: 'c1', studentId: 's2', value: '15', comment: '' }, null,
    ));
    expect(container.querySelector('td[data-r="1"][data-c="0"]').textContent).toBe('15');
  });

  it('правка онлайн-клетки сначала закрепляет работу колонкой, потом пишет правку', async () => {
    const { container } = renderScreen();
    await screen.findByText('Борисов Илья');
    const region = container.querySelector('.cj-scroll');
    fireEvent.mouseDown(container.querySelector('td[data-r="1"][data-c="1"]'));
    fireEvent.keyDown(region, { key: '7' });
    const input = container.querySelector('td[data-r="1"][data-c="1"] input');
    fireEvent.change(input, { target: { value: '70' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    await waitFor(() => expect(apiMock.saveJournalMark).toHaveBeenCalled());
    expect(apiMock.createJournalColumn).toHaveBeenCalledWith(expect.objectContaining({
      group: 'g1', source: 'work', work: 'w1', title: 'Тест: степени',
    }));
    // Закреплённая ради правки — не «выдана всему классу».
    expect(apiMock.createJournalColumn.mock.calls[0][0].assigned).toBeUndefined();
    expect(apiMock.saveJournalMark).toHaveBeenCalledWith(
      { colId: 'c9', studentId: 's2', value: '70', comment: '' }, null,
    );
  });

  it('вставка столбца: подходящее пишется, мусор — в предупреждение', async () => {
    const { container } = renderScreen();
    await screen.findByText('Алексеева Мария');
    const region = container.querySelector('.cj-scroll');
    fireEvent.mouseDown(container.querySelector('td[data-r="0"][data-c="0"]'));
    await act(async () => {
      fireEvent.paste(region, { clipboardData: { getData: () => '19\nабв\n' } });
    });
    await waitFor(() => expect(apiMock.saveJournalMark).toHaveBeenCalledTimes(1));
    expect(apiMock.saveJournalMark).toHaveBeenCalledWith(
      { colId: 'c1', studentId: 's1', value: '19', comment: '' }, 'm1',
    );
    // antd печатает заголовок окна дважды (второй — для скринридера).
    expect((await screen.findAllByText(/Не подошло к шкале колонки: 1/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Борисов Илья · Устный счёт 1: «абв»/)).toBeInTheDocument();
  });

  it('новая колонка подхватывает шкалу и следующий номер прошлой', async () => {
    renderScreen();
    await screen.findByText('Алексеева Мария');
    fireEvent.click(screen.getByRole('button', { name: /Колонка/ }));
    const title = await screen.findByPlaceholderText('Устный счёт 4');
    expect(title.value).toBe('Устный счёт 2');
    expect(screen.getByText(/Из 20: «5» — от 17/)).toBeInTheDocument();
  });
});
