import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lessonsApi } from '../shared/services/pb/lessons';

const mock = vi.hoisted(() => ({
  list: vi.fn(), update: vi.fn(), audit: vi.fn(), scope: vi.fn(filter => `scope && (${filter})`),
}));
vi.mock('../shared/services/pb/client.js', () => ({
  pb: { collection: () => ({ getFullList: mock.list, update: mock.update }) },
  _logAudit: mock.audit, andOwner: x => x, andMineOrCoTaught: mock.scope, currentTeacher: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mock.list.mockResolvedValue([]);
  mock.update.mockResolvedValue({ id: 'l1', title: 'Урок' });
});

describe('API привязки материалов урока', () => {
  it('находит и работу, и старые ссылки на её выдачи в доступных уроках календаря', async () => {
    const api = { ...lessonsApi, getSessionsByWork: vi.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }]) };
    await api.getLessonsByMaterialId('w1', 'work');
    expect(api.getSessionsByWork).toHaveBeenCalledWith('w1');
    expect(mock.scope).toHaveBeenCalledWith('(materials ~ "w1" || materials ~ "s1" || materials ~ "s2")', { shareField: 'shared_with' });
    expect(mock.list).toHaveBeenCalledWith(expect.objectContaining({ filter: expect.stringContaining('scope &&'), expand: 'group' }));
  });

  it('для теста ищет именно выдачи теста', async () => {
    const api = { ...lessonsApi, getSessionsByMCTest: vi.fn().mockResolvedValue([{ id: 'test-session' }]) };
    await api.getLessonsByMaterialId('t1', 'mc_test');
    expect(api.getSessionsByMCTest).toHaveBeenCalledWith('t1');
    expect(mock.scope).toHaveBeenCalledWith('(materials ~ "t1" || materials ~ "test-session")', { shareField: 'shared_with' });
  });

  it('сохраняет прежний вызов для файлов и геометрии без поиска выдач', async () => {
    await lessonsApi.getLessonsByMaterialId('file1');
    expect(mock.scope).toHaveBeenCalledWith('(materials ~ "file1")', { shareField: 'shared_with' });
  });

  it('изменение материалов пишет аудит и не меняет владельца урока', async () => {
    await lessonsApi.updateLesson('l1', { owner: 'other', materials: [] });
    expect(mock.update).toHaveBeenCalledWith('l1', { materials: [] });
    expect(mock.audit).toHaveBeenCalledWith('update', 'lessons', 'l1', 'Материалы урока: Урок');
  });
});
