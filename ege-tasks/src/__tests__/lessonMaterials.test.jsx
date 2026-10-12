import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { App as AntApp } from 'antd';
import {
  normalizeLessonItems, deliveryChoices, deliveryOf, withDelivery, studentSection, studentPreview,
  pickOpenSession, resultSessionIds, hasItem,
} from '../utils/lessonItems';
import { itemResult, resultLabel, itemRequired, itemSection } from '../utils/lessonResults';
import { todoList } from '../utils/studentHome';

// Единый список материалов урока (v3.9.358): одна запись на работу, способ
// выдачи — deliver, у ученика — разделы «Обязательно / Материалы / Результаты».

const require = createRequire(import.meta.url);
const lib = require('../../../pocketbase/pb_hooks/lessons_feed_lib.js');

const mockApi = vi.hoisted(() => ({
  getMyLessons: vi.fn(),
  getStudentLessonAttempts: vi.fn(),
  getMCTestsLight: vi.fn(),
  getGeometryWorksLight: vi.fn(),
  getProgramWorkIds: vi.fn(),
  getSessionsByWorks: vi.fn(),
  getSessionsByMCTests: vi.fn(),
  getLessonNote: vi.fn(),
  getWork: vi.fn(),
  setWorkShowSharing: vi.fn(),
  createSession: vi.fn(),
  setSessionsResultsHidden: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ canEdit: true }), useOptionalAuth: () => ({ canEdit: true }) }));

// eslint-disable-next-line import/first
import LessonMaterialsEditor from '../components/workspace/calendar/LessonMaterialsEditor';
// eslint-disable-next-line import/first
import StudentCoursePortal from '../components/student/StudentCoursePortal';

