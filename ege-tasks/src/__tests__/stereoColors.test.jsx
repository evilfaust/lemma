import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App as AntApp } from 'antd';
import StereoEditor from '../components/stereo/StereoEditor';
import {
  evaluateScene, renderStereo, stereoSvgString, DEFAULT_CAMERA, setPointColors,
  removeOpCascade, renamePointInScene, parseCommand, toolClick, colorKeyFromWord,
  pointColorHex, parseStereoBlock, buildStereoBlock, tryAppendOp,
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
    expect(screen.getByRole('radiogroup', { name: 'Цвет точек и прямых' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'красный' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'синий' }));
    expect(screen.getByRole('radio', { name: 'синий' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Снять все').closest('button').disabled).toBe(false);
    fireEvent.keyDown(window, { key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(screen.getByText('Снять все').closest('button').disabled).toBe(true);
  });
});
