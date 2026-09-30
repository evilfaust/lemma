import { describe, it, expect } from 'vitest';
import {
  evaluateScene, tryAppendOp, removeOpCascade, renamePointInScene,
  parseCommand, describeOp, opToCommand, renderStereo, DEFAULT_CAMERA,
  toolClick, acceptedKinds, TOOLS, nextFootName,
} from '../utils/stereo';
import { parseStereoBlock, buildStereoBlock } from '../utils/stereo/dsl';
import { sub, dot, dist, len, distToLine } from '../utils/stereo/vec3';

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

  it('точка на самой прямой без плоскости — ошибка с подсказкой грани', () => {
    const sc = build(['M на AB 1:2']);
    const r = parseCommand('M ⊥ AB', evaluateScene(sc));
    const res = tryAppendOp(sc, r.op);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/лежит на прямой AB — .*укажите плоскость, например «M ⊥ AB в ABC»/);
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

describe('перпендикуляр к прямой из точки на ней — в плоскости', () => {
  it('серединный перпендикуляр к диагонали AC в основании — это прямая BD', () => {
    const sc = build(['M на AC 1:1', 'M ⊥ AC в ABC', 'K на (M⊥AC в ABC) 2']);
    expect(sc.ops[1]).toMatchObject({ type: 'perp', from: 'M', ref: ['A', 'C'], within: ['A', 'B', 'C'] });
    expect(sc.ops[1].name).toBeUndefined();
    const m = evaluateScene(sc);
    const MK = sub(pos(m, 'K'), pos(m, 'M'));
    expect(len(MK)).toBeCloseTo(2, 9);
    expect(perpTo(MK, sub(pos(m, 'C'), pos(m, 'A')))).toBe(true);
    expect(MK.z).toBeCloseTo(0, 9); // в плоскости основания
    // Прямая через M ⊥ AC в основании куба проходит через B и D.
    const line = m.lines.find((l) => l.id === sc.ops[1].id);
    expect(distToLine(pos(m, 'B'), line.p, line.u)).toBeLessThan(1e-9);
    expect(distToLine(pos(m, 'D'), line.p, line.u)).toBeLessThan(1e-9);
    expect(m.marks).toHaveLength(1);
    expect(perpTo(m.marks[0].a, m.marks[0].b)).toBe(true);
  });

  it('в вертикальной плоскости — вверх, внутрь тела', () => {
    const m = evaluateScene(build(['M на AC 1:1', 'M ⊥ AC в AA1C', 'K на (M⊥AC в AA1C) 3']));
    expect(sub(pos(m, 'K'), pos(m, 'M')).z).toBeCloseTo(3, 9);
  });

  it('плоскость без прямой или без точки — понятные ошибки', () => {
    const sc = build(['M на AC 1:1']);
    const bad = (cmd) => tryAppendOp(sc, parseCommand(cmd, evaluateScene(sc)).op).error;
    expect(bad('M ⊥ AC в ABB1')).toMatch(/не лежит в плоскости \(ABB₁\)/);
    expect(bad('M ⊥ AC в A1B1C1')).toMatch(/Точка M не лежит в плоскости/);
  });

  it('точка вне прямой — плоскость не нужна, обычный опущенный перпендикуляр', () => {
    const op = parseCommand('C1 ⊥ AC в ABC', evaluateScene({ body: cube, ops: [] })).op;
    expect(op).toMatchObject({ name: 'H', from: 'C1', ref: ['A', 'C'] });
    expect(op.within).toBeUndefined();
  });

  it('команда, описание, блок ```stereo — туда и обратно', () => {
    const sc = build(['M на AC 1:1', 'перпендикуляр M AC в плоскости ABC', 'K на (M ⊥ AC в ABC) 2']);
    const byId = evaluateScene(sc).opsById;
    expect(describeOp(sc.ops[1], byId)).toBe('Прямая через M ⊥ AC в (ABC)');
    expect(opToCommand(sc.ops[1], byId)).toBe('M ⊥ AC в ABC');
    expect(opToCommand(sc.ops[2], byId)).toBe('K на (M⊥AC в ABC) 2');
    const { text, skipped } = buildStereoBlock(sc, DEFAULT_CAMERA);
    expect(skipped).toBe(0);
    const back = parseStereoBlock(text);
    expect(back.errors).toEqual([]);
    expect(dist(pos(evaluateScene(back.scene), 'K'), pos(evaluateScene(sc), 'K'))).toBeLessThan(1e-9);
    const renamed = renamePointInScene(sc, 'B', 'E');
    expect(renamed.ops[1].within).toEqual(['A', 'E', 'C']);
  });

  it('ссылка на несуществующий — подсказка', () => {
    const r = parseCommand('K на (M⊥AC в ABC) 2', evaluateScene(build(['M на AC 1:1'])));
    expect(r.error).toMatch(/сначала «M ⊥ AC в ABC»/);
  });

  it('инструмент: точка → прямая, на которой она лежит → грань', () => {
    const m = evaluateScene(build(['M на AC 1:1', 'AC']));
    const acId = m.lines.find((l) => l.kind === 'segment').id;
    let r = toolClick('perp', [], { point: 'M' }, m);
    r = toolClick('perp', r.pending, { line: { id: acId, ref: ['A', 'C'] } }, m);
    expect(r.op).toBeUndefined();
    expect(r.pending.map((p) => p.kind)).toEqual(['point', 'line']);
    expect(acceptedKinds('perp', r.pending)).toEqual(['poly', 'face']);
    r = toolClick('perp', r.pending, { face: { id: 'f', verts: ['A', 'B', 'C', 'D'] } }, m);
    expect(r.op).toMatchObject({ type: 'perp', from: 'M', ref: ['A', 'C'], within: ['A', 'B', 'C', 'D'] });
    expect(r.pending).toEqual([]);
  });
});


describe('перпендикулярная плоскость', () => {
  const near = (a, b) => dist(a, b) < 1e-9;
  const polyOf = (m, sc, k) => m.polys.find((pg) => pg.id === sc.ops[k].id);

  it('через вершину A ⊥ диагонали BD1 — треугольник AB1C', () => {
    const sc = build(['сечение A ⊥ BD1']);
    const m = evaluateScene(sc);
    const pg = polyOf(m, sc, 0);
    expect(pg.kind).toBe('section');
    expect(pg.pts).toHaveLength(3);
    for (const v of ['A', 'B1', 'C']) expect(pg.pts.some((p) => near(p, pos(m, v)))).toBe(true);
  });

  it('через центр куба ⊥ диагонали — правильный шестиугольник', () => {
    const sc = build(['O = середина BD1', 'сечение через O перпендикулярно BD1']);
    const pg = polyOf(evaluateScene(sc), sc, 1);
    expect(pg.pts).toHaveLength(6);
    const sides = pg.pts.map((p, i) => dist(p, pg.pts[(i + 1) % 6]));
    for (const s of sides) expect(s).toBeCloseTo(2 * Math.sqrt(2), 9);
  });

  it('через прямую ⊥ плоскости: AB ⊥ (ABC) — грань ABB1A1, «плоскость» — полупрозрачная', () => {
    const sc = build(['плоскость AB ⊥ (ABC)']);
    const m = evaluateScene(sc);
    const pg = polyOf(m, sc, 0);
    expect(pg.kind).toBe('plane');
    expect(pg.pts).toHaveLength(4);
    for (const v of ['A', 'B', 'B1', 'A1']) expect(pg.pts.some((p) => near(p, pos(m, v)))).toBe(true);
  });

  it('прямая ⊥ плоскости — таких плоскостей много', () => {
    const sc = { body: cube, ops: [] };
    const r = parseCommand('плоскость AA1 ⊥ (ABC)', evaluateScene(sc));
    expect(tryAppendOp(sc, r.op).error).toMatch(/перпендикулярна плоскости \(ABC\)/);
  });

  it('понятные ошибки разбора', () => {
    const m = evaluateScene({ body: cube, ops: [] });
    expect(parseCommand('сечение M ⊥ ABC', m).error).toMatch(/задайте прямую/);
    expect(parseCommand('плоскость AB ⊥ CD', m).error).toMatch(/задайте плоскость/);
    expect(parseCommand('X = AA1 ∩ (M⊥BD1)', m).error).toMatch(/сначала «сечение M ⊥ BD1»/);
  });

  it('ссылка «(M⊥BD1)»: след и перпендикуляр к ней', () => {
    const sc = build(['M на AA1 1:1', 'сечение M ⊥ BD1', 'X = CC1 ∩ (M⊥BD1)', 'H = C ⊥ (M⊥BD1)']);
    const m = evaluateScene(sc);
    const u = sub(pos(m, 'D1'), pos(m, 'B'));
    expect(dot(sub(pos(m, 'X'), pos(m, 'M')), u)).toBeCloseTo(0, 9);
    const CH = sub(pos(m, 'H'), pos(m, 'C'));
    expect(len({ x: CH.y * u.z - CH.z * u.y, y: CH.z * u.x - CH.x * u.z, z: CH.x * u.y - CH.y * u.x })).toBeLessThan(1e-9);
    expect(dot(sub(pos(m, 'H'), pos(m, 'M')), u)).toBeCloseTo(0, 9);
    // «(M⊥BD1)» — плоскость, прямой быть не может.
    expect(parseCommand('K на (M⊥BD1) 1', m).error).toMatch(/это плоскость/);
  });

  it('вложенно: плоскость через прямую ⊥ перпендикулярной плоскости', () => {
    const sc = build(['O = середина BD1', 'сечение O ⊥ BD1']);
    // BD1 сама перпендикулярна этой плоскости — плоскость через неё не единственная.
    const r = parseCommand('плоскость BD1 ⊥ (O⊥BD1)', evaluateScene(sc));
    expect(tryAppendOp(sc, r.op).error).toMatch(/перпендикулярна плоскости \(O ⊥ BD₁\)/);
    const sc2 = build(['O = середина BD1', 'сечение O ⊥ BD1', 'сечение AC ⊥ (O⊥BD1)']);
    expect(evaluateScene(sc2).steps.every((st) => st.ok)).toBe(true);
  });

  it('описание, команда и блок ```stereo — туда и обратно', () => {
    const sc = build(['M на AA1 1:1', 'сечение M ⊥ BD1', 'X = CC1 ∩ (M⊥BD1)', 'плоскость AB ⊥ (M⊥BD1)', 'H = C ⊥ (M⊥BD1)']);
    const byId = evaluateScene(sc).opsById;
    expect(sc.ops.slice(1).map((o) => describeOp(o, byId))).toEqual([
      'Сечение через M ⊥ BD₁', 'X = CC₁ ∩ (M ⊥ BD₁)', 'Плоскость через AB ⊥ (M ⊥ BD₁)', 'CH ⊥ (M ⊥ BD₁)',
    ]);
    expect(sc.ops.slice(1).map((o) => opToCommand(o, byId))).toEqual([
      'сечение M ⊥ BD1', 'X = CC1 ∩ (M⊥BD1)', 'плоскость AB ⊥ (M⊥BD1)', 'H = C ⊥ (M⊥BD1)',
    ]);
    const { text, skipped } = buildStereoBlock(sc, DEFAULT_CAMERA);
    expect(skipped).toBe(0);
    const back = parseStereoBlock(text);
    expect(back.errors).toEqual([]);
    const m1 = evaluateScene(sc);
    const m2 = evaluateScene(back.scene);
    for (const n of ['X', 'H']) expect(dist(pos(m1, n), pos(m2, n))).toBeLessThan(1e-9);
    expect(m2.polys.map((pg) => pg.kind)).toEqual(['section', 'plane']);
  });

  it('удаление плоскости уносит след и перпендикуляр к ней; переименование', () => {
    const sc = build(['M на AA1 1:1', 'сечение M ⊥ BD1', 'X = CC1 ∩ (M⊥BD1)', 'H = C ⊥ (M⊥BD1)']);
    expect(removeOpCascade(sc, sc.ops[1].id).scene.ops).toHaveLength(1);
    const renamed = renamePointInScene(sc, 'M', 'P');
    expect(renamed.ops[1].from).toBe('P');
    expect(evaluateScene(renamed).steps.every((st) => st.ok)).toBe(true);
  });

  it('инструмент: точка → прямая; прямая → грань; «Перпендикуляр» к такой плоскости', () => {
    const sc = build(['M на AA1 1:1', 'сечение M ⊥ BD1']);
    const m = evaluateScene(sc);
    expect(TOOLS.find((t) => t.key === 'perpPlane').hot).toBe('N');
    expect(acceptedKinds('perpPlane', [])).toEqual(['point', 'line']);

    let r = toolClick('perpPlane', [], { point: 'M' }, m);
    expect(acceptedKinds('perpPlane', r.pending)).toEqual(['line']);
    r = toolClick('perpPlane', r.pending, { line: { id: 'edge:A-B', ref: ['A', 'B'] } }, m);
    expect(r.op).toMatchObject({ type: 'perpPlane', from: 'M', ref: ['A', 'B'], style: 'section' });

    r = toolClick('perpPlane', [], { line: { id: 'edge:A-B', ref: ['A', 'B'] } }, m);
    expect(acceptedKinds('perpPlane', r.pending)).toEqual(['poly', 'face']);
    r = toolClick('perpPlane', r.pending, { face: { id: 'f', verts: ['A', 'B', 'C', 'D'] } }, m);
    expect(r.op).toMatchObject({ type: 'perpPlane', line: ['A', 'B'], plane: ['A', 'B', 'C', 'D'] });

    const toPlane = toolClick('perp', [{ kind: 'point', name: 'C' }], { poly: { id: sc.ops[1].id } }, m);
    expect(toPlane.op).toMatchObject({ type: 'perp', name: 'H', from: 'C', plane: sc.ops[1].id });
    expect(tryAppendOp(sc, toPlane.op).ok).toBe(true);
  });
});

describe('угол между прямой и плоскостью', () => {
  const deg = (x) => (x * 180) / Math.PI;
  const valueOf = (m, k) => m.steps[k].created.value;

  it('диагональ куба и основание: точки уже есть — новых не появляется', () => {
    const sc = build(['угол A1C (ABC)']);
    expect(sc.ops[0].at).toBeUndefined();
    expect(sc.ops[0].foot).toBeUndefined();
    const m = evaluateScene(sc);
    expect(m.steps[0].created.angle).toEqual(['A1', 'C', 'A']);
    expect(valueOf(m, 0)).toBe(`≈ ${String(Math.round(deg(Math.atan(1 / Math.sqrt(2))) * 100) / 100).replace('.', ',')}°`);
    expect(m.steps[0].created.note).toMatch(/^∠\(A₁C, \(ABC\)\) = ∠A₁CA ≈ 35,26°$/);
    // A1A — ребро, повторно не рисуется; CA — диагональ основания — рисуется.
    const segs = m.lines.filter((l) => l.kind === 'segment');
    expect(segs.map((l) => l.ref)).toEqual([['C', 'A']]);
    expect(m.arcs).toHaveLength(1);
    expect(m.marks).toHaveLength(1);
  });

  it('боковое ребро пирамиды и основание: основание высоты получает имя H', () => {
    const sc = build(['угол SA (ABC)'], pyramid);
    expect(sc.ops[0]).toMatchObject({ foot: 'H' });
    expect(sc.ops[0].at).toBeUndefined();
    const m = evaluateScene(sc);
    const H = pos(m, 'H');
    for (const v of ['A', 'B', 'C', 'D']) expect(dist(H, pos(m, v))).toBeCloseTo(2 * Math.sqrt(2), 9);
    expect(valueOf(m, 0)).toBe(`≈ ${String(Math.round(deg(Math.atan(5 / (2 * Math.sqrt(2)))) * 100) / 100).replace('.', ',')}°`);
  });

  it('пересечение вне тела — новая точка, прямая дорисовывается; свои имена', () => {
    const sc = build(['P на AA1 0,3', 'угол PC1 (ABC) основание Q след Z']);
    expect(sc.ops[1]).toMatchObject({ at: 'Z', foot: 'Q' });
    const m = evaluateScene(sc);
    expect(pos(m, 'Z').z).toBeCloseTo(pos(m, 'A').z, 9);
    // основание перпендикуляра из P — вершина A: Q — её синоним
    expect(m.points.Q.alias).toBe('A');
    expect(m.lines.some((l) => l.kind === 'ext' && l.step === 1)).toBe(true);
  });

  it('параллельна, лежит в плоскости, перпендикулярна — понятные ошибки', () => {
    const sc = { body: cube, ops: [] };
    const err = (cmd) => tryAppendOp(sc, parseCommand(cmd, evaluateScene(sc)).op).error;
    expect(err('угол A1B1 (ABC)')).toMatch(/параллельна плоскости \(ABC\) — угол между ними 0°/);
    expect(err('угол AC (ABC)')).toMatch(/лежит в плоскости/);
    expect(err('угол AA1 (ABC)')).toMatch(/перпендикулярна плоскости \(ABC\) — угол 90°/);
    expect(parseCommand('угол AB CD', evaluateScene(sc)).error).toMatch(/угол SA \(ABC\)/);
  });

  it('записи команды: словами, плоскость первой, ссылка на перпендикулярную плоскость', () => {
    const m = evaluateScene({ body: cube, ops: [] });
    expect(parseCommand('угол между BD1 и (ABB1)', m).op).toMatchObject({ type: 'angle', ref: ['B', 'D1'], plane: ['A', 'B', 'B1'] });
    expect(parseCommand('угол (ABC) A1C', m).op).toMatchObject({ ref: ['A1', 'C'], plane: ['A', 'B', 'C'] });
    const sc = build(['O = середина BD1', 'сечение O ⊥ BD1', 'угол AC1 (O⊥BD1)']);
    expect(evaluateScene(sc).steps.every((st) => st.ok)).toBe(true);
  });

  it('описание, команда, блок ```stereo; величина в сцену не попадает', () => {
    const sc = build(['угол SA (ABC)', 'HB'], pyramid);
    const byId = evaluateScene(sc).opsById;
    expect(describeOp(sc.ops[0], byId)).toBe('Угол между SA и (ABC)');
    expect(opToCommand(sc.ops[0], byId)).toBe('угол SA (ABC) основание H');
    const { text } = buildStereoBlock(sc, DEFAULT_CAMERA);
    const back = parseStereoBlock(text);
    expect(back.errors).toEqual([]);
    expect(dist(pos(evaluateScene(back.scene), 'H'), pos(evaluateScene(sc), 'H'))).toBeLessThan(1e-9);
    // Эфир и пособия передают сцену — там ни величины, ни «°».
    expect(JSON.stringify(sc)).not.toMatch(/°/);
    expect(text).not.toMatch(/°/);
  });

  it('удаление и переименование', () => {
    const sc = build(['угол SA (ABC)', 'HB'], pyramid);
    expect(removeOpCascade(sc, sc.ops[0].id).scene.ops).toHaveLength(0);
    const renamed = renamePointInScene(sc, 'H', 'O');
    expect(renamed.ops[0].foot).toBe('O');
    expect(renamed.ops[1].ref).toEqual(['O', 'B']);
    expect(evaluateScene(renamed).steps.every((st) => st.ok)).toBe(true);
  });

  it('инструмент: прямая → грань; дуга рисуется штрихами и не ловится кликом', () => {
    const m0 = evaluateScene({ body: pyramid, ops: [] });
    expect(TOOLS.find((t) => t.key === 'angle').hot).toBe('E');
    expect(acceptedKinds('angle', [])).toEqual(['line']);
    let r = toolClick('angle', [], { line: { id: 'edge:A-S', ref: ['A', 'S'] } }, m0);
    expect(acceptedKinds('angle', r.pending)).toEqual(['poly', 'face']);
    r = toolClick('angle', r.pending, { face: { id: 'f', verts: ['A', 'B', 'C', 'D'] } }, m0);
    expect(r.op).toMatchObject({ type: 'angle', ref: ['A', 'S'], plane: ['A', 'B', 'C', 'D'], foot: 'H' });

    const m = evaluateScene({ body: pyramid, ops: [r.op] });
    const frame = renderStereo(m, DEFAULT_CAMERA, { width: 400, height: 340 });
    const arc = frame.strokes.filter((st) => st.objId === m.arcs[0].id);
    expect(arc.length).toBeGreaterThanOrEqual(14);
    expect(frame.hits.lines.some((l) => l.id === m.arcs[0].id)).toBe(false);
  });
});
