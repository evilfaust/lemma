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
  getJournalSheet: vi.fn(),
  getJournalBlocks: vi.fn(),
  createJournalBlock: vi.fn(),
  updateJournalBlock: vi.fn(),
  deleteJournalBlock: vi.fn(),
  generateIntensiveFeedback: vi.fn(),
  saveFeedbackExamples: vi.fn(),
  updateStudentProfile: vi.fn(),
}));

// Сценарии с окнами antd (Form, DatePicker) под нагрузкой полного прогона
// идут дольше 5 с по умолчанию — сами по себе они укладываются в 1–4 с.
vi.setConfig({ testTimeout: 20000 });

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
import SheetToJournalModal from '../components/workspace/journal/SheetToJournalModal';
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
  apiMock.getJournalBlocks.mockResolvedValue([]);
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

// ── «В журнал» у листа генератора (v3.9.240) ───────────────────────────────

const oralSheet = { id: 'S1', title: 'Устный счёт 4', generator: 'oral_counting', questions_count: 12, variants_count: 4 };

function renderJournalRoutes(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AntApp>
        <Routes>
          <Route path="/app/journal" element={<ClassJournal />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </AntApp>
    </MemoryRouter>,
  );
}

describe('ClassJournal — колонка по листу генератора', () => {
  it('ссылка ?sheet=: колонка по листу — баллы из числа заданий, ссылка на лист, потом ввод', async () => {
    apiMock.getJournalSheet.mockResolvedValue(oralSheet);
    renderScreen('/app/journal?group=g1&sheet=S1');
    expect(await screen.findByDisplayValue('Устный счёт 4')).toBeInTheDocument();
    expect(apiMock.getJournalSheet).toHaveBeenCalledWith('S1');
    expect(screen.getByDisplayValue('12')).toBeInTheDocument();
    expect(screen.getByText(/По листу «Устный счёт 4»/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    await waitFor(() => expect(apiMock.createJournalColumn).toHaveBeenCalled());
    expect(apiMock.createJournalColumn.mock.calls[0][0]).toMatchObject({
      group: 'g1',
      title: 'Устный счёт 4',
      scale: 'points',
      max_score: 12,
      category: 'Устный счёт',
      source: 'manual',
      ref: { type: 'sheet', id: 'S1', generator: 'oral_counting', title: 'Устный счёт 4' },
    });
    expect(await screen.findByText(/Внесено \d+ из 2/)).toBeInTheDocument();
  });

  it('лист уже в журнале класса — второй колонки нет, открывается ввод в существующей', async () => {
    apiMock.getJournalColumns.mockResolvedValue([
      { id: 'c5', group: 'g1', owner: 't1', source: 'manual', title: 'Устный счёт 4', date: '2026-09-20 12:00:00.000Z', scale: 'points', max_score: 12, ref: { type: 'sheet', id: 'S1', generator: 'oral_counting', title: 'Устный счёт 4' }, created: '5' },
    ]);
    renderScreen('/app/journal?group=g1&sheet=S1');
    expect(await screen.findByText(/Внесено \d+ из 2/)).toBeInTheDocument();
    expect(apiMock.getJournalSheet).not.toHaveBeenCalled();
    expect(apiMock.createJournalColumn).not.toHaveBeenCalled();
    expect((await screen.findAllByText(/Лист уже в журнале/)).length).toBeGreaterThan(0);
  });

  it('«Открыть лист» в меню колонки ведёт в генератор листа', async () => {
    apiMock.getJournalColumns.mockResolvedValue([
      { id: 'c5', group: 'g1', owner: 't1', source: 'manual', title: 'Устный счёт 4', date: '2026-09-20 12:00:00.000Z', scale: 'points', max_score: 12, ref: { type: 'sheet', id: 'S1', generator: 'oral_counting', title: 'Устный счёт 4' }, created: '5' },
    ]);
    apiMock.getJournalAttempts.mockResolvedValue([]);
    const { container } = renderJournalRoutes('/app/journal');
    await screen.findByText('Алексеева Мария');
    fireEvent.click(container.querySelector('.cj-colh__btn'));
    fireEvent.click(await screen.findByText('Открыть лист'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/app/arith/oral-counting?sheet=S1'), { timeout: 5000 });
  });
});

describe('SheetToJournalModal — выбор класса', () => {
  it('ведёт в журнал выбранного класса со ссылкой на лист и помнит класс', async () => {
    apiMock.getTeachingGroups.mockResolvedValue([
      { id: 'g1', name: '10 кл', year: '2026/2027' },
      { id: 'g2', name: '8 кл', year: '2026/2027' },
    ]);
    localStorage.setItem('journal.groupId', 'g2');
    render(
      <MemoryRouter initialEntries={['/app/arith/oral-counting']}>
        <AntApp>
          <Routes>
            <Route path="/app/arith/oral-counting" element={<SheetToJournalModal open sheet={oralSheet} onClose={() => {}} />} />
            <Route path="/app/journal" element={<Where />} />
          </Routes>
        </AntApp>
      </MemoryRouter>,
    );
    expect(await screen.findByText('8 кл')).toBeInTheDocument();
    expect(screen.getByText(/заданий в варианте: 12/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Открыть журнал' }));
    expect(screen.getByTestId('where').textContent).toBe('/app/journal?group=g2&sheet=S1');
    expect(localStorage.getItem('journal.groupId')).toBe('g2');
  });
});

// ── Интенсив (v3.9.241) ─────────────────────────────────────────────────────

describe('ClassJournal — интенсив', () => {
  const intensive = {
    id: 'B1', group: 'g1', owner: 't1', title: 'Производная',
    date_from: '2026-09-18 12:00:00.000Z', date_to: '2026-09-22 12:00:00.000Z', final_share: 40,
  };
  const inBlock = (extra) => ({ group: 'g1', owner: 't1', source: 'manual', block: 'B1', ...extra });

  beforeEach(() => {
    apiMock.getJournalBlocks.mockResolvedValue([intensive]);
    apiMock.getJournalAttempts.mockResolvedValue([]);
    apiMock.getJournalColumns.mockResolvedValue([
      inBlock({ id: 'd18', title: 'За день', role: 'day', scale: 'grade', date: '2026-09-18 12:00:00.000Z', created: '1' }),
      inBlock({ id: 'fin', title: 'Зачёт', role: 'final', scale: 'points', max_score: 20, date: '2026-09-22 12:00:00.000Z', created: '2' }),
      inBlock({ id: 'tot', title: 'Итог', role: 'total', scale: 'grade', date: '2026-09-22 12:00:00.000Z', created: '3' }),
      inBlock({ id: 'w18', title: 'У/с', role: 'work', scale: 'points', max_score: 20, date: '2026-09-18 12:00:00.000Z', created: '4' }),
    ]);
    // У/с 18 из 20 (90 % → «5»), зачёт 12 из 20 (60 % → «3»): итог ≈ 5·0,6 + 3·0,4 = 4,2.
    apiMock.getJournalMarks.mockResolvedValue([
      { id: 'm1', col: 'w18', student: 's1', value: '18', comment: '' },
      { id: 'm2', col: 'fin', student: 's1', value: '12', comment: '' },
      { id: 'm3', col: 'd18', student: 's2', value: 'w', comment: '' },
    ]);
  });

  it('название над колонками интенсива, подсказки «за день» и итога, свёртка до итогов', async () => {
    const { container } = renderScreen();
    await screen.findByText('Алексеева Мария');
    expect(screen.getByText('Интенсив · Производная · 18–22.09')).toBeInTheDocument();
    const titles = [...container.querySelectorAll('.cj-colh__title')].map((el) => el.textContent);
    expect(titles).toEqual(['У/с', 'За день', 'Зачёт', 'Итог']);
    const cellOf = (r, title) => container.querySelector(`td[data-r="${r}"][data-c="${titles.indexOf(title)}"]`);
    expect(cellOf(0, 'За день').textContent).toBe('≈5,0');
    expect(cellOf(0, 'Итог').textContent).toBe('≈4,2');
    expect(cellOf(1, 'За день').textContent).toBe('w');

    fireEvent.click(screen.getByText('Интенсив · Производная · 18–22.09'));
    fireEvent.click(await screen.findByText('Свернуть до итогов (за день, зачёт, итог)'));
    await waitFor(() => {
      expect([...container.querySelectorAll('.cj-colh__title')].map((el) => el.textContent))
        .toEqual(['За день', 'Зачёт', 'Итог']);
    });
    // Работ в сетке нет, а подсказка итога считается по ним же.
    expect(container.querySelector('td[data-r="0"][data-c="2"]').textContent).toBe('≈4,2');
    expect(JSON.parse(localStorage.getItem('journal.collapsedBlocks'))).toEqual(['B1']);
  });

  it('«Обратная связь ученикам» из меню интенсива открывает окно черновиков', async () => {
    renderScreen();
    await screen.findByText('Алексеева Мария');
    fireEvent.click(screen.getByText('Интенсив · Производная · 18–22.09'));
    fireEvent.click(await screen.findByText('Обратная связь ученикам (черновики ИИ)'));
    expect(await screen.findByText('Обратная связь · интенсив «Производная»')).toBeInTheDocument();
    // Строка на каждого ученика класса, итог берётся из колонки «Итог».
    expect(screen.getAllByText(/^Итог:/)).toHaveLength(2);
  });

  it('«Добавить работу дня» из меню интенсива: колонка уходит в интенсив с ролью работы', async () => {
    renderScreen();
    await screen.findByText('Алексеева Мария');
    fireEvent.click(screen.getByText('Интенсив · Производная · 18–22.09'));
    fireEvent.click(await screen.findByText('Добавить работу дня'));
    await screen.findByText('Новая колонка · интенсив «Производная»');
    // Настройки подхвачены с прошлой работы интенсива.
    expect(screen.getByDisplayValue('У/с')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    await waitFor(() => expect(apiMock.createJournalColumn).toHaveBeenCalled());
    expect(apiMock.createJournalColumn.mock.calls[0][0]).toMatchObject({
      group: 'g1', block: 'B1', role: 'work', title: 'У/с', scale: 'points', max_score: 20,
    });
  });

  it('новый интенсив: запись интенсива и колонки «за день» на каждый день, зачёт, итог', async () => {
    apiMock.getJournalBlocks.mockResolvedValue([]);
    apiMock.getJournalColumns.mockResolvedValue([]);
    apiMock.getJournalMarks.mockResolvedValue([]);
    apiMock.createJournalBlock.mockImplementation(async (data) => ({ id: 'B2', owner: 't1', ...data }));
    renderScreen();
    await screen.findByText('Журнал пока пуст');
    fireEvent.click(screen.getByRole('button', { name: 'Какую колонку добавить' }));
    fireEvent.click(await screen.findByText('Интенсив — несколько дней по одной теме'));
    fireEvent.change(await screen.findByPlaceholderText('Производная'), { target: { value: 'Логарифмы' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

    await waitFor(() => expect(apiMock.createJournalBlock).toHaveBeenCalled());
    expect(apiMock.createJournalBlock.mock.calls[0][0]).toMatchObject({ title: 'Логарифмы', group: 'g1', final_share: 40 });
    await waitFor(() => expect(screen.getByText(/Интенсив «Логарифмы» заведён/)).toBeInTheDocument());
    const created = apiMock.createJournalColumn.mock.calls.map(([c]) => c);
    // Уроков нет — дни интенсива: пять дней от сегодня, кроме воскресенья.
    const days = [0, 1, 2, 3, 4].map((i) => { const x = new Date(); x.setDate(x.getDate() + i); return x; })
      .filter((x) => x.getDay() !== 0).length;
    expect(created.map((c) => c.role)).toEqual([...Array(days).fill('day'), 'final', 'total']);
    expect(created.every((c) => c.block === 'B2' && c.group === 'g1')).toBe(true);
    expect(created.at(-2)).toMatchObject({ title: 'Зачёт', scale: 'points', max_score: 20 });
    expect(created.at(-1)).toMatchObject({ title: 'Итог', scale: 'grade' });
  });
});
