import { describe, it, expect } from 'vitest';
import {
  evaluateScene, tryAppendOp, removeOpCascade, renamePointInScene,
  parseCommand, describeOp, opToCommand, renderStereo, DEFAULT_CAMERA,
  toolClick, acceptedKinds, TOOLS, nextFootName,
} from '../utils/stereo';
import { parseStereoBlock, buildStereoBlock } from '../utils/stereo/dsl';
import { sub, dot, dist, len } from '../utils/stereo/vec3';

const cube = { kind: 'cube', a: 4 };
const pyramid = { kind: 'pyramid', n: 4, a: 4, h: 5, apex: 'S' };

/** Сцена из строк команд — так же, как её набирает учитель. */
function build(cmds, body = cube) {
  let scene = { body, ops: [] };
  for (const cmd of cmds) {
    const r = parseCommand(cmd, evaluateScene(scene));
    expect({ cmd, error: r.error }).toEqual({ cmd, error: undefined });
    const res = tryAppendOp(scene, r.op);
    expect({ cmd, error: res.error }).toEqual({ cmd, error: null });
    scene = res.scene;
  }
  return scene;
}
const pos = (m, n) => m.points[n].pos;
const perpTo = (a, b) => Math.abs(dot(a, b)) < 1e-9;

describe('перпендикуляр к прямой', () => {
  it('основание — проекция точки, отрезок и знак прямого угла', () => {
    const m = evaluateScene(build(['H = A1 ⊥ BD']));
    const H = pos(m, 'H');
    expect(perpTo(sub(pos(m, 'A1'), H), sub(pos(m, 'D'), pos(m, 'B')))).toBe(true);
    // Основание — центр основания куба: середина BD.
    expect(dist(H, { x: (pos(m, 'B').x + pos(m, 'D').x) / 2, y: (pos(m, 'B').y + pos(m, 'D').y) / 2, z: pos(m, 'B').z })).toBeLessThan(1e-9);
    const seg = m.lines.find((l) => l.kind === 'segment');
    expect(seg.ref).toEqual(['A1', 'H']);
    // BD в кубе не нарисована — она дорисовалась до основания.
    expect(m.lines.some((l) => l.kind === 'ext')).toBe(true);
    expect(m.marks).toHaveLength(1);
    const [mk] = m.marks;
    expect(perpTo(mk.a, mk.b)).toBe(true);
    expect(len(mk.a)).toBeCloseTo(len(mk.b), 9);
    expect(perpTo(mk.b, sub(pos(m, 'A1'), H))).toBe(true);
  });

  it('основание на продолжении — прямая дотягивается до него', () => {
    // K — на продолжении AB за точку B; перпендикуляр из K на A1B1 падает за B1.
    const m = evaluateScene(build(['K на AB 1,5', 'H = K ⊥ A1B1']));
    const t = dot(sub(pos(m, 'H'), pos(m, 'A1')), sub(pos(m, 'B1'), pos(m, 'A1'))) / 16;
    expect(t).toBeCloseTo(1.5, 9);
    const ext = m.lines.filter((l) => l.kind === 'ext' && l.step === 1);
    expect(ext).toHaveLength(1);
  });

  it('точка на самой прямой — понятная ошибка', () => {
    const sc = build(['M на AB 1:2']);
    const r = parseCommand('M ⊥ AB', evaluateScene(sc));
    const res = tryAppendOp(sc, r.op);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/лежит на прямой AB/);
    expect(res.model.points.H).toBeUndefined();
    expect(res.model.marks).toHaveLength(0);
  });

  it('перпендикуляр вдоль ребра не рисуется второй раз, основание — синоним вершины', () => {
    const m = evaluateScene(build(['A1 ⊥ AB']));
    expect(m.points.H.alias).toBe('A');
    expect(m.lines.filter((l) => l.kind !== 'edge')).toHaveLength(0);
    expect(m.marks).toHaveLength(1);
  });

  it('к параллельной прямой — по ссылке «(P||AB)»', () => {
    const m = evaluateScene(build(['P на AA1 1:1', 'прямая P || AB', 'H = C1 ⊥ (P||AB)']));
    expect(perpTo(sub(pos(m, 'C1'), pos(m, 'H')), sub(pos(m, 'B'), pos(m, 'A')))).toBe(true);
    expect(m.steps.every((s) => s.ok)).toBe(true);
  });
});

