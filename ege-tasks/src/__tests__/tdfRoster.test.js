import { describe, it, expect } from 'vitest';
import {
  ROSTER_DEFAULTS, ROSTER_PAGE, MIN_COL_MM, MAX_ROW_MM,
  normalizeRosterSettings, tasksAreaMm, colsPerPage, planRoster, legendLabel,
} from '../utils/tdfRoster';

const S = (patch = {}) => normalizeRosterSettings({ ...ROSTER_DEFAULTS, ...patch });

describe('normalizeRosterSettings', () => {
  it('зажимает ширину колонки имени в разумные рамки', () => {
    expect(normalizeRosterSettings({ nameColMm: 5 }).nameColMm).toBe(28);
    expect(normalizeRosterSettings({ nameColMm: 500 }).nameColMm).toBe(80);
    expect(normalizeRosterSettings({ nameColMm: 'что-то' }).nameColMm).toBe(ROSTER_DEFAULTS.nameColMm);
  });

  it('неизвестная ориентация — альбомная', () => {
    expect(normalizeRosterSettings({ orientation: 'вбок' }).orientation).toBe('landscape');
    expect(normalizeRosterSettings({ orientation: 'portrait' }).orientation).toBe('portrait');
  });
});

describe('ширина листа', () => {
  it('колонки пунктов получают остаток полосы набора', () => {
    const s = S();
    const expected = ROSTER_PAGE.landscape.w - 16 - s.nameColMm - 7 - 12 - 12;
    expect(tasksAreaMm(s)).toBeCloseTo(expected, 6);
  });

  it('без «Итого» и «Оценки» пунктам достаётся больше места', () => {
    expect(tasksAreaMm(S({ showTotal: false, showMark: false })))
      .toBeGreaterThan(tasksAreaMm(S()));
  });

  it('колонка пункта не уже 7 мм — иначе в неё не поставить отметку', () => {
    const s = S();
    expect(tasksAreaMm(s) / colsPerPage(s)).toBeGreaterThanOrEqual(MIN_COL_MM - 0.001);
  });

  it('в книжной ориентации колонок помещается меньше', () => {
    expect(colsPerPage(S({ orientation: 'portrait' }))).toBeLessThan(colsPerPage(S()));
  });
});

describe('planRoster', () => {
  it('класс на 14 человек и 10 пунктов умещается на один лист', () => {
    const pages = planRoster(14, 10, S());
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ rowFrom: 0, colFrom: 0, colTo: 10 });
  });

  it('лишние пункты уезжают на следующий лист с теми же учениками', () => {
    const s = S();
    const many = colsPerPage(s) + 3;
    const pages = planRoster(10, many, s);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].colTo).toBe(colsPerPage(s));
    expect(pages[1].colFrom).toBe(colsPerPage(s));
    expect(pages[1].colTo).toBe(many);
  });

  it('«Итого» стоит только там, где закончились пункты', () => {
    const s = S();
    const pages = planRoster(10, colsPerPage(s) + 2, s);
    expect(pages[0].showTotal).toBe(false);
    expect(pages[pages.length - 1].showTotal).toBe(true);
  });

  it('пустые строки добавляются к списку учеников', () => {
    const pages = planRoster(3, 5, S({ extraRows: 4 }));
    expect(pages[0].rowTo - pages[0].rowFrom).toBe(7);
  });

  it('строка не растягивается выше потолка', () => {
    const pages = planRoster(2, 5, S({ extraRows: 0 }));
    expect(pages[0].rowMm).toBeLessThanOrEqual(MAX_ROW_MM);
  });

  it('большой класс делится на листы по строкам', () => {
    const pages = planRoster(60, 5, S());
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].rowTo).toBe(pages[1].rowFrom);
  });

  it('набор без пунктов не роняет план', () => {
    const pages = planRoster(5, 0, S());
    expect(pages).toHaveLength(1);
    expect(pages[0].colTo).toBe(0);
  });
});

describe('legendLabel', () => {
  it('режет длинное название и ставит многоточие', () => {
    expect(legendLabel({ name: 'а'.repeat(80) }).length).toBe(60);
    expect(legendLabel({ name: 'а'.repeat(80) }).endsWith('…')).toBe(true);
  });

  it('пустое название заменяет прочерком', () => {
    expect(legendLabel({ name: '  ' })).toBe('—');
    expect(legendLabel(null)).toBe('—');
  });
});
