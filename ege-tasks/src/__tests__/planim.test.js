import { describe, it, expect } from 'vitest';
import {
  evaluateScene, tryAppendOps, removeOpCascade, renamePoint, applyAction,
  parseCommand, opToCommand, describeOp, normalizeCommand,
  figureOps, figurePoints, FIGURE_KINDS,
  parsePlanimBlock, buildPlanimBlock, planimSvgFromSpec, planimDrawingSvg, planimSpecFromSvg,
  planimBlockMarkdown, planimSpecFromInline, planimInlineFromSpec,
  renderPlanim, fitView, contentBox, planimFrame, formatMarkText, stylePieces,
  toolClick, TOOLS, toolHint, draggableOp, dragTarget, dragPosition, setOpPosition,
  snapPosition, snapAngle, snapWorld, nextFreeName, nextFreeNames,
  parseLineRef, parseCircleRef, lineRefText, circleRefText, segKey,
  circumcircle, incircle, lineCircle, circleCircle, tangentPoints, intersectLines,
} from '../utils/planim';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/** Собрать сцену из команд (каждая обязана разобраться и построиться). */
function build(...cmds) {
  let scene = { ops: [] };
  for (const cmd of cmds) {
    const r = parseCommand(cmd, evaluateScene(scene));
    expect({ cmd, error: r.error }).toEqual({ cmd, error: undefined });
    if (r.action) {
      const res = applyAction(scene, r);
      expect({ cmd, error: res.error }).toEqual({ cmd, error: undefined });
      scene = res.scene;
      continue;
    }
    const res = tryAppendOps(scene, r.ops || [r.op]);
    expect({ cmd, error: res.error }).toEqual({ cmd, error: null });
    scene = res.scene;
  }
  return scene;
}
const model = (...cmds) => evaluateScene(build(...cmds));

describe('геометрия', () => {
  it('пересечение прямых: точка, параллельны, совпадают', () => {
    const r = intersectLines({ p: { x: 0, y: 0 }, u: { x: 1, y: 1 } }, { p: { x: 0, y: 2 }, u: { x: 1, y: -1 } });
    expect(r.kind).toBe('point');
    expect(near(r.point.x, 1) && near(r.point.y, 1)).toBe(true);
    expect(intersectLines({ p: { x: 0, y: 0 }, u: { x: 1, y: 0 } }, { p: { x: 0, y: 1 }, u: { x: 2, y: 0 } }).kind).toBe('parallel');
    expect(intersectLines({ p: { x: 0, y: 0 }, u: { x: 1, y: 0 } }, { p: { x: 5, y: 0 }, u: { x: -2, y: 0 } }).kind).toBe('same');
  });

  it('описанная и вписанная окружности египетского треугольника', () => {
    const A = { x: 0, y: 0 }; const B = { x: 4, y: 0 }; const C = { x: 0, y: 3 };
    const cc = circumcircle(A, B, C);
    expect(near(cc.r, 2.5) && near(cc.c.x, 2) && near(cc.c.y, 1.5)).toBe(true);
    const ic = incircle(A, B, C);
    expect(near(ic.r, 1) && near(ic.c.x, 1) && near(ic.c.y, 1)).toBe(true);
    expect(circumcircle(A, B, { x: 8, y: 0 })).toBeNull();
  });

  it('прямая и окружность: две точки по возрастанию t, касание, мимо', () => {
    const C = { c: { x: 0, y: 0 }, r: 5 };
    const two = lineCircle({ p: { x: -10, y: 3 }, u: { x: 1, y: 0 } }, C);
    expect(two.map((h) => Math.round(h.point.x))).toEqual([-4, 4]);
    expect(lineCircle({ p: { x: -10, y: 5 }, u: { x: 1, y: 0 } }, C)).toHaveLength(1);
    expect(lineCircle({ p: { x: -10, y: 6 }, u: { x: 1, y: 0 } }, C)).toHaveLength(0);
  });

  it('две окружности и касательные из точки', () => {
    const r = circleCircle({ c: { x: 0, y: 0 }, r: 5 }, { c: { x: 6, y: 0 }, r: 5 });
    expect(r.points.map((p) => Math.round(p.y))).toEqual([4, -4]); // слева от луча центров — первая
    expect(circleCircle({ c: { x: 0, y: 0 }, r: 1 }, { c: { x: 6, y: 0 }, r: 1 }).kind).toBe('none');
    const t = tangentPoints({ x: 5, y: 0 }, { c: { x: 0, y: 0 }, r: 3 });
    expect(t.kind).toBe('points');
    for (const T of t.points) {
      expect(near(Math.hypot(T.x, T.y), 3)).toBe(true);
      expect(near(T.x * (T.x - 5) + T.y * T.y, 0)).toBe(true); // радиус ⊥ касательной
    }
    expect(tangentPoints({ x: 1, y: 0 }, { c: { x: 0, y: 0 }, r: 3 }).kind).toBe('inside');
  });
});

