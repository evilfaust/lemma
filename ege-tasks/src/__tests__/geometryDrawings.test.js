import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  LEVELS, DEFAULT_LEVEL, normalizeDrawings, drawingKind, maxLevel, chosenLevel, taskLevel,
  setDefaultLevel, setTasksLevel, rowChoice,
} from '../utils/geometryDrawings';
import { stereoDrawingSvg } from '../utils/stereo/dsl';
import { planimDrawingSvg, parsePlanimBlock } from '../utils/planim/dsl';
import { DEFAULT_CAMERA } from '../utils/stereo/camera';

// Чертежи ученикам в геометрической работе (v3.9.377): уровень показа на
// работу и на задачу, отрезание на сервере (pb_hooks/geometry_work_lib.js).

const require = createRequire(import.meta.url);
const lib = require('../../../pocketbase/pb_hooks/geometry_work_lib.js');

const STEREO_SVG = stereoDrawingSvg({ body: { kind: 'cube', a: 4 }, ops: [] }, DEFAULT_CAMERA);
const PLANIM_SVG = planimDrawingSvg(parsePlanimBlock('треугольник ABC 5 6 7').scene);

const TASKS = {
  stereo: { id: 'tstereo', drawing_view: 'svg', drawing_svg: STEREO_SVG },
  planim: { id: 'tplanim', drawing_view: 'svg', drawing_svg: PLANIM_SVG },
  svg: { id: 'tsvg', drawing_view: 'svg', drawing_svg: '<svg viewBox="0 0 10 10"><line x1="0" y1="0" x2="9" y2="9"/></svg>' },
  image: { id: 'timage', drawing_view: 'image', geogebra_image_base64: 'pic.png' },
  solution: { id: 'tsol', drawing_view: 'image', geogebra_image_base64: 'sol.png', image_role: 'solution' },
  none: { id: 'tnone', statement_md: 'Без чертежа' },
};

describe('вид чертежа и потолок уровня', () => {
  it('вид определяется по исходнику в SVG и по картинке', () => {
    expect(drawingKind(TASKS.stereo)).toBe('stereo');
    expect(drawingKind(TASKS.planim)).toBe('planim');
    expect(drawingKind(TASKS.svg)).toBe('svg');
    expect(drawingKind(TASKS.image)).toBe('image');
    expect(drawingKind(TASKS.solution)).toBeNull(); // чертёж решения — никогда
    expect(drawingKind(TASKS.none)).toBeNull();
    expect(drawingKind({ drawing_view: 'svg', drawing_svg: '', geogebra_image_base64: 'a.png' })).toBe('image');
  });

  it('GeoGebra/PNG и SVG без исходника — не выше картинки', () => {
    expect(maxLevel('stereo')).toBe('steps');
    expect(maxLevel('planim')).toBe('steps');
    expect(maxLevel('svg')).toBe('image');
    expect(maxLevel('image')).toBe('image');
    expect(maxLevel(null)).toBe('none');
  });
});

describe('уровень задачи: умолчание работы и оверрайд', () => {
  it('пустая настройка = как было до неё (интерактивный)', () => {
    expect(DEFAULT_LEVEL).toBe('live');
    expect(normalizeDrawings(null)).toEqual({ default: 'live', tasks: {} });
    expect(taskLevel(null, 'tstereo', 'stereo')).toBe('live');
    expect(taskLevel(null, 'timage', 'image')).toBe('image');
  });

  it('мусор в настройке отбрасывается, строка JSON читается', () => {
    expect(normalizeDrawings({ default: 'всё', tasks: { a: 'steps', b: 'xxx' } }))
      .toEqual({ default: 'live', tasks: { a: 'steps' } });
    expect(normalizeDrawings('{"default":"none","tasks":{"a":"image"}}'))
      .toEqual({ default: 'none', tasks: { a: 'image' } });
    expect(normalizeDrawings('не json')).toEqual({ default: 'live', tasks: {} });
  });

  it('сценарий учителя: эталон по шагам, 2–3 живые, остальные — только условие', () => {
    const d = { default: 'none', tasks: { t1: 'steps', t2: 'live', t3: 'live' } };
    expect(taskLevel(d, 't1', 'stereo')).toBe('steps');
    expect(taskLevel(d, 't2', 'planim')).toBe('live');
    expect(taskLevel(d, 't3', 'image')).toBe('image'); // у картинки живого нет
    expect(taskLevel(d, 't4', 'stereo')).toBe('none');
    expect(chosenLevel(d, 't3')).toBe('live');
  });

  it('оверрайд может и закрыть чертёж при открытом умолчании', () => {
    expect(taskLevel({ default: 'steps', tasks: { a: 'none' } }, 'a', 'stereo')).toBe('none');
  });
});

describe('правка настройки', () => {
  it('новое умолчание снимает совпавшие с ним оверрайды', () => {
    const d = setDefaultLevel({ default: 'live', tasks: { a: 'none', b: 'steps' } }, 'none');
    expect(d).toEqual({ default: 'none', tasks: { b: 'steps' } });
  });

  it('уровень позиции — всем её задачам; «как у работы» и равный умолчанию — без оверрайда', () => {
    let d = setTasksLevel(null, ['a', 'b', null], 'steps');
    expect(d.tasks).toEqual({ a: 'steps', b: 'steps' });
    d = setTasksLevel(d, ['a'], null);
    expect(d.tasks).toEqual({ b: 'steps' });
    d = setTasksLevel(d, ['b'], 'live'); // = умолчание
    expect(d.tasks).toEqual({});
  });

  it('выбор позиции: общий, «как у работы» или разный', () => {
    const d = { default: 'live', tasks: { a: 'steps', b: 'steps', c: 'none' } };
    expect(rowChoice(d, ['a', 'b'])).toBe('steps');
    expect(rowChoice(d, ['x', 'y'])).toBeNull();
    expect(rowChoice(d, ['a', 'c'])).toBe('mixed');
    expect(rowChoice(d, ['a', 'x'])).toBe('mixed');
  });
});

