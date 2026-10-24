import { describe, it, expect } from 'vitest';
import { validateTaskCode } from '../utils/taskCodeGenerator';

describe('validateTaskCode (формат банка с v3.9.397)', () => {
  it('экзамены: буква экзамена + номер задания', () => {
    expect(validateTaskCode('П12-034')).toBe(true);
    expect(validateTaskCode('Б5-001')).toBe(true);
    expect(validateTaskCode('ОГ25-999')).toBe(true);
    expect(validateTaskCode('ПА12-001')).toBe(true);
    expect(validateTaskCode('В7.15-001')).toBe(true);
    expect(validateTaskCode('Т1-012')).toBe(true);
  });

  it('счётчик больших тем — от трёх цифр и длиннее', () => {
    expect(validateTaskCode('П16-1026')).toBe(true);
  });

  it('темы без номера: буквы, иногда с классом', () => {
    expect(validateTaskCode('КУ-361')).toBe(true);
    expect(validateTaskCode('И11-001')).toBe(true);
    expect(validateTaskCode('ВХ11П-005')).toBe(true);
    expect(validateTaskCode('М16-109')).toBe(true);
  });

  it('старый формат без буквы экзамена — уже не код банка', () => {
    expect(validateTaskCode('14-001')).toBe(false);
    expect(validateTaskCode('A12-001')).toBe(false);
    expect(validateTaskCode('T1-001')).toBe(false);
  });

  it('мусор', () => {
    expect(validateTaskCode('П12-01')).toBe(false);
    expect(validateTaskCode('П12034')).toBe(false);
    expect(validateTaskCode('')).toBe(false);
    expect(validateTaskCode(null)).toBe(false);
    expect(validateTaskCode(undefined)).toBe(false);
  });
});
