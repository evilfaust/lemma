import { describe, it, expect } from 'vitest';
import {
  evaluateScene, tryAppendOp, parseCommand, renderStereo, stereoSvgString, DEFAULT_CAMERA,
  applyHideCommand, setLinesHidden, toolClick, removeOpCascade, renamePointInScene,
  parseStereoBlock, buildStereoBlock,
} from '../utils/stereo';

// Скрытые прямые и отрезки (scene.hiddenLines / scene.hiddenSegments) —
// оформление, как скрытые точки.

const VP = { width: 400, height: 360 };

function build(cmds) {
  let sc = { body: { kind: 'cube', a: 4 }, ops: [] };
  for (const c of cmds) {
    const r = parseCommand(c, evaluateScene(sc));
    expect({ c, e: r.error }).toEqual({ c, e: undefined });
    if (r.op) {
      const res = tryAppendOp(sc, r.op);
      expect(res.error).toBeNull();
      sc = res.scene;
    } else {
      const res = applyHideCommand(sc, r);
      expect(res.error).toBeUndefined();
      sc = res.scene;
    }
  }
  return sc;
}

const strokesOf = (fr, id) => fr.strokes.filter((s) => s.objId === id);

describe('скрытые прямые и отрезки: команды', () => {
  const m = evaluateScene({ body: { kind: 'cube', a: 4 }, ops: [] });
  it('разбор', () => {
    expect(parseCommand('скрыть отрезок AM', m)).toMatchObject({ action: 'hide', segments: [['A', 'M']], hidden: true });
    expect(parseCommand('скрыть прямую AB', m)).toMatchObject({ action: 'hide', lines: [['A', 'B']], hidden: true });
    expect(parseCommand('показать отрезки AM, BK', m)).toMatchObject({ segments: [['A', 'M'], ['B', 'K']], hidden: false });
    expect(parseCommand('скрыть M, N', m)).toMatchObject({ names: ['M', 'N'] }); // точки — как раньше
  });

  it('скрыть можно только нарисованное', () => {
    expect(applyHideCommand({ body: { kind: 'cube', a: 4 }, ops: [] }, { names: [], segments: [['A', 'C1']], hidden: true }).error)
      .toMatch(/не нарисован/);
  });
});

describe('скрытые прямые и отрезки: чертёж', () => {
  it('отрезок MN скрыт целиком: в печати его нет, в редакторе — бледный', () => {
    const sc = build(['M на AA1 1:1', 'N на CC1 1:1', 'MN', 'скрыть отрезок MN']);
    const md = evaluateScene(sc);
    const id = sc.ops[2].id;
    expect(strokesOf(renderStereo(md, DEFAULT_CAMERA, VP), id)).toHaveLength(0);
    const ed = strokesOf(renderStereo(md, DEFAULT_CAMERA, VP, { showHidden: true }), id);
    expect(ed.length).toBeGreaterThan(0);
    expect(ed.every((s) => s.ghost)).toBe(true);
    // В SVG (печать, картинка) бледных линий нет даже из кадра редактора
    const frEd = renderStereo(md, DEFAULT_CAMERA, VP, { showHidden: true });
    const svg = stereoSvgString(frEd);
    expect((svg.match(/<line /g) || []).length).toBe(frEd.strokes.filter((st) => !st.ghost).length);
  });

  it('кусок ребра AM скрыт, MA1 остаётся', () => {
    const sc = build(['M на AA1 1:1', 'скрыть отрезок AM']);
    const fr = renderStereo(evaluateScene(sc), DEFAULT_CAMERA, VP);
    const edge = strokesOf(fr, 'edge:A-A1');
    expect(edge.length).toBeGreaterThan(0);
    const len = edge.reduce((a, s) => a + Math.hypot(s.x2 - s.x1, s.y2 - s.y1), 0);
    const full = strokesOf(renderStereo(evaluateScene({ ...sc, hiddenSegments: undefined }), DEFAULT_CAMERA, VP), 'edge:A-A1')
      .reduce((a, s) => a + Math.hypot(s.x2 - s.x1, s.y2 - s.y1), 0);
    expect(len / full).toBeCloseTo(0.5, 2);
  });

  it('прямая целиком — с продолжениями', () => {
    const sc = build(['K на AB 1,5', 'скрыть прямую AB']);
    const fr = renderStereo(evaluateScene(sc), DEFAULT_CAMERA, VP);
    expect(fr.strokes.some((s) => s.objId === 'edge:A-B' || s.objId.endsWith(':ext0'))).toBe(false);
  });

  it('«показать все» возвращает и точки, и линии', () => {
    const sc = build(['M на AA1 1:1', 'скрыть M', 'скрыть отрезок AM', 'скрыть прямую BC', 'показать все']);
    expect(sc.hidden).toBeUndefined();
    expect(sc.hiddenSegments).toBeUndefined();
    expect(sc.hiddenLines).toBeUndefined();
  });
});

describe('скрытые прямые и отрезки: инструмент, журнал, текст', () => {
  it('«Скрыть» по линии — кусок между точками, с Shift — прямая', () => {
    const md = evaluateScene(build(['M на AA1 1:1']));
    const line = md.lines.find((l) => l.id === 'edge:A-A1');
    const pos = { x: line.a.x, y: line.a.y, z: line.a.z + 0.5 };
    const hit = { line: { id: line.id, ref: line.ref, p: line.p, u: line.u, pos } };
    expect(toolClick('hide', [], hit, md).hide).toEqual({ segment: 'A-M' });
    expect(toolClick('hide', [], { ...hit, shift: true }, md).hide).toEqual({ line: 'A-A1' });
    expect(setLinesHidden({ hiddenLines: ['A-A1'] }, ['A-A1'], false)).toEqual({});
  });

  it('удаление точки уносит её скрытые куски, переименование — переносит', () => {
    const sc = build(['M на AA1 1:1', 'скрыть отрезок AM']);
    expect(removeOpCascade(sc, sc.ops[0].id).scene.hiddenSegments).toBeUndefined();
    expect(renamePointInScene(sc, 'M', 'K').hiddenSegments).toEqual(['A-K']);
  });

  it('блок ```stereo туда и обратно', () => {
    const r = parseStereoBlock('куб 4\nM на AA1 1:1\nN на CC1 1:1\nMN\nскрыть отрезки AM, MN\nскрыть прямую BC');
    expect(r.errors).toEqual([]);
    const text = buildStereoBlock(r.scene, DEFAULT_CAMERA).text;
    expect(text).toMatch(/скрыть отрезки (AM, MN|MN, AM)/);
    expect(text).toContain('скрыть прямую BC');
    expect(parseStereoBlock(text).scene.hiddenSegments).toEqual(r.scene.hiddenSegments);
  });
});
