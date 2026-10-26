import { describe, expect, it } from 'vitest';
import {
  KTP_UNITS, assignWeeks, buildKtpRows, formatAmount, scaleTemplate, sectionSummary,
  totalAmount, totalLabel, unitOf, weeksNeeded,
} from '../utils/ktpPlan';
import { KTP_TEMPLATES, ktpTemplate } from '../utils/ktpTemplates';

const stereo = ktpTemplate('stereo10-atanasyan');
const lessons = (rows) => rows.filter((r) => !r.section);

describe('шаблоны КТП', () => {
  it('стереометрия 10: 68 часов, 5 контрольных, 2 зачёта, как в программе', () => {
    const ls = lessons(stereo.items);
    expect(ls.reduce((s, r) => s + r.hours, 0)).toBe(68);
    expect(ls.filter((r) => r.kind === 'control')).toHaveLength(5);
    expect(ls.filter((r) => r.kind === 'credit')).toHaveLength(2);
  });

  it('у каждой строки — название, часы и известный вид', () => {
    for (const t of KTP_TEMPLATES) {
      for (const r of lessons(t.items)) {
        expect(r.title).toBeTruthy();
        expect(r.hours).toBeGreaterThan(0);
        expect(['theory', 'practice', 'control', 'credit', 'lab', 'review']).toContain(r.kind);
      }
    }
  });
});

describe('scaleTemplate', () => {
  it('без цели — часы программы как есть', () => {
    const { rows, total, overflow } = scaleTemplate(stereo.items);
    expect(total).toBe(68);
    expect(overflow).toBe(0);
    expect(lessons(rows).map((r) => r.slots)).toEqual(lessons(stereo.items).map((r) => r.hours));
  });

  it('вдвое больше занятий: контроль остаётся одним, итог ровно в сетку', () => {
    const { rows, total } = scaleTemplate(stereo.items, 136);
    expect(total).toBe(136);
    for (const r of lessons(rows)) {
      if (r.kind === 'control' || r.kind === 'credit') expect(r.slots).toBe(1);
      else expect(r.slots).toBeGreaterThanOrEqual(r.hours * 2);
    }
  });

  it('меньше часов: каждой теме хотя бы одно занятие, сумма = цель', () => {
    const { rows, total, overflow } = scaleTemplate(stereo.items, 50);
    expect(total).toBe(50);
    expect(overflow).toBe(0);
    expect(lessons(rows).every((r) => r.slots >= 1)).toBe(true);
  });

  it('совсем мало часов — overflow вместо потерянных тем', () => {
    const n = lessons(stereo.items).length;
    const { total, overflow } = scaleTemplate(stereo.items, 10);
    expect(total).toBe(n);
    expect(overflow).toBe(n - 10);
  });
});

describe('assignWeeks', () => {
  const rows = [
    { is_section: true, title: 'Раздел' },
    { title: 'a', hours: 1 },
    { title: 'b', hours: 3 },
    { title: 'c', hours: 1 },
    { title: 'd', hours: 2 },
  ];

  it('строка встаёт в неделю, где начинается', () => {
    const out = assignWeeks(rows, 2);
    expect(out[0].week_no).toBeUndefined();
    expect(out.slice(1).map((r) => r.week_no)).toEqual([1, 1, 3, 3]);
    expect(weeksNeeded(rows, 2)).toBe(4);
  });

  it('даты — с первого учебного дня, дальше по понедельникам', () => {
    const out = assignWeeks(rows, 2, { startDate: new Date(2026, 8, 1) }); // вторник 1 сентября
    const d = out.slice(1).map((r) => new Date(r.planned_date));
    expect(d[0].getDate()).toBe(1);
    expect(d[2].getMonth()).toBe(8);
    expect(d[2].getDate()).toBe(14); // неделя 3 — понедельник 14 сентября
    expect(d[2].getDay()).toBe(1);
  });
});

describe('единицы', () => {
  it('пары: подпись и академические часы', () => {
    const course = { unit: 'pair' };
    expect(unitOf(course)).toBe(KTP_UNITS.pair);
    expect(unitOf({})).toBe(KTP_UNITS.lesson);
    expect(formatAmount(68, KTP_UNITS.pair)).toBe('68 пар');
    expect(formatAmount(1, KTP_UNITS.lesson)).toBe('1 час');
    expect(formatAmount(2.5, KTP_UNITS.lesson)).toBe('2,5 часа');
    expect(totalLabel([{ hours: 2 }, { hours: 1 }, { is_section: true, hours: 9 }], course)).toBe('3 пары (6 ч)');
  });
});

describe('buildKtpRows', () => {
  it('2 пары × 34 недели: 68 пар, недели 1…34, разделы — заголовками', () => {
    const { entries, total, base } = buildKtpRows(stereo, { totalSlots: 68, perWeek: 2 });
    expect(total).toBe(68);
    expect(base).toBe(68);
    expect(totalAmount(entries)).toBe(68);
    const weeks = entries.filter((e) => !e.is_section).map((e) => e.week_no);
    expect(Math.min(...weeks)).toBe(1);
    expect(Math.max(...weeks)).toBeLessThanOrEqual(34);
    expect(entries[0]).toMatchObject({ is_section: true, title: stereo.items[0].section });
    const first = entries[1];
    expect(first.planned_results).toContain('Учебник: п. 1, 2');
  });

  it('сводка по разделам сходится с итогом', () => {
    const { rows } = scaleTemplate(stereo.items, 68);
    const sum = sectionSummary(rows);
    expect(sum).toHaveLength(6);
    expect(sum.reduce((s, x) => s + x.slots, 0)).toBe(68);
  });
});
