import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

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
  getJournalLessons: vi.fn(),
  getJournalAttendance: vi.fn(),
  getJournalColumnsByLesson: vi.fn(),
  getLesson: vi.fn(),
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
import LessonJournalBlock from '../components/workspace/calendar/LessonJournalBlock';
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
  apiMock.getJournalLessons.mockResolvedValue([]);
  apiMock.getJournalAttendance.mockResolvedValue([]);
  apiMock.getJournalColumnsByLesson.mockResolvedValue([]);
});

function renderScreen(url = '/app/journal') {
  return render(
    <MemoryRouter initialEntries={[url]}>
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

// ── Урок календаря и посещаемость (v3.9.239) ──────────────────────────────

const lesson = {
  id: 'L1', group: 'g1', title: 'Интенсив: логарифмы', time_slot: '2-4', status: 'done',
  date_plan: '2026-09-18 09:00:00.000Z', date_fact: '',
};

describe('ClassJournal — колонка урока', () => {
  it('отсутствовавший на уроке получает «н» сам, колонка помечена уроком', async () => {
    apiMock.getJournalColumns.mockResolvedValue([
      { id: 'c1', group: 'g1', owner: 't1', source: 'manual', title: 'Интенсив', date: '2026-09-18 12:00:00.000Z', scale: 'points', max_score: 5, lesson: 'L1', created: '1' },
    ]);
    apiMock.getJournalMarks.mockResolvedValue([]);
    apiMock.getJournalAttempts.mockResolvedValue([]); // только колонка урока
    apiMock.getJournalLessons.mockResolvedValue([lesson]);
    apiMock.getJournalAttendance.mockResolvedValue([
      { id: 'at1', lesson: 'L1', student: 's2', status: 'absent' },
      { id: 'at2', lesson: 'L1', student: 's1', status: 'present' },
    ]);
    const { container } = renderScreen();
    await screen.findByText('Борисов Илья');
    expect(apiMock.getJournalAttendance).toHaveBeenCalledWith(['L1']);
    expect(container.querySelector('td[data-r="1"][data-c="0"]').textContent).toBe('н');
    expect(container.querySelector('td[data-r="0"][data-c="0"]').textContent).toBe('');
    expect(container.querySelector('[aria-label="колонка урока"]')).not.toBeNull();
  });

  it('ссылка из карточки урока: окно новой колонки с датой и темой урока, после — «Ввод списком»', async () => {
    apiMock.getJournalLessons.mockResolvedValue([lesson]);
    apiMock.getJournalAttendance.mockResolvedValue([{ id: 'at1', lesson: 'L1', student: 's2', status: 'absent' }]);
    renderScreen('/app/journal?group=g1&lesson=L1');
    const title = await screen.findByDisplayValue('Интенсив: логарифмы');
    expect(title).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    await waitFor(() => expect(apiMock.createJournalColumn).toHaveBeenCalled());
    const data = apiMock.createJournalColumn.mock.calls[0][0];
    expect(data).toMatchObject({ group: 'g1', lesson: 'L1', title: 'Интенсив: логарифмы', source: 'manual' });
    expect(data.date).toMatch(/^2026-09-18 12:00:00/);
    // Посещаемость нового урока подтянута, ввод списком открыт.
    await waitFor(() => expect(apiMock.getJournalAttendance).toHaveBeenLastCalledWith(['L1']));
    expect(await screen.findByText(/Внесено \d+ из/)).toBeInTheDocument();
    expect(screen.getByText('не был на уроке')).toBeInTheDocument();
  });

  it('ссылка «Отметки» открывает ввод списком нужной колонки', async () => {
    renderScreen('/app/journal?group=g1&entry=c1');
    expect(await screen.findByText(/Внесено \d+ из 2/)).toBeInTheDocument();
  });

  it('если на дату новой колонки один урок класса — он подставляется сам', async () => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T10:00:00`;
    const todayLesson = { ...lesson, id: 'L9', title: 'Пара сегодня', date_plan: new Date(iso).toISOString().replace('T', ' ') };
    apiMock.getJournalLessons.mockResolvedValue([todayLesson]);
    renderScreen();
    await screen.findByText('Алексеева Мария');
    fireEvent.click(screen.getByRole('button', { name: /Колонка/ }));
    await screen.findByPlaceholderText('Устный счёт 4');
    expect(screen.getByText(/Пара сегодня/)).toBeInTheDocument();
    expect(screen.getByText(/сам получит «н»/)).toBeInTheDocument();
  });
});

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{`${loc.pathname}${loc.search}`}</div>;
}

function renderBlock(props) {
  return render(
    <MemoryRouter initialEntries={['/app/calendar']}>
      <AntApp>
        <Routes>
          <Route path="/app/calendar" element={<LessonJournalBlock lessonId="L1" groupId="g1" canEdit {...props} />} />
          <Route path="/app/journal" element={<Where />} />
        </Routes>
      </AntApp>
    </MemoryRouter>,
  );
}

describe('LessonJournalBlock — «Журнал» в карточке урока', () => {
  it('колонки урока со ссылкой на ввод отметок', async () => {
    apiMock.getJournalColumnsByLesson.mockResolvedValue([
      { id: 'c1', title: 'Интенсив', group: 'g1', scale: 'points', max_score: 5, source: 'manual' },
      { id: 'cx', title: 'Скрытая', group: 'g1', scale: 'grade', hidden: true },
    ]);
    renderBlock();
    expect(await screen.findByText('Интенсив')).toBeInTheDocument();
    expect(screen.getByText('из 5')).toBeInTheDocument();
    expect(screen.queryByText('Скрытая')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Отметки' }));
    expect(screen.getByTestId('where').textContent).toBe('/app/journal?group=g1&entry=c1');
  });

  it('«Колонка в журнал» ведёт в журнал класса с уроком', async () => {
    renderBlock();
    expect(await screen.findByText(/получит «н» сам/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Колонка в журнал/ }));
    expect(screen.getByTestId('where').textContent).toBe('/app/journal?group=g1&lesson=L1');
  });

  it('журнал недоступен — блока нет; урок без класса — тоже', async () => {
    apiMock.getJournalColumnsByLesson.mockRejectedValue(Object.assign(new Error('404'), { status: 404 }));
    const { container } = renderBlock();
    await waitFor(() => expect(container.querySelector('.ljb')).toBeNull());
    const { container: c2 } = renderBlock({ groupId: '' });
    expect(c2.querySelector('.ljb')).toBeNull();
  });
});
