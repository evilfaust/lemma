import { describe, it, expect } from 'vitest';
import {
  MARK_MAX_MM, MARK_MIN_MM, RATING_PAD, RATING_PAGE,
  markSizeMm, minTaskColMm, normalizeRatingSettings, planRating,
  ratingContentMm, ratingMaxScore, rowsPerPage, scoreForAttempt, tasksPerPage,
} from '../utils/marathonRating';

const plan = (studentCount, taskCount, settings = {}) =>
  planRating({ studentCount, taskCount, settings });

describe('геометрия бланка рейтинга', () => {
  it('колонки укладываются в полосу набора без остатка', () => {
    const { pages } = plan(12, 17, { extraRows: 2 });
    const { wMm } = ratingContentMm('landscape');
    pages.forEach((p) => {
      const used = p.indexMm + p.nameMm + p.totalMm + p.taskColMm * (p.taskTo - p.taskFrom);
      expect(used).toBeCloseTo(wMm, 6);
    });
  });

  it('строки укладываются в высоту листа', () => {
    const { pages } = plan(20, 10, { extraRows: 0 });
    const { hMm } = ratingContentMm('landscape');
    pages.forEach((p) => {
      const rows = p.rowTo - p.rowFrom;
      expect(p.rowMm * rows).toBeLessThanOrEqual(hMm);
    });
  });

  it('марафон на 17 задач и класс на 14 строк — это один лист', () => {
    const { pages } = plan(12, 17, { extraRows: 2 });
    expect(pages).toHaveLength(1);
    expect(pages[0].withTotal).toBe(true);
  });

  it('пустые строки добавляются к списку учеников', () => {
    const { pages } = plan(5, 8, { extraRows: 3 });
    expect(pages[0].rowTo - pages[0].rowFrom).toBe(8);
  });

  it('что не влезло по ширине — следующий лист, «Итого» только на последнем', () => {
    const { pages } = plan(10, 40, { extraRows: 0 });
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.filter(p => p.withTotal)).toHaveLength(1);
    expect(pages[pages.length - 1].withTotal).toBe(true);
    // блоки задач идут подряд и покрывают весь набор
    expect(pages[0].taskFrom).toBe(0);
    expect(pages[pages.length - 1].taskTo).toBe(40);
  });

  it('что не влезло по высоте — следующий лист с теми же задачами', () => {
    const { pages, rowsPerSheet } = plan(60, 10, { extraRows: 0 });
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].rowTo).toBe(rowsPerSheet);
    expect(pages[1].rowFrom).toBe(rowsPerSheet);
    expect(pages[pages.length - 1].rowTo).toBe(60);
  });

  it('пустой марафон не ломает расчёт', () => {
    expect(plan(0, 10, { extraRows: 0 }).pages).toHaveLength(0);
    expect(plan(10, 0).pages).toHaveLength(0);
  });

  it('без списка учеников, но с пустыми строками — бланк «впишу сам»', () => {
    const { pages } = plan(0, 10, { extraRows: 5 });
    expect(pages).toHaveLength(1);
    expect(pages[0].rowTo - pages[0].rowFrom).toBe(5);
  });

  it('книжный лист вмещает меньше задач, чем альбомный', () => {
    const land = tasksPerPage({ orientation: 'landscape' });
    const port = tasksPerPage({ orientation: 'portrait' });
    expect(port).toBeLessThan(land);
    expect(rowsPerPage({ orientation: 'portrait' }))
      .toBeGreaterThan(rowsPerPage({ orientation: 'landscape' }));
  });

  it('лист по высоте не 210/297: округления печати выдавливают пустую страницу', () => {
    expect(RATING_PAGE.landscape.h).toBeLessThan(210);
    expect(RATING_PAGE.portrait.h).toBeLessThan(297);
    expect(ratingContentMm('landscape').hMm)
      .toBeCloseTo(RATING_PAGE.landscape.h - RATING_PAD.top - RATING_PAD.bottom, 6);
  });
});

describe('квадратики попыток', () => {
  it('размер держится в читаемых пределах', () => {
    [8, 17, 25, 40].forEach((n) => {
      const { pages } = plan(10, n);
      pages.forEach((p) => {
        expect(p.markMm).toBeGreaterThanOrEqual(MARK_MIN_MM);
        expect(p.markMm).toBeLessThanOrEqual(MARK_MAX_MM);
      });
    });
  });

  it('чем плотнее лист, тем мельче квадратик', () => {
    const wide = plan(10, 8).pages[0];
    const dense = plan(10, 20).pages[0];
    expect(dense.markMm).toBeLessThanOrEqual(wide.markMm);
  });

  it('квадратики с зазорами влезают в свою колонку', () => {
    const { pages } = plan(10, 17, { attempts: 4 });
    const p = pages[0];
    expect(markSizeMm(p.taskColMm, 4, false) * 4).toBeLessThan(p.taskColMm);
  });

  it('клетка «баллы» сужает место под квадратики', () => {
    const bare = plan(10, 12, { showScore: false }).pages[0];
    const scored = plan(10, 12, { showScore: true }).pages[0];
    expect(scored.scoreMm).toBeGreaterThan(0);
    expect(scored.markMm).toBeLessThanOrEqual(bare.markMm);
    expect(minTaskColMm(3, true)).toBeGreaterThan(minTaskColMm(3, false));
  });
});

describe('баллы', () => {
  it('с первой попытки — максимум, дальше по убыванию', () => {
    expect(scoreForAttempt(1, 3)).toBe(3);
    expect(scoreForAttempt(2, 3)).toBe(2);
    expect(scoreForAttempt(3, 3)).toBe(1);
    expect(scoreForAttempt(4, 3)).toBe(0);
  });

  it('максимум за бланк считается по числу попыток', () => {
    expect(ratingMaxScore(17, 3)).toBe(51);
    expect(ratingMaxScore(17, 2)).toBe(34);
    expect(ratingMaxScore(0, 3)).toBe(0);
  });
});

describe('настройки бланка', () => {
  it('чужие значения не роняют лист', () => {
    const s = normalizeRatingSettings({ orientation: 'diagonal', attempts: 99, extraRows: -5, nameMm: 5 });
    expect(s.orientation).toBe('landscape');
    expect(s.attempts).toBe(5);
    expect(s.extraRows).toBe(0);
    expect(s.nameMm).toBeGreaterThanOrEqual(30);
  });

  it('число попыток не опускается ниже двух', () => {
    expect(normalizeRatingSettings({ attempts: 1 }).attempts).toBe(2);
  });
});
