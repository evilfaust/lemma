import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App as AntApp } from 'antd';
import StereoEditor from '../components/stereo/StereoEditor';
import {
  evaluateScene, renderStereo, stereoSvgString, DEFAULT_CAMERA, setPointColors,
  removeOpCascade, renamePointInScene, parseCommand, toolClick, colorKeyFromWord,
  pointColorHex, parseStereoBlock, buildStereoBlock, tryAppendOp, setPolyColors, applyColorCommand,
} from '../utils/stereo';

const cube = { kind: 'cube', a: 4 };
const base = {
  body: cube,
  ops: [
    { id: 'a', type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5 },
    { id: 'b', type: 'pointOnLine', name: 'N', ref: ['C', 'C1'], t: 0.5 },
    { id: 'c', type: 'section', pts: ['M', 'N', 'B'] },
  ],
};

describe('цвет точек: логика', () => {
  it('слова и палитра', () => {
    expect(colorKeyFromWord('красный')).toBe('red');
    expect(colorKeyFromWord('Зелёные')).toBe('green');
    expect(colorKeyFromWord('нет')).toBe('');
    expect(colorKeyFromWord('бирюзовый')).toBeNull();
    expect(pointColorHex('blue')).toBe('#2563eb');
    expect(pointColorHex('')).toBeNull();
  });

  it('красим, снимаем; цвет — не шаг журнала', () => {
    const s1 = setPointColors(base, ['M', 'N', 'B'], 'red');
    expect(s1.ops).toBe(base.ops);
    expect(s1.colors).toEqual({ M: 'red', N: 'red', B: 'red' });
    const m = evaluateScene(s1);
    expect(m.points.B.color).toBe('red'); // вершина тоже красится
    expect(m.steps).toHaveLength(3);
    const s2 = setPointColors(s1, ['M', 'N', 'B'], '');
    expect(s2.colors).toBeUndefined();
    expect(tryAppendOp(s1, { id: 'd', type: 'segment', ref: ['M', 'C'] }).scene.colors).toEqual(s1.colors);
  });

  it('удаление и переименование уносят цвет с собой', () => {
    const s1 = setPointColors(base, ['M', 'N'], 'green');
    expect(removeOpCascade(s1, 'a').scene.colors).toEqual({ N: 'green' });
    expect(renamePointInScene(s1, 'M', 'K').colors).toEqual({ K: 'green', N: 'green' });
  });

  it('команда и инструмент', () => {
    const m = evaluateScene(base);
    expect(parseCommand('цвет MNB красный', m)).toEqual({ action: 'color', names: ['M', 'N', 'B'], color: 'red' });
    expect(parseCommand('цвет точки M нет', m)).toEqual({ action: 'color', names: ['M'], color: '' });
    expect(parseCommand('color mn red', m)).toEqual({ action: 'color', names: ['M', 'N'], color: 'red' });
    expect(parseCommand('цвет M бирюзовый', m).error).toMatch(/Цвета/);
    expect(toolClick('color', [], { point: 'B' }, m)).toEqual({ pending: [], paint: { name: 'B' } });
  });

  it('отрисовка: цветная точка и подпись; в ч/б — крупнее и жирнее', () => {
    const m = evaluateScene(setPointColors(base, ['M'], 'red'));
    const frame = renderStereo(m, DEFAULT_CAMERA, { width: 500, height: 400 });
    expect(frame.dots.find((d) => d.name === 'M').color).toBe('#dc2626');
    expect(frame.labels.find((l) => l.name === 'M').color).toBe('#dc2626');
    const color = stereoSvgString(frame);
    expect(color).toContain('fill="#dc2626"');
    const mono = stereoSvgString(frame, { mono: true });
    expect(mono).not.toContain('#dc2626');
    expect(mono).toContain('r="4.4"');
    expect(mono).toContain('font-weight="bold"');
  });

  it('блок ```stereo: туда и обратно с цветами', () => {
    const src = 'куб 4\nM на AA1\nN на CC1\nсечение MNB\nцвет MNB красный\nцвет C синий';
    const a = parseStereoBlock(src);
    expect(a.errors).toEqual([]);
    expect(a.scene.colors).toEqual({ M: 'red', N: 'red', B: 'red', C: 'blue' });
    const { text } = buildStereoBlock(a.scene, a.camera);
    expect(text).toContain('цвет MNB красный');
    expect(parseStereoBlock(text).scene.colors).toEqual(a.scene.colors);
    expect(parseStereoBlock('куб\nцвет Q красный').errors[0].message).toMatch(/Нет точки Q/);
  });
});