describe('фигуры', () => {
  it('у каждого вида — нужное число вершин и положительные размеры', () => {
    for (const kind of Object.keys(FIGURE_KINDS)) {
      if (kind === 'empty') continue;
      const pts = figurePoints({ kind });
      expect({ kind, ok: Array.isArray(pts) && pts.length >= 1 }).toEqual({ kind, ok: true });
    }
  });

  it('треугольник по трём сторонам: стороны те самые', () => {
    const m = model('треугольник ABC 5 6 7');
    const { A, B, C } = m.points;
    expect(near(d(A.pos, B.pos), 5, 1e-3)).toBe(true);
    expect(near(d(B.pos, C.pos), 6, 1e-3)).toBe(true);
    expect(near(d(A.pos, C.pos), 7, 1e-3)).toBe(true);
    expect(m.lines.filter((l) => l.kind === 'side')).toHaveLength(3);
  });

  it('невозможный треугольник — ошибка, а не кривой чертёж', () => {
    expect(parseCommand('треугольник ABC 1 2 9', evaluateScene({ ops: [] })).error).toMatch(/треугольника нет/);
    expect(figureOps({ kind: 'triangleSss', a: 1, b: 2, c: 9 }, ['A', 'B', 'C']).error).toBeTruthy();
  });

  it('прямоугольный треугольник: прямой угол C помечен', () => {
    const m = model('прямоугольный треугольник ABC 3 4');
    expect(m.angles).toHaveLength(1);
    expect(m.angles[0].right).toBe(true);
    expect(near(d(m.points.A.pos, m.points.B.pos), 5)).toBe(true);
  });

  it('четырёхугольники: A слева внизу, дальше по часовой', () => {
    const m = model('прямоугольник ABCD 7 4');
    expect(m.points.A.pos).toEqual({ x: 0, y: 0 });
    expect(m.points.B.pos).toEqual({ x: 0, y: 4 });
    expect(m.points.C.pos).toEqual({ x: 7, y: 4 });
    expect(m.points.D.pos).toEqual({ x: 7, y: 0 });
  });

  it('правильный шестиугольник: все стороны равны, низ горизонтален', () => {
    const m = model('правильный ABCDEF 3');
    const names = ['A', 'B', 'C', 'D', 'E', 'F'];
    names.forEach((n, i) => {
      expect(near(d(m.points[n].pos, m.points[names[(i + 1) % 6]].pos), 3, 1e-3)).toBe(true);
    });
    expect(near(m.points.A.pos.y, m.points.F.pos.y, 1e-3)).toBe(true);
  });

  it('без букв имена подбираются, вторая фигура встаёт правее первой', () => {
    const m = model('квадрат 4', 'треугольник');
    expect(Object.keys(m.points)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(m.points.E.pos.x).toBeGreaterThan(m.points.D.pos.x);
  });

  it('«треугольник ABC» на готовых точках — только контур', () => {
    const s = build('A = (0; 0)', 'B = (2; 3)', 'C = (5; 0)', 'треугольник ABC');
    expect(s.ops.map((o) => o.type)).toEqual(['point', 'point', 'point', 'polygon']);
  });
});

describe('построения', () => {
  const TRI = 'треугольник ABC 5 6 7';

  it('высота: основание на стороне, отрезок и прямой угол', () => {
    const s = build(TRI, 'H = высота B AC');
    expect(s.ops.slice(-3).map((o) => o.type)).toEqual(['foot', 'segment', 'angle']);
    const m = evaluateScene(s);
    const { A, B, C, H } = m.points;
    expect(near(H.pos.y, 0)).toBe(true);
    expect(near((B.pos.x - H.pos.x) * (C.pos.x - A.pos.x) + (B.pos.y - H.pos.y) * (C.pos.y - A.pos.y), 0)).toBe(true);
    expect(m.angles[0].right).toBe(true);
  });

  it('высота тупоугольного треугольника: сторона дорисована до основания', () => {
    const m = model('A = (0; 0)', 'B = (-2; 3)', 'C = (5; 0)', 'треугольник ABC', 'H = высота B AC');
    expect(m.points.H.pos.x).toBeCloseTo(-2);
    const ext = m.lines.filter((l) => l.kind === 'ext');
    expect(ext).toHaveLength(1);
    expect(Math.min(ext[0].a.x, ext[0].b.x)).toBeCloseTo(-2);
    expect(Math.max(ext[0].a.x, ext[0].b.x)).toBeCloseTo(0);
  });

  it('медиана и биссектриса треугольника', () => {
    const m = model(TRI, 'M = медиана B AC', 'L = биссектриса ABC');
    const { A, B, C, M, L } = m.points;
    expect(near(d(A.pos, M.pos), d(M.pos, C.pos))).toBe(true);
    // Свойство биссектрисы: AL : LC = AB : BC.
    expect(near(d(A.pos, L.pos) / d(L.pos, C.pos), d(A.pos, B.pos) / d(B.pos, C.pos), 1e-6)).toBe(true);
  });

  it('три медианы пересекаются в одной точке: вторая точка — синоним первой', () => {
    const s = build(TRI, 'медиана A BC', 'медиана B AC', 'медиана C AB', 'G = AM ∩ BN');
    const r = tryAppendOps(s, parseCommand('X = AM ∩ CK', evaluateScene(s)).op);
    expect(r.ok).toBe(true);
    expect(r.note).toMatch(/Это точка G/);
    expect(r.model.points.X.alias).toBe('G');
  });

  it('параллельные прямые не пересекаются — понятная ошибка, шаг не создаётся', () => {
    const s = build('квадрат ABCD 4');
    const r = tryAppendOps(s, parseCommand('X = AB ∩ CD', evaluateScene(s)).op);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/параллельны/);
    expect(r.model.points.X).toBeUndefined();
  });

  it('описанная окружность проходит через вершины, вписанная касается сторон', () => {
    const m = model(TRI, 'O = описанная ABC', 'I = вписанная ABC', 'T = основание I AC');
    const [cc, ic] = m.circles;
    for (const n of ['A', 'B', 'C']) expect(near(d(m.points[n].pos, cc.c), cc.r)).toBe(true);
    expect(near(d(m.points.O.pos, cc.c), 0)).toBe(true);
    expect(near(d(m.points.T.pos, m.points.I.pos), ic.r)).toBe(true);
    expect(cc.centerName).toBe('O');
  });

  it('«окр(O)» находит нарисованную окружность по центру', () => {
    const m = model(TRI, 'O = описанная ABC', 'K на окр(O) 90');
    const cc = m.circles[0];
    expect(near(d(m.points.K.pos, cc.c), cc.r)).toBe(true);
    expect(near(m.points.K.pos.x, cc.c.x)).toBe(true);
    expect(parseCommand('K на окр(Z) 10', m).error).toMatch(/Нет окружности с центром Z/);
  });

  it('прямая ∩ окружность: отмечается точка, которой ещё нет', () => {
    // A и B уже на окружности — новых точек нет.
    const s = build('O = (0; 0)', 'A = (5; 0)', 'окружность O A', 'B = (-3; 4)');
    expect(parseCommand('X = AB ∩ окр(O)', evaluateScene(s)).error).toMatch(/уже отмечены/);
    // Прямая через точку окружности: отмечается только вторая.
    const s1 = build('O = (0; 0)', 'A = (5; 0)', 'окружность O A', 'C = (0; 2)');
    const one = parseCommand('X = AC ∩ окр(O)', evaluateScene(s1));
    expect(one.op).toMatchObject({ type: 'lineCircle', name: 'X' });
    const mx = tryAppendOps(s1, one.op).model;
    expect(mx.points.X.alias).toBeUndefined();
    expect(mx.points.X.pos.x).toBeLessThan(0);
    const s2 = build('O = (0; 0)', 'A = (5; 0)', 'окружность O A', 'P = (9; 0)', 'Q = (0; 3)');
    const r = parseCommand('PQ ∩ окр(O)', evaluateScene(s2));
    expect(r.ops).toHaveLength(2);
    const m2 = tryAppendOps(s2, r.ops).model;
    for (const op of r.ops) expect(near(Math.hypot(m2.points[op.name].pos.x, m2.points[op.name].pos.y), 5)).toBe(true);
  });

  it('касательные: точки касания и отрезки, радиус ⊥ касательной', () => {
    const s = build('O = (0; 0)', 'окружность O 3', 'P = (5; 0)', 'касательные P окр(O)');
    expect(s.ops.slice(-4).map((o) => o.type)).toEqual(['tangent', 'segment', 'tangent', 'segment']);
    const m = evaluateScene(s);
    for (const n of ['T', 'T1']) {
      const T = m.points[n].pos;
      expect(near(T.x * (T.x - 5) + T.y * T.y, 0)).toBe(true);
    }
    const bad = build('O = (0; 0)', 'окружность O 3', 'P = (1; 0)');
    expect(tryAppendOps(bad, parseCommand('T = касание P окр(O) 1', evaluateScene(bad)).op).error).toMatch(/внутри окружности/);
  });

  it('параллельная, перпендикуляр и биссектриса — как прямые в других командах', () => {
    const m = model(TRI, 'прямая B || AC', 'прямая C ⊥ AC', 'X = (B||AC) ∩ (C⊥AC)', 'биссектриса угла BAC', 'Y = (бис BAC) ∩ BC');
    const { B, C, X, Y, A } = m.points;
    expect(near(X.pos.x, C.pos.x) && near(X.pos.y, B.pos.y)).toBe(true);
    expect(near(d(B.pos, Y.pos) / d(Y.pos, C.pos), d(A.pos, B.pos) / d(A.pos, C.pos))).toBe(true);
  });

  it('серединный перпендикуляр: середина и прямая', () => {
    const s = build('A = (0; 0)', 'B = (4; 0)', 'серединный перпендикуляр AB');
    expect(s.ops.slice(-2).map((o) => o.type)).toEqual(['pointOnLine', 'perp']);
    const line = evaluateScene(s).lines.find((l) => l.kind === 'line');
    expect(near(line.a.x, 2) && near(line.b.x, 2)).toBe(true);
  });

  it('прямая тянется через все свои точки и чуть дальше, луч — из начала', () => {
    const m = model('A = (0; 0)', 'B = (4; 0)', 'прямая AB', 'K на AB 2', 'C = (0; 3)', 'луч AC');
    const line = m.lines.find((l) => l.kind === 'line');
    expect(Math.min(line.a.x, line.b.x)).toBeLessThan(0);
    expect(Math.max(line.a.x, line.b.x)).toBeGreaterThan(8);
    const ray = m.lines.find((l) => l.kind === 'ray');
    expect(ray.a).toEqual({ x: 0, y: 0 });
    expect(ray.b.y).toBeGreaterThan(3);
  });
});