describe('окно урока: пункты единого списка', () => {
  it('старые записи приводятся к одной строке на работу', () => {
    const sessions = new Map([
      ['sess1', { id: 'sess1', work: 'w1' }],
      ['sess2', { id: 'sess2', mc_test: 't1' }],
    ]);
    const out = normalizeLessonItems([
      { type: 'work', id: 'w1', title: 'Субботний тест' },          // учительская запись…
      { type: 'session', id: 'sess1', title: '', role: 'homework' }, // …и её выдача ученикам
      { type: 'mc_test', id: 't1', title: 'Тест' },
      { type: 'session', id: 'sess2', title: 'Тест ученикам' },
      { type: 'work_view', id: 'w2', title: 'Разбор' },
      { type: 'geometry_view', id: 'g1', title: 'Геометрия' },
      { type: 'session', id: 'unknown1', title: 'Выдача по коду' },
      { type: 'work', id: 'w3', title: 'Только учителю' },
    ], sessions);
    expect(out).toEqual([
      { type: 'work', id: 'w1', title: 'Субботний тест', role: 'homework', deliver: 'online', session: 'sess1' },
      { type: 'mc_test', id: 't1', title: 'Тест ученикам', deliver: 'online', session: 'sess2' },
      { type: 'work', id: 'w2', title: 'Разбор', deliver: 'show' },
      { type: 'geometry_work', id: 'g1', title: 'Геометрия', deliver: 'show' },
      { type: 'session', id: 'unknown1', title: 'Выдача по коду' },
      { type: 'work', id: 'w3', title: 'Только учителю' },
    ]);
  });

  it('вход не меняется (копии), повторная нормализация — то же самое', () => {
    const src = [{ type: 'work', id: 'w1', title: '' }, { type: 'work_view', id: 'w1', title: '' }];
    const once = normalizeLessonItems(src);
    expect(src[0]).toEqual({ type: 'work', id: 'w1', title: '' });
    expect(normalizeLessonItems(once)).toEqual(once);
    expect(once).toEqual([{ type: 'work', id: 'w1', title: '', deliver: 'show' }]);
  });

  it('способы выдачи по виду пункта; смена способа', () => {
    expect(deliveryChoices({ type: 'work' })).toEqual(['online', 'show', 'paper', 'none']);
    expect(deliveryChoices({ type: 'mc_test' })).toEqual(['online', 'none']);
    expect(deliveryChoices({ type: 'geometry_work' })).toEqual(['show', 'none']);
    expect(deliveryChoices({ type: 'material' })).toEqual(['file', 'none']);
    expect(deliveryChoices({ type: 'text' })).toEqual([]);

    const w = { type: 'work', id: 'w1', title: 'Т' };
    expect(deliveryOf(w)).toBe('none');
    const online = withDelivery(w, 'online', { session: 's1' });
    expect(online).toEqual({ type: 'work', id: 'w1', title: 'Т', deliver: 'online', session: 's1' });
    expect(withDelivery(online, 'paper')).toEqual({ type: 'work', id: 'w1', title: 'Т', deliver: 'paper' });
    expect(withDelivery(online, 'none')).toEqual(w);
    // файл: видимость
    expect(withDelivery({ type: 'material', id: 'f' }, 'file').visible).toBe(true);
    expect(deliveryOf({ type: 'material', id: 'f' }, false)).toBe('none');
    expect(deliveryOf({ type: 'material', id: 'f' }, true)).toBe('file');
  });

  it('раздел у ученика и подпись «что увидит ученик»', () => {
    const paper = { type: 'work', id: 'w', deliver: 'paper' };
    const online = { type: 'work', id: 'w', deliver: 'online', session: 's' };
    const show = { type: 'work', id: 'w', deliver: 'show' };
    const hwShow = { ...show, role: 'homework' };
    expect(studentSection({ type: 'work', id: 'w' }, false)).toBe(null);
    expect(studentSection(paper)).toBe('results');
    expect(studentSection(online)).toBe('required');
    expect(studentSection(show)).toBe('materials');
    expect(studentSection(hwShow)).toBe('required');
    expect(studentSection({ ...online, required: false })).toBe('materials');
    expect(studentSection({ ...show, required: true })).toBe('required');

    expect(studentPreview({ type: 'work', id: 'w' })).toBe('Ученики не видят');
    expect(studentPreview(paper)).toMatch(/«Результаты».*внесёте результаты/);
    expect(studentPreview({ ...hwShow, due: 'next' })).toMatch(/«Обязательно» · ДЗ к следующему уроку · условия/);
    expect(studentPreview(online, { studentFacing: false })).toBe('');
  });

  it('выдача для «онлайн» — только открытая; выдачи результатов пункта', () => {
    expect(pickOpenSession([{ id: 'p', is_open: false }, { id: 'o', is_open: true }])?.id).toBe('o');
    expect(pickOpenSession([{ id: 'p', is_open: false }])).toBe(null);
    expect(resultSessionIds({ deliver: 'online', session: 's' }, [{ id: 'x' }])).toEqual(['s']);
    expect(resultSessionIds({ deliver: 'paper' }, [{ id: 'a' }, { id: 'b' }])).toEqual(['a', 'b']);
    expect(resultSessionIds({ deliver: 'show' }, [{ id: 'a' }])).toEqual([]);
    expect(hasItem([{ type: 'work', id: 'w' }], 'work', 'w')).toBe(true);
    expect(hasItem([{ type: 'work', id: 'w' }], 'mc_test', 'w')).toBe(false);
  });
});

describe('сервер: проекция новых записей', () => {
  it('online / show / paper / «только мне»; онлайн без выдачи не уходит', () => {
    const out = lib.projectItems([
      { type: 'work', id: 'w1', title: 'Субботний тест', deliver: 'paper' },
      { type: 'work', id: 'w2', title: 'Онлайн', deliver: 'online', session: 's2', role: 'homework' },
      { type: 'work', id: 'w3', title: 'Без выдачи', deliver: 'online' },
      { type: 'work', id: 'w4', title: 'Условия', deliver: 'show', required: true },
      { type: 'mc_test', id: 't1', title: 'Тест', deliver: 'online', session: 's5', required: false },
      { type: 'geometry_work', id: 'g1', title: 'Геом', deliver: 'show' },
      { type: 'work', id: 'w5', title: 'Только мне' },
      { type: 'mc_test', id: 't2', title: 'Только мне' },
    ], false);
    expect(out).toEqual([
      { kind: 'paper', title: 'Субботний тест', work_id: 'w1', role: 'class', due: 'lesson', required: false },
      { kind: 'work', title: 'Онлайн', session_id: 's2', work_id: 'w2', role: 'homework', due: 'lesson', required: true },
      { kind: 'show', title: 'Условия', work_id: 'w4', role: 'class', due: 'lesson', required: true },
      { kind: 'work', title: 'Тест', session_id: 's5', test_id: 't1', role: 'class', due: 'lesson', required: false },
      { kind: 'show', title: 'Геом', work_id: 'g1', geometry: true, role: 'class', due: 'lesson', required: false },
    ]);
  });
});

