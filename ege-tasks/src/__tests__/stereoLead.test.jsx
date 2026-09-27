import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, renderHook } from '@testing-library/react';
import { App as AntApp } from 'antd';
import {
  chaseCamera, isRoomLead, roomChanges, evaluateScene, renderStereo, stereoSvgString,
  DEFAULT_CAMERA, setLineColors, lineColorKey, refOfLineColorKey, removeOpCascade,
  renamePoint, parseCommand, toolClick, parseStereoBlock, buildStereoBlock,
  setSegmentColors, segmentAt, colorPieces, applyColorCommand,
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
// eslint-disable-next-line import/first
import useStereoLive, { LEAD_MS } from '../hooks/useStereoLive';

const cube = { kind: 'cube', a: 4 };
const room = (over = {}) => ({
  id: 'r1', code: '10a', live: true, updated: '2026-09-27 10:00:00.000Z',
  scene: { body: cube, ops: [] }, camera: { yaw: 22, pitch: 22, zoom: 1, seq: 1 },
  ...over,
});

// --- «Все смотрят сюда» ---------------------------------------------------------

describe('«Все смотрят сюда»: чистая логика', () => {
  it('флаг ведения — только в эфире', () => {
    expect(isRoomLead(room({ camera: { yaw: 0, pitch: 0, zoom: 1, seq: 2, lead: true } }))).toBe(true);
    expect(isRoomLead(room({ live: false, camera: { yaw: 0, pitch: 0, zoom: 1, lead: true } }))).toBe(false);
    expect(isRoomLead(room())).toBe(false);
    const ch = roomChanges(room(), room({ camera: { yaw: 90, pitch: 10, zoom: 1, seq: 2, lead: true } }));
    expect(ch.lead).toBe(true);
    expect(ch.camera).toEqual({ yaw: 90, pitch: 10, zoom: 1 });
  });

  it('догонялка: плавно, по кратчайшей дуге, и доходит до цели', () => {
    let cam = { yaw: 350, pitch: 10, zoom: 1 };
    const target = { yaw: 20, pitch: 30, zoom: 1.5 };
    const r1 = chaseCamera(cam, target, 16);
    expect(r1.done).toBe(false);
    expect(r1.camera.yaw > 350 || r1.camera.yaw < 20).toBe(true); // через 0°, а не назад через 180°
    let frames = 0;
    let r = r1;
    while (!r.done && frames < 200) { cam = r.camera; r = chaseCamera(cam, target, 16); frames += 1; }
    expect(r.done).toBe(true);
    expect(r.camera).toEqual({ yaw: 20, pitch: 30, zoom: 1.5 });
    expect(frames).toBeLessThan(60); // меньше секунды при 60 кадрах
  });
});

describe('экран ученика: учитель ведёт', () => {
  let handler = null;
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(mockApi).forEach((f) => f.mockReset());
    mockApi.subscribeStereoRoom.mockImplementation((id, cb) => { handler = cb; return Promise.resolve(); });
    mockApi.unsubscribeStereoRoom.mockResolvedValue();
  });
  afterEach(() => vi.useRealTimers());

  const svg = () => screen.getByRole('img');

  it('«Смотрите отсюда» возвращает слежение тому, кто крутил сам', async () => {
    mockApi.findLiveStereoRoom.mockResolvedValue(room());
    render(<StudentStereoBoard code="10a" />);
    await act(async () => {});
    expect(screen.getByText('Как у учителя ✓')).toBeTruthy();
    fireEvent.wheel(svg(), { deltaY: -100 });
    expect(screen.getByText('Как у учителя')).toBeTruthy();
    await act(async () => {
      handler({ action: 'update', record: room({ updated: '2026-09-27 10:00:05.000Z', camera: { yaw: 80, pitch: 30, zoom: 1, seq: 2 } }) });
    });
    expect(screen.getByText('Как у учителя ✓')).toBeTruthy();
  });

  it('пока учитель ведёт — плашка, кнопка заблокирована, крутить нельзя', async () => {
    mockApi.findLiveStereoRoom.mockResolvedValue(room());
    render(<StudentStereoBoard code="10a" />);
    await act(async () => {});
    fireEvent.wheel(svg(), { deltaY: -100 }); // ученик крутил сам
    await act(async () => {
      handler({ action: 'update', record: room({ updated: '2026-09-27 10:00:05.000Z', camera: { yaw: 80, pitch: 30, zoom: 1, seq: 2, lead: true } }) });
    });
    expect(screen.getByText('Учитель показывает — смотрите')).toBeTruthy();
    expect(screen.getByText('Показывает учитель')).toBeTruthy();
    expect(screen.queryByText(/Крутите пальцем/)).toBeNull();
    fireEvent.wheel(svg(), { deltaY: -100 }); // жест не выключает слежение
    expect(screen.getByText('Показывает учитель')).toBeTruthy();

    // Учитель отпустил — снова можно крутить.
    await act(async () => {
      handler({ action: 'update', record: room({ updated: '2026-09-27 10:00:09.000Z', camera: { yaw: 80, pitch: 30, zoom: 1, seq: 3, lead: false } }) });
    });
    expect(screen.queryByText('Учитель показывает — смотрите')).toBeNull();
    expect(screen.getByText('Как у учителя ✓')).toBeTruthy();
    fireEvent.wheel(svg(), { deltaY: -100 });
    expect(screen.getByText('Как у учителя')).toBeTruthy();
  });
});