describe('перпендикуляр к плоскости', () => {
  it('высота пирамиды: основание — центр квадрата', () => {
    const sc = build(['O = S ⊥ (ABC)'], pyramid);
    const m = evaluateScene(sc);
    const O = pos(m, 'O');
    for (const v of ['A', 'B', 'C', 'D']) expect(dist(O, pos(m, v))).toBeCloseTo(dist(O, pos(m, 'A')), 9);
    expect(dist(pos(m, 'S'), O)).toBeCloseTo(5, 9);
    expect(m.lines.find((l) => l.kind === 'segment').ref).toEqual(['S', 'O']);
    // В плоскости основания через O ничего не проведено — знака пока нет…
    expect(m.marks).toHaveLength(0);
    // …он появляется, когда проведена OA.
    const m2 = evaluateScene(build(['O = S ⊥ (ABC)', 'OA'], pyramid));
    expect(m2.marks).toHaveLength(1);
    expect(dot(m2.marks[0].b, sub(pos(m2, 'A'), pos(m2, 'O')))).toBeGreaterThan(0);
  });

  it('к плоскости сечения: расстояние от вершины до (A1BD)', () => {
    const m = evaluateScene(build(['сечение A1BD', 'H = A ⊥ (A1BD)']));
    const H = pos(m, 'H');
    const AH = sub(H, pos(m, 'A'));
    expect(perpTo(AH, sub(pos(m, 'B'), pos(m, 'A1')))).toBe(true);
    expect(perpTo(AH, sub(pos(m, 'D'), pos(m, 'A1')))).toBe(true);
    expect(len(AH)).toBeCloseTo(4 / Math.sqrt(3), 9);
  });

  it('точка в самой плоскости — восставляется прямая, внутрь тела, доля = расстояние', () => {
    const sc = build(['M на AC 1:1', 'M ⊥ (ABC)', 'K на (M⊥ABC) 3']);
    const m = evaluateScene(sc);
    expect(sc.ops[1].name).toBeUndefined();
    expect(m.lines.find((l) => l.id === sc.ops[1].id).kind).toBe('line');
    const MK = sub(pos(m, 'K'), pos(m, 'M'));
    expect(len(MK)).toBeCloseTo(3, 9);
    expect(MK.z).toBeCloseTo(3, 9); // вверх, внутрь куба
    // От верхней грани — вниз.
    const top = evaluateScene(build(['A1 ⊥ (A1B1C1)', 'K на (A1⊥A1B1C1) 1']));
    expect(pos(top, 'K').z).toBeCloseTo(pos(top, 'A1').z - 1, 9);
  });

  it('восставленный перпендикуляр: знак угла — с прямой плоскости через точку', () => {
    const m = evaluateScene(build(['M на AC 1:1', 'AC', 'M ⊥ (ABC)']));
    expect(m.marks).toHaveLength(1);
    expect(perpTo(m.marks[0].a, m.marks[0].b)).toBe(true);
  });

  it('ссылка на несуществующий перпендикуляр — подсказка', () => {
    const r = parseCommand('K на (A⊥ABC) 3', evaluateScene({ body: cube, ops: [] }));
    expect(r.error).toMatch(/сначала «A ⊥ \(ABC\)»/);
  });
});