describe('цвет точек: редактор', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('stereo.editor.v1', JSON.stringify({ scene: base }));
  });
  const enter = (input, value) => {
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    fireEvent.keyUp(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
  };

  it('команда красит, палитра появляется у инструмента «Цвет», Ctrl+Z снимает', () => {
    render(<AntApp><StereoEditor /></AntApp>);
    enter(screen.getByLabelText('Строка команд'), 'цвет MNB красный');
    expect(screen.queryByText(/Не понял/)).toBeNull();
    expect(screen.getByLabelText('Строка команд').value).toBe('');
    fireEvent.keyDown(window, { key: 'o', code: 'KeyO' });
    expect(screen.getByRole('radiogroup', { name: 'Цвет точек, прямых и сечений' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'красный' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'синий' }));
    expect(screen.getByRole('radio', { name: 'синий' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Снять все').closest('button').disabled).toBe(false);
    fireEvent.keyDown(window, { key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(screen.getByText('Снять все').closest('button').disabled).toBe(true);
  });
});

describe('цвет сечений и плоскостей', () => {
  // Два сечения на одном кубе: MNB и через K, L, P.
  const two = {
    body: cube,
    ops: [
      ...base.ops,
      { id: 'k', type: 'pointOnLine', name: 'K', ref: ['A', 'B'], t: 0.5 },
      { id: 'l', type: 'pointOnLine', name: 'L', ref: ['B', 'C'], t: 0.5 },
      { id: 'p', type: 'pointOnLine', name: 'P', ref: ['B', 'B1'], t: 0.5 },
      { id: 's2', type: 'section', pts: ['K', 'L', 'P'] },
    ],
  };

  it('новые цвета палитры', () => {
    expect(colorKeyFromWord('голубой')).toBe('cyan');
    expect(colorKeyFromWord('желтый')).toBe('yellow');
    expect(colorKeyFromWord('серым')).toBe('gray');
    expect(pointColorHex('pink')).toBe('#db2777');
  });

  it('команда красит сечение по его точкам и по точкам в его плоскости', () => {
    const m = evaluateScene(two);
    expect(parseCommand('цвет сечения MNB зелёный', m))
      .toEqual({ action: 'color', names: [], planes: [['M', 'N', 'B']], color: 'green' });
    expect(parseCommand('цвет сечений MNB, KLP розовый', m).planes).toHaveLength(2);
    expect(parseCommand('цвет сечения MN красный', m).error).toMatch(/тремя точками/);
    expect(applyColorCommand(two, parseCommand('цвет сечения BNM зелёный', m)).scene.polyColors).toEqual({ c: 'green' });
    expect(applyColorCommand(two, parseCommand('цвет плоскости KLP красный', m)).scene.polyColors).toEqual({ s2: 'red' });
    expect(applyColorCommand(two, parseCommand('цвет сечения ABC красный', m)).error).toMatch(/не построено/);
  });

  it('отрисовка: заливка и контур своим цветом, второе сечение — по умолчанию', () => {
    const s = setPolyColors(two, ['c'], 'green');
    const frame = renderStereo(evaluateScene(s), DEFAULT_CAMERA, { width: 500, height: 400 });
    expect(frame.polys.find((p) => p.id === 'c').fill).toBe('#16a34a');
    expect(frame.polys.find((p) => p.id === 's2').fill).toBe('#3b82f6');
    expect(frame.strokes.filter((st) => st.objId.startsWith('c:e')).every((st) => st.color === '#16a34a')).toBe(true);
  });

  it('инструмент: клик внутри сечения, по грани без плоскости — подсказка', () => {
    const m = evaluateScene(two);
    expect(toolClick('color', [], { poly: { id: 's2' } }, m)).toEqual({ pending: [], paint: { poly: 's2' } });
    expect(toolClick('color', [], { face: { id: 'ABCD', verts: ['A', 'B', 'C', 'D'] } }, m).error).toMatch(/плоскость/);
    const withFace = evaluateScene({ ...two, ops: [...two.ops, { id: 'f', type: 'plane', pts: ['A', 'B', 'C', 'D'] }] });
    const faceId = withFace.polys.find((p) => p.id === 'f').faceId;
    expect(toolClick('color', [], { face: { id: faceId, verts: ['A', 'B', 'C', 'D'] } }, withFace).paint).toEqual({ poly: 'f' });
  });

  it('удаление шага уносит цвет; блок ```stereo — туда и обратно', () => {
    const s = setPolyColors(setPolyColors(two, ['c'], 'green'), ['s2'], 'orange');
    expect(removeOpCascade(s, 'k').scene.polyColors).toEqual({ c: 'green' });
    expect(removeOpCascade(removeOpCascade(s, 'k').scene, 'a').scene.polyColors).toBeUndefined();
    const { text } = buildStereoBlock(s, DEFAULT_CAMERA);
    expect(text).toContain('цвет сечения MNB зелёный');
    expect(text).toContain('цвет сечения KLP оранжевый');
    const back = parseStereoBlock(text);
    expect(back.errors).toEqual([]);
    expect(Object.values(back.scene.polyColors).sort()).toEqual(['green', 'orange']);
  });
});