describe('пометки и оформление', () => {
  const TRI = 'прямоугольный треугольник ABC 3 4';

  it('угол: дуги, подпись, градусы; прямой определяется сам', () => {
    const m = model(TRI, 'угол CAB 2 α', 'угол ABC 37', 'угол ACB');
    expect(m.angles[1]).toMatchObject({ arcs: 2, label: 'α', right: false });
    expect(m.angles[2].label).toBe('37°');
    expect(m.angles[3].right).toBe(true);
    expect(Math.round(m.angles[2].deg)).toBe(37);
  });

  it('подпись не портится нормализацией: x остаётся x', () => {
    const s = build(TRI, 'длина AB x', 'длина AC', 'текст (1; 1) a');
    const [x, real, text] = s.ops.slice(-3);
    expect(x.text).toBe('x');
    expect(real.text).toBe('3');
    expect(text).toMatchObject({ type: 'text', x: 1, y: 1, text: 'a' });
    expect(formatMarkText('2sqrt(3)')).toBe('2√3');
    expect(formatMarkText('\\alpha')).toBe('α');
  });

  it('равные отрезки: число штрихов растёт само', () => {
    const s = build('квадрат ABCD 4', 'равны AB CD', 'равны BC AD', 'штрих AB 3');
    expect(s.ops.slice(-3).map((o) => o.n)).toEqual([1, 2, 3]);
    expect(evaluateScene(s).ticks).toHaveLength(5);
  });

  it('пунктир и цвет отрезка — оформление, не шаги', () => {
    const s = build(TRI, 'H = высота C AB', 'пунктир CH', 'цвет отрезка AB красный', 'цвет C синий');
    expect(s.segStyles).toEqual({ [segKey('C', 'H')]: { dash: true }, [segKey('A', 'B')]: { color: 'red' } });
    expect(s.colors).toEqual({ C: 'blue' });
    const m = evaluateScene(s);
    const ch = m.lines.find((l) => l.kind === 'segment');
    expect(ch.ranges).toEqual([{ t0: 0, t1: 1, color: null, dash: true }]);
    const back = build(TRI, 'H = высота C AB', 'пунктир CH', 'сплошная CH');
    expect(back.segStyles).toBeUndefined();
  });

  it('ненарисованный отрезок покрасить нельзя', () => {
    const s = build(TRI);
    const r = applyAction(s, parseCommand('пунктир AB', evaluateScene(s)));
    expect(r.error).toBeUndefined();
    const s2 = build('A = (0; 0)', 'B = (1; 1)');
    expect(applyAction(s2, parseCommand('пунктир AB', evaluateScene(s2))).error).toMatch(/не нарисован/);
  });

  it('стиль окружности живёт в её шаге', () => {
    const s = build('O = (0; 0)', 'окружность O 3', 'пунктир окр(O)', 'цвет окр(O) синий');
    expect(s.ops[1]).toMatchObject({ dash: true, color: 'blue' });
  });

  it('скрытая точка не рисуется, но построения на неё опираются', () => {
    const s = build(TRI, 'O = описанная ABC', 'скрыть O', 'OA');
    const m = evaluateScene(s);
    expect(m.points.O.hidden).toBe(true);
    const frame = planimFrame(s);
    expect(frame.dots.find((x) => x.name === 'O').ghost).toBe(true);
    expect(planimSvgFromSpec(buildPlanimBlock(s).text)).not.toMatch(/>O</);
  });

  it('куски стиля: позднее — главнее, соседние одинаковые сливаются', () => {
    expect(stylePieces([{ t0: 0, t1: 0.5, color: 'red', dash: false }, { t0: 0.25, t1: 0.75, color: 'blue', dash: true }]))
      .toEqual([
        { t0: 0, t1: 0.25, color: 'red', dash: false },
        { t0: 0.25, t1: 0.5, color: 'blue', dash: true },
        { t0: 0.5, t1: 0.75, color: 'blue', dash: true },
        { t0: 0.75, t1: 1, color: null, dash: false },
      ].reduce((acc, p) => {
        const last = acc[acc.length - 1];
        if (last && last.color === p.color && last.dash === p.dash) last.t1 = p.t1; else acc.push({ ...p });
        return acc;
      }, []));
  });

  it('вершина многоугольника — «угловая» (без жирной точки), середина стороны — с точкой', () => {
    const m = model('треугольник ABC 5 6 7', 'M = медиана B AC');
    expect(m.points.A.corner).toBe(true);
    expect(m.points.M.corner).toBe(false);
  });
});

