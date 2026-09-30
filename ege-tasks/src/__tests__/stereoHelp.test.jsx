import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { App as AntApp } from 'antd';
import StereoEditor from '../components/stereo/StereoEditor';
import {
  COMMAND_HELP, KEY_HELP, DSL_HELP, TOOLS, parseCommand, evaluateScene,
} from '../utils/stereo';
import { parseStereoBlock } from '../utils/stereo/dsl';

// Сцена, на которой справка «живёт»: есть P на AA1, прямая через P ∥ AB и
// перпендикуляр к основанию, восставленный из A.
const scene = {
  body: { kind: 'cube', a: 4 },
  ops: [
    { id: 'p', type: 'pointOnLine', name: 'P', ref: ['A', 'A1'], t: 0.3 },
    { id: 'par', type: 'parallel', through: 'P', ref: ['A', 'B'] },
    { id: 'perp', type: 'perp', from: 'A', plane: ['A', 'B', 'C'] },
  ],
};

describe('справка стереоредактора — сторож', () => {
  it('каждая команда из справки разбирается', () => {
    const m = evaluateScene(scene);
    const all = COMMAND_HELP.flatMap((s) => s.items);
    expect(all.length).toBeGreaterThan(20);
    for (const { cmd } of all) {
      const r = parseCommand(cmd, m);
      expect({ cmd, error: r.error }).toEqual({ cmd, error: undefined });
    }
  });

  it('каждая строка блока ```stereo из справки читается без ошибок', () => {
    for (const { line } of DSL_HELP) {
      const isBody = /^(куб|параллелепипед|призма|пирамида|тетраэдр)/.test(line);
      const r = parseStereoBlock(isBody ? line : `куб 4\n${line}`);
      expect({ line, errors: r.errors }).toEqual({ line, errors: [] });
    }
  });

  it('буквы инструментов в справке совпадают с горячими клавишами', () => {
    const row = KEY_HELP.flatMap((s) => s.items).find((r) => r.keys === 'Буква инструмента');
    const letters = row.what.match(/\(([^)]+)\)/)[1].split(/,\s*/);
    expect(letters).toEqual(TOOLS.map((t) => t.hot));
  });
});

describe('справка в редакторе', () => {
  it('кнопка «?» открывает, клик по команде вставляет её в строку', async () => {
    localStorage.clear();
    render(<AntApp><StereoEditor /></AntApp>);
    fireEvent.click(screen.getByLabelText('Справка по командам'));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Справка: стереочертежи')).toBeTruthy();
    fireEvent.click(within(dlg).getByText('середина AC1'));
    expect(screen.getByLabelText('Строка команд').value).toBe('середина AC1');
  });

  it('клавиша «?» тоже открывает', async () => {
    localStorage.clear();
    render(<AntApp><StereoEditor /></AntApp>);
    fireEvent.keyDown(window, { key: '?', code: 'Slash', shiftKey: true });
    expect(await screen.findByText('Справка: стереочертежи')).toBeTruthy();
  });
});
