// Серверная логика распознавания бланков (pocketbase/scan-blank-lib.mjs):
// какие модели читают бланк, когда переходить к запасной, разбор ответа.
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SCAN_MODELS, DEFAULT_SCAN_FALLBACK,
  scanModels, modelsForSlot, shouldTryNext,
  normalizeScanValue, extractJson, parseScanReply, SCAN_BLANK_PROMPT,
} from '../../../pocketbase/scan-blank-lib.mjs';

describe('модели распознавания', () => {
  it('по умолчанию — две разные модели и запасная', () => {
    const cfg = scanModels({});
    expect(cfg.models).toEqual(DEFAULT_SCAN_MODELS);
    expect(new Set(cfg.models).size).toBe(2);
    expect(cfg.fallback).toEqual(DEFAULT_SCAN_FALLBACK);
  });

  it('SCAN_BLANK_MODELS — список через запятую, старое SCAN_BLANK_MODEL тоже понимается', () => {
    expect(scanModels({ SCAN_BLANK_MODELS: ' a/x , b/y ' }).models).toEqual(['a/x', 'b/y']);
    expect(scanModels({ SCAN_BLANK_MODEL: 'c/z' }).models).toEqual(['c/z']);
    expect(scanModels({ SCAN_BLANK_MODELS: 'a/x', SCAN_BLANK_MODEL: 'c/z' }).models).toEqual(['a/x']);
    expect(scanModels({ SCAN_BLANK_FALLBACK: 'f/1,f/2' }).fallback).toEqual(['f/1', 'f/2']);
  });

  it('прочтения 0 и 1 начинают с разных моделей, дальше — остальные и запасные без повторов', () => {
    const cfg = { models: ['a', 'b'], fallback: ['f', 'a'] };
    expect(modelsForSlot(cfg, 0)).toEqual(['a', 'b', 'f']);
    expect(modelsForSlot(cfg, 1)).toEqual(['b', 'a', 'f']);
    expect(modelsForSlot(cfg, 2)).toEqual(['a', 'b', 'f']);
    // Мусор вместо номера — как первое прочтение
    expect(modelsForSlot(cfg, -1)[0]).toBe('a');
    expect(modelsForSlot(cfg, undefined)[0]).toBe('a');
    // Одна модель в списке — оба прочтения ею (как было до v3.9.396)
    expect(modelsForSlot({ models: ['a'], fallback: ['f'] }, 1)).toEqual(['a', 'f']);
  });

  it('к запасной идём, когда модель снята или шлюз сбоит, но не при плохом запросе', () => {
    for (const s of [402, 403, 404, 408, 410, 429, 500, 502, 503]) expect(shouldTryNext(s)).toBe(true);
    for (const s of [400, 401, 413]) expect(shouldTryNext(s)).toBe(false);
  });
});

describe('разбор ответа модели', () => {
  it('крестик и прочерк — нет ответа; минус, точка и пробелы — как в бланке', () => {
    for (const v of ['X', 'x', 'Х', 'х', '×', '-', '--', '—', '–', '−', ' ', '']) {
      expect(normalizeScanValue(v)).toBe('');
    }
    expect(normalizeScanValue('−0.5')).toBe('-0,5');
    expect(normalizeScanValue(' 12 5 ')).toBe('125');
    expect(normalizeScanValue('-12')).toBe('-12');
    expect(normalizeScanValue(17)).toBe('17');
  });

  it('JSON в ограждении и с текстом вокруг', () => {
    expect(extractJson('```json\n{"fields":{}}\n```')).toEqual({ fields: {} });
    expect(extractJson('Вот ответ: {"a":1} — готово')).toEqual({ a: 1 });
    expect(extractJson('не json')).toBeNull();
  });

  it('поля вне варианта отброшены, замены применены, «X» снят', () => {
    const raw = JSON.stringify({
      fields: { 1: '17', 2: 'X', 3: '0.5', 4: '-', 22: '99', abc: '5' },
      replacements: [{ task: 3, value: '−1,6' }, { task: 30, value: '7' }, { task: 2, value: '' }],
      uncertain: [3, 3, 40, 'x'],
    });
    expect(parseScanReply(raw, 21)).toEqual({
      fields: { 1: '17', 3: '-1,6' },
      replacements: [{ task: 3, value: '-1,6' }],
      uncertain: [3],
    });
  });

  it('без числа заданий — поля 1–40; не-JSON — null', () => {
    const r = parseScanReply('{"fields":{"40":"1","41":"2"}}');
    expect(r.fields).toEqual({ 40: '1' });
    expect(parseScanReply('модель отказалась', 21)).toBeNull();
  });

  it('промпт называет число заданий варианта', () => {
    expect(SCAN_BLANK_PROMPT(21)).toContain('В этом варианте 21 заданий');
    expect(SCAN_BLANK_PROMPT(null)).not.toContain('В этом варианте');
  });
});