describe('журнал: удаление, переименование', () => {
  it('удаление точки уносит всё, что на неё опирается, и её оформление', () => {
    const s = build('треугольник ABC 5 6 7', 'H = высота B AC', 'пунктир BH', 'цвет H красный', 'K = середина BH', 'AB');
    const foot = s.ops.find((o) => o.type === 'foot');
    const { scene, removed } = removeOpCascade(s, foot.id);
    expect(removed).toHaveLength(4); // основание, отрезок BH, прямой угол, середина
    expect(scene.segStyles).toBeUndefined();
    expect(scene.colors).toBeUndefined();
    expect(evaluateScene(scene).steps.every((st) => st.ok)).toBe(true);
  });

  it('переименование переписывает журнал, выражения и оформление', () => {
    const s = build('треугольник ABC 5 6 7', 'прямая B || AC', 'K на (B||AC) 0,5', 'пунктир AB', 'метка A 200');
    const r = renamePoint(s, 'A', 'P');
    expect(r.error).toBeUndefined();
    const text = buildPlanimBlock(r.scene).text;
    expect(text).toMatch(/многоугольник PBC/);
    expect(text).toMatch(/K на \(B\|\|PC\) 0,5/);
    expect(text).toMatch(/пунктир BP/);
    expect(text).toMatch(/метка P 200/);
    expect(renamePoint(s, 'A', 'B').error).toMatch(/занято/);
  });
});

