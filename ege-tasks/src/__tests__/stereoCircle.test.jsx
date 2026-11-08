import { expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App as AntApp } from 'antd';
import StereoEditor from '../components/stereo/StereoEditor';
import {
  buildStereoBlock, evaluateScene, finishPending, parseStereoBlock, pickCircle, pickCircleTarget,
  removeOpCascade, renamePoint, renderStereo, toolClick, tryAppendOp,
} from '../utils/stereo';
import { dist } from '../utils/stereo/vec3';

const POINTS = 'пространство\nO = (0; 0; 0)\nA = (3; 0; 0)\nB = (0; 0; 3)\nC = (-3; 0; 0)';

it('строит окружность в пространстве через три точки и пересчитывает её при правке', () => {
  const { scene, errors } = parseStereoBlock(`${POINTS}\nокружность ABC`);
  expect(errors).toEqual([]);
  const { circles, points } = evaluateScene(scene);
  expect(circles).toHaveLength(1);
  for (const p of circles[0].pts) {
    expect(p.y).toBeCloseTo(0, 12);
    expect(dist(p, points.O.pos)).toBeCloseTo(3, 12);
  }
  expect(evaluateScene(scene, { upTo: scene.ops.length - 1 }).circles).toEqual([]);
  const { scene: renamed } = renamePoint(scene, 'B', 'K');
  expect(renamed.ops.at(-1).pts).toEqual(['A', 'K', 'C']);
  expect(removeOpCascade(renamed, renamed.ops[2].id).scene.ops.some((op) => op.type === 'circle')).toBe(false);
});

it('по центру завершает горизонтальную окружность кнопкой или задаёт наклон третьей точкой', () => {
  const { scene } = parseStereoBlock(POINTS);
  const model = evaluateScene(scene);
  const mode = { circleMode: 'center' };
  const first = toolClick('circle', [], { point: 'O' }, model, mode);
  const second = toolClick('circle', first.pending, { point: 'A' }, model, mode);
  const flat = tryAppendOp(scene, finishPending('circle', second.pending, model, 'center').op);
  expect(flat.ok).toBe(true);
  expect(flat.model.circles[0].pts.every((p) => p.z === 0)).toBe(true);
  const upright = tryAppendOp(scene, toolClick('circle', second.pending, { point: 'B' }, model, mode).op);
  expect(upright.ok).toBe(true);
  expect(upright.model.circles[0].pts.every((p) => p.y === 0)).toBe(true);
});

it('строит горизонтальную окружность по введённому радиусу и клику по центру', () => {
  const { scene } = parseStereoBlock(POINTS);
  const model = evaluateScene(scene);
  const { op } = toolClick('circle', [], { point: 'B' }, model, { circleMode: 'radius', circleRadius: '2√3' });
  const result = tryAppendOp(scene, op);
  expect(result.ok).toBe(true);
  for (const point of result.model.circles[0].pts) {
    expect(point.z).toBe(3);
    expect(dist(point, model.points.B.pos)).toBeCloseTo(2 * Math.sqrt(3), 12);
  }
});

it.each([
  'окружность ABC',
  'окружность с центром O через A',
  'окружность с центром O через B в плоскости OAB',
  'окружность с центром O радиуса 2*sqrt(3)',
])('выгружает и читает без изменения геометрии: %s', (cmd) => {
  const { scene, errors } = parseStereoBlock(`${POINTS}\n${cmd}`);
  expect(errors).toEqual([]);
  const roundTrip = parseStereoBlock(buildStereoBlock(scene).text);
  expect(roundTrip.errors).toEqual([]);
  expect(evaluateScene(roundTrip.scene).circles[0].pts).toEqual(evaluateScene(scene).circles[0].pts);
});

it.each([
  ['окружность OAC', 'одной прямой'],
  ['окружность с центром O через B', 'одной плоскости'],
  ['окружность с центром O радиуса 0', 'больше нуля'],
])('отклоняет неверное построение: %s', (cmd, message) => {
  const result = parseStereoBlock(`${POINTS}\n${cmd}`);
  expect(result.errors).toMatchObject([{ message: expect.stringContaining(message) }]);
  expect(evaluateScene(result.scene).circles).toEqual([]);
});

it('делит окружность на видимую и скрытую дуги и даёт удалить её кликом', () => {
  const { scene, errors } = parseStereoBlock('куб 4\nO = (0; 0; 0)\nокружность с центром O радиуса 2,4');
  expect(errors).toEqual([]);
  const model = evaluateScene(scene);
  const frame = renderStereo(model, { yaw: 0, pitch: 25, zoom: 1 }, { width: 500, height: 400 });
  const arcs = frame.strokes.filter((stroke) => stroke.kind === 'circle');
  const visible = arcs.find((stroke) => !stroke.hidden);
  expect(visible).toBeTruthy();
  expect(arcs.some((stroke) => stroke.hidden && stroke.dashOffset)).toBe(true);
  const circle = pickCircle(frame, visible.x1, visible.y1);
  expect(circle).toBe(scene.ops.at(-1).id);
  expect(toolClick('erase', [], { circle }, model).erase).toEqual({ opId: circle });
});