describe('панель эфира: кнопка «Все смотрят сюда»', () => {
  const live = (over = {}) => ({
    rooms: [room()], room: room(), isLive: true, error: '',
    selectRoom: vi.fn(), createRoom: vi.fn(), deleteRoom: vi.fn(),
    start: vi.fn(), stop: vi.fn(), pushCamera: vi.fn(), setLead: vi.fn(), isLeading: false,
    ...over,
  });
  const cam = { yaw: 1, pitch: 2, zoom: 1 };
  const mount = (l) => render(<AntApp><StereoLivePanel live={l} camera={cam} /></AntApp>);

  it('включает и отпускает', () => {
    const setLead = vi.fn();
    const { unmount } = mount(live({ setLead }));
    fireEvent.click(screen.getByText('Все смотрят сюда'));
    expect(setLead).toHaveBeenCalledWith(true, cam);
    unmount();
    mount(live({ setLead, isLeading: true }));
    expect(screen.getByText(/сами чертёж не крутят/)).toBeTruthy();
    fireEvent.click(screen.getByText('Все смотрят сюда · отпустить'));
    expect(setLead).toHaveBeenLastCalledWith(false, cam);
  });
});

describe('useStereoLive: ракурс в эфир, пока учитель ведёт', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(mockApi).forEach((f) => f.mockReset());
    localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('не чаще раза в LEAD_MS, последний ракурс не теряется; без ведения — тишина', async () => {
    let current = room();
    mockApi.getStereoRooms.mockResolvedValue([current]);
    const calls = [];
    mockApi.updateStereoRoom.mockImplementation(async (id, patch) => {
      calls.push(patch);
      current = { ...current, ...patch };
      return current;
    });
    const scene = { body: cube, ops: [] };
    const { result } = renderHook(() => useStereoLive({ scene, enabled: true }));
    await act(async () => {});
    expect(result.current.isLive).toBe(true);
    calls.length = 0;

    act(() => result.current.streamCamera({ yaw: 10, pitch: 10, zoom: 1 }));
    expect(calls).toHaveLength(0); // учитель не ведёт — поворот остаётся у него

    await act(async () => { result.current.setLead(true, { yaw: 11, pitch: 10, zoom: 1 }); });
    expect(result.current.isLeading).toBe(true);
    expect(calls.at(-1).camera).toMatchObject({ yaw: 11, lead: true });
    const n0 = calls.length;

    await act(async () => {
      for (let i = 0; i < 10; i++) result.current.streamCamera({ yaw: 20 + i, pitch: 10, zoom: 1 });
    });
    expect(calls.length).toBe(n0); // окно ещё не прошло
    await act(async () => { vi.advanceTimersByTime(LEAD_MS + 5); });
    expect(calls.length).toBe(n0 + 1);
    expect(calls.at(-1).camera).toMatchObject({ yaw: 29, lead: true });

    await act(async () => { result.current.setLead(false, { yaw: 29, pitch: 10, zoom: 1 }); });
    expect(calls.at(-1).camera.lead).toBe(false);
    const n1 = calls.length;
    await act(async () => {
      result.current.streamCamera({ yaw: 40, pitch: 10, zoom: 1 });
      vi.advanceTimersByTime(LEAD_MS * 3);
    });
    expect(calls.length).toBe(n1);
  });
});

// --- цвет прямых ---------------------------------------------------------------

const base = {
  body: cube,
  ops: [
    { id: 'a', type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5 },
    { id: 'b', type: 'pointOnLine', name: 'N', ref: ['C', 'C1'], t: 0.5 },
    { id: 's', type: 'segment', ref: ['M', 'N'] },
    { id: 'p', type: 'parallel', through: 'M', ref: ['A', 'C'] },
    { id: 'x', type: 'pointOnLine', name: 'K', ref: ['A', 'B'], t: 1.5 },
  ],
};