describe('перпендикуляр: команды и журнал', () => {
  it('разные записи одной команды', () => {
    const m = evaluateScene({ body: cube, ops: [] });
    const a = parseCommand('H = A1 ⊥ BD', m).op;
    expect(a).toMatchObject({ type: 'perp', name: 'H', from: 'A1', ref: ['B', 'D'] });
    expect(parseCommand('перпендикуляр A1 BD', m).op).toMatchObject({ type: 'perp', name: 'H', from: 'A1', ref: ['B', 'D'] });
    expect(parseCommand('K = перпендикуляр из точки A1 к прямой BD', m).op).toMatchObject({ name: 'K', ref: ['B', 'D'] });
    expect(parseCommand('перпендикуляр из A1 на BCD', m).op).toMatchObject({ type: 'perp', name: 'H', from: 'A1', plane: ['B', 'C', 'D'] });
    // Русская раскладка: буквы-двойники читаются как латинские.
    expect(parseCommand('А1 ⊥ ( ВСЕ )', m).op).toMatchObject({ from: 'A1', plane: ['B', 'C', 'E'] });
    expect(parseCommand('perp A1 BCD', m).op).toMatchObject({ plane: ['B', 'C', 'D'] });
    expect(parseCommand('A1 ⊥ B', m).error).toBeTruthy();
  });

  it('имя основания — H, потом H1', () => {
    expect(nextFootName(new Set())).toBe('H');
    expect(nextFootName(new Set(['H']))).toBe('H1');
    const sc = build(['A1 ⊥ BD', 'C1 ⊥ (A1BD)']);
    expect(sc.ops.map((o) => o.name)).toEqual(['H', 'H1']);
  });

  it('описание и команда обратно', () => {
    const sc = build(['H = A1 ⊥ BD', 'K = A ⊥ (A1BD)', 'B ⊥ (ABC)']);
    const byId = evaluateScene(sc).opsById;
    expect(sc.ops.map((o) => describeOp(o, byId))).toEqual([
      'A₁H ⊥ BD', 'AK ⊥ (A₁BD)', 'Прямая через B ⊥ (ABC)',
    ]);
    expect(sc.ops.map((o) => opToCommand(o, byId))).toEqual([
      'H = A1 ⊥ BD', 'K = A ⊥ (A1BD)', 'B ⊥ (ABC)',
    ]);
  });

  it('блок ```stereo: туда и обратно', () => {
    const sc = build(['M на AC 1:1', 'M ⊥ (ABC)', 'K на (M⊥ABC) 3', 'H = K ⊥ BB1']);
    const { text, skipped } = buildStereoBlock(sc, DEFAULT_CAMERA);
    expect(skipped).toBe(0);
    expect(text).toContain('M ⊥ (ABC)');
    expect(text).toContain('K на (M⊥ABC) 3');
    const back = parseStereoBlock(text);
    expect(back.errors).toEqual([]);
    const m1 = evaluateScene(sc);
    const m2 = evaluateScene(back.scene);
    for (const n of ['M', 'K', 'H']) expect(dist(pos(m1, n), pos(m2, n))).toBeLessThan(1e-9);
  });

  it('удаление и переименование задевают перпендикуляр', () => {
    const sc = build(['M на AA1 1:1', 'H = M ⊥ BD', 'HC1']);
    expect(removeOpCascade(sc, sc.ops[0].id).scene.ops).toHaveLength(0);
    expect(removeOpCascade(sc, sc.ops[1].id).scene.ops).toHaveLength(1);
    const renamed = renamePointInScene(sc, 'M', 'P');
    expect(renamed.ops[1].from).toBe('P');
    expect(evaluateScene(renamed).steps.every((s) => s.ok)).toBe(true);
  });
});

describe('перпендикуляр: инструмент и чертёж', () => {
  it('точка → прямая, точка → грань, точка → сечение', () => {
    expect(TOOLS.find((t) => t.key === 'perp')).toMatchObject({ hot: 'H', glyph: '⊥' });
    expect(new Set(TOOLS.map((t) => t.hot)).size).toBe(TOOLS.length);
    expect(acceptedKinds('perp', [])).toEqual(['point']);

    const sc = build(['сечение A1BD']);
    const m = evaluateScene(sc);
    const first = toolClick('perp', [], { point: 'A1' }, m);
    expect(first.pending).toEqual([{ kind: 'point', name: 'A1' }]);

    const toLine = toolClick('perp', first.pending, { line: { id: 'edge:B-C', ref: ['B', 'C'] } }, m);
    expect(toLine.op).toMatchObject({ type: 'perp', name: 'H', from: 'A1', ref: ['B', 'C'] });

    const toFace = toolClick('perp', first.pending, { face: { id: 'f', verts: ['A', 'B', 'C', 'D'] } }, m);
    expect(toFace.op).toMatchObject({ type: 'perp', name: 'H', from: 'A1', plane: ['A', 'B', 'C', 'D'] });

    // A1 лежит в самом сечении — восставляем, имени нет.
    const toPoly = toolClick('perp', first.pending, { poly: { id: sc.ops[0].id }, face: { id: 'f', verts: ['A', 'B', 'C', 'D'] } }, m);
    expect(toPoly.op).toMatchObject({ type: 'perp', from: 'A1', plane: ['A1', 'B', 'D'] });
    expect(toPoly.op.name).toBeUndefined();

    const fromC = toolClick('perp', [{ kind: 'point', name: 'C' }], { poly: { id: sc.ops[0].id } }, m);
    expect(fromC.op.name).toBe('H');
  });

  it('знак прямого угла попадает в чертёж двумя штрихами и не ловится кликом', () => {
    const m = evaluateScene(build(['H = A1 ⊥ BD']));
    const frame = renderStereo(m, DEFAULT_CAMERA, { width: 400, height: 340 });
    const marks = frame.strokes.filter((s) => s.kind === 'mark');
    expect(marks.length).toBeGreaterThanOrEqual(2);
    expect(new Set(marks.map((s) => s.objId))).toEqual(new Set([m.marks[0].id]));
    expect(frame.hits.lines.some((l) => l.id === m.marks[0].id)).toBe(false);
  });
});
