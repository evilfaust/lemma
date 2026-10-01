import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { App as AntApp } from 'antd';

const mockApi = vi.hoisted(() => ({
  getGeometryWork: vi.fn(),
  getGeometryTasksByIds: vi.fn(),
  getGeometryTags: vi.fn(() => Promise.resolve({ object: [], method: [], fact: [] })),
  updateGeometryWork: vi.fn(() => Promise.resolve({})),
  getGeometryImageUrl: vi.fn(() => ''),
  getSimilarGeometryTasks: vi.fn(),
  getGeometryTask: vi.fn(),
  getLessonsByMaterialId: vi.fn(() => Promise.resolve([])),
  getGeometryTasks: vi.fn(() => Promise.resolve([])),
  getGeometryTopics: vi.fn(() => Promise.resolve([])),
  getGeometrySubtopics: vi.fn(() => Promise.resolve([])),
  getNextGeometryCode: vi.fn(() => Promise.resolve('GEO-999')),
}));
// Редактор задачи тянет апплет GeoGebra — в тестах не нужен
vi.mock('../components/GeoGebraApplet', () => ({ default: () => <div data-testid="ggb" /> }));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ canEdit: true, canDelete: true }) }));

// eslint-disable-next-line import/first
import GeometryWorkEditor from '../components/geometry/works/GeometryWorkEditor';
// eslint-disable-next-line import/first
import { geometryBasket } from '../utils/geometryBasket';

const TASKS = [
  { id: 'a', code: 'GEO-001', statement_md: 'Сечение куба', answer: '', section: 'stereo' },
  { id: 'b', code: 'GEO-002', statement_md: 'Угол в призме', answer: '30', section: 'stereo' },
  { id: 'b2', code: 'MCCME-00009', origin: 'mccme', statement_md: 'Угол в пирамиде', answer: '45', section: 'stereo' },
];

function renderEditor() {
  return render(
    <AntApp>
      <MemoryRouter initialEntries={['/app/geometry/works/w1']}>
        <Routes>
          <Route path="/app/geometry/works/:workId" element={<GeometryWorkEditor />} />
        </Routes>
      </MemoryRouter>
    </AntApp>,
  );
}

describe('редактор геометрической работы', () => {
  beforeEach(() => {
    localStorage.clear();
    geometryBasket._reload();
    Object.values(mockApi).forEach((f) => f.mockClear?.());
    mockApi.getGeometryWork.mockResolvedValue({
      id: 'w1',
      title: 'Контрольная',
      class: 10,
      structure: { variants: [{ items: [{ task: 'a' }, { task: 'b' }] }, { items: [null, { task: 'b2' }] }] },
    });
    mockApi.getGeometryTasksByIds.mockImplementation((ids) => Promise.resolve(TASKS.filter((t) => ids.includes(t.id))));
  });

  it('сетка позиций × вариантов: задачи, пустая ячейка, счётчики', async () => {
    renderEditor();
    expect(await screen.findByText('GEO-001')).toBeInTheDocument();
    expect(screen.getByText('MCCME-00009')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Контрольная')).toBeInTheDocument();
    expect(screen.getByText('Вариант 2')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument(); // во втором варианте одна из двух
    expect(screen.getByText('Подобрать')).toBeInTheDocument(); // у пустой ячейки есть образец
    expect(screen.getByText('Заполнить пустые (1)')).toBeInTheDocument();
    expect(screen.getByText('Сохранено').closest('button')).toBeDisabled();
  });

  it('правка → «Сохранить» пишет структуру работы', async () => {
    renderEditor();
    await screen.findByText('MCCME-00009');
    const cell = screen.getByText('MCCME-00009').closest('.gw-cell');
    fireEvent.click(within(cell).getAllByRole('button')[1]); // «Убрать из варианта»
    const saveBtn = screen.getByText('Сохранить').closest('button');
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);
    await waitFor(() => expect(mockApi.updateGeometryWork).toHaveBeenCalled());
    const [id, data] = mockApi.updateGeometryWork.mock.calls[0];
    expect(id).toBe('w1');
    expect(data.title).toBe('Контрольная');
    expect(data.class).toBe(10);
    expect(data.structure.variants[1].items).toEqual([null, null]);
  });

  it('позиции из подборки — в выбранный вариант, подборка пустеет', async () => {
    geometryBasket.add([{ id: 'c', code: 'GEO-003' }]);
    mockApi.getGeometryTasksByIds.mockImplementation((ids) => Promise.resolve(
      [...TASKS, { id: 'c', code: 'GEO-003', statement_md: 'Расстояние' }].filter((t) => ids.includes(t.id)),
    ));
    renderEditor();
    await screen.findByText('GEO-001');
    fireEvent.click(screen.getByText('Позиции из подборки (1)'));
    expect(await screen.findByText('Расстояние')).toBeInTheDocument();
    expect(geometryBasket.getSnapshot()).toEqual([]);
    expect(screen.getByText(/Позиций: 3/)).toBeInTheDocument();
  });
});

describe('редактор работы: добавить задачи и править их', () => {
  beforeEach(() => {
    localStorage.clear();
    geometryBasket._reload();
    Object.values(mockApi).forEach((f) => f.mockClear?.());
    mockApi.getGeometryWork.mockResolvedValue({
      id: 'w1', title: 'Контрольная', structure: { variants: [{ items: [{ task: 'a' }] }] },
    });
    mockApi.getGeometryTasksByIds.mockImplementation((ids) => Promise.resolve(TASKS.filter((t) => ids.includes(t.id))));
  });

  it('«Добавить задачи → Из банка»: отмеченные — новыми позициями, взятые — недоступны', async () => {
    mockApi.getGeometryTasks.mockResolvedValue([
      { id: 'a', code: 'GEO-001', statement_md: 'Сечение куба' },
      { id: 'z', code: 'GEO-077', statement_md: 'Угол между прямыми' },
    ]);
    renderEditor();
    await screen.findByText('GEO-001');
    fireEvent.mouseOver(screen.getByText('Добавить задачи'));
    fireEvent.click(await screen.findByText('Из банка задач…'));
    expect(await screen.findByText('GEO-077')).toBeInTheDocument();
    expect(screen.getByText('уже в работе')).toBeInTheDocument();
    fireEvent.click(screen.getByText('GEO-077'));
    fireEvent.click(screen.getByText('Добавить (1)'));
    expect(await screen.findByText(/Позиций: 2/)).toBeInTheDocument();
    expect(screen.getByText('Сохранить').closest('button')).not.toBeDisabled();
  });

  it('«Редактировать» в карточке задачи открывает редактор задачи поверх работы', async () => {
    mockApi.getGeometryTask.mockResolvedValue({ ...TASKS[0], tags: [] });
    renderEditor();
    await screen.findByText('Сечение куба');
    // Ячейка перерисовывается (KaTeX, догрузка справочников) — кликаем по свежему узлу
    await waitFor(() => expect(document.querySelector('.gw-cell-body')).toBeTruthy());
    fireEvent.click(document.querySelector('.gw-cell-body'));
    fireEvent.click(await screen.findByText('Редактировать'));
    expect(await screen.findByText('Назад к работе')).toBeInTheDocument();
    expect(screen.getByText('Редактирование: GEO-001')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Назад к работе'));
    expect(await screen.findByText(/Позиций: 1/)).toBeInTheDocument();
  });
});
