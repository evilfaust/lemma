import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import {
  topicPrefix, formatCode, parseCode, suggestPrefix, normalizeCodeQuery,
  compareTaskCodes, oldCodesOf, previewNextCode,
} from '../utils/taskCode';

const require = createRequire(import.meta.url);
const lib = require('../../../pocketbase/pb_hooks/task_codes_lib.js');

const TOPICS = [
  { id: 'p12', exam_type: 'ege_profile', ege_number: 12 },
  { id: 'p12a', exam_type: 'ege_profile', ege_number: 12, archived: true },
  { id: 'b5', exam_type: 'ege_base', ege_number: 5 },
  { id: 'o3', exam_type: 'oge', ege_number: 3 },
  { id: 'v715', exam_type: 'vpr', ege_number: 715 },
  { id: 'v77', exam_type: 'vpr', ege_number: 77 },
  { id: 'trigtopic000007', exam_type: 'trig' },
  { id: 'ku', exam_type: 'other', code_prefix: 'КУ' },
  { id: 'low', exam_type: 'other', code_prefix: 'ку ' },
  { id: 'own', exam_type: 'ege_profile', ege_number: 4, code_prefix: 'X1' },
  { id: 'gordin', exam_type: 'other' },
  { id: 'nonum', exam_type: 'ege_base' },
  null,
];

describe('коды задач: копии фронта и хука совпадают', () => {
  it('topicPrefix', () => {
    for (const t of TOPICS) expect(topicPrefix(t)).toBe(lib.topicPrefix(t));
  });

  it('formatCode / parseCode', () => {
    for (const [p, n] of [['П12', 34], ['В7.15', 1], ['КУ', 1000]]) {
      expect(formatCode(p, n)).toBe(lib.formatCode(p, n));
    }
    for (const c of ['П12-034', 'В7.15-001', 'gordin-plan-24.8', '', 'ВХ11П-5', '18-r513844']) {
      expect(parseCode(c)).toEqual(lib.parseCode(c));
    }
  });

  it('suggestPrefix', () => {
    const taken = ['КУ', 'П12'];
    for (const title of ['Квадратные уравнения', 'Интенсив 11', 'Производная', 'Квадратичная функция и её график', '', 'Входной тест в 10 класс', 'Ёлка']) {
      expect(suggestPrefix(title, taken)).toBe(lib.suggestPrefix(title, taken));
    }
  });
});

describe('topicPrefix', () => {
  it('экзамены — буква экзамена и номер задания', () => {
    expect(topicPrefix(TOPICS[0])).toBe('П12');
    expect(topicPrefix(TOPICS[1])).toBe('ПА12');
    expect(topicPrefix(TOPICS[2])).toBe('Б5');
    expect(topicPrefix(TOPICS[3])).toBe('ОГ3');
  });

  it('ВПР — класс.номер, тригонометрия — Т по номеру темы', () => {
    expect(topicPrefix(TOPICS[4])).toBe('В7.15');
    expect(topicPrefix(TOPICS[5])).toBe('В7.7');
    expect(topicPrefix(TOPICS[6])).toBe('Т7');
  });

  it('свой префикс темы — заглавными; без префикса — пусто', () => {
    expect(topicPrefix(TOPICS[8])).toBe('КУ');
    expect(topicPrefix(TOPICS[9])).toBe('X1');
    expect(topicPrefix(TOPICS[10])).toBe('');
    expect(topicPrefix(TOPICS[11])).toBe('');
  });
});

describe('suggestPrefix', () => {
  it('первые буквы слов, цифры из названия, служебные слова пропускаются', () => {
    expect(suggestPrefix('Квадратные уравнения')).toBe('КУ');
    expect(suggestPrefix('Интенсив 11')).toBe('И11');
    expect(suggestPrefix('Квадратичная функция и её график')).toBe('КФГ');
    expect(suggestPrefix('Производная')).toBe('ПР');
  });

  it('занятый префикс обходится цифрой', () => {
    expect(suggestPrefix('Квадратные уравнения', ['КУ'])).toBe('КУ2');
    expect(suggestPrefix('Квадратные уравнения', new Set(['ку', 'КУ2']))).toBe('КУ3');
  });
});

describe('normalizeCodeQuery — код, набранный как попало', () => {
  it('пробел, короткий номер, строчные', () => {
    expect(normalizeCodeQuery('п12 34')).toBe('П12-034');
    expect(normalizeCodeQuery('П12-34')).toBe('П12-034');
    expect(normalizeCodeQuery(' п12-034 ')).toBe('П12-034');
    expect(normalizeCodeQuery('кУ 6')).toBe('КУ-006');
  });

  it('латинские двойники кириллицы', () => {
    expect(normalizeCodeQuery('ПA12-5')).toBe('ПА12-005'); // латинская A
    expect(normalizeCodeQuery('OГ5-1')).toBe('ОГ5-001');   // латинская O
    expect(normalizeCodeQuery('B7.15-2')).toBe('В7.15-002');
  });

  it('только префикс — все задачи темы', () => {
    expect(normalizeCodeQuery('п12')).toBe('П12-');
    expect(normalizeCodeQuery('ВХ11П 5')).toBe('ВХ11П-005');
  });

  it('не код — null (старый код и слова ищутся как раньше)', () => {
    expect(normalizeCodeQuery('12-034')).toBe(null);
    expect(normalizeCodeQuery('синус')).toBe(null);
    expect(normalizeCodeQuery('найдите значение')).toBe(null);
    expect(normalizeCodeQuery('')).toBe(null);
  });
});

describe('сортировка, прежние коды, подсказка следующего', () => {
  it('999 раньше 1000, П2 раньше П12', () => {
    const codes = ['П16-1000', 'П16-999', 'П12-001', 'П2-005'];
    expect([...codes].sort(compareTaskCodes)).toEqual(['П2-005', 'П12-001', 'П16-999', 'П16-1000']);
  });

  it('old_codes бывает null, строкой JSON или массивом', () => {
    expect(oldCodesOf({ old_codes: null })).toEqual([]);
    expect(oldCodesOf({ old_codes: ['12-034'] })).toEqual(['12-034']);
    expect(oldCodesOf({ old_codes: '["12-034","П12-034"]' })).toEqual(['12-034', 'П12-034']);
    expect(oldCodesOf({ old_codes: 'null' })).toEqual([]);
    expect(oldCodesOf(null)).toEqual([]);
  });

  it('previewNextCode — max+1 только своего префикса', () => {
    const topic = { exam_type: 'ege_profile', ege_number: 12 };
    expect(previewNextCode(topic, ['П12-001', 'П12-041', 'ПА12-900', 'gordin-plan-1.1'])).toBe('П12-042');
    expect(previewNextCode(topic, [])).toBe('П12-001');
    expect(previewNextCode({ exam_type: 'other' }, ['П12-001'])).toBe('');
  });

  it('withOldCode хука — без повторов и пустых', () => {
    expect(lib.withOldCode(['12-034'], 'П12-034')).toEqual(['12-034', 'П12-034']);
    expect(lib.withOldCode(['12-034'], '12-034')).toEqual(['12-034']);
    expect(lib.withOldCode(null, '')).toEqual([]);
  });

  it('codeRange хука: диапазон префикса не задевает длинный соседний префикс', () => {
    const { lo, hi } = lib.codeRange('В7.1');
    const inRange = (c) => c >= lo && c < hi;
    expect(inRange('В7.1-005')).toBe(true);
    expect(inRange('В7.15-001')).toBe(false);
    expect(inRange('В7.13-001')).toBe(false);
  });
});
