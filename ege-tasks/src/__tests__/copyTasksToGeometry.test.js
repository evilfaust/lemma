import { describe, it, expect, vi, beforeEach } from 'vitest';

// Маленький PocketBase в памяти: getFullList отдаёт записи, у которых
// хоть одно значение из фильтра встречается в JSON записи.
let db;
const created = [];
const deleted = [];
const quoted = (filter = '') => [...filter.matchAll(/"([^"]*)"/g)].map((m) => m[1]);

vi.mock('../shared/services/pb/client.js', () => ({
  pb: {
    collection: (name) => ({
      getFullList: async ({ filter = '' } = {}) => {
        const rows = db[name] || [];
        if (name === 'geometry_tasks') return rows;
        const values = quoted(filter);
        return rows.filter((r) => values.some((v) => JSON.stringify(r).includes(`"${v}"`)
          || (Array.isArray(r.tasks) && r.tasks.includes(v))));
      },
      getOne: async (id) => (db[name] || []).find((r) => r.id === id),
      create: async (data) => { const rec = { id: `g${created.length + 1}`, ...data }; created.push(rec); return rec; },
      delete: async (id) => { deleted.push(id); return true; },
    }),
    files: { getUrl: (rec, file) => `https://pb/${rec.id}/${file}` },
  },
  _logAudit: () => {},
  withOwner: (d) => d,
  andOwner: (f) => f || '',
}));

const { geometryApi } = await import('../shared/services/pb/geometry.js');

const task = (id, statement, extra = {}) => ({ id, code: `1-${id}`, statement_md: statement, answer: '1', ...extra });

beforeEach(() => {
  created.length = 0;
  deleted.length = 0;
  db = {
    tasks: [
      task('t1', 'Найдите угол $A$.', { image: 'a.png' }),
      task('t2', 'Найдите сторону.'),
      task('t3', 'Найдите   сторону'), // тот же текст, что у t2
      task('t4', 'Уже в геометрии.'),
    ],
    task_images: [],
    geometry_tasks: [{ id: 'old', code: 'GEO-041', statement_md: 'уже в геометрии' }],
    variants: [{ id: 'v1', tasks: ['t2'] }],
  };
  global.fetch = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) }));
});

describe('copyTasksToGeometry', () => {
  it('копирует, не дублирует и продолжает нумерацию GEO', async () => {
    const report = await geometryApi.copyTasksToGeometry(['t1', 't2', 't3', 't4'], { topic: 'gt' });
    expect(report.created.map((c) => [c.taskCode, c.geoCode])).toEqual([
      ['1-t1', 'GEO-042'],
      ['1-t2', 'GEO-043'],
    ]);
    expect(report.skipped.map((s) => [s.taskCode, s.geoCode])).toEqual([
      ['1-t4', 'GEO-041'],
      ['1-t3', 'GEO-043'],
    ]);
    expect(created[0].geogebra_image_base64).toBeInstanceOf(File);
    expect(created[0].drawing_view).toBe('image');
    expect(created[0].topic).toBe('gt');
    expect(created[1].solution_md).toBe('*Из банка задач: 1-t2.*');
    expect(deleted).toEqual([]);
    expect(report.kept).toEqual([]);
  });

  it('с удалением убирает только неиспользуемые исходники', async () => {
    const report = await geometryApi.copyTasksToGeometry(['t1', 't2', 't4'], { deleteSource: true });
    expect(deleted.sort()).toEqual(['t1', 't4']);
    expect(report.kept).toEqual([{ taskCode: '1-t2', reason: 'работы' }]);
  });

  it('чертёж не скачался — копия без чертежа, исходник остаётся', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 404 }));
    const report = await geometryApi.copyTasksToGeometry(['t1'], { deleteSource: true });
    expect(report.created[0].noDrawing).toBe(true);
    expect(created[0].geogebra_image_base64).toBeUndefined();
    expect(deleted).toEqual([]);
    expect(report.kept).toEqual([{ taskCode: '1-t1', reason: 'чертёж не скопировался' }]);
  });
});
