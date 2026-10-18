import { readFileSync } from 'fs';
import { resolve } from 'path';
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
  adoptGeneratedGeometryTasks: vi.fn(),
}));
// Редактор задачи тянет апплет GeoGebra — в тестах не нужен
vi.mock('../components/GeoGebraApplet', () => ({ default: () => <div data-testid="ggb" /> }));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ canEdit: true, canDelete: true }),
  useOptionalAuth: () => ({ canEdit: true, canDelete: true }),
}));

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
    // Ширина сетки — от колонок, не от условия в одну строку (было min-width: max-content)
    const grid = document.querySelector('.gw-grid');
    expect(grid.style.minWidth).toBe(`${56 + 2 * 240 + 36 + 8 * 3}px`);
    const css = readFileSync(resolve(__dirname, '../components/geometry/works/geometryWorks.css'), 'utf8');
    expect(css).not.toMatch(/\.gw-grid\s*\{[^}]*min-width:\s*max-content/);
  });

  it('правка → «Сохранить» пишет структуру работы', async () => {
    renderEditor();
    await screen.findByText('MCCME-00009');
    const cell = screen.getByText('MCCME-00009').closest('.gw-cell');
    fireEvent.click(within(cell).getByLabelText('Убрать из варианта'));
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

  it('«Печать → Лист задач»: оба варианта листом Генератора, класс — в шапке', async () => {
    renderEditor();
    await screen.findByText('GEO-001');
    fireEvent.mouseOver(screen.getByText('Печать'));
    fireEvent.click(await screen.findByText('Лист задач (оформление Генератора)'));
    expect(await screen.findByText('Оформление')).toBeInTheDocument();
    await waitFor(() => expect(document.querySelectorAll('.ps-page').length).toBeGreaterThan(0));
    const pages = [...document.querySelectorAll('.ps-page')].map((p) => p.textContent).join(' ');
    expect(pages).toMatch(/Контрольная/);
    expect(pages).toMatch(/Сечение куба/);
    expect(pages).toMatch(/Угол в пирамиде/); // второй вариант
    expect(screen.getByDisplayValue('10 класс')).toBeInTheDocument();
    expect(screen.queryByText('Шифровка по ответам')).toBeNull();
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

  it('задачи генератора в работе → «Мои» на месте: работа не меняется, коды обновляются', async () => {
    const GEN = [
      { id: 'g1', code: 'ANG-YO5M4-2', origin: 'gen', statement_md: 'Угол в кубе', answer: '60', section: 'stereo' },
      { id: 'g2', code: 'ANG-YO5M4-4', origin: 'gen', statement_md: 'Ещё угол', answer: '45', section: 'stereo' },
    ];
    mockApi.getGeometryWork.mockResolvedValue({
      id: 'w1', title: 'Из генератора', structure: { variants: [{ items: [{ task: 'g1' }, { task: 'g2' }, { task: 'a' }] }] },
    });
    mockApi.getGeometryTasksByIds.mockImplementation((ids) => Promise.resolve([...GEN, ...TASKS].filter((t) => ids.includes(t.id))));
    mockApi.adoptGeneratedGeometryTasks.mockImplementation((ids) => Promise.resolve(ids.map((id, i) => ({
      ...GEN.find((t) => t.id === id), origin: 'manual', code: `GEO-${600 + i}`,
    }))));
    renderEditor();
    expect(await screen.findByText('ANG-YO5M4-2')).toBeInTheDocument();
    expect(screen.getAllByText('Генератор')).toHaveLength(2);

    fireEvent.click(screen.getByText('Задачи генератора → в мои (2)'));
    fireEvent.click(await screen.findByText('Сохранить в мои'));
    await waitFor(() => expect(mockApi.adoptGeneratedGeometryTasks).toHaveBeenCalledWith(['g1', 'g2'], { topic: null, subtopic: null }));
    expect(await screen.findByText('GEO-600')).toBeInTheDocument();
    expect(screen.getByText('GEO-601')).toBeInTheDocument();
    expect(screen.queryByText(/Задачи генератора → в мои/)).toBeNull();
    // Состав работы тот же — сохранять нечего
    expect(screen.getByText('Сохранено').closest('button')).toBeDisabled();
    expect(mockApi.updateGeometryWork).not.toHaveBeenCalled();
  });

  it('перенос между вариантами: стрелка, перетаскивание и «Разложить по вариантам»', async () => {
    const LIST = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, code: `GEO-10${i}`, statement_md: `Задача ${id}`, answer: '1', section: 'stereo' }));
    mockApi.getGeometryWork.mockResolvedValue({
      id: 'w1', title: 'Список', structure: { variants: [{ items: LIST.map((t) => ({ task: t.id })) }, { items: [] }] },
    });
    mockApi.getGeometryTasksByIds.mockImplementation((ids) => Promise.resolve(LIST.filter((t) => ids.includes(t.id))));
    renderEditor();
    expect(await screen.findByText('GEO-103')).toBeInTheDocument();
    const cellOf = (code) => screen.getByText(code).closest('.gw-cell');
    const rowsText = () => [...document.querySelectorAll('.gw-grid > .gw-cell')].map((el) => (el.classList.contains('gw-cell--empty') ? '·' : el.querySelector('code')?.textContent));

    // Стрелка «в вариант 2»: GEO-103 → первая свободная ячейка варианта 2, позиция 4 исчезает
    fireEvent.click(within(cellOf('GEO-103')).getByLabelText('В вариант 2'));
    expect(rowsText()).toEqual(['GEO-100', 'GEO-103', 'GEO-101', '·', 'GEO-102', '·']);
    expect(screen.getByText('Сохранить').closest('button')).not.toBeDisabled();

    // Перетаскивание GEO-102 на пустую ячейку позиции 2 варианта 2
    const dt = { setData: () => {}, effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(cellOf('GEO-102'), { dataTransfer: dt });
    const target = document.querySelectorAll('.gw-grid > .gw-cell')[3];
    fireEvent.dragOver(target, { dataTransfer: dt });
    expect(target.classList.contains('gw-cell--drop')).toBe(true);
    fireEvent.drop(target, { dataTransfer: dt });
    expect(rowsText()).toEqual(['GEO-100', 'GEO-103', 'GEO-101', 'GEO-102']);

    // Перетаскивание на занятую — обмен местами
    fireEvent.dragStart(cellOf('GEO-100'), { dataTransfer: dt });
    fireEvent.dragOver(cellOf('GEO-102'), { dataTransfer: dt });
    fireEvent.drop(cellOf('GEO-102'), { dataTransfer: dt });
    expect(rowsText()).toEqual(['GEO-102', 'GEO-103', 'GEO-101', 'GEO-100']);
    // Параллели уже есть — раскладывать нечего
    expect(screen.queryByText('Разложить по вариантам')).toBeNull();
  });

  it('«Разложить по вариантам» по очереди: список одного варианта → пары позиций', async () => {
    const LIST = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, code: `GEO-10${i}`, statement_md: `Задача ${id}`, answer: '1', section: 'stereo' }));
    mockApi.getGeometryWork.mockResolvedValue({
      id: 'w1', title: 'Список', structure: { variants: [{ items: LIST.map((t) => ({ task: t.id })) }, { items: [] }] },
    });
    mockApi.getGeometryTasksByIds.mockImplementation((ids) => Promise.resolve(LIST.filter((t) => ids.includes(t.id))));
    renderEditor();
    expect(await screen.findByText('GEO-103')).toBeInTheDocument();
    fireEvent.mouseOver(screen.getByText('Разложить по вариантам'));
    fireEvent.click(await screen.findByText(/^По очереди/));
    const rowsText = [...document.querySelectorAll('.gw-grid > .gw-cell')].map((el) => el.querySelector('code')?.textContent || '·');
    expect(rowsText).toEqual(['GEO-100', 'GEO-101', 'GEO-102', 'GEO-103']);
    expect(screen.getByText('Позиций: 2 · вариантов: 2')).toBeInTheDocument();
  });
});
