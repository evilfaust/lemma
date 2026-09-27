import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App as AntApp } from 'antd';
import StereoEditor from '../components/stereo/StereoEditor';
import {
  cameraFacing, cameraBasis, clampCamera, evaluateScene, renderStereo, toolClick, polyNormal,
  pickPoly, acceptedKinds, toolHint,
} from '../utils/stereo';

const cube = { kind: 'cube', a: 4 };
const withSection = {
  body: cube,
  ops: [
    { id: 'a', type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5 },
    { id: 'b', type: 'pointOnLine', name: 'N', ref: ['C', 'C1'], t: 0.5 },
    { id: 'c', type: 'section', pts: ['M', 'N', 'B'] },
  ],
};

// Взгляд перпендикулярен плоскости ⇔ направление «к зрителю» параллельно нормали.
const alongNormal = (cam, n) => {
  const v = cameraBasis(cam).toViewer;
  const nl = Math.hypot(n.x, n.y, n.z);
  return Math.abs(Math.abs(v.x * n.x + v.y * n.y + v.z * n.z) / nl - 1);
};

describe('вид перпендикулярно плоскости', () => {
  it('строго сверху: наклон 90° разрешён, поворот в плоскости не меняется', () => {
    expect(clampCamera({ yaw: 0, pitch: 90 }).pitch).toBe(90);
    expect(clampCamera({ yaw: 0, pitch: 120 }).pitch).toBe(90);
    expect(cameraFacing({ x: 0, y: 0, z: 1 }, { yaw: 33, pitch: 20, zoom: 1.4 })).toEqual({ yaw: 33, pitch: 90, zoom: 1.4 });
    // нижнее основание — тоже сверху, а не снизу
    expect(cameraFacing({ x: 0, y: 0, z: -1 }, { yaw: 10, pitch: 20, zoom: 1 }).pitch).toBe(90);
  });

  it('вертикальная грань — сбоку, с той стороны, откуда смотрели', () => {
    const front = cameraFacing({ x: 0, y: -1, z: 0 }, { yaw: 20, pitch: 30, zoom: 1 });
    expect(front.pitch).toBeCloseTo(0, 9);
    expect(front.yaw).toBeCloseTo(0, 9);
    // та же плоскость с нормалью «от нас» — всё равно смотрим спереди
    expect(cameraFacing({ x: 0, y: 1, z: 0 }, { yaw: 20, pitch: 30, zoom: 1 }).yaw).toBeCloseTo(0, 9);
  });

  it('наклонная плоскость: взгляд вдоль нормали', () => {
    for (const n of [{ x: 1, y: -2, z: 3 }, { x: -0.3, y: 0.7, z: 0.2 }, { x: 2, y: 1, z: -1 }]) {
      const cam = cameraFacing(n, { yaw: 22, pitch: 22, zoom: 1 });
      expect(alongNormal(cam, n)).toBeLessThan(1e-9);
      expect(cam.pitch).toBeGreaterThanOrEqual(0);
    }
  });

  it('клик по грани и по сечению → ракурс; сечение видно в натуральную величину', () => {
    const m = evaluateScene(withSection);
    expect(acceptedKinds('view')).toEqual(['poly', 'face']);
    expect(toolHint('view')).toMatch(/перпендикулярно/);
    const face = m.body.faces[0];
    expect(toolClick('view', [], { face: { id: face.id, verts: face.verts } }, m).view.normal).toBe(face.n);
    const r = toolClick('view', [], { poly: { id: 'c' }, face: { id: face.id, verts: face.verts } }, m);
    expect(r.view.normal).toEqual(polyNormal(m, 'c')); // сечение важнее грани под ним
    const cam = cameraFacing(r.view.normal, { yaw: 22, pitch: 22, zoom: 1 });
    // Натуральная величина: длины сторон на экране пропорциональны длинам в пространстве.
    const frame = renderStereo(m, cam, { width: 600, height: 500 });
    const pg = m.polys.find((p) => p.id === 'c');
    const scr = frame.polys.find((p) => p.id === 'c').pts;
    const ratios = pg.pts.map((a, i) => {
      const b = pg.pts[(i + 1) % pg.pts.length];
      const d3 = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      const s = scr[(i + 1) % scr.length];
      return Math.hypot(scr[i].x - s.x, scr[i].y - s.y) / d3;
    });
    ratios.forEach((k) => expect(k).toBeCloseTo(ratios[0], 6));
    // и сечение находится кликом по его середине
    const cx = scr.reduce((a, p) => a + p.x, 0) / scr.length;
    const cy = scr.reduce((a, p) => a + p.y, 0) / scr.length;
    expect(pickPoly(frame, cx, cy).id).toBe('c');
  });

  it('в редакторе: кнопка «⊥ На плоскость» включает выбор, Esc отменяет', () => {
    localStorage.clear();
    render(<AntApp><StereoEditor /></AntApp>);
    fireEvent.click(screen.getByText('⊥ На плоскость'));
    expect(screen.getByText(/чертёж повернётся перпендикулярно/)).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText(/чертёж повернётся перпендикулярно/)).toBeNull();
  });
});