const att = (id, extra) => ({ id, status: 'submitted', score: 0, total: 10, created: '2026-10-10', ...extra });
const sess = (id, work, hidden = false) => ({ session: id, expand: { session: { id, work, results_hidden: hidden } } });

describe('ученик: результат у пункта урока', () => {
  const online = { kind: 'work', session_id: 's1', work_id: 'w1' };
  const paper = { kind: 'paper', work_id: 'w9' };

  it('онлайн: нет попыток → решать; начато → продолжить; сдано → лучший балл', () => {
    expect(itemResult(online, []).state).toBe('none');
    expect(itemResult(online, [att('a', { ...sess('s1', 'w1'), status: 'started' })]).state).toBe('started');
    const res = itemResult(online, [
      att('a', { ...sess('s1', 'w1'), score: 4 }),
      att('b', { ...sess('s1', 'w1'), score: 7 }),
      att('c', { ...sess('s2', 'w1'), score: 10 }), // другая выдача той же работы — не эта
    ]);
    expect(res).toMatchObject({ state: 'done', score: 7, total: 10, pct: 70 });
    expect(res.attempt.id).toBe('b');
    expect(resultLabel(online, res)).toBe('7 из 10');
  });

  it('закрытые учителем результаты — «результатов пока нет»', () => {
    const res = itemResult(online, [att('a', { ...sess('s1', 'w1', true), score: 9 })]);
    expect(res.state).toBe('hidden');
    expect(resultLabel(online, res)).toBe('Сдано · результатов пока нет');
  });

  it('бумага: по любой выдаче работы; без попыток — «результатов пока нет»', () => {
    expect(resultLabel(paper, itemResult(paper, []))).toBe('Результатов пока нет');
    const res = itemResult(paper, [att('p', { ...sess('paper1', 'w9'), score: 8 })]);
    expect(res).toMatchObject({ state: 'done', score: 8 });
    expect(resultLabel(paper, itemResult(paper, [att('p', { ...sess('paper1', 'w9', true) })]))).toBe('Результатов пока нет');
  });

  it('обязательность и раздел; «Сделать» на главной — только обязательное', () => {
    expect(itemRequired({ kind: 'file', role: 'homework', required: false })).toBe(false);
    expect(itemRequired({ kind: 'work' })).toBe(true); // пункт старого сервера
    expect(itemSection({ kind: 'paper', required: true })).toBe('results');
    expect(itemSection({ kind: 'show', required: false })).toBe('materials');

    const lessons = [{
      id: 'l1', group: 'g', owner: 't', date_plan: '2026-10-14T10:00:00', status: 'planned',
      items: [
        { kind: 'text', role: 'homework', due: 'lesson', required: true, description: 'Задача 1' },
        { kind: 'file', role: 'homework', due: 'lesson', required: false, title: 'Справочник', file_url: 'u' },
      ],
    }];
    expect(todoList(lessons, [], '2026-10-13T12:00:00').map((r) => r.item.description || r.title)).toEqual(['Задача 1']);
  });
});

