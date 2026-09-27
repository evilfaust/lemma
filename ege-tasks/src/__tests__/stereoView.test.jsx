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

  it('текст чертежа собирается, шаг отмечен как невыразимый', async () => {
    const { buildStereoBlock } = await import('../utils/stereo/dsl');
    const { opToCommand, describeOp } = await import('../utils/stereo/commands');
    expect(opToCommand(sc.ops[2])).toBe('');
    expect(describeOp(sc.ops[2], { par: sc.ops[1] })).toMatch(/K ∈/);
    const { text, skipped } = buildStereoBlock(sc);
    expect(skipped).toBe(1); // параллельная через P ∥ AB выражается, точка на ней — нет
    expect(text).toContain('# шаг не выражается текстом: pointOnLine');
  });

  it('редактор с таким чертежом не падает', () => {
    localStorage.clear();
    localStorage.setItem('stereo.editor.v1', JSON.stringify({ scene: sc, camera: { yaw: 22, pitch: 22, zoom: 1 } }));
    render(<AntApp><StereoEditor /></AntApp>);
    expect(screen.getByText('Шаги построения')).toBeTruthy();
  });
});