it('показывает способы построения при выборе инструмента клавишей B', () => {
  render(<AntApp><StereoEditor embedded /></AntApp>);
  expect(screen.getByTitle('Окружность (B)')).toBeTruthy();
  fireEvent.keyDown(window, { key: 'b', code: 'KeyB' });
  expect(screen.getByText('Через три точки')).toBeTruthy();
  fireEvent.click(screen.getByText('По центру'));
  expect(screen.getByText('Выберите центр окружности')).toBeTruthy();
  fireEvent.click(screen.getByText('По радиусу'));
  expect(screen.getByLabelText('Радиус окружности')).toBeTruthy();
});

it('выбирает нужный конец диаметра кликом по окружности верхнего основания цилиндра с шаром', () => {
  const src = 'цилиндр 2 4 каркас\nи шар 2 вписано\nK = (1; 0; 2)\nпрямая KO1';
  const { scene, errors } = parseStereoBlock(src);
  expect(errors).toEqual([]);
  const model = evaluateScene(scene);
  const frame = renderStereo(model, { yaw: 0, pitch: 40, zoom: 1 }, { width: 500, height: 400 });
  const line = { id: scene.ops.at(-1).id, ref: ['K', 'O1'] };
  for (const x of [-2, 2]) {
    const projected = frame.project({ x, y: 0, z: 2 });
    const pick = pickCircleTarget(frame, projected.x, projected.y, 6, true);
    expect(pick.ref).toEqual(['O1']);
    const circleTarget = { ...pick, ...projected, project: frame.project };
    const first = toolClick('intersect', [], { line }, model);
    const last = toolClick('intersect', first.pending, { circleTarget }, model);
    const result = tryAppendOp(scene, last.op);
    expect(result.ok).toBe(true);
    expect(result.model.points[last.op.name].pos).toEqual({ x, y: 0, z: 2 });
    const roundTrip = parseStereoBlock(buildStereoBlock(result.scene).text);
    expect(roundTrip.errors).toEqual([]);
    expect(evaluateScene(roundTrip.scene).points[last.op.name].pos).toEqual({ x, y: 0, z: 2 });
  }
});

it.each([
  ['A = (2; 0; -1)\nB = (2; 0; 1)', { x: 2, y: 0, z: 0 }],
  ['A = (0; 2; 0)\nB = (1; 2; 0)', { x: 0, y: 2, z: 0 }],
  ['A = (0; 0; -1)\nB = (0; 0; 1)', null],
  ['A = (0; 0; 1)\nB = (1; 0; 1)', null],
])('учитывает положение прямой относительно плоскости окружности: %s', (line, expected) => {
  const src = `пространство\nO = (0; 0; 0)\n${line}\nокружность с центром O радиуса 2\nX = окр(#1) ∩ AB`;
  const { scene, errors } = parseStereoBlock(src);
  if (expected) {
    expect(errors).toEqual([]);
    expect(evaluateScene(scene).points.X.pos).toEqual(expected);
    expect(removeOpCascade(scene, scene.ops[3].id).scene.ops).toHaveLength(3);
  } else {
    expect(errors).toMatchObject([{ message: expect.stringContaining('нет общих точек в пространстве') }]);
  }
});

it('следит за именем центра основания и за построенной окружностью при выгрузке', () => {
  const src = 'цилиндр 2 4\nK = (1; 0; 2)\nX = KO1 ∩ окр(O1) 2';
  const parsed = parseStereoBlock(src);
  expect(parsed.errors).toEqual([]);
  const { scene } = renamePoint(parsed.scene, 'O1', 'P');
  const model = evaluateScene(scene);
  expect(model.points.X.pos.x).toBe(-2);
  const frame = renderStereo(model, { yaw: 0, pitch: 40, zoom: 1 }, { width: 500, height: 400 });
  const p = frame.project({ x: -2, y: 0, z: 2 });
  expect(pickCircleTarget(frame, p.x, p.y, 6, true).ref).toEqual(['P']);
  const output = buildStereoBlock(scene).text;
  expect(output).toContain('X = KP ∩ окр(P) 2');
  expect(parseStereoBlock(output).errors).toEqual([]);
  const custom = parseStereoBlock(`${POINTS}\nокружность ABC\nX = OA ∩ окр(#1) 2`);
  expect(custom.errors).toEqual([]);
  const rebuilt = parseStereoBlock(buildStereoBlock(custom.scene).text);
  expect(rebuilt.errors).toEqual([]);
  expect(evaluateScene(rebuilt.scene).points.X.pos).toEqual({ x: 3, y: 0, z: 0 });
});