describe('окно урока: строка материала', () => {
  beforeEach(() => {
    for (const fn of Object.values(mockApi)) fn.mockReset();
    mockApi.getMCTestsLight.mockResolvedValue([]);
    mockApi.getGeometryWorksLight.mockResolvedValue([]);
    mockApi.getProgramWorkIds.mockResolvedValue(new Set());
    mockApi.getSessionsByWorks.mockResolvedValue([
      { id: 'paper1', work: 'w1', is_open: false, created: '2026-10-10', results_hidden: true },
    ]);
    mockApi.getSessionsByMCTests.mockResolvedValue([]);
    mockApi.getLessonNote.mockResolvedValue(null);
    mockApi.setSessionsResultsHidden.mockResolvedValue([{ results_hidden: false }]);
  });
  afterEach(() => cleanup());

  function Harness({ initial, onItems }) {
    const [items, setItems] = useState(initial);
    onItems?.(items);
    return (
      <AntApp>
        <LessonMaterialsEditor
          items={items}
          setItems={setItems}
          works={[{ id: 'w1', title: 'Субботний тест' }]}
          canEdit
          studentFacing
          isCourse={false}
          group={{ id: 'g', grade: '11' }}
          visibleToStudents
        />
      </AntApp>
    );
  }

  it('«Только мне» видно сразу; «Писали на бумаге» — в «Результаты», выключатель результатов', async () => {
    let latest = [];
    render(<Harness initial={[{ type: 'work', id: 'w1', title: 'Субботний тест' }]} onItems={(x) => { latest = x; }} />);
    expect(screen.getByText('Ученики не видят')).toBeTruthy();

    // Способ выдачи → «Писали на бумаге»
    const select = document.querySelector('.lm-deliver .ant-select-selector');
    fireEvent.mouseDown(select);
    fireEvent.click(await screen.findByText('Писали на бумаге'));
    await waitFor(() => expect(latest[0].deliver).toBe('paper'));
    expect(screen.getByText(/Ученик увидит: «Результаты»/)).toBeTruthy();

    // Бумажная выдача с закрытыми результатами → выключатель «скрыты» → открыть
    await waitFor(() => expect(document.querySelector('.lm-results [role="switch"]')).toBeTruthy());
    const sw = document.querySelector('.lm-results [role="switch"]');
    expect(within(sw).getByText('скрыты')).toBeTruthy();
    fireEvent.click(sw);
    await waitFor(() => expect(mockApi.setSessionsResultsHidden).toHaveBeenCalledWith(['paper1'], false));
  });
});

describe('ученик: карточка урока с разделами и результатами', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T12:00:00'));
    try { localStorage.clear(); } catch { /* нет хранилища */ }
    for (const fn of Object.values(mockApi)) fn.mockReset();
    mockApi.getMyLessons.mockResolvedValue({
      groups: [{ id: 'g1', name: '12У', kind: 'class' }],
      lessons: [{
        id: 'l1', group: 'g1', owner: 't', title: 'Субботний урок', date_plan: '2026-10-10T14:05:00', time_slot: '3',
        status: 'planned',
        items: [
          { kind: 'paper', title: '10 октября 11 кл (субботний тест)', work_id: 'w1', role: 'class', due: 'lesson', required: false },
          { kind: 'paper', title: 'Проверочная', work_id: 'w2', role: 'class', due: 'lesson', required: false },
          { kind: 'work', title: 'Онлайн-тест', session_id: 's1', work_id: 'w3', role: 'class', due: 'lesson', required: true },
          { kind: 'file', title: 'Конспект', file_url: 'https://f', role: 'class', due: 'lesson', required: false },
        ],
      }],
    });
    mockApi.getStudentLessonAttempts.mockResolvedValue([
      att('pa', { ...sess('paper1', 'w1'), score: 15, total: 20 }),
      att('pb', { ...sess('paper2', 'w2', true), score: 3, total: 5 }),
    ]);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('три раздела, балл и «Подробнее», закрытые — «результатов пока нет»', async () => {
    const onOpenAttempt = vi.fn();
    render(<StudentCoursePortal student={{ id: 's1' }} onOpenAttempt={onOpenAttempt} />);
    expect(await screen.findByText('Субботний урок')).toBeTruthy();
    expect(screen.getByText('✅ Обязательно')).toBeTruthy();
    expect(screen.getByText('📎 Материалы')).toBeTruthy();
    expect(screen.getByText('📊 Результаты')).toBeTruthy();
    expect(screen.getByText('Решать')).toBeTruthy();

    await waitFor(() => expect(screen.getByText(/15 из 20/)).toBeTruthy());
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText(/Результатов пока нет/)).toBeTruthy();
    fireEvent.click(screen.getByText('Подробнее'));
    expect(onOpenAttempt).toHaveBeenCalledWith('pa');
  });
});