describe('команды ⇄ текст', () => {
  it('нормализация: кириллица-двойник, строчные имена, координаты, скобки', () => {
    expect(normalizeCommand('Высота С АВ')).toBe('Высота C AB');
    expect(normalizeCommand('x = mn ∩ ac')).toBe('X = MN ∩ AC');
    expect(normalizeCommand('A = ( 1,5 ; −2 )')).toBe('A = (1,5;-2)');
    expect(normalizeCommand('A = (1, 2)')).toBe('A = (1;2)');
    expect(normalizeCommand('K на окр (O, A) 30')).toBe('K на окр(O,A) 30');
    expect(normalizeCommand('прямая K _|_ AB')).toBe('прямая K⊥AB');
  });

  it('ссылки на прямые и окружности читаются и пишутся', () => {
    expect(lineRefText(parseLineRef('(Q||(P⊥AB))'))).toBe('(Q||(P⊥AB))');
    expect(parseLineRef('(бисABC)')).toEqual({ k: 'bis', pts: ['A', 'B', 'C'] });
    expect(circleRefText(parseCircleRef('окр(O,2,5)'))).toBe('окр(O;2,5)');
    expect(parseCircleRef('окр(O;A)')).toEqual({ k: 'cp', o: 'O', a: 'A' });
    expect(parseCircleRef('впис(ABC)')).toEqual({ k: 'in', pts: ['A', 'B', 'C'] });
    expect(() => parseLineRef('ABC')).toThrow();
  });

  it('каждая операция выгружается командой и читается обратно той же', () => {
    const s = build(
      'A = (0; 0)', 'B = (1,5; 4)', 'C = (6; 0)', 'многоугольник ABC',
      'M на AC 1:2', 'K на AB 1,5', 'X = BM ∩ AC', 'H = основание B AC',
      'прямая AB', 'луч CB', 'отрезок BH', 'прямая B || AC', 'прямая C ⊥ AC', 'биссектриса угла BAC',
      'окружность A 2', 'окружность B C', 'O = описанная ABC', 'I = вписанная ABC',
      'P на окр(A;2) 120', 'Y = AC ∩ окр(A;2) 2', 'Z = окр(A;2) ∩ окр(B,C) 1', 'T = касание C окр(A;2) 2',
      'заливка ABM', 'угол BAC 2 α', 'прямой угол BHC', 'равны AM MC 2', 'длина AB 2sqrt(5)', 'текст (3; -1) l',
    );
    const text1 = buildPlanimBlock(s).text;
    const again = parsePlanimBlock(text1);
    expect(again.errors).toEqual([]);
    expect(buildPlanimBlock(again.scene).text).toBe(text1);
    expect(again.scene.ops.map((o) => o.type)).toEqual(s.ops.map((o) => o.type));
    for (const op of s.ops) {
      expect({ type: op.type, cmd: !!opToCommand(op) }).toEqual({ type: op.type, cmd: true });
      expect(describeOp(op).length).toBeGreaterThan(3);
    }
  });

  it('оформление переживает выгрузку в текст и обратно', () => {
    const s = build(
      'треугольник ABC 5 6 7', 'H = высота B AC', 'O = описанная ABC',
      'пунктир BH', 'цвет отрезков AB, BC красный', 'цвет AH синий', 'пунктир окр(O)', 'цвет окр(O) зелёный',
      'скрыть O', 'метка B вверх',
    );
    const text = buildPlanimBlock(s, { color: true, grid: true, size: { width: 400, height: 300 } }).text;
    const back = parsePlanimBlock(text);
    expect(back.errors).toEqual([]);
    expect(back).toMatchObject({ color: true, grid: true, size: { width: 400, height: 300 } });
    expect(back.scene.segStyles).toEqual(s.segStyles);
    expect(back.scene.colors).toEqual(s.colors);
    expect(back.scene.hidden).toEqual(['O']);
    expect(back.scene.labelAngles).toEqual({ B: 90 });
    expect(back.scene.ops.find((o) => o.type === 'circle')).toMatchObject({ dash: true, color: 'green' });
  });

  it('ошибка строки не рушит блок: шаг пропущен, номер строки назван', () => {
    const r = parsePlanimBlock('квадрат ABCD 4\nX = AB ∩ CD\n# комментарий\nO = AC ∩ BD // центр\nабракадабра');
    expect(r.errors.map((e) => e.line)).toEqual([2, 5]);
    expect(r.scene.ops[r.scene.ops.length - 1]).toMatchObject({ type: 'intersect', name: 'O', note: 'центр' });
  });

  it('инлайн-форма: «;» в скобках не режет команду, палка экранируется', () => {
    const spec = 'A = (0; 0)\nB = (4; 0)\nC = (1; 3)\nмногоугольник ABC\nпрямая C || AB\nK на (C||AB) 0,5 // подпись';
    const inline = planimInlineFromSpec(spec);
    expect(inline).toContain('A = (0; 0); B = (4; 0)');
    expect(inline).toContain('C \\|\\| AB');
    expect(inline).not.toContain('подпись');
    const back = parsePlanimBlock(planimSpecFromInline(inline));
    expect(back.errors).toEqual([]);
    expect(back.scene.ops).toHaveLength(6);
    expect(planimBlockMarkdown(back.scene, { format: 'inline' })).toMatch(/^`planim: /);
    expect(planimBlockMarkdown(back.scene)).toMatch(/^\n```planim\n/);
  });
});

