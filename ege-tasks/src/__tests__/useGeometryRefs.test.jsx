import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockApi = vi.hoisted(() => ({
  getGeometryTopics: vi.fn(),
  getGeometrySubtopics: vi.fn(),
  getGeometryTags: vi.fn(),
  getGeometrySources: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

// eslint-disable-next-line import/first
import { useGeometryRefs, reloadGeometryRefs, _resetGeometryRefs } from '../hooks/useGeometryRefs';

const TOPICS = [{ id: 't1', title: 'Стереометрия' }];

describe('справочники раздела «Геометрия» — общий кэш', () => {
  beforeEach(() => {
    _resetGeometryRefs();
    Object.values(mockApi).forEach((f) => f.mockReset());
    mockApi.getGeometryTopics.mockResolvedValue(TOPICS);
    mockApi.getGeometrySubtopics.mockResolvedValue([{ id: 's1', topic: 't1', title: 'Сечения' }]);
    mockApi.getGeometryTags.mockResolvedValue({ object: [{ id: 'g', name: 'Куб' }], method: [], fact: [] });
    mockApi.getGeometrySources.mockResolvedValue(['Атанасян']);
  });

  it('два экрана сразу — один запрос на справочник', async () => {
    const a = renderHook(() => useGeometryRefs());
    const b = renderHook(() => useGeometryRefs(['topics']));
    await waitFor(() => expect(b.result.current.topics).toEqual(TOPICS));
    await waitFor(() => expect(a.result.current.sources).toEqual(['Атанасян']));
    expect(mockApi.getGeometryTopics).toHaveBeenCalledTimes(1);
    expect(mockApi.getGeometryTags).toHaveBeenCalledTimes(1);
    // третий экран позже — из кэша, без запроса
    const c = renderHook(() => useGeometryRefs(['topics']));
    expect(c.result.current.topics).toEqual(TOPICS);
    expect(mockApi.getGeometryTopics).toHaveBeenCalledTimes(1);
  });

  it('справочники независимы: сбой фасетов не оставляет пустыми темы', async () => {
    mockApi.getGeometryTags.mockRejectedValue(new Error('сбой'));
    let release;
    mockApi.getGeometrySources.mockReturnValue(new Promise((r) => { release = r; })); // медленные источники
    const { result } = renderHook(() => useGeometryRefs());
    await waitFor(() => expect(result.current.topics).toEqual(TOPICS));
    expect(result.current.subtopics).toHaveLength(1);
    expect(result.current.loading.sources).toBe(true); // источники ещё грузятся — темы их не ждут
    await waitFor(() => expect(result.current.loading.tags).toBe(false));
    expect(result.current.tags.object).toEqual([]);
    await act(async () => { release(['МЦНМО']); });
    expect(result.current.sources).toEqual(['МЦНМО']);
  });

  it('пустой ответ (сбой API) не кэшируется — следующий экран спросит снова', async () => {
    mockApi.getGeometryTopics.mockResolvedValueOnce([]);
    const a = renderHook(() => useGeometryRefs(['topics']));
    await waitFor(() => expect(a.result.current.loading.topics).toBe(false));
    expect(a.result.current.topics).toEqual([]);
    const b = renderHook(() => useGeometryRefs(['topics']));
    await waitFor(() => expect(b.result.current.topics).toEqual(TOPICS));
    expect(mockApi.getGeometryTopics).toHaveBeenCalledTimes(2);
  });

  it('reload перечитывает после правки справочника', async () => {
    const { result } = renderHook(() => useGeometryRefs(['topics']));
    await waitFor(() => expect(result.current.topics).toEqual(TOPICS));
    mockApi.getGeometryTopics.mockResolvedValue([...TOPICS, { id: 't2', title: 'Планиметрия' }]);
    await act(() => reloadGeometryRefs(['topics']));
    expect(result.current.topics).toHaveLength(2);
  });
});
