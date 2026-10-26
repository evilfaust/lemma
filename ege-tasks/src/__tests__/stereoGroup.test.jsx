import { describe, it, expect } from 'vitest';
import {
  buildBody, evaluateScene, renderStereo, DEFAULT_CAMERA, parseStereoBlock, buildStereoBlock,
  renamePoint, parseCommand, tryAppendOp, bodyTitle,
} from '../utils/stereo';
import { addPart, bodyLine } from '../utils/stereo/dsl';

// Несколько тел на чертеже (kind: 'group'): вписанные (внешнее — каркас) и
// стоящие рядом.

const VP = { width: 400, height: 360 };
const strokesOf = (fr, prefix) => fr.strokes.filter((s) => s.objId.startsWith(prefix));

describe('группа тел: разбор и текст', () => {
  it('«куб 4 каркас» + «и шар 2» — шар внутри, куб — каркас', () => {
    const r = parseStereoBlock('куб 4 каркас\nи шар 2');
    expect(r.errors).toEqual([]);
    expect(r.scene.body.kind).toBe('group');
    expect(r.scene.body.parts[0]).toMatchObject({ kind: 'cube', frame: true });
    expect(r.scene.body.parts[1]).toMatchObject({ kind: 'sphere', r: 2, at: [0, 0, 0] });
    expect(bodyTitle(r.scene.body)).toBe('Куб и Шар');
  });

  it('«справа» ставит рядом, донышки на одном уровне', () => {
    const g = addPart({ kind: 'cylinder', r: 2, h: 3 }, { kind: 'cylinder', r: 1.5, h: 4 }, { kind: 'right' });
    const [, second] = g.parts;
    expect(second.at[0]).toBeGreaterThan(3.5);
    expect(second.at[2]).toBeCloseTo(0.5); // низ: −1,5 = 0,5 − 2
  });

  it('текст блока туда и обратно', () => {
    const r = parseStereoBlock('цилиндр 2 3\nи цилиндр 1,5 4 справа');
    const text = buildStereoBlock(r.scene, DEFAULT_CAMERA).text;
    expect(text.split('\n')[1]).toBe('и цилиндр 1.5 4 справа');
    const back = parseStereoBlock(text);
    expect(back.errors).toEqual([]);
    expect(back.scene.body).toEqual(r.scene.body);
    expect(bodyLine(r.scene.body).split('\n')).toHaveLength(2);
  });

  it('тела — до построений', () => {
    const r = parseStereoBlock('куб 4\nAC\nи шар 2');
    expect(r.errors[0].message).toMatch(/до построений/);
  });
});

describe('группа тел: имена и видимость', () => {
  it('совпавшие имена второй части получают номер', () => {
    const b = buildBody(parseStereoBlock('цилиндр 2 3\nи цилиндр 1,5 4 справа').scene.body);
    expect(b.order).toEqual(['O', 'O1', 'A', 'A1', 'O2', 'O12', 'A2', 'A12']);
    expect(Object.keys(b.circles)).toEqual(['O', 'O1', 'O2', 'O12']);
  });

  it('шар в кубе-каркасе виден, задние рёбра куба — пунктиром', () => {
    const fr = renderStereo(evaluateScene(parseStereoBlock('куб 4 каркас\nи шар 2').scene), DEFAULT_CAMERA, VP);
    expect(strokesOf(fr, 'sil:').every((s) => !s.hidden)).toBe(true);
    expect(fr.strokes.filter((s) => s.kind === 'edge' && s.objId.startsWith('edge:')).some((s) => s.hidden)).toBe(true);
  });

  it('без каркаса куб закрывает шар целиком', () => {
    const fr = renderStereo(evaluateScene(parseStereoBlock('куб 4\nи шар 1,5').scene), DEFAULT_CAMERA, VP);
    expect(strokesOf(fr, 'sil:').every((s) => s.hidden)).toBe(true);
  });

  it('кружки рядом: контур одной не закрыт другой', () => {
    const fr = renderStereo(evaluateScene(parseStereoBlock('цилиндр 2 3\nи цилиндр 1,5 4 справа').scene), DEFAULT_CAMERA, VP);
    expect(strokesOf(fr, 'sil:').filter((s) => !s.hidden).length).toBeGreaterThan(0);
  });

  it('построения на частях: отрезок, точка на окружности второй части', () => {
    let sc = parseStereoBlock('цилиндр 2 3\nи цилиндр 1,5 4 справа').scene;
    for (const c of ['K на окружности O2 90', 'OK']) {
      const r = tryAppendOp(sc, parseCommand(c, evaluateScene(sc)).op);
      expect({ c, e: r.error }).toEqual({ c, e: null });
      sc = r.scene;
    }
  });

  it('переименование вершины части', () => {
    const sc = parseStereoBlock('цилиндр 2 3\nи цилиндр 1,5 4 справа').scene;
    const r = renamePoint(sc, 'O2', 'Q');
    expect(r.error).toBeUndefined();
    const b = buildBody(r.scene.body);
    expect(b.order).toContain('Q');
    expect(b.circles.Q).toBeTruthy();
  });

  it('сечение режет все тела группы', () => {
    const sc = parseStereoBlock('куб 4 каркас\nи шар 1,8\nM на AA1 1:1\nN на BB1 1:1\nсечение MNC').scene;
    const md = evaluateScene(sc);
    expect(md.steps.every((s) => s.ok)).toBe(true);
    expect(md.polys.filter((p) => p.kind === 'section').length).toBe(2);
  });
});
