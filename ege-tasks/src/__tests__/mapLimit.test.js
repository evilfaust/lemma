import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapLimit } from '../shared/utils/mapLimit.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

describe('mapLimit', () => {
  it('результаты в порядке входа, даже если быстрые закончили раньше', async () => {
    const { results, errors } = await mapLimit([30, 5, 20, 1], 2, async (ms, i) => {
      await delay(ms);
      return `#${i}`;
    });
    expect(results).toEqual(['#0', '#1', '#2', '#3']);
    expect(errors).toEqual([]);
  });

  it('в полёте не больше limit вызовов', async () => {
    let now = 0;
    let peak = 0;
    await mapLimit(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      now++;
      peak = Math.max(peak, now);
      await delay(2);
      now--;
    });
    expect(peak).toBe(3);
  });

  it('ошибка не прерывает остальные и отдаётся с индексом', async () => {
    const { results, errors } = await mapLimit(['a', 'b', 'c'], 2, async (x) => {
      if (x === 'b') throw new Error('сбой');
      return x.toUpperCase();
    });
    expect(results).toEqual(['A', undefined, 'C']);
    expect(errors).toHaveLength(1);
    expect(errors[0].index).toBe(1);
    expect(errors[0].item).toBe('b');
  });

  it('пустой список — ни одного вызова', async () => {
    const fn = vi.fn();
    const { results } = await mapLimit([], 4, fn);
    expect(results).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});

// getFullListPaged: склеивает страницы в порядке, не теряя ни одной.
const getList = vi.fn();
vi.mock('../shared/services/pb/client.js', () => ({
  pb: { collection: () => ({ getList }) },
}));

describe('getFullListPaged', () => {
  beforeEach(() => getList.mockReset());

  it('одна страница — один запрос', async () => {
    const { getFullListPaged } = await import('../shared/services/pb/chunked.js');
    getList.mockResolvedValueOnce({ items: [{ id: 'a' }], totalPages: 1 });
    expect(await getFullListPaged('tasks', { fields: 'id' })).toEqual([{ id: 'a' }]);
    expect(getList).toHaveBeenCalledTimes(1);
  });

  it('все страницы по порядку, без автоотмены и без повторного подсчёта', async () => {
    const { getFullListPaged } = await import('../shared/services/pb/chunked.js');
    getList.mockImplementation(async (page) => {
      await delay(page === 2 ? 15 : 1); // вторая отвечает последней
      return { items: [{ id: `p${page}` }], totalPages: 4 };
    });
    const out = await getFullListPaged('tasks', { filter: 'x' }, { perPage: 1, concurrency: 2 });
    expect(out.map((r) => r.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(getList).toHaveBeenCalledTimes(4);
    for (const [, , opts] of getList.mock.calls) {
      expect(opts.requestKey).toBeNull();
      expect(opts.filter).toBe('x');
    }
    expect(getList.mock.calls[0][2].skipTotal).toBeUndefined();
    expect(getList.mock.calls[1][2].skipTotal).toBe(true);
  });

  it('сбой любой страницы — ошибка, а не обрезанный список', async () => {
    const { getFullListPaged } = await import('../shared/services/pb/chunked.js');
    getList.mockImplementation(async (page) => {
      if (page === 3) throw new Error('500');
      return { items: [{ id: `p${page}` }], totalPages: 3 };
    });
    await expect(getFullListPaged('tasks', {}, { perPage: 1 })).rejects.toThrow('500');
  });
});
