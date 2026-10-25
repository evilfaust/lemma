import { describe, it, expect, vi, beforeEach } from 'vitest';

// Снимок банка задач (аудит 25.10.2026): хук /api/tasks/snapshot одним запросом,
// при сбое — постраничная загрузка. Записи обязаны выглядеть как у REST.
const send = vi.fn();
const getList = vi.fn();
vi.mock('../shared/services/pb/client.js', () => ({
  pb: { send, collection: () => ({ getList }) },
  _logAudit: vi.fn(),
  withOwner: (d) => d,
  andOwner: (f) => f,
}));

const { rowsToRecords, catalogApi } = await import('../shared/services/pb/catalog.js');
const api = catalogApi;

const SNAP = {
  fields: ['id', 'topic', 'subtopic', 'tags', 'difficulty', 'has_image', 'source', 'year'],
  rows: [
    ['t1', 'top1', ['s1'], [], 2, 1, 'РЕШУ', 2026],
    ['t2', 'top2', [], ['g1', 'g2'], 1, 0, '', 0],
  ],
};

describe('rowsToRecords', () => {
  it('строки → объекты, has_image булево', () => {
    expect(rowsToRecords(SNAP)).toEqual([
      { id: 't1', topic: 'top1', subtopic: ['s1'], tags: [], difficulty: 2, has_image: true, source: 'РЕШУ', year: 2026 },
      { id: 't2', topic: 'top2', subtopic: [], tags: ['g1', 'g2'], difficulty: 1, has_image: false, source: '', year: 0 },
    ]);
  });

  it('чужая форма ответа → null (грузим по-старому)', () => {
    expect(rowsToRecords(null)).toBeNull();
    expect(rowsToRecords({ items: [] })).toBeNull();
    expect(rowsToRecords({ fields: ['topic'], rows: [] })).toBeNull();
  });
});

describe('getTasksStatsSnapshot', () => {
  beforeEach(() => { send.mockReset(); getList.mockReset(); });

  it('берёт снимок из хука одним запросом', async () => {
    send.mockResolvedValueOnce(SNAP);
    const out = await api.getTasksStatsSnapshot();
    expect(out.map((r) => r.id)).toEqual(['t1', 't2']);
    expect(send).toHaveBeenCalledWith('/api/tasks/snapshot', expect.objectContaining({ method: 'GET', requestKey: null }));
    expect(getList).not.toHaveBeenCalled();
  });

  it('хука нет (404) — грузит страницами с тем же фильтром', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }));
    getList.mockResolvedValueOnce({ items: [{ id: 'p1' }], totalPages: 1 });
    const out = await api.getTasksStatsSnapshot();
    expect(out).toEqual([{ id: 'p1' }]);
    expect(getList.mock.calls[0][2].filter).toBe('source != "trig_generator"');
  });
});
