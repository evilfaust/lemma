import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { App as AntApp } from 'antd';
import {
  roomCodeFromName, normalizeRoomCode, codeCandidates, roomLink, roomCodeFromPath,
  isTeachingNotice, roomChanges, interpolateCamera, sceneOfRoom, toolClick, evaluateScene,
} from '../utils/stereo';

const mockApi = vi.hoisted(() => ({
  findLiveStereoRoom: vi.fn(),
  getStereoRoom: vi.fn(),
  subscribeStereoRoom: vi.fn(),
  unsubscribeStereoRoom: vi.fn(),
  getStereoRooms: vi.fn(),
  createStereoRoom: vi.fn(),
  updateStereoRoom: vi.fn(),
  deleteStereoRoom: vi.fn(),
  getTeachingGroups: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

// eslint-disable-next-line import/first
import StudentStereoBoard from '../components/stereo/StudentStereoBoard';
// eslint-disable-next-line import/first
import StereoLivePanel from '../components/stereo/StereoLivePanel';

const cube = { kind: 'cube', a: 4 };
const room = (over = {}) => ({
  id: 'r1', code: '10a', live: true, updated: '2026-09-27 10:00:00.000Z',
  scene: { body: cube, ops: [] }, camera: { yaw: 22, pitch: 22, zoom: 1, seq: 1 },
  ...over,
});

describe('комната: чистая логика', () => {
  it('код по названию класса', () => {
    expect(roomCodeFromName('10А')).toBe('10a');
    expect(roomCodeFromName('10 А')).toBe('10a');
    expect(roomCodeFromName('11 Б профиль')).toBe('11b-profil');
    expect(roomCodeFromName('10 кл')).toBe('10-kl');
    expect(roomCodeFromName('')).toBe('room');
    expect(normalizeRoomCode('  Эфир!!  ')).toBe('efir');
    expect(roomCodeFromName('очень длинное название класса с профилем')).toHaveLength(24);
    expect(codeCandidates('10a', 3)).toEqual(['10a', '10a-2', '10a-3']);
  });

  it('ссылка и разбор адреса', () => {
    expect(roomLink('10a')).toEqual({ full: 'https://student.oipav.ru/b/10a', short: 'student.oipav.ru/b/10a' });
    expect(roomCodeFromPath('/b/10a')).toBe('10a');
    expect(roomCodeFromPath('/student/b/10A/')).toBe('10a');
    expect(roomCodeFromPath('/student/abc123')).toBeNull();
    expect(roomCodeFromPath('/student/marathon-live/x')).toBeNull();
  });

  it('что показать классу', () => {
    expect(isTeachingNotice('Прямые MN и AD скрещиваются — общей точки нет')).toBe(true);
    expect(isTeachingNotice('Прямая MN параллельна плоскости (ABC)')).toBe(true);
    expect(isTeachingNotice('Имя M уже занято')).toBe(false);
  });

  it('разбор изменений комнаты', () => {
    const a = room();
    const b = room({ scene: { body: cube, ops: [{ id: 'o1', type: 'segment', ref: ['A', 'C'] }] } });
    expect(roomChanges(a, b).flashStep).toBe(0);
    const first = roomChanges(null, room({ pulse: { points: ['A'], seq: 5 }, notice: { text: 'x', seq: 5 } }));
    expect(first.camera).toMatchObject({ yaw: 22, pitch: 22 });
    expect(first.pulse).toBeNull(); // старое «смотрите сюда» опоздавшему не показываем
    expect(first.notice).toBeNull();
    const c = room({ ...b, camera: { yaw: 90, pitch: 10, zoom: 1, seq: 2 }, notice: { text: 'скрещиваются', seq: 3 } });
    const ch = roomChanges(b, c);
    expect(ch.camera.yaw).toBe(90);
    expect(ch.notice).toBe('скрещиваются');
    expect(ch.flashStep).toBeNull();
    const other = roomChanges(b, room({ scene: { body: { kind: 'tetra', a: 3 }, ops: [] } }));
    expect(other.reset).toBe(true);
  });

  it('поворот камеры по кратчайшей дуге', () => {
    const mid = interpolateCamera({ yaw: 350, pitch: 0, zoom: 1 }, { yaw: 10, pitch: 20, zoom: 1 }, 0.5);
    expect(mid.yaw).toBeCloseTo(0, 6);
    expect(mid.pitch).toBeCloseTo(10, 6);
  });

  it('битая сцена комнаты', () => {
    expect(sceneOfRoom({ scene: null })).toBeNull();
    expect(sceneOfRoom({ scene: { body: cube } })).toBeNull();
    expect(sceneOfRoom(room())).toEqual({ body: cube, ops: [] });
  });

  it('инструмент «Внимание» — не шаг журнала', () => {
    const m = evaluateScene({ body: cube, ops: [] });
    expect(toolClick('attention', [], { point: 'A' }, m)).toEqual({ pending: [], attention: { points: ['A'], lines: [] } });
    const r = toolClick('attention', [], { line: { id: 'edge:A-B', ref: ['A', 'B'], t: 0.4 } }, m);
    expect(r.attention.lines).toEqual(['edge:A-B']);
    expect(r.op).toBeUndefined();
  });
});

describe('экран ученика', () => {
  let handler = null;
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(mockApi).forEach((f) => f.mockReset());
    handler = null;
    mockApi.subscribeStereoRoom.mockImplementation((id, cb) => { handler = cb; return Promise.resolve(); });
    mockApi.unsubscribeStereoRoom.mockResolvedValue();
  });
  afterEach(() => vi.useRealTimers());

  it('ждёт эфир, подключается сам, показывает шаги и «скрещиваются»', async () => {
    mockApi.findLiveStereoRoom.mockResolvedValueOnce(null);
    render(<StudentStereoBoard code="10a" />);
    await act(async () => {});
    expect(screen.getByText('Ждём учителя')).toBeTruthy();
    expect(screen.getByText('эфир не идёт')).toBeTruthy();

    mockApi.findLiveStereoRoom.mockResolvedValue(room());
    await act(async () => { vi.advanceTimersByTime(4100); });
    expect(screen.getByText('в эфире')).toBeTruthy();
    expect(mockApi.subscribeStereoRoom).toHaveBeenCalledWith('r1', expect.any(Function));
    expect(screen.getByText('Пока только тело — смотрите на доску')).toBeTruthy();

    await act(async () => {
      handler({
        action: 'update',
        record: room({
          updated: '2026-09-27 10:00:05.000Z',
          scene: { body: cube, ops: [{ id: 'o1', type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5, ratio: [1, 1] }] },
          notice: { text: 'Прямые MC₁ и BD скрещиваются — общей точки нет', seq: 9 },
        }),
      });
    });
    expect(screen.getByText('Шаг 1: M ∈ AA₁, середина')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/скрещиваются/);
  });

  it('выключенный эфир ловит опрос — чертёж остаётся', async () => {
    mockApi.findLiveStereoRoom.mockResolvedValue(room());
    render(<StudentStereoBoard code="10a" />);
    await act(async () => {});
    expect(screen.getByText('в эфире')).toBeTruthy();
    mockApi.getStereoRoom.mockResolvedValue(null);
    mockApi.findLiveStereoRoom.mockResolvedValue(null);
    await act(async () => { vi.advanceTimersByTime(8100); });
    expect(screen.getByText('эфир не идёт')).toBeTruthy();
    expect(screen.getByText('Показ завершён — чертёж остаётся, его можно крутить')).toBeTruthy();
    expect(mockApi.unsubscribeStereoRoom).toHaveBeenCalledWith('r1');
  });
});

describe('панель эфира учителя', () => {
  const baseLive = {
    rooms: [room({ live: false })], room: room({ live: false }), isLive: false, error: '',
    selectRoom: vi.fn(), createRoom: vi.fn(), deleteRoom: vi.fn(),
    start: vi.fn(), stop: vi.fn(), pushCamera: vi.fn(),
  };
  const mount = (live) => render(<AntApp><StereoLivePanel live={live} camera={{ yaw: 1, pitch: 2, zoom: 1 }} /></AntApp>);

  it('без миграции — спокойная подсказка', () => {
    mount({ ...baseLive, rooms: null, room: null });
    expect(screen.getByText(/появится после обновления базы/)).toBeTruthy();
  });

  it('ссылка для доски и старт эфира с текущим ракурсом', () => {
    const start = vi.fn();
    mount({ ...baseLive, start });
    expect(screen.getByText('student.oipav.ru/b/10a')).toBeTruthy();
    fireEvent.click(screen.getByText('▶ Начать эфир'));
    expect(start).toHaveBeenCalledWith({ yaw: 1, pitch: 2, zoom: 1 });
  });

  it('в эфире — «Смотрите отсюда» и «Стоп»', () => {
    const pushCamera = vi.fn();
    const stop = vi.fn();
    mount({ ...baseLive, isLive: true, room: room(), rooms: [room()], pushCamera, stop });
    fireEvent.click(screen.getByText('Смотрите отсюда'));
    expect(pushCamera).toHaveBeenCalledWith({ yaw: 1, pitch: 2, zoom: 1 });
    fireEvent.click(screen.getByText('Стоп'));
    expect(stop).toHaveBeenCalled();
  });
});

describe('useStereoLive: очередь записей', () => {
  it('правки во время запроса сливаются, последняя сцена побеждает', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { default: useStereoLive } = await import('../hooks/useStereoLive');
    Object.values(mockApi).forEach((f) => f.mockReset());
    localStorage.clear();
    let current = room({ live: false });
    mockApi.getStereoRooms.mockResolvedValue([current]);
    const calls = [];
    let release;
    mockApi.updateStereoRoom.mockImplementation((id, patch) => {
      calls.push(patch);
      current = { ...current, ...patch };
      return new Promise((res) => { release = () => res(current); });
    });
    const s0 = { body: cube, ops: [] };
    const { result, rerender } = renderHook(({ scene }) => useStereoLive({ scene, enabled: true }), { initialProps: { scene: s0 } });
    await act(async () => {});
    expect(result.current.room.code).toBe('10a');

    act(() => result.current.start({ yaw: 5, pitch: 6, zoom: 1 }));
    expect(calls[0]).toMatchObject({ live: true, scene: s0, camera: { yaw: 5, pitch: 6 } });
    await act(async () => { release(); });
    expect(result.current.isLive).toBe(true);

    const s1 = { body: cube, ops: [{ id: 'a' }] };
    const s2 = { body: cube, ops: [{ id: 'a' }, { id: 'b' }] };
    const s3 = { body: cube, ops: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
    rerender({ scene: s1 });
    rerender({ scene: s2 }); // пока летит s1
    rerender({ scene: s3 });
    await act(async () => { release(); });
    await act(async () => { release(); });
    expect(calls).toHaveLength(3); // старт, s1, затем s2+s3 одним запросом
    expect(calls[1].scene).toBe(s1);
    expect(calls[2].scene).toBe(s3);
  });
});

describe('показ по шагам в эфире', () => {
  it('перемотка вперёд вспыхивает, назад — нет', () => {
    const ops = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const at = (k) => room({ scene: { body: cube, ops, upTo: k } });
    expect(roomChanges(at(1), at(2)).flashStep).toBe(1);
    expect(roomChanges(at(2), at(1)).flashStep).toBeNull();
    expect(roomChanges(at(3), room({ scene: { body: cube, ops } })).flashStep).toBeNull();
  });

  it('ученик видит только показанные шаги и подпись', async () => {
    vi.useFakeTimers();
    Object.values(mockApi).forEach((f) => f.mockReset());
    mockApi.subscribeStereoRoom.mockResolvedValue();
    mockApi.unsubscribeStereoRoom.mockResolvedValue();
    mockApi.findLiveStereoRoom.mockResolvedValue(room({
      scene: {
        body: cube,
        upTo: 1,
        ops: [
          { id: 'a', type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5, ratio: [1, 1], note: 'середина ребра' },
          { id: 'b', type: 'segment', ref: ['M', 'C1'] },
        ],
      },
    }));
    render(<StudentStereoBoard code="10a" />);
    await act(async () => {});
    expect(screen.getByText('Шаг 1: M ∈ AA₁, середина')).toBeTruthy();
    expect(screen.getByText('середина ребра')).toBeTruthy();
    vi.useRealTimers();
  });
});
