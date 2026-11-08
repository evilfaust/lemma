// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  teacher: { id: 'teacher1', role: 'editor' },
  getOne: vi.fn(), update: vi.fn(), getFullList: vi.fn(), audit: vi.fn(),
}));
vi.mock('../shared/services/pb/client.js', () => ({
  pb: { collection: () => mocks },
  currentTeacher: () => mocks.teacher,
  withOwner: (data) => data,
  andOwner: (filter = '') => filter ? `(${filter}) && owner = "teacher1"` : 'owner = "teacher1"',
  _logAudit: mocks.audit,
}));
import { sessionsApi } from '../shared/services/pb/sessions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.teacher = { id: 'teacher1', role: 'editor' };
  mocks.getOne.mockResolvedValue({ id: 'session1', owner: 'teacher1', groups: ['other'] });
});

describe('назначение тестов: API', () => {
  it('добавляет/снимает только выбранную группу и пишет аудит', async () => {
    mocks.update.mockResolvedValueOnce({ groups: ['other', 'g1'] }).mockResolvedValueOnce({ groups: ['other'] });
    await sessionsApi.assignSessionToGroup('session1', 'g1');
    expect(mocks.update).toHaveBeenCalledWith('session1', { 'groups+': ['g1'] });
    await sessionsApi.assignSessionToGroup('session1', 'g1', false);
    expect(mocks.update).toHaveBeenCalledWith('session1', { 'groups-': ['g1'] });
    expect(mocks.audit).toHaveBeenCalledTimes(2);
  });
  it('отсутствие миграции и неполное сохранение не выдаются за успех', async () => {
    mocks.update.mockResolvedValueOnce({ id: 'session1' }).mockResolvedValueOnce({ groups: ['g1'] });
    await expect(sessionsApi.assignSessionToGroup('session1', 'g1')).rejects.toThrow('миграция');
    await expect(sessionsApi.setSessionGroups('session1', ['g1', 'g2'])).rejects.toThrow('миграция');
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('viewer и чужой автор не могут менять назначение', async () => {
    mocks.teacher.role = 'viewer';
    await expect(sessionsApi.assignSessionToGroup('session1', 'g1')).rejects.toThrow('автор');
    mocks.teacher.role = 'editor';
    mocks.getOne.mockResolvedValue({ owner: 'other' });
    await expect(sessionsApi.setSessionGroups('session1', ['g1'])).rejects.toThrow('автор');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('выборка групп использует .id и владельца; получает только названия тестов', async () => {
    mocks.getFullList.mockResolvedValue([]);
    await sessionsApi.getGroupTestSessions(['g1', 'g2']);
    expect(mocks.getFullList.mock.calls[0][0].filter).toContain('groups.id ?= "g1"');
    expect(mocks.getFullList.mock.calls[0][0].filter).toContain('owner = "teacher1"');
    await sessionsApi.getAssignableSessions();
    // Тригонометрические тесты объединены с mc_tests миграцией 1772000036:
    // фильтр по удалённому trig_mc_test на реальной схеме отвечает HTTP 400.
    expect(mocks.getFullList.mock.calls[1][0].filter).not.toContain('trig_mc_test');
    const fields = mocks.getFullList.mock.calls[1][0].fields;
    expect(fields).toContain('expand.mc_test.title');
    expect(fields).not.toContain('variants');
  });
  it('ошибка чтения попыток доходит до экрана', async () => {
    mocks.getFullList.mockRejectedValue(new Error('network failed'));
    await expect(sessionsApi.getGroupTestAttempts('s1')).rejects.toThrow('network failed');
  });
});
