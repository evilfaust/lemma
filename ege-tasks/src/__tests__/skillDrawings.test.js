// Сторож скила claude.ai `skills/lemma-drawings`: каждый блок-пример, каждый
// однострочник и каждая команда из таблиц справочников обязаны разбираться
// настоящими парсерами Lemma — иначе модель, читающая скил, будет писать
// неработающие чертежи. Меняется команда редактора — тест покажет, что скил
// устарел (и его надо перепаковать в .skill).

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCoordPlot } from '../utils/coordPlot';
import { parseChartSpec } from '../utils/chartSpec';
import { parseNumberLine } from '../utils/numberLine';
import { parseGridPaper } from '../utils/gridPaper';
import { parseStereoBlock } from '../utils/stereo/dsl';
import { stereoSpecFromInline } from '../utils/stereo/inline';
import { parsePlanimBlock } from '../utils/planim/dsl';
import { planimSpecFromInline } from '../utils/planim/inline';

const SKILL = resolve(__dirname, '../../../skills/lemma-drawings');
const read = (p) => readFileSync(resolve(SKILL, p), 'utf8');
const refs = Object.fromEntries(readdirSync(resolve(SKILL, 'references')).map((f) => [f, read(`references/${f}`)]));
const ALL_MD = [read('SKILL.md'), ...Object.values(refs)].join('\n\n');

const CHECK = {
  plot: (s) => {
    const m = parseCoordPlot(s);
    expect(m.errors).toEqual([]);
    expect(m.curves.length + m.vectors.length + m.points.length).toBeGreaterThan(0);
  },
  chart: (s) => {
    const { doc, errors } = parseChartSpec(s);
    expect(errors).toEqual([]);
    expect(doc.series.length + doc.bars.length).toBeGreaterThan(0);
  },
  numline: (s) => {
    const m = parseNumberLine(s);
    expect(m.bars.length + m.points.length + m.marks.length).toBeGreaterThan(0);
  },
  grid: (s) => expect(parseGridPaper(s).rows).toBeGreaterThan(0),
  stereo: (s) => expect(parseStereoBlock(s).errors).toEqual([]),
  planim: (s) => {
    const r = parsePlanimBlock(s);
    expect(r.errors).toEqual([]);
    expect(r.scene.ops.length).toBeGreaterThan(0);
  },
};
const LANGS = { plot: 'plot', vectors: 'plot', chart: 'chart', numline: 'numline', grid: 'grid', stereo: 'stereo', planim: 'planim' };

function blocks(md) {
  const out = [];
  for (const m of md.matchAll(/^```(\w+)\n([\s\S]*?)^```/gm)) {
    if (LANGS[m[1]]) out.push([LANGS[m[1]], m[2].trim()]);
  }
  return out;
}

