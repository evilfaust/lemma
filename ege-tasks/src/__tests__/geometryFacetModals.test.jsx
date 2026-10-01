import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';

const mockApi = vi.hoisted(() => ({
  getGeometryFacetNeighbors: vi.fn(),
  updateGeometryTask: vi.fn(() => Promise.resolve({})),
  updateGeometryTasksTags: vi.fn(() => Promise.resolve({ ok: 2, failed: 0 })),
  getGeometryImageUrl: vi.fn(() => ''),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

// eslint-disable-next-line import/first
import { FacetReviewModal } from '../components/geometry/FacetModals';

const geoTags = {
  object: [{ id: 'cube', name: 'Куб' }, { id: 'sec', name: 'Сечение многогранника' }],
  method: [{ id: 'tr', name: 'Метод следов' }],
  fact: [],
  named: [{ id: 'nm', name: 'Задача Эйлера' }],
};
const tasks = [
  { id: 't1', code: 'GEO-101', statement_md: 'Постройте сечение куба', tags: ['nm'] },
  { id: 't2', code: 'GEO-102', statement_md: 'Найдите угол', tags: [] },
];

describe('разметка фасетами по очереди', () => {
  beforeEach(() => {
    Object.values(mockApi).forEach((f) => f.mockClear());
    mockApi.getGeometryFacetNeighbors.mockResolvedValue([
      { pct: 90, tags: ['cube', 'sec', 'tr'] },
      { pct: 80, tags: ['cube', 'sec'] },
      { pct: 50, tags: ['sec'] },
    ]);
  });

  it('уверенные подсказки → сохранить; чужие теги задачи сохраняются; дальше следующая', async () => {
    const onSaved = vi.fn();
    render(
      <AntApp>
        <FacetReviewModal open tasks={tasks} geoTags={geoTags} onClose={vi.fn()} onSaved={onSaved} />
      </AntApp>,
    );
    expect(screen.getByText('GEO-101')).toBeInTheDocument();
    fireEvent.click(await screen.findByText('Добавить уверенные (2)'));
    fireEvent.click(screen.getByText('Сохранить и дальше'));
    await waitFor(() => expect(mockApi.updateGeometryTask).toHaveBeenCalled());
    const [id, data] = mockApi.updateGeometryTask.mock.calls[0];
    expect(id).toBe('t1');
    expect(data.tags.sort()).toEqual(['cube', 'nm', 'sec']);
    expect(onSaved).toHaveBeenCalledWith('t1', expect.any(Array));
    expect(await screen.findByText('GEO-102')).toBeInTheDocument();
    expect(screen.getByText(/сохранено 1/)).toBeInTheDocument();
  });
});
