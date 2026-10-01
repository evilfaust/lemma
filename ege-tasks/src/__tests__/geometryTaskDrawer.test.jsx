import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Карточка зовёт useNavigate («В стереоредактор») — нужен роутер
const render = (ui, opts) => {
  const r = rtlRender(<MemoryRouter>{ui}</MemoryRouter>, opts);
  return { ...r, rerender: (next) => r.rerender(<MemoryRouter>{next}</MemoryRouter>) };
};

const mockApi = vi.hoisted(() => ({
  getGeometryTask: vi.fn(),
  getGeometryImageUrl: vi.fn(() => ''),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));
// «Похожие» ходят в сеть — в карточке они свёрнуты, но модуль подменим.
vi.mock('../components/geometry/SimilarGeometryPanel', () => ({ default: () => <div data-testid="similar" /> }));

// eslint-disable-next-line import/first
import GeometryTaskDrawer from '../components/geometry/GeometryTaskDrawer';

const TASKS = {
  a: {
    id: 'a', code: 'GEO-101', origin: 'manual', section: 'stereo', difficulty: 2,
    statement_md: 'В кубе $ABCDA_1B_1C_1D_1$ постройте сечение', answer: '12',
    hints: [{ order: 1, text_md: 'Продлите $MN$' }], tags: ['t1'],
  },
  b: {
    id: 'b', code: 'MCCME-00007', origin: 'mccme', section: 'planim',
    statement_md: 'Хорды пересекаются', answer: '', solution_md: 'Решение банка', tags: [],
  },
};
const geoTags = { object: [{ id: 't1', name: 'Куб' }], method: [], fact: [] };

function setup(props = {}) {
  const onOpen = vi.fn();
  const handlers = {
    onClose: vi.fn(), onFacet: vi.fn(), onEdit: vi.fn(), onDuplicate: vi.fn(), onTakeToMine: vi.fn(),
  };
  const utils = render(
    <GeometryTaskDrawer
      taskId="a"
      listIds={['a', 'b']}
      geoTags={geoTags}
      onOpen={onOpen}
      canEdit
      {...handlers}
      {...props}
    />,
  );
  return { ...utils, onOpen, ...handlers };
}

describe('карточка геометрической задачи', () => {
  beforeEach(() => {
    mockApi.getGeometryTask.mockReset();
    mockApi.getGeometryTask.mockImplementation((id) => Promise.resolve(TASKS[id]));
  });

  it('показывает условие, ответ, раздел и фасеты', async () => {
    const { onFacet } = setup();
    expect(await screen.findByText('GEO-101')).toBeInTheDocument();
    expect(screen.getByText('Стереометрия')).toBeInTheDocument();
    expect(screen.getByText('Моя')).toBeInTheDocument();
    expect(screen.getByText('Указания (1)')).toBeInTheDocument();
    expect(screen.getByText('1 из 2')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Куб'));
    expect(onFacet).toHaveBeenCalledWith('object', 't1');
  });

  it('стрелка → листает список', async () => {
    const { onOpen } = setup();
    await screen.findByText('GEO-101');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onOpen).toHaveBeenCalledWith('b', ['a', 'b']);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onOpen).toHaveBeenCalledTimes(1); // первая — назад некуда
  });

  it('у своей задачи — «Дублировать», у задачи МЦНМО — «Взять к себе»', async () => {
    const { onDuplicate, rerender } = setup();
    await screen.findByText('GEO-101');
    fireEvent.click(screen.getByText('Дублировать'));
    expect(onDuplicate).toHaveBeenCalledWith(TASKS.a);
    expect(screen.queryByText('Взять к себе')).toBeNull();

    const onTakeToMine = vi.fn();
    rerender(
      <GeometryTaskDrawer taskId="b" listIds={[]} geoTags={geoTags} onOpen={vi.fn()} onClose={vi.fn()}
        canEdit onEdit={vi.fn()} onDuplicate={vi.fn()} onTakeToMine={onTakeToMine} />,
    );
    await screen.findByText('MCCME-00007');
    expect(screen.getByText('МЦНМО')).toBeInTheDocument();
    expect(screen.queryByText('1 из 2')).toBeNull(); // не из списка — стрелок нет
    fireEvent.click(screen.getByText('Взять к себе'));
    await waitFor(() => expect(onTakeToMine).toHaveBeenCalledWith(TASKS.b));
  });

  it('без прав на правку — без кнопок действий', async () => {
    setup({ canEdit: false });
    await screen.findByText('GEO-101');
    expect(screen.queryByText('Редактировать')).toBeNull();
  });
});
