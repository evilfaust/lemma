import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import PrintFill from '../components/shared/PrintFill';
import { normalizeTdfSheetSettings, TDF_SHEET_DEFAULTS } from '../utils/tdfSheet';
import { normalizeFlowSettings } from '../utils/tdfFlowSheet';

describe('PrintFill: яркость линий', () => {
  it('по умолчанию — прежняя чёткая клетка (другие листы не меняются)', () => {
    const { container } = render(<PrintFill fill="grid" heightMm={20} widthMm={20} />);
    expect(container.firstChild.className).toBe('pfill');
  });

  it('светлая и точки — модификатор класса, число линий то же', () => {
    for (const tone of ['light', 'dots']) {
      const { container } = render(<PrintFill fill="grid" heightMm={20} widthMm={20} tone={tone} />);
      expect(container.firstChild.className).toBe(`pfill pfill--${tone}`);
      expect(container.querySelectorAll('.pfill-h')).toHaveLength(3);
      expect(container.querySelectorAll('.pfill-v')).toHaveLength(3);
    }
  });

  it('мусор вместо тона — чёткая', () => {
    const { container } = render(<PrintFill fill="lines" heightMm={20} tone="neon" />);
    expect(container.firstChild.className).toBe('pfill');
  });

  it('серый в CSS не светлее #8a8a8a — иначе ч/б принтер линию теряет', () => {
    const css = readFileSync(resolve(__dirname, '../components/shared/printFill.css'), 'utf8');
    const greys = [...css.matchAll(/#([0-9a-f]{6})/gi)].map(m => parseInt(m[1].slice(0, 2), 16));
    expect(greys.length).toBeGreaterThan(0);
    for (const g of greys) expect(g).toBeLessThanOrEqual(0x8a);
  });
});

describe('настройки листов ТДФ', () => {
  it('бланк и «Лист» по умолчанию печатают светлую клетку', () => {
    expect(TDF_SHEET_DEFAULTS.fillTone).toBe('light');
    expect(normalizeTdfSheetSettings({}).fillTone).toBe('light');
    expect(normalizeFlowSettings({}).fillTone).toBe('light');
  });

  it('выбор учителя сохраняется, мусор — к умолчанию', () => {
    expect(normalizeTdfSheetSettings({ fillTone: 'dots' }).fillTone).toBe('dots');
    expect(normalizeTdfSheetSettings({ fillTone: 'dark' }).fillTone).toBe('dark');
    expect(normalizeFlowSettings({ fillTone: 'bright' }).fillTone).toBe('light');
  });
});
