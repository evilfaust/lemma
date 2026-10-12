import { describe, it, expect } from 'vitest';
import {
  evaluateScene, tryAppendOps, applyAction, parseCommand, editStepCommand,
  parsePlanimBlock, buildPlanimBlock, planimSvgFromSpec, planimFrame, renderPlanim, fitView,
  contentBox, planimSvgString, pickMark, toolClick, setOpStyle, showAll,
} from '../utils/planim';

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
const cmdError = (scene, cmd) => {
  const r = parseCommand(cmd, evaluateScene(scene));
  return r.error || applyAction(scene, r).error;
};

const SIZE = { width: 400, height: 320 };
const frameOf = (scene, showHidden) => {
  const m = evaluateScene(scene);
  return renderPlanim(m, fitView(m, SIZE, { padding: 40 }), SIZE, { showHidden });
};
const segDist = (p, s) => {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const L = dx * dx + dy * dy;
  const t = L > 0 ? Math.max(0, Math.min(1, ((p.x - s.x1) * dx + (p.y - s.y1) * dy) / L)) : 0;
  return Math.hypot(p.x - (s.x1 + dx * t), p.y - (s.y1 + dy * t));
};
/** Есть ли в кадре видимый (не бледный) штрих через точку мира. */
const strokeAt = (frame, world) => {
  const p = frame.project(world);
  return frame.strokes.some((s) => !s.ghost && segDist(p, s) < 0.5);
};

const TRI = ['A = (0; 0)', 'B = (2; 4)', 'C = (6; 0)', 'многоугольник ABC'];