describe('точка на параллельной прямой (регрессия v3.9.253)', () => {
  // Прямая через P ∥ AB задана шагом → у точки на ней ref — строка (id шага).
  const sc = {
    body: { kind: 'pyramid', n: 3, a: 4, h: 5 },
    ops: [
      { id: 'p1', type: 'pointOnLine', name: 'P', ref: ['A', 'S'], t: 0.5 },
      { id: 'par', type: 'parallel', through: 'P', ref: ['A', 'B'] },
      { id: 'k1', type: 'pointOnLine', name: 'K', ref: 'par', t: 0.3 },
      { id: 's1', type: 'segment', ref: ['K', 'C'] },
    ],
  };

  it('текст чертежа: точка на параллельной выгружается и читается обратно', async () => {
    const { buildStereoBlock, parseStereoBlock } = await import('../utils/stereo/dsl');
    const { opToCommand } = await import('../utils/stereo/commands');
    expect(opToCommand(sc.ops[2], { par: sc.ops[1] })).toBe('K на (P||AB) 0,3');
    expect(opToCommand(sc.ops[2])).toBe(''); // без журнала — не выражается, но и не падает
    const { text, skipped } = buildStereoBlock(sc);
    expect(skipped).toBe(0);
    expect(text).toContain('прямая P || AB');
    expect(text).toContain('K на (P||AB) 0,3');
    const back = parseStereoBlock(text);
    expect(back.errors).toEqual([]);
    const m0 = evaluateScene(sc);
    const m1 = evaluateScene(back.scene);
    for (const n of ['P', 'K']) {
      expect(m1.points[n].pos.x).toBeCloseTo(m0.points[n].pos.x, 9);
      expect(m1.points[n].pos.z).toBeCloseTo(m0.points[n].pos.z, 9);
    }
    expect(m1.lines.some((o) => o.id === back.scene.ops[3].id)).toBe(true); // отрезок KC построен
  });

  it('редактор с таким чертежом не падает', () => {
    localStorage.clear();
    localStorage.setItem('stereo.editor.v1', JSON.stringify({ scene: sc, camera: { yaw: 22, pitch: 22, zoom: 1 } }));
    render(<AntApp><StereoEditor /></AntApp>);
    expect(screen.getByText('Шаги построения')).toBeTruthy();
  });
});

