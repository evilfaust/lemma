import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App as AntApp } from 'antd';

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => mockNavigate }));

let created = 0;
const mockApi = vi.hoisted(() => ({
  getGeometryTags: vi.fn(),
  createGeneratedGeometryTasks: vi.fn(),
  createGeometryWork: vi.fn(),
  createMineGeometryTasks: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ canEdit: true }) }));
// Холст с жестами в jsdom не нужен — модалка решения здесь не открывается
vi.mock('../components/stereo/StereoCanvas', () => ({ default: () => <div data-testid="canvas" /> }));

vi.mock('../hooks/useGeometryRefs', () => ({
  useGeometryRefs: () => ({
    topics: [{ id: 'pl', title: 'Планиметрия' }, { id: 'st', title: 'Стереометрия' }],
    subtopics: [{ id: 'ang', title: 'Угол между скрещивающимися прямыми', topic: 'st' }],
    loading: {},
  }),
}));

// eslint-disable-next-line import/first
import SectionGenerator from '../components/geometry/sections/SectionGenerator';

describe('генератор сечений — страница', () => {
  beforeEach(() => {
    created = 0;
    vi.clearAllMocks();
    mockApi.getGeometryTags.mockResolvedValue({
      object: [{ id: 'cube', name: 'Куб' }, { id: 'sec', name: 'Сечение многогранника' }], method: [], fact: [],
    });
    mockApi.createGeneratedGeometryTasks.mockImplementation((recs) => Promise.resolve(recs.map((r) => {
      created += 1;
      return { ...r, id: `t${created}` };
    })));
    mockApi.createGeometryWork.mockResolvedValue({ id: 'w9' });
  });

  it('сетка заданий → работа с вариантами и фасетами', async () => {
    render(<AntApp><MemoryRouter><SectionGenerator /></MemoryRouter></AntApp>);
    fireEvent.click(screen.getByText('Сгенерировать'));
    expect(await screen.findByText('Вариант 2')).toBeInTheDocument();
    expect(screen.getAllByText(/Постройте сечение куба/)).toHaveLength(8); // 4 задачи × 2 варианта
    // Сетка не тянется по длине условия в одну строку (было minWidth: max-content → карточки по 1700 px)
    const grid = screen.getByText('Вариант 2').closest('div');
    expect(grid.style.minWidth).toBe('572px'); // 2 × 280 + 12

    fireEvent.click(screen.getByText('Создать работу'));
    fireEvent.click(await screen.findByText('Создать'));
    await waitFor(() => expect(mockApi.createGeometryWork).toHaveBeenCalled());

    expect(mockApi.createGeneratedGeometryTasks).toHaveBeenCalledTimes(8);
    const rec = mockApi.createGeneratedGeometryTasks.mock.calls[0][0][0];
    expect(rec).toMatchObject({ origin: 'gen', section: 'stereo', tags: ['cube', 'sec'] });
    expect(rec.code).toMatch(/^SEC-/);
    const work = mockApi.createGeometryWork.mock.calls[0][0];
    expect(work.title).toMatch(/^Сечения · куб/);
    expect(work.structure.variants).toHaveLength(2);
    expect(work.structure.variants[0].items).toHaveLength(4);
    expect(work.structure.variants[1].items[0]).toEqual({ task: 't5' });
    expect(mockNavigate).toHaveBeenCalledWith('/app/geometry/works/w9');
  });

  it('несколько типов и тел: позиции чередуются, у метрических — точный ответ и фасеты', async () => {
    mockApi.getGeometryTags.mockResolvedValue({
      object: [{ id: 'cube', name: 'Куб' }, { id: 'skew', name: 'Угол между скрещивающимися прямыми' }],
      method: [{ id: 'coord', name: 'Метод координат в пространстве' }],
      fact: [],
    });
    const { container } = render(<AntApp><MemoryRouter><SectionGenerator /></MemoryRouter></AntApp>);
    // Типы: + «Угол между прямыми»
    fireEvent.mouseDown(container.querySelector('[aria-label="Типы заданий"]').closest('.ant-select').querySelector('.ant-select-selector'));
    fireEvent.click(await screen.findByTitle('Угол между прямыми'));
    // Тела: + пирамида
    fireEvent.mouseDown(container.querySelector('[aria-label="Тела"]').closest('.ant-select').querySelector('.ant-select-selector'));
    fireEvent.click(await screen.findByTitle('Правильная четырёхугольная пирамида'));
    fireEvent.click(screen.getByText('Сгенерировать'));
    expect(await screen.findByText('Вариант 2')).toBeInTheDocument();
    // 4 позиции: сечение/куб, угол/куб, сечение/пирамида, угол/пирамида — по 2 варианта
    expect(screen.getAllByText(/Постройте сечение куба/)).toHaveLength(2);
    expect(screen.getAllByText(/Постройте сечение пирамиды/)).toHaveLength(2);
    expect(screen.getAllByText(/Найдите угол между прямыми/)).toHaveLength(4);

    fireEvent.click(screen.getByText('Создать работу'));
    fireEvent.click(await screen.findByText('Создать'));
    await waitFor(() => expect(mockApi.createGeometryWork).toHaveBeenCalled());
    const recs = mockApi.createGeneratedGeometryTasks.mock.calls.map((c) => c[0][0]);
    const angle = recs.find((r) => r.code.startsWith('ANG-'));
    expect(angle.title).toMatch(/^Угол между прямыми: куб/);
    expect(angle.tags).toEqual(expect.arrayContaining(['cube', 'skew']));
    expect(mockApi.createGeometryWork.mock.calls[0][0].title).toMatch(/^Стереометрия · /);
  });

  it('первая часть ЕГЭ: типы по номерам экзамена, тело выбирать не нужно', async () => {
    render(<AntApp><MemoryRouter><SectionGenerator /></MemoryRouter></AntApp>);
    fireEvent.click(screen.getByText('Первая часть ЕГЭ (база №11, №13, профиль №3)'));
    expect(screen.queryByLabelText('Тела')).toBeNull();
    expect(screen.queryByText('Сложность')).toBeNull();
    // кнопка «весь номер» — все типы базы №11
    fireEvent.click(screen.getByText('Весь база №11'));
    fireEvent.click(screen.getByText('Сгенерировать'));
    expect(await screen.findByText('Вариант 2')).toBeInTheDocument();
    // карточки подписаны номером и группой: Б11 · …
    expect(screen.getAllByText(/^Б11 · /).length).toBe(8);
    fireEvent.click(screen.getByText('Создать работу'));
    fireEvent.click(await screen.findByText('Создать'));
    await waitFor(() => expect(mockApi.createGeometryWork).toHaveBeenCalled());
    const rec = mockApi.createGeneratedGeometryTasks.mock.calls[0][0][0];
    expect(rec.code).toMatch(/^B11-/);
    expect(mockApi.createGeometryWork.mock.calls[0][0].title).toMatch(/^Стереометрия, первая часть \(Б11\)/);
  });

  it('«В мои»: удачная задача сохраняется своей, в работу идёт она же — без второй копии', async () => {
    mockApi.createMineGeometryTasks.mockImplementation((recs, opts) => Promise.resolve(recs.map((r, i) => ({
      ...r, ...opts, origin: 'manual', id: `m${i + 1}`, code: `GEO-${500 + i}`,
    }))));
    render(<AntApp><MemoryRouter><SectionGenerator /></MemoryRouter></AntApp>);
    fireEvent.click(screen.getByText('Сгенерировать'));
    expect(await screen.findByText('Вариант 2')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('В мои')[0]); // №1, вариант 1
    expect(await screen.findByText('В мои задачи')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Сохранить в мои'));
    await waitFor(() => expect(mockApi.createMineGeometryTasks).toHaveBeenCalledTimes(1));
    const [recs, opts] = mockApi.createMineGeometryTasks.mock.calls[0];
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ section: 'stereo', tags: ['cube', 'sec'] });
    expect(opts).toEqual({ topic: 'st', subtopic: null }); // тема «Стереометрия» по умолчанию
    expect(await screen.findByText('GEO-500')).toBeInTheDocument();
    expect(screen.getByText('Все в мои (7)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Создать работу'));
    fireEvent.click(await screen.findByText('Создать'));
    await waitFor(() => expect(mockApi.createGeometryWork).toHaveBeenCalled());
    expect(mockApi.createGeneratedGeometryTasks).toHaveBeenCalledTimes(7);
    const work = mockApi.createGeometryWork.mock.calls[0][0];
    expect(work.structure.variants[0].items[0]).toEqual({ task: 'm1' });
  });
});
