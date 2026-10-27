import { describe, it, expect, vi, beforeEach } from 'vitest';

// Список задач (v3.9.411): тема подставляется на клиенте одной записью на
// весь список, а не копией в каждой задаче через expand. Форма — прежняя:
// record.expand.topic — полная запись темы (её читают 17 экранов).
const getFullList = vi.fn();
const getList = vi.fn();
const getFullListByOr = vi.fn();
vi.mock('../shared/services/pb/client.js', () => ({
  pb: { collection: () => ({ getFullList, getList }) },
  _logAudit: vi.fn(),
}));
vi.mock('../shared/services/pb/chunked.js', () => ({ getFullListByOr: (...a) => getFullListByOr(...a) }));

const { tasksApi } = await import('../shared/services/pb/tasks.js');
const api = tasksApi;

const TOPIC = { id: 'tp1', title: 'Планиметрия', ege_number: 1, collectionName: 'topics' };

describe('getTasks / getTasksPage — тема без expand', () => {
  beforeEach(() => { getFullList.mockReset(); getList.mockReset(); getFullListByOr.mockReset(); });

  it('тема одна на весь список, теги и подтемы — как раньше через expand', async () => {
    getFullList.mockResolvedValueOnce([
      { id: 'a', topic: 'tp1', expand: { tags: [{ id: 'g' }] } },
      { id: 'b', topic: 'tp1' },
      { id: 'c', topic: '' },
    ]);
    getFullListByOr.mockResolvedValueOnce([TOPIC]);
    const out = await api.getTasks({ topic: 'tp1' });
    expect(getFullList.mock.calls[0][0].expand).toBe('tags,subtopic');
    expect(getFullListByOr).toHaveBeenCalledTimes(1);
    expect(getFullListByOr.mock.calls[0].slice(0, 3)).toEqual(['topics', 'id', ['tp1']]);
    expect(out[0].expand).toEqual({ tags: [{ id: 'g' }], topic: TOPIC });
    expect(out[1].expand.topic).toBe(TOPIC);
    expect(out[2].expand).toBeUndefined();
  });

  it('страница каталога — та же подстановка', async () => {
    getList.mockResolvedValueOnce({ items: [{ id: 'a', topic: 'tp1' }], totalItems: 1, page: 1 });
    getFullListByOr.mockResolvedValueOnce([TOPIC]);
    const res = await api.getTasksPage({ page: 1, perPage: 20, filters: {} });
    expect(getList.mock.calls[0][2].expand).toBe('tags,subtopic');
    expect(res.items[0].expand.topic).toBe(TOPIC);
    expect(res.totalItems).toBe(1);
  });

  it('темы не загрузились — задачи всё равно отдаются', async () => {
    getFullList.mockResolvedValueOnce([{ id: 'a', topic: 'tp1' }]);
    getFullListByOr.mockRejectedValueOnce(new Error('сеть'));
    const out = await api.getTasks({});
    expect(out.map((r) => r.id)).toEqual(['a']);
  });
});

describe('лёгкие выборки вместо всей темы', () => {
  beforeEach(() => { getFullList.mockReset(); });

  it('коды темы — только поле code', async () => {
    getFullList.mockResolvedValueOnce([{ code: 'П1-001' }, { code: 'П1-002' }]);
    expect(await api.getTaskCodesByTopic('tp1')).toEqual(['П1-001', 'П1-002']);
    const opts = getFullList.mock.calls[0][0];
    expect(opts.fields).toBe('code');
    expect(opts.filter).toContain('topic = "tp1"');
  });

  it('теги задач — только поле tags, без повторов', async () => {
    getFullList.mockResolvedValueOnce([{ tags: ['x', 'y'] }, { tags: ['y'] }, { tags: [] }, { tags: 'z' }]);
    const ids = await api.getTaskTagIds({ topic: 'tp1', subtopic: 's1' });
    expect(ids.sort()).toEqual(['x', 'y', 'z']);
    const opts = getFullList.mock.calls[0][0];
    expect(opts.fields).toBe('tags');
    expect(opts.filter).toContain('subtopic ~ "s1"');
  });
});