describe('параллельная в строке команд «(P||AB)»', () => {
  const sc = {
    body: { kind: 'cube', a: 4 },
    ops: [
      { id: 'm', type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5, ratio: [1, 1] },
      { id: 'par', type: 'parallel', through: 'M', ref: ['A', 'B'] },
    ],
  };

  it('точка, пересечение, след и параллельная к параллельной', async () => {
    const { parseCommand } = await import('../utils/stereo/commands');
    const m = evaluateScene(sc);
    expect(parseCommand('K на (M || AB) 0,5', m).op).toMatchObject({ type: 'pointOnLine', name: 'K', ref: 'par', t: 0.5 });
    expect(parseCommand('K на (M||BA) середина', m).op.ratio).toBeUndefined(); // AB и BA — одна прямая
    expect(parseCommand('X = (M||AB) ∩ BB1', m).op).toMatchObject({ type: 'intersect', l1: 'par', l2: ['B', 'B1'] });
    expect(parseCommand('X = (M||AB) ∩ (BCC1)', m).op).toMatchObject({ type: 'trace', ref: 'par', plane: ['B', 'C', 'C1'] });
    expect(parseCommand('прямая C || (M||AB)', m).op).toMatchObject({ type: 'parallel', through: 'C', ref: 'par' });
    expect(parseCommand('K на (C||AB) 0,5', m).error).toMatch(/Нет прямой через C ∥ AB/);
    expect(parseCommand('K на (C|AB) 0,5', m).error).toBeTruthy();
  });

  it('вложенная параллельная выгружается и читается обратно', async () => {
    const { buildStereoBlock, parseStereoBlock } = await import('../utils/stereo/dsl');
    const sc2 = {
      ...sc,
      ops: [
        ...sc.ops,
        { id: 'q', type: 'parallel', through: 'C', ref: 'par' },
        { id: 'y', type: 'intersect', name: 'Y', l1: 'q', l2: ['B', 'C'] },
        { id: 'z', type: 'trace', name: 'Z', ref: 'par', plane: ['B', 'C', 'C1'] },
      ],
    };
    const { text, skipped } = buildStereoBlock(sc2);
    expect(skipped).toBe(0);
    expect(text).toContain('прямая C || (M||AB)');
    expect(text).toContain('Y = (C||(M||AB)) ∩ BC');
    expect(text).toContain('Z = (M||AB) ∩ (BCC1)');
    const back = parseStereoBlock(text);
    expect(back.errors).toEqual([]);
    const a = evaluateScene(sc2).points.Z.pos;
    const b = evaluateScene(back.scene).points.Z.pos;
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.y).toBeCloseTo(a.y, 9);
  });
});

describe('инструмент «Середина»', () => {
  const sc = {
    body: { kind: 'cube', a: 4 },
    ops: [{ id: 'm', type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5, ratio: [1, 1] }],
  };
  const m = evaluateScene(sc);
  const edge = m.lines.find((o) => o.id === 'edge:A-A1');
  const at = (t) => ({ x: edge.a.x + (edge.b.x - edge.a.x) * t, y: edge.a.y + (edge.b.y - edge.a.y) * t, z: edge.a.z + (edge.b.z - edge.a.z) * t });

  it('клик по отрезку — середина куска между соседними точками', () => {
    const r = toolClick('mid', [], { line: { id: edge.id, ref: ['A', 'A1'], t: 0.2, pos: at(0.2), p: edge.p, u: edge.u } }, m);
    expect(r.op).toMatchObject({ type: 'pointOnLine', ref: ['A', 'M'], t: 0.5, ratio: [1, 1] });
    const pos = evaluateScene({ ...sc, ops: [...sc.ops, r.op] }).points[r.op.name].pos;
    expect(pos.z).toBeCloseTo((m.points.A.pos.z + m.points.M.pos.z) / 2, 9);
  });

  it('две точки — середина между ними; и командой', async () => {
    const r1 = toolClick('mid', [], { point: 'A' }, m);
    expect(r1.pending).toEqual([{ kind: 'point', name: 'A' }]);
    expect(toolHint('mid', r1.pending)).toMatch(/выберите вторую/);
    const r2 = toolClick('mid', r1.pending, { point: 'C1' }, m);
    expect(r2.op).toMatchObject({ ref: ['A', 'C1'], t: 0.5, ratio: [1, 1] });
    const { parseCommand } = await import('../utils/stereo/commands');
    expect(parseCommand('середина AC1', m).op).toMatchObject({ ref: ['A', 'C1'], t: 0.5, ratio: [1, 1] });
    expect(parseCommand('O = середина отрезка AC1', m).op.name).toBe('O');
    expect(parseCommand('середина A', m).error).toMatch(/двух точек/);
  });

  it('в редакторе: инструмент на клавише M', () => {
    localStorage.clear();
    render(<AntApp><StereoEditor /></AntApp>);
    fireEvent.keyDown(window, { key: 'm', code: 'KeyM' });
    expect(screen.getByText(/появится его середина/)).toBeTruthy();
  });
});