describe('цвет прямых', () => {
  it('ключ — сама прямая: порядок точек не важен, параллельная — по шагу', () => {
    expect(lineColorKey(['A1', 'A'])).toBe('A-A1');
    expect(lineColorKey(['A', 'A1'])).toBe('A-A1');
    expect(lineColorKey('p')).toBe('#p');
    expect(refOfLineColorKey('A-A1')).toEqual(['A', 'A1']);
    expect(refOfLineColorKey('#p')).toBe('p');
  });

  it('ребро красится вместе с продолжением; цвет — не шаг журнала', () => {
    const sc = setLineColors(base, ['A-B', 'M-N', '#p'], 'red');
    expect(sc.ops).toBe(base.ops);
    const m = evaluateScene(sc);
    const edge = m.lines.find((o) => o.id === 'edge:A-B');
    const ext = m.lines.find((o) => o.id.startsWith('x:ext'));
    expect(edge.color).toBe('red');
    expect(ext.color).toBe('red'); // продолжение AB за B
    expect(m.lines.find((o) => o.id === 's').color).toBe('red');
    expect(m.lines.find((o) => o.id === 'p').color).toBe('red');
    expect(m.lines.find((o) => o.id === 'edge:C-D').color).toBeUndefined();
    expect(setLineColors(sc, ['A-B', 'M-N', '#p'], '').lineColors).toBeUndefined();
  });

  it('отрисовка: цвет и толщина; в ч/б — чёрная, но толще', () => {
    const sc = setLineColors(base, ['M-N'], 'blue');
    const frame = renderStereo(evaluateScene(sc), DEFAULT_CAMERA, { width: 500, height: 400 });
    const plain = renderStereo(evaluateScene(base), DEFAULT_CAMERA, { width: 500, height: 400 });
    const mn = frame.strokes.find((s) => s.objId === 's');
    const mn0 = plain.strokes.find((s) => s.objId === 's');
    expect(mn.color).toBe('#2563eb');
    expect(mn.width).toBeGreaterThan(mn0.width);
    const mono = stereoSvgString(frame, { mono: true });
    expect(mono).not.toContain('#2563eb');
  });

  it('удаление и переименование переносят цвет', () => {
    const sc = setLineColors(base, ['M-N', 'A-B', '#p'], 'green');
    const del = removeOpCascade(sc, 'a').scene; // M ушла — с ней MN и параллельная через M
    expect(del.lineColors).toEqual({ 'A-B': 'green' });
    const ren = renamePoint(sc, 'A', 'Q').scene; // вершина тела
    expect(ren.lineColors).toEqual({ 'M-N': 'green', 'B-Q': 'green', '#p': 'green' });
    const m = evaluateScene(ren);
    expect(m.lines.find((o) => o.id === 'edge:Q-B' || o.id === 'edge:B-Q').color).toBe('green');
  });

  it('инструмент «Цвет» по прямой и команда', () => {
    const m = evaluateScene(base);
    const r = toolClick('color', [], { line: { id: 'edge:A-B', ref: ['A', 'B'], t: 0.3 } }, m);
    expect(r).toEqual({ pending: [], paint: { line: 'A-B' } });
    expect(toolClick('color', [], { line: { id: 'p', ref: 'p', t: 0.3 } }, m).paint).toEqual({ line: '#p' });
    expect(toolClick('color', [], { point: 'M', line: { id: 's', ref: ['M', 'N'] } }, m).paint).toEqual({ name: 'M' });
    expect(parseCommand('цвет прямой AB красный', m)).toEqual({ action: 'color', names: [], lines: [['A', 'B']], color: 'red' });
    expect(parseCommand('цвет прямых AB, MN синий', m).lines).toEqual([['A', 'B'], ['M', 'N']]);
    expect(parseCommand('цвет отрезка MN нет', m)).toMatchObject({ segments: [['M', 'N']], color: '' });
    expect(parseCommand('цвет прямой ABC красный', m).error).toMatch(/двумя точками/);
    expect(parseCommand('цвет MN красный', m)).toEqual({ action: 'color', names: ['M', 'N'], color: 'red' });
  });

  it('блок ```stereo: туда и обратно', () => {
    const sc = setLineColors(base, ['M-N', 'A-B', '#p'], 'violet');
    const { text } = buildStereoBlock(sc, DEFAULT_CAMERA);
    expect(text).toContain('цвет прямых MN, AB фиолетовый');
    const back = parseStereoBlock(text);
    expect(back.errors.filter((e) => !/параллельн/.test(e.message))).toEqual([]);
    expect(back.scene.lineColors).toEqual({ 'A-B': 'violet', 'M-N': 'violet' });
    expect(parseStereoBlock('куб 4\nцвет прямой AZ красный').errors[0].message).toMatch(/Нет точки Z/);
  });
});

// --- цвет отрезка (куска прямой) -----------------------------------------------