describe('копии правил на сервере и в браузере совпадают', () => {
  const settings = [
    null,
    { default: 'none', tasks: {} },
    { default: 'image', tasks: { tstereo: 'steps', tplanim: 'live', timage: 'steps' } },
    { default: 'steps', tasks: { tsvg: 'none' } },
    '{"default":"live","tasks":{"tnone":"steps"}}',
  ];

  it('уровни и умолчание', () => {
    expect(lib.LEVELS).toEqual(LEVELS);
    expect(lib.DEFAULT_LEVEL).toBe(DEFAULT_LEVEL);
  });

  it('вид, потолок, уровень — на всех сочетаниях', () => {
    for (const t of Object.values(TASKS)) {
      expect(lib.drawingKind(t)).toBe(drawingKind(t));
      for (const s of settings) {
        expect(lib.normalizeDrawings(s)).toEqual(normalizeDrawings(s));
        expect(lib.taskLevel(s, t.id, lib.drawingKind(t))).toBe(taskLevel(s, t.id, drawingKind(t)));
      }
    }
    for (const k of ['stereo', 'planim', 'svg', 'image', null]) expect(lib.maxLevel(k)).toBe(maxLevel(k));
  });
});

describe('сервер: что уходит ученику', () => {
  const full = (t) => ({ ...t, code: 'GEO-1', statement_md: 'Условие', answer: '42', solution_md: 'Решение', hints: [{ text_md: 'указание' }] });

  it('ответ, решение и указания не уходят никогда', () => {
    for (const t of Object.values(TASKS)) {
      const out = lib.projectTask(full(t), { default: 'steps', tasks: {} });
      expect(out).not.toHaveProperty('answer');
      expect(out).not.toHaveProperty('solution_md');
      expect(out).not.toHaveProperty('hints');
      expect(out.statement_md).toBe('Условие');
    }
  });

  it('«только условие» — чертежа в ответе сервера нет, но ученик знает, что он был', () => {
    const d = { default: 'none', tasks: {} };
    const st = lib.projectTask(full(TASKS.stereo), d);
    expect(st.level).toBe('none');
    expect(st.has_drawing).toBe(true);
    expect(st).not.toHaveProperty('drawing_svg');
    const img = lib.projectTask(full(TASKS.image), d);
    expect(img).not.toHaveProperty('geogebra_image_base64');
    expect(lib.projectTask(full(TASKS.none), d).has_drawing).toBe(false);
  });

  it('«картинка» — SVG без исходника: шаги построения не восстановить', () => {
    const out = lib.projectTask(full(TASKS.stereo), { default: 'image', tasks: {} });
    expect(out.level).toBe('image');
    expect(out.drawing_svg).toMatch(/^<svg/);
    expect(out.drawing_svg).not.toMatch(/<!--stereo:/);
    const pl = lib.projectTask(full(TASKS.planim), { default: 'image', tasks: {} });
    expect(pl.drawing_svg).not.toMatch(/<!--planim:/);
  });

  it('«живой» и «по шагам» — SVG с исходником', () => {
    for (const lv of ['live', 'steps']) {
      const out = lib.projectTask(full(TASKS.stereo), { default: lv, tasks: {} });
      expect(out.level).toBe(lv);
      expect(out.kind).toBe('stereo');
      expect(out.drawing_svg).toMatch(/<!--stereo:/);
    }
  });

  it('картинка GeoGebra отдаётся файлом, чертёж решения — нет', () => {
    const img = lib.projectTask(full(TASKS.image), { default: 'steps', tasks: {} });
    expect(img.level).toBe('image');
    expect(img.geogebra_image_base64).toBe('pic.png');
    const sol = lib.projectTask(full(TASKS.solution), { default: 'steps', tasks: {} });
    expect(sol.level).toBe('none');
    expect(sol.has_drawing).toBe(false);
    expect(sol).not.toHaveProperty('geogebra_image_base64');
  });

  it('варианты из структуры: пустая ячейка остаётся на месте', () => {
    expect(lib.variantsOf({ variants: [{ items: [{ task: 'a' }, null, { task: 'b' }] }, { items: [] }] }))
      .toEqual([['a', null, 'b'], []]);
    expect(lib.variantsOf(null)).toEqual([[]]);
    expect(lib.variantsOf('{"variants":[{"items":[{"task":"x"}]}]}')).toEqual([['x']]);
  });

  it('хук отдаёт только открытые работы и не тянет ответы из базы', () => {
    const src = readFileSync(resolve(__dirname, '../../../pocketbase/pb_hooks/geometry_work.pb.js'), 'utf8');
    expect(src).toMatch(/routerAdd\("GET", "\/api\/geometry\/work\/\{id\}"/);
    expect(src).toMatch(/getBool\("public"\)/);
    expect(src).toMatch(/require\(`\$\{__hooks\}\/geometry_work_lib\.js`\)/);
    for (const f of ['answer', 'solution_md', 'hints', 'solution_files']) {
      expect(src).not.toMatch(new RegExp(`getString\\("${f}"\\)`));
    }
  });

  it('миграция: json-поле drawings и откат', () => {
    const src = readFileSync(resolve(__dirname, '../../../pocketbase/pb_migrations/1788800000_geometry_works_drawings.js'), 'utf8');
    expect(src).toMatch(/new JSONField/);
    expect(src).toMatch(/"name": "drawings"/);
    expect(src).toMatch(/removeById\("json_gwork_drawings"\)/);
  });
});