function inlines(md) {
  const out = [];
  for (const m of md.matchAll(/`(\w+):\s*([^`]*)`/g)) {
    const kind = LANGS[m[1]];
    if (!kind) continue;
    const spec = kind === 'stereo' ? stereoSpecFromInline(m[2])
      : kind === 'planim' ? planimSpecFromInline(m[2]) : m[2];
    out.push([kind, spec]);
  }
  return out;
}

/** Первая колонка таблиц между заголовками: `команда` → команда (с \| → |). */
function tableCommands(md, fromHeading, toHeading) {
  const start = md.indexOf(fromHeading);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = toHeading ? md.indexOf(toHeading, start + 1) : md.length;
  return md.slice(start, end).split('\n')
    .map((l) => /^\|\s*`([^`]+)`/.exec(l))
    .filter(Boolean)
    .map((m) => m[1].replace(/\\\|/g, '|'));
}

describe('скил lemma-drawings: шапка', () => {
  // claude.ai не принимает скил с описанием длиннее 1024 символов.
  it('description не длиннее 1024 символов', () => {
    const m = /^---\nname: lemma-drawings\ndescription: >-\n([\s\S]*?)\n---/.exec(read('SKILL.md'));
    const text = m[1].split('\n').map((l) => l.trim()).join(' ');
    expect(text.length).toBeLessThanOrEqual(1024);
  });
});

describe('скил lemma-drawings: блоки и однострочники', () => {
  const all = [...blocks(ALL_MD), ...inlines(ALL_MD)];

  it('примеры есть по всем видам', () => {
    const kinds = new Set(all.map(([k]) => k));
    expect([...kinds].sort()).toEqual(['chart', 'grid', 'numline', 'planim', 'plot', 'stereo']);
    expect(all.length).toBeGreaterThan(50);
  });

  it.each(all)('%s: %s', (kind, spec) => {
    if (kind === 'planim') expect({ spec, e: parsePlanimBlock(spec).errors }).toEqual({ spec, e: [] });
    CHECK[kind](spec);
  });
});

// ── planim: команды из таблиц ────────────────────────────────────────────────
const FIGURE_RE = /^(треугольник|прямоугольн|равнобедренн|равносторонн|квадрат|параллелограмм|ромб|трапеция|правильный)/;
const PLANIM_BASE = [
  'A = (0; 0)', 'B = (1; 4)', 'C = (6; 0)', 'D = (5; -3)',
  'O = (1; 1)', 'окружность O 1,5', 'AC', 'AB',
];
const definedBy = (cmd) => (/^([A-Z]\d*)\s*(=|на\s|в\s)/.exec(cmd) || [])[1];

function planimSample(cmd) {
  if (FIGURE_RE.test(cmd)) return cmd;
  const own = definedBy(cmd);
  const base = PLANIM_BASE.filter((l) => !own || !new RegExp(`(^|\\s)${own}(\\s|$)`).test(l));
  return [...base, cmd].join('\n');
}

describe('скил lemma-drawings: команды planim', () => {
  const md = refs['planim.md'];
  const cmds = [
    ...tableCommands(md, '## Фигуры', '## Ссылки на построенные'),
    ...tableCommands(md, '## Пометки', '## Примеры'),
  ];
  it('таблицы найдены', () => expect(cmds.length).toBeGreaterThan(50));
  it.each(cmds)('planim: %s', (cmd) => {
    expect(parsePlanimBlock(planimSample(cmd)).errors).toEqual([]);
  });

  it('служебные строки и ссылки', () => {
    for (const s of [
      'сетка\nцвет\nразмер 360 300\nтреугольник ABC 5 6 7\nH = высота B AC // опускаем высоту',
      'треугольник ABC 5 6 7\nX = AC ∩ (B⊥AC)',
      'параллелограмм ABCD 8 5 60\nK = (бис DAB) ∩ BC',
      'треугольник ABC 5 6 7\nP = (2; 5)\nпрямая P || AB\nX = BC ∩ (P||AB)',
    ]) expect({ s, e: parsePlanimBlock(s).errors }).toEqual({ s, e: [] });
  });
});

// ── stereo: команды из таблиц ────────────────────────────────────────────────
const STEREO_HELPERS = { M: 'M на AA1 1:2', N: 'N на CC1 1:3', K: 'K на BB1 0,5', L: 'L на DD1 0,5', O: 'O = середина AC' };
// Командам, которым нужен свой контекст, — свой чертёж целиком.
const STEREO_OWN = {
  'K на окружности O 120': 'цилиндр 2 5 с буквами\nK на окружности O 120',
  'K на поверхности O 30 0,5': 'цилиндр 2 5 с буквами\nK на поверхности O 30 0,5',
  'показать O': 'цилиндр 2 5\nпоказать O',
  'M ⊥ AC в ABC': 'куб 4\nM на AC 0,5\nM ⊥ AC в ABC',
  'K на (P||AB) 0,3': 'куб 4\nP на CC1 0,5\nпрямая P || AB\nK на (P||AB) 0,3',
  'уровень 3': 'параллелепипед 6 3 4\nуровень 3',
  'цвет сечения MNB зелёный': 'куб 4\nM на AA1 1:2\nN на CC1 1:3\nсечение MNB\nцвет\nцвет сечения MNB зелёный',
  'заливка KLMN': 'куб 4\nK на AA1 0,5\nL на BB1 0,5\nM на CC1 0,5\nN на DD1 0,5\nзаливка KLMN',
  'подпись SO h': 'пирамида 4 4 5 S\nO = S ⊥ (ABC)\nподпись SO h',
  'уровень 60%': 'параллелепипед 6 3 4\nуровень 60%',
};

function stereoSample(cmd) {
  if (STEREO_OWN[cmd]) return STEREO_OWN[cmd];
  const body = /(^|[^A-Z])S([^A-Z0-9]|$)/.test(cmd) ? 'пирамида 4 4 5 S' : 'куб 4';
  const own = definedBy(cmd);
  const helpers = Object.entries(STEREO_HELPERS)
    .filter(([name]) => name !== own && cmd.replace(/\(.*?\)/g, '').replace(/^[A-Z]\d*\s*=/, '').includes(name))
    .map(([, line]) => line);
  return [body, ...helpers, cmd].join('\n');
}

describe('скил lemma-drawings: команды stereo', () => {
  const md = refs['stereo.md'];
  const bodies = tableCommands(md, '## Тело — первая строка', '## Служебные строки');
  const cmds = tableCommands(md, '## Точки', '## Без тела');
  const space = tableCommands(md, '## Без тела', '## Примеры');

  it('таблицы найдены', () => {
    expect(bodies.length).toBeGreaterThan(20);
    expect(cmds.length).toBeGreaterThan(35);
    expect(space.length).toBe(4);
  });

  it.each(bodies)('stereo тело: %s', (cmd) => {
    expect(parseStereoBlock(cmd).errors).toEqual([]);
  });

  it.each(cmds)('stereo: %s', (cmd) => {
    expect(parseStereoBlock(stereoSample(cmd)).errors).toEqual([]);
  });

  it('без тела', () => {
    const s = ['пространство', 'A = (0; 0; -2)', 'B = (4; 0; 0)', 'C = (0; 4; 0)', 'M = (1; 1; 1)',
      'P = (2; 2; 3)', 'Q = (2; 2; -3)', 'плоскость ABC', 'лист α через M', 'PQ', 'X = PQ ∩ (α)'].join('\n');
    expect(parseStereoBlock(s).errors).toEqual([]);
  });

  it('служебные строки', () => {
    for (const s of [
      'куб 4\nвершины KLMNK1L1M1N1',
      'куб 4 каркас\nи шар 2',
      'куб 4\nвид 30 20 1,2\nразмер 400 300\nцвет\nстатично\nM на AA1 1:2 // делим ребро',
      'куб 4 по часовой', 'пирамида 4 4 5 S без букв',
    ]) expect({ s, e: parseStereoBlock(s).errors }).toEqual({ s, e: [] });
  });
});

// ── chart / numline / grid: команды из таблиц ────────────────────────────────
describe('скил lemma-drawings: chart, numline, grid', () => {
  const md = refs['chart-numline-grid.md'];

  it('numline: каждая команда понятна парсеру', () => {
    const inter = tableCommands(md, '### Режим «Неравенства»', '### Режим «Точки');
    const pts = tableCommands(md, '### Режим «Точки', '### Примеры');
    expect(inter.length).toBe(8);
    expect(pts.length).toBe(2);
    for (const c of inter) {
      const m = parseNumberLine(`domain -3 5\n${c}\npoint 0 fill`);
      expect({ c, n: m.points.length + m.bars.length }).toEqual({ c, n: m.points.length + m.bars.length });
    }
    expect(parseNumberLine('domain -3 5\nseg -1 3 fill open').bars.length).toBe(1);
    expect(parseNumberLine('scale -3 3 1\nmark A -2').marks.length).toBe(1);
  });

  it('grid: все записи', () => {
    const rows = tableCommands(md, '## ```grid', null);
    expect(rows.length).toBe(6);
    rows.forEach((r) => expect(parseGridPaper(r.replace(/ \(или.*$/, '')).rows).toBeGreaterThan(0));
  });

  it('chart: values по числу делений', () => {
    const { doc, errors } = parseChartSpec('x 8 24 step 1\ny 0 5 step 1\nvalues 1 2 3 4 5 1 2 3 4 5 1 2 3 4 5 1 2');
    expect(errors).toEqual([]);
    expect(doc.series[0].points.length).toBe(17);
  });
});