describe('цвет отрезка: кусок, а не прямая', () => {
  // M — середина AA1; K — на продолжении AB за B.
  const sc0 = base;
  const model = evaluateScene(sc0);
  const edgeAA1 = model.lines.find((o) => o.id === 'edge:A-A1');
  const edgeAB = model.lines.find((o) => o.id === 'edge:A-B');
  const at = (o, t) => ({ x: o.a.x + (o.b.x - o.a.x) * t, y: o.a.y + (o.b.y - o.a.y) * t, z: o.a.z + (o.b.z - o.a.z) * t });

  it('кусок под кликом — между соседними точками на прямой', () => {
    expect(segmentAt(model, edgeAA1, at(edgeAA1, 0.2))).toEqual(['A', 'M']);
    expect(segmentAt(model, edgeAA1, at(edgeAA1, 0.8))).toEqual(['M', 'A1']);
    const ext = model.lines.find((o) => o.id.startsWith('x:ext'));
    expect(segmentAt(model, ext, at(ext, 0.5))).toEqual(['B', 'K']);
    expect(segmentAt(model, edgeAB, at(edgeAB, 0.5))).toEqual(['A', 'B']);
  });

  it('инструмент: клик — кусок, Shift+клик — прямая целиком', () => {
    const hit = (t, shift) => ({ line: { id: edgeAA1.id, ref: ['A', 'A1'], t, pos: at(edgeAA1, t), p: edgeAA1.p, u: edgeAA1.u }, shift });
    expect(toolClick('color', [], hit(0.2, false), model).paint).toEqual({ segment: 'A-M' });
    expect(toolClick('color', [], hit(0.2, true), model).paint).toEqual({ line: 'A-A1' });
  });

  it('красится только кусок: ребро AB без продолжения BK, AM без MA1', () => {
    const sc = setSegmentColors(sc0, ['A-B', 'A-M'], 'red');
    const m = evaluateScene(sc);
    expect(m.lines.find((o) => o.id === 'edge:A-B').colorRanges).toEqual([{ t0: 0, t1: 1, color: 'red' }]);
    expect(m.lines.find((o) => o.id.startsWith('x:ext')).colorRanges).toBeUndefined();
    const aa1 = m.lines.find((o) => o.id === 'edge:A-A1');
    expect(aa1.colorRanges).toHaveLength(1);
    expect(aa1.colorRanges[0].t1).toBeCloseTo(0.5, 9);
    const frame = renderStereo(m, DEFAULT_CAMERA, { width: 500, height: 400 });
    const pieces = frame.strokes.filter((s) => s.objId === 'edge:A-A1');
    expect(pieces.some((s) => s.color === '#dc2626')).toBe(true);
    expect(pieces.some((s) => s.color !== '#dc2626')).toBe(true);
  });

  it('куски линии: поздний отрезок поверх, одинаковые сливаются', () => {
    expect(colorPieces([{ t0: 0, t1: 0.5, color: 'red' }])).toEqual([
      { t0: 0, t1: 0.5, color: 'red' }, { t0: 0.5, t1: 1, color: null },
    ]);
    expect(colorPieces([{ t0: 0, t1: 0.6, color: 'red' }, { t0: 0.4, t1: 1, color: 'blue' }])).toEqual([
      { t0: 0, t1: 0.4, color: 'red' }, { t0: 0.4, t1: 1, color: 'blue' },
    ]);
    expect(colorPieces([{ t0: 0, t1: 0.5, color: 'red' }, { t0: 0.5, t1: 1, color: 'red' }])).toEqual([
      { t0: 0, t1: 1, color: 'red' },
    ]);
  });

  it('команда: отрезок только на нарисованной линии', () => {
    const r = applyColorCommand(sc0, parseCommand('цвет отрезка AM красный', model));
    expect(r.scene.segmentColors).toEqual({ 'A-M': 'red' });
    expect(applyColorCommand(sc0, parseCommand('цвет отрезка AC1 красный', model)).error).toMatch(/не лежит на нарисованной линии/);
    expect(applyColorCommand(sc0, parseCommand('цвет отрезка AZ красный', model)).error).toMatch(/Нет точки Z/);
    // снять можно всегда
    expect(applyColorCommand(r.scene, parseCommand('цвет отрезка AM нет', model)).scene.segmentColors).toBeUndefined();
  });

  it('удаление, переименование и блок ```stereo', () => {
    const sc = setSegmentColors(sc0, ['A-M', 'B-K'], 'green');
    expect(removeOpCascade(sc, 'a').scene.segmentColors).toEqual({ 'B-K': 'green' });
    expect(renamePoint(sc, 'M', 'P').scene.segmentColors).toEqual({ 'A-P': 'green', 'B-K': 'green' });
    const { text } = buildStereoBlock(sc, DEFAULT_CAMERA);
    expect(text).toContain('цвет отрезков AM, BK зелёный');
    expect(parseStereoBlock(text).scene.segmentColors).toEqual({ 'A-M': 'green', 'B-K': 'green' });
  });
});
