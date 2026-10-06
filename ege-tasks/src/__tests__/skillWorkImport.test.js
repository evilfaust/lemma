// Сторож скила claude.ai `skills/lemma-work-import`: каждый блок-пример и каждая
// команда из таблиц шпаргалки обязаны разбираться настоящими парсерами Lemma,
// иначе модель, читающая скил, будет писать неработающие чертежи. Меняется
// команда редактора — этот тест покажет, что скил устарел.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePlanimBlock } from '../utils/planim/dsl';
import { parseStereoBlock } from '../utils/stereo/dsl';
import { parseWorkMarkdown } from '../utils/workImportFormat';

const SKILL = resolve(__dirname, '../../../skills/lemma-work-import');
const read = (p) => readFileSync(resolve(SKILL, p), 'utf8');
const drawingsMd = read('references/drawings.md');
const skillMd = read('SKILL.md');

const PARSERS = { planim: parsePlanimBlock, stereo: parseStereoBlock };

function fencedBlocks(md, lang) {
  const re = new RegExp('^```' + lang + '\\n([\\s\\S]*?)^```', 'gm');
  return [...md.matchAll(re)].map((m) => m[1].trim());
}

/** Первая колонка таблиц раздела: `команда` → команда (с \| → |). */
function tableCommands(md, fromHeading, toHeading) {
  const start = md.indexOf(fromHeading);
  const end = toHeading ? md.indexOf(toHeading, start) : md.length;
  return md.slice(start, end).split('\n')
    .map((l) => /^\|\s*`([^`]+)`\s*\|/.exec(l))
    .filter(Boolean)
    .map((m) => m[1].replace(/\\\|/g, '|'));
}

const FIGURE_RE = /^(треугольник|прямоугольн|равнобедренн|равносторонн|квадрат|параллелограмм|ромб|трапеция|правильный)/;
const PLANIM_BASE = [
  'A = (0; 0)', 'B = (1; 4)', 'C = (6; 0)', 'D = (5; -3)',
  'O = (1; 1)', 'окружность O 1,5', 'AC',
].join('\n');

// Команда в чертеже из нескольких точек: что команда сама называет, не
// добавляем в основу (иначе «точка уже есть»).
const definedBy = (cmd) => (/^([A-Z]\d*)\s*(=|на\s)/.exec(cmd) || [])[1];

function planimSample(cmd) {
  if (FIGURE_RE.test(cmd)) return cmd;
  const own = definedBy(cmd);
  const base = PLANIM_BASE.split('\n')
    .filter((l) => !own || !new RegExp(`(^|\\s)${own}(\\s|$)`).test(l)).join('\n');
  return `${base}\n${cmd}`;
}

const STEREO_HELPERS = { M: 'M на AA1 1:2', N: 'N на CC1 1:3', K: 'K на BB1 0,5' };
function stereoSample(cmd) {
  const body = /(^|[^A-Z])S([^A-Z0-9]|$)/.test(cmd) ? 'пирамида 4 4 5 S' : 'куб 4';
  const own = definedBy(cmd);
  const helpers = Object.entries(STEREO_HELPERS)
    .filter(([name]) => name !== own && cmd.replace(/\(.*?\)/g, '').includes(name))
    .map(([, line]) => line);
  return [body, ...helpers, cmd].join('\n');
}

describe('скил lemma-work-import: блоки-примеры', () => {
  for (const lang of ['planim', 'stereo']) {
    const blocks = [...fencedBlocks(drawingsMd, lang), ...fencedBlocks(skillMd, lang)];
    it(`${lang}: примеры есть`, () => expect(blocks.length).toBeGreaterThan(3));
    it.each(blocks)(`${lang}: %s`, (block) => {
      expect(PARSERS[lang](block).errors).toEqual([]);
    });
  }
});

describe('скил lemma-work-import: команды из таблиц', () => {
  const planim = tableCommands(drawingsMd, '## Планиметрия', '### Клетчатая бумага');
  const bodies = tableCommands(drawingsMd, '### Тело — первая строка', '### Команды');
  const stereo = tableCommands(drawingsMd, '### Команды', '### Примеры');

  it('таблицы найдены', () => {
    expect(planim.length).toBeGreaterThan(40);
    expect(bodies.length).toBeGreaterThan(5);
    expect(stereo.length).toBeGreaterThan(10);
  });

  it.each(planim)('planim: %s', (cmd) => {
    expect(parsePlanimBlock(planimSample(cmd)).errors).toEqual([]);
  });

  it.each(bodies)('stereo тело: %s', (cmd) => {
    expect(parseStereoBlock(cmd).errors).toEqual([]);
  });

  it.each(stereo)('stereo: %s', (cmd) => {
    expect(parseStereoBlock(stereoSample(cmd)).errors).toEqual([]);
  });

  it('вершины своими буквами', () => {
    expect(parseStereoBlock('куб 4\nвершины KLMNK1L1M1N1\nKM1').errors).toEqual([]);
    expect(parseStereoBlock('куб 4 по часовой').errors).toEqual([]);
  });
});

describe('скил lemma-work-import: пример формата', () => {
  it('разбирается парсером импорта без ошибок', () => {
    const example = /## Формат\n\n```markdown\n([\s\S]*?)\n```\n/.exec(skillMd)[1]
      .replace(/^…$/gm, 'Условие.');
    const r = parseWorkMarkdown(example);
    expect(r.errors).toEqual([]);
    expect(r.variants.map((v) => v.tasks.length)).toEqual([2, 1]);
    expect(r.variants[0].tasks[1].answer).toBe('312');
    expect(r.imagePlaceholders).toEqual(['рис1']);
  });
});
