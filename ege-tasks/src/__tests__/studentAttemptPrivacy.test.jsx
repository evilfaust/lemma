import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Аудит 25.10.2026, шаг 2: ученику не видны чужие попытки. Варианты по кругу
// раздаются по раскладке выдачи (только variant/mc_variant), а запросы к
// попыткам несут `device` — по нему правило узнаёт попытки этого устройства.

const mockApi = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAttemptsByStudent: vi.fn(),
  getAttemptsByDevice: vi.fn(),
  getAttemptsBySession: vi.fn(),
  getSessionVariantLoad: vi.fn(),
  getVariantsByWork: vi.fn(),
  getVariant: vi.fn(),
  createAttempt: vi.fn(),
  updateAttempt: vi.fn(),
  getMCTest: vi.fn(),
}));
vi.mock('../services/pocketbase', () => ({ api: mockApi }));

const { useStudentSession } = await import('../hooks/useStudentSession');

const variant = (id, n) => ({ id, number: n, tasks: ['t1'], expand: { tasks: [{ id: 't1', statement_md: '1+1' }] } });

describe('useStudentSession — раздача вариантов без чужих попыток', () => {
  beforeEach(() => {
    Object.values(mockApi).forEach((f) => f.mockReset());
    mockApi.getSession.mockResolvedValue({ id: 'sess', work: 'w1', is_open: true });
    mockApi.getAttemptsByDevice.mockResolvedValue([]);
    mockApi.getAttemptsByStudent.mockResolvedValue([]);
    mockApi.getVariantsByWork.mockResolvedValue([variant('v1', 1), variant('v2', 2), variant('v3', 3)]);
    mockApi.createAttempt.mockImplementation(async (d) => ({ id: 'new', created: new Date().toISOString(), ...d }));
  });

  it('гость получает наименее выданный вариант, попытки выдачи не читаются', async () => {
    mockApi.getSessionVariantLoad.mockResolvedValue([
      { variant: 'v1', mc_variant: 0 }, { variant: 'v1', mc_variant: 0 },
      { variant: 'v2', mc_variant: 0 }, { variant: 'v3', mc_variant: 0 },
      { variant: 'v3', mc_variant: 0 },
    ]);
    const { result } = renderHook(() => useStudentSession('sess', 'dev-1', null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.startAttempt('Иванов'); });

    expect(mockApi.createAttempt).toHaveBeenCalledWith(expect.objectContaining({ variant: 'v2', device_id: 'dev-1' }));
    expect(mockApi.getSessionVariantLoad).toHaveBeenCalledWith('sess');
    expect(mockApi.getAttemptsBySession).not.toHaveBeenCalled();
    expect(result.current.attempt.issueNumber).toBe(1);
  });

  it('продолжение начатой попытки — номер по своим попыткам, чужие не нужны', async () => {
    const mine = { id: 'a1', session: 'sess', device_id: 'dev-1', variant: 'v1', status: 'started', created: '2026-10-01T10:00:00Z' };
    mockApi.getAttemptsByDevice.mockResolvedValue([mine]);
    mockApi.getVariant.mockResolvedValue(variant('v1', 1));
    const { result } = renderHook(() => useStudentSession('sess', 'dev-1', null));
    await waitFor(() => expect(result.current.attempt?.id).toBe('a1'));
    expect(result.current.attempt.issueNumber).toBe(1);
    expect(mockApi.getAttemptsBySession).not.toHaveBeenCalled();
  });
});

describe('pb.beforeSend — параметр device', () => {
  it('только к попыткам и ответам, только при известном устройстве', async () => {
    vi.doUnmock('../shared/services/pb/client.js');
    const { pb } = await vi.importActual('../shared/services/pb/client.js');
    localStorage.setItem('ege_device_id', 'uuid-123');
    const a = await pb.beforeSend('https://x/api/collections/attempts/records', { query: { filter: 'f' } });
    expect(a.options.query).toEqual({ filter: 'f', device: 'uuid-123' });
    const b = await pb.beforeSend('https://x/api/collections/attempt_answers/records/abc', {});
    expect(b.options.query).toEqual({ device: 'uuid-123' });
    const c = await pb.beforeSend('https://x/api/collections/tasks/records', {});
    expect(c.options.query).toBeUndefined();
    localStorage.removeItem('ege_device_id');
    const d = await pb.beforeSend('https://x/api/collections/attempts/records', {});
    expect(d.options.query).toBeUndefined();
  });
});