describe('скрытие объектов планиметрического чертежа', () => {
  it('скрытый шаг не рисуется, но построения на нём держатся', () => {
    const s = build('A = (0; 0)', 'B = (4; 0)', 'C = (0; 3)', 'D = (4; 3)', 'AD', 'скрыть шаг', 'BC', 'X = AD ∩ BC');
    expect(s.ops[4].hidden).toBe(true);
    const m = evaluateScene(s);
    expect(m.steps.every((st) => st.ok)).toBe(true);
    expect(m.points.X.pos).toEqual({ x: 2, y: 1.5 });
    expect(m.lines.find((l) => l.id === s.ops[4].id).hidden).toBe(true);

    const print = frameOf(s, false);
    expect(strokeAt(print, { x: 1, y: 0.75 })).toBe(false); // на AD
    expect(strokeAt(print, { x: 1, y: 2.25 })).toBe(true); // на BC
    expect(print.hits.lines.map((l) => l.id)).not.toContain(s.ops[4].id);

    const editor = frameOf(s, true);
    expect(editor.strokes.some((st) => st.objId === s.ops[4].id && st.ghost)).toBe(true);
    expect(editor.hits.lines.map((l) => l.id)).toContain(s.ops[4].id);
    // В SVG для печати бледного нет, даже если кадр — редакторский.
    expect(planimSvgString(editor).match(/<line /g)).toHaveLength(1);
  });

  it('«скрыть отрезок» — кусок линии между двумя точками, хоть сторона многоугольника', () => {
    const s = build(...TRI, 'M на AC 1:1', 'скрыть отрезок AM');
    expect(s.segStyles).toEqual({ 'A-M': { hide: true } });
    const print = frameOf(s, false);
    expect(strokeAt(print, { x: 1.5, y: 0 })).toBe(false);
    expect(strokeAt(print, { x: 4.5, y: 0 })).toBe(true);
    expect(frameOf(s, true).strokes.some((st) => st.ghost)).toBe(true);
    const back = build(...TRI, 'M на AC 1:1', 'скрыть отрезок AM', 'показать отрезок AM');
    expect(back.segStyles).toBeUndefined();
  });

  it('прямая, окружность, угол, заливка, многоугольник — шагом целиком', () => {
    const s = build(
      ...TRI, 'BC', 'O = (2; 1)', 'окружность O 1', 'угол ABC', 'заливка ABC', 'прямая O || AC',
      'скрыть прямую BC', 'скрыть окр(O)', 'скрыть угол CBA', 'скрыть заливку CAB', 'скрыть прямую (O||AC)',
    );
    const hidden = s.ops.filter((o) => o.hidden).map((o) => o.type);
    expect(hidden.sort()).toEqual(['angle', 'circle', 'fill', 'parallel', 'segment']);
    const m = evaluateScene(s);
    expect(m.circles[0].hidden && m.angles[0].hidden && m.polys[0].hidden).toBe(true);
    const print = frameOf(s, false);
    expect(print.circles).toHaveLength(0);
    expect(print.arcs).toHaveLength(0);
    expect(print.polys).toHaveLength(0);
    // Сторона многоугольника своего шага не имеет — скрывается кусок.
    const side = build(...TRI, 'скрыть прямую AC');
    expect(side.segStyles).toEqual({ 'A-C': { hide: true } });
    expect(side.ops.some((o) => o.hidden)).toBe(false);
    expect(build(...TRI, 'скрыть треугольник ABC').ops[3].hidden).toBe(true);
  });

  it('понятные ошибки', () => {
    const s = build(...TRI);
    expect(cmdError(s, 'скрыть прямую BD')).toMatch(/Нет точки D/);
    expect(cmdError(build(...TRI, 'D = (6; 6)'), 'скрыть прямую BD')).toMatch(/Не нарисована прямая/);
    expect(cmdError(s, 'скрыть окр(O)')).toBeTruthy();
    expect(cmdError(s, 'скрыть угол ABC')).toMatch(/Нет пометки угла/);
    expect(cmdError(s, 'скрыть шаг 1')).toMatch(/ничего не рисует/);
    expect(cmdError(s, 'скрыть')).toMatch(/Что скрыть/);
    expect(cmdError(s, 'скрыть всё')).toBeTruthy();
  });

  it('«показать всё» возвращает точки, куски и шаги', () => {
    const s = build(...TRI, 'M на AC 1:1', 'BM', 'скрыть M', 'скрыть отрезок MC', 'скрыть шаг 6', 'цвет отрезка AM красный');
    expect(s.hidden).toEqual(['M']);
    expect(s.ops[5].hidden).toBe(true);
    const back = applyAction(s, parseCommand('показать всё', evaluateScene(s))).scene;
    expect(back.hidden).toBeUndefined();
    expect(back.ops.some((o) => o.hidden)).toBe(false);
    expect(back.segStyles).toEqual({ 'A-M': { color: 'red' } });
    expect(showAll(s)).toEqual(back);
  });

  it('скрытое не раздувает рамку чертежа и не теснит буквы', () => {
    const plain = build(...TRI);
    const s = build(...TRI, 'O = (2; 1)', 'окружность O 20', 'скрыть шаг');
    expect(evaluateScene(s).bbox).toEqual(evaluateScene(plain).bbox);
    expect(contentBox(planimFrame(s))).toEqual(contentBox(planimFrame(plain)));
  });

  it('скрытое переживает текст блока и обратно', () => {
    const s = build(...TRI, 'M на AC 1:1', 'BM', 'скрыть шаг', 'O = (2; 1)', 'окружность O 1', 'пунктир окр(O)', 'скрыть окр(O)', 'скрыть отрезок AM', 'скрыть M');
    const { text } = buildPlanimBlock(s);
    expect(text).toMatch(/^отрезок BM\nскрыть шаг$/m);
    expect(text).toMatch(/^скрыть отрезок AM$/m);
    const back = parsePlanimBlock(text);
    expect(back.errors).toEqual([]);
    expect(back.scene.ops.filter((o) => o.hidden).map((o) => o.type)).toEqual(['segment', 'circle']);
    expect(back.scene.segStyles).toEqual(s.segStyles);
    expect(back.scene.hidden).toEqual(['M']);
    // В картинке для задачи скрытого нет.
    const svg = planimSvgFromSpec(text);
    expect(svg).not.toMatch(/<circle[^>]*fill="none"/);
  });

  it('«скрыть шаг» после сломанной строки не трогает чужой шаг', () => {
    const r = parsePlanimBlock('A = (0; 0)\nB = (4; 0)\nAB\nAZ\nскрыть шаг');
    expect(r.errors.map((e) => e.line)).toEqual([4]);
    expect(r.scene.ops.some((o) => o.hidden)).toBe(false);
  });

  it('правка шага командой не снимает скрытие', () => {
    const s = build('O = (0; 0)', 'окружность O 2', 'скрыть шаг');
    const res = editStepCommand(s, s.ops[1].id, 'окружность O 3');
    expect(res.scene.ops[1]).toMatchObject({ hidden: true, circle: { k: 'cr', r: 3 } });
  });

  it('инструмент «Скрыть»: точка, кусок линии, Shift — шаг, окружность', () => {
    const s = build('A = (0; 0)', 'B = (4; 0)', 'M на AB 1:1', 'AB', 'O = (0; 3)', 'окружность O 1');
    const m = evaluateScene(s);
    const seg = m.lines.find((l) => l.kind === 'segment');
    const line = { id: seg.id, ref: seg.ref, t: 0.25, pos: { x: 1, y: 0 }, p: seg.p, u: seg.u };
    expect(toolClick('hide', [], { point: 'M' }, m).hide).toEqual({ name: 'M' });
    expect(toolClick('hide', [], { line, pos: line.pos }, m).hide).toEqual({ segment: 'A-M' });
    expect(toolClick('hide', [], { line, pos: line.pos, shift: true }, m).hide).toEqual({ opId: s.ops[3].id });
    const circle = { id: m.circles[0].id, ref: m.circles[0].ref, angle: 0 };
    expect(toolClick('hide', [], { circle }, m).hide).toEqual({ opId: s.ops[5].id });
  });

  it('пометку без подписи ловит клик по дуге угла и по штриху', () => {
    const s = build('A = (4; 0)', 'B = (0; 0)', 'C = (0; 4)', 'AB', 'BC', 'угол ABC', 'равны AB BC');
    const f = frameOf(setOpStyle(s, [], {}), true);
    const tick = f.tickMarks[0];
    expect(pickMark(f, (tick.x1 + tick.x2) / 2, (tick.y1 + tick.y2) / 2)).toEqual({ opId: s.ops[6].id });
    const box = f.arcs[0];
    expect(box.right).toBe(true);
    const [, p2] = box.pts;
    expect(pickMark(f, p2.x, p2.y)).toEqual({ opId: s.ops[5].id });
    const s2 = build('A = (4; 0)', 'B = (0; 0)', 'C = (3; 3)', 'AB', 'BC', 'угол ABC');
    const f2 = frameOf(s2, true);
    const a = f2.arcs[0];
    const mid = a.a0 + a.da / 2;
    const r = a.radii[0];
    expect(pickMark(f2, a.vx + r * Math.cos(mid), a.vy + r * Math.sin(mid))).toEqual({ opId: s2.ops[5].id });
    expect(pickMark(f2, a.vx + r * Math.cos(mid + Math.PI), a.vy + r * Math.sin(mid + Math.PI))).toBeNull();
  });
});