describe('рендер', () => {
  const spec = 'треугольник ABC 5 6 7\nH = высота B AC\nO = описанная ABC\nугол BAC 2 α\nравны AB BC\nдлина AC 7\nпунктир BH';

  it('SVG: по умолчанию только чёрная краска, с «цвет» — палитра', () => {
    const mono = planimSvgFromSpec(`${spec}\nцвет отрезка AB красный`);
    expect(mono).toMatch(/^<svg/);
    expect(mono).not.toMatch(/#dc2626/);
    expect(mono).toMatch(/stroke-dasharray/);
    expect(mono).toMatch(/<circle[^>]*fill="none"/);
    expect(mono).toMatch(/<path d="M/);
    const color = planimSvgFromSpec(`${spec}\nцвет отрезка AB красный\nцвет`);
    expect(color).toMatch(/#dc2626/);
  });

  it('чертёж вписывается в «размер» и обрезается по содержимому', () => {
    const { scene, size } = parsePlanimBlock(`${spec}\nразмер 400 300`);
    const frame = planimFrame(scene, { size });
    const box = contentBox(frame);
    expect(box.w).toBeLessThanOrEqual(400 + 40);
    expect(box.h).toBeLessThanOrEqual(300 + 40);
    expect(box.w).toBeGreaterThan(200);
  });

  it('«сетка»: линии по целым клеткам вокруг чертежа', () => {
    const svg = planimSvgFromSpec('A = (1; 1)\nB = (4; 5)\nC = (6; 2)\nмногоугольник ABC\nсетка');
    const thin = svg.match(/stroke-width="0.35"/g) || [];
    expect(thin.length).toBeGreaterThanOrEqual(10);
  });

  it('ошибки блока подписаны под чертежом', () => {
    expect(planimSvgFromSpec('квадрат ABCD 4\nX = AB ∩ CD')).toMatch(/строка 2: .*параллельны/);
  });

  it('чертёж задачи несёт исходник и открывается снова', () => {
    const { scene } = parsePlanimBlock(spec);
    const svg = planimDrawingSvg(scene, { grid: true });
    expect(svg).toMatch(/<!--planim:/);
    const back = planimSpecFromSvg(svg);
    expect(parsePlanimBlock(back).errors).toEqual([]);
    expect(back).toBe(buildPlanimBlock(scene, { grid: true }).text);
    expect(planimSpecFromSvg('<svg></svg>')).toBeNull();
  });

  it('буква точки: авто — наружу от фигуры; «метка» ставит под заданным углом', () => {
    const s = build('треугольник ABC 5 6 7');
    const m = evaluateScene(s);
    const frame = renderPlanim(m, fitView(m, { width: 400, height: 300 }), { width: 400, height: 300 });
    const lb = Object.fromEntries(frame.labels.map((l) => [l.name, l]));
    const dot = Object.fromEntries(frame.dots.map((x) => [x.name, x]));
    expect(lb.B.y).toBeLessThan(dot.B.y); // B наверху — буква выше
    expect(lb.A.x).toBeLessThan(dot.A.x);
    expect(lb.C.x).toBeGreaterThan(dot.C.x);
    const s2 = applyAction(s, parseCommand('метка B 0', m)).scene;
    const m2 = evaluateScene(s2);
    const f2 = renderPlanim(m2, fitView(m2, { width: 400, height: 300 }), { width: 400, height: 300 });
    const b2 = f2.labels.find((l) => l.name === 'B');
    expect(b2.x).toBeGreaterThan(dot.B.x);
    expect(Math.abs(b2.y - dot.B.y)).toBeLessThan(1);
  });
});

describe('инструменты', () => {
  const size = { width: 600, height: 400 };
  const frameOf = (s) => {
    const m = evaluateScene(s);
    return { m, frame: renderPlanim(m, fitView(m, size), size, { showHidden: true }) };
  };
  const apply = (s, r) => {
    const res = tryAppendOps(s, r.ops);
    expect(res.error).toBeNull();
    return res.scene;
  };

  it('у инструментов разные клавиши и есть подсказка', () => {
    expect(new Set(TOOLS.map((t) => t.hot)).size).toBe(TOOLS.length);
    for (const t of TOOLS) expect(toolHint(t.key, []).length).toBeGreaterThan(10);
  });

  it('«Отрезок» сам ставит точки на пустом месте', () => {
    let s = { ops: [] };
    let r = toolClick('segment', [], { pos: { x: 0, y: 0 } }, evaluateScene(s));
    s = apply(s, r);
    expect(r.pending).toEqual([{ kind: 'point', name: 'A' }]);
    r = toolClick('segment', r.pending, { pos: { x: 4, y: 3 } }, evaluateScene(s));
    s = apply(s, r);
    expect(s.ops.map((o) => o.type)).toEqual(['point', 'point', 'segment']);
    expect(r.pending).toEqual([]);
  });

  it('«Многоугольник»: клики по пустому месту и замыкание на первой точке', () => {
    let s = { ops: [] };
    let pending = [];
    for (const pos of [{ x: 0, y: 0 }, { x: 0, y: 3 }, { x: 4, y: 0 }]) {
      const r = toolClick('polygon', pending, { pos }, evaluateScene(s));
      s = apply(s, r);
      pending = r.pending;
    }
    const r = toolClick('polygon', pending, { point: 'A', pos: { x: 0, y: 0 } }, evaluateScene(s));
    s = apply(s, r);
    expect(s.ops[s.ops.length - 1]).toMatchObject({ type: 'polygon', pts: ['A', 'B', 'C'] });
  });

  it('«Точка»: на линии — точка на линии, в перекрестье — пересечение', () => {
    const s = build('квадрат ABCD 4', 'AC', 'BD');
    const m = evaluateScene(s);
    const ac = m.lines.find((l) => l.id === s.ops[5].id);
    const bd = m.lines.find((l) => l.id === s.ops[6].id);
    const hitLine = (l, t) => ({ id: l.id, ref: l.ref, t, pos: { x: l.a.x + (l.b.x - l.a.x) * t, y: l.a.y + (l.b.y - l.a.y) * t }, p: l.p, u: l.u });
    const cross = toolClick('point', [], { line: hitLine(ac, 0.5), line2: hitLine(bd, 0.5), pos: { x: 2, y: 2 } }, m);
    expect(cross.ops[0]).toMatchObject({ type: 'intersect', name: 'O' });
    const on = toolClick('point', [], { line: { ...hitLine(ac, 0.25), ratio: [1, 3] }, pos: { x: 1, y: 1 } }, m);
    expect(on.ops[0]).toMatchObject({ type: 'pointOnLine', t: 0.25, ratio: [1, 3] });
    expect(toolClick('point', [], { point: 'A', pos: { x: 0, y: 0 } }, m).error).toMatch(/уже есть точка A/);
  });

  it('«Высота», «Медиана», «Биссектриса» — вершина и сторона', () => {
    const s = build('треугольник ABC 5 6 7');
    const m = evaluateScene(s);
    const ac = m.lines.find((l) => l.ref.includes('A') && l.ref.includes('C'));
    const side = { id: ac.id, ref: ac.ref, t: 0.4, pos: { x: 2.8, y: 0 }, p: ac.p, u: ac.u };
    let r = toolClick('altitude', [{ kind: 'point', name: 'B' }], { line: side, pos: side.pos }, m);
    expect(r.ops.map((o) => o.type)).toEqual(['foot', 'segment', 'angle']);
    expect(r.ops[0].name).toBe('H');
    r = toolClick('median', [{ kind: 'line', ...side }], { point: 'B' }, m);
    expect(r.ops.map((o) => o.type)).toEqual(['pointOnLine', 'segment']);
    expect(r.ops[0].name).toBe('M');
    r = toolClick('bisector', [{ kind: 'point', name: 'A' }, { kind: 'point', name: 'B' }], { point: 'C' }, m);
    expect(r.ops.map((o) => o.type)).toEqual(['intersect', 'segment']); // сторона AC нарисована
    const free = build('A = (0; 0)', 'B = (2; 2)', 'C = (4; 0)');
    r = toolClick('bisector', [{ kind: 'point', name: 'A' }, { kind: 'point', name: 'B' }], { point: 'C' }, evaluateScene(free));
    expect(r.ops.map((o) => o.type)).toEqual(['bisector']);
  });

  it('«Описанная» даёт окружность и центр O; «Угол» берёт настройки пометки', () => {
    const s = build('треугольник ABC 5 6 7');
    const m = evaluateScene(s);
    const two = [{ kind: 'point', name: 'A' }, { kind: 'point', name: 'B' }];
    let r = toolClick('circum', two, { point: 'C' }, m);
    expect(r.ops.map((o) => o.type)).toEqual(['circle', 'center']);
    expect(r.ops[1].name).toBe('O');
    r = toolClick('angle', two, { point: 'C' }, m, { arcs: 2, angleLabel: '40' });
    expect(r.ops[0]).toMatchObject({ type: 'angle', pts: ['A', 'B', 'C'], arcs: 2, label: '40°' });
  });

  it('«Цвет» и «Пунктир» — не шаги: кусок между соседними точками, Shift — отрезок целиком', () => {
    const s = build('треугольник ABC 5 6 7', 'M на AC 0,5');
    const m = evaluateScene(s);
    const ac = m.lines.find((l) => l.ref.includes('A') && l.ref.includes('C'));
    const line = { id: ac.id, ref: ac.ref, t: 0.2, pos: { x: 1.4, y: 0 }, p: ac.p, u: ac.u };
    expect(toolClick('dash', [], { line, pos: line.pos }, m).dash).toEqual({ segment: segKey('A', 'M') });
    expect(toolClick('color', [], { line, pos: line.pos, shift: true }, m).paint).toEqual({ segment: segKey('A', 'C') });
    expect(toolClick('color', [], { point: 'B' }, m).paint).toEqual({ name: 'B' });
  });

  it('перетаскивание: свободная точка — по сетке, точка на отрезке — вдоль него, на окружности — по ней', () => {
    const s = build('A = (0; 0)', 'B = (6; 0)', 'AB', 'M на AB 1:2', 'окружность A 3', 'K на окр(A) 0');
    const { m, frame } = frameOf(s);
    expect(draggableOp(s, 'M').type).toBe('pointOnLine');
    const at = (w) => frame.project(w);
    // свободная
    let t = dragTarget(m, draggableOp(s, 'B'));
    let p = at({ x: 5.2, y: 1.3 });
    expect(dragPosition(t, frame, p.x, p.y, { step: 0.5 })).toEqual({ x: 5, y: 1.5 });
    // на отрезке: прилипает к середине, за концы не уезжает
    t = dragTarget(m, draggableOp(s, 'M'));
    p = at({ x: 3.05, y: 2 });
    expect(dragPosition(t, frame, p.x, p.y)).toEqual({ t: 0.5, ratio: [1, 1] });
    p = at({ x: 40, y: 0 });
    expect(dragPosition(t, frame, p.x, p.y).t).toBeLessThan(1);
    // на окружности
    t = dragTarget(m, draggableOp(s, 'K'));
    p = at({ x: 0.1, y: 5 });
    expect(dragPosition(t, frame, p.x, p.y)).toEqual({ angle: 90 });
    const moved = setOpPosition(s, draggableOp(s, 'M').id, { t: 0.5, ratio: [1, 1] });
    expect(evaluateScene(moved).points.M.pos.x).toBeCloseTo(3);
  });

  it('прилипание', () => {
    expect(snapPosition(0.49, 300)).toEqual({ t: 0.5, ratio: [1, 1] });
    expect(snapPosition(0.41, 300)).toEqual({ t: 0.41 });
    expect(snapAngle(88.5)).toBe(90);
    expect(snapAngle(52.3)).toBe(52);
    expect(snapWorld({ x: 1.26, y: -0.2 }, 0.5)).toEqual({ x: 1.5, y: 0 });
  });

  it('автоимена: вершины по алфавиту, основание H, H занята — H1', () => {
    expect(nextFreeNames(['A', 'B'], 3, 'free')).toEqual(['C', 'D', 'E']);
    expect(nextFreeName(['H'], 'foot')).toBe('H1');
    expect(nextFreeName(['O'], 'center')).toBe('I');
  });
});
