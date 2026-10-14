import { describe, it, expect } from 'vitest';
import { pickRetakeVariant, mcVariantKey } from '../utils/retakeVariant';

const first = (arr) => arr; // без случайности: берём первого кандидата
const byVariant = (a) => a.variant;

describe('вариант для попытки, выданной вручную', () => {
  it('сначала вариант, которого у ученика не было, и наименее выданный', () => {
    const attempts = [
      { student: 'u1', variant: 'v1' },
      { student: 'u2', variant: 'v2' },
      { student: 'u3', variant: 'v2' },
    ];
    const got = pickRetakeVariant(['v1', 'v2', 'v3'], attempts, attempts[0], byVariant, first);
    expect(got).toBe('v3');
  });

  it('все варианты были — не повторяем текущий', () => {
    const attempts = [
      { student: 'u1', variant: 'v1' },
      { student: 'u1', variant: 'v2' },
    ];
    const got = pickRetakeVariant(['v1', 'v2'], attempts, attempts[1], byVariant, first);
    expect(got).toBe('v1');
  });

  it('единственный вариант — он же', () => {
    const a = { student: 'u1', variant: 'v1' };
    expect(pickRetakeVariant(['v1'], [a], a, byVariant, first)).toBe('v1');
  });

  it('без вариантов — null', () => {
    expect(pickRetakeVariant([], [], {}, byVariant)).toBeNull();
  });

  it('тест A/B/C/D: ключ — номер варианта из mc_variant', () => {
    const attempts = [
      { student: 'u1', mc_variant: 1, variant: '' },
      { student: 'u2', mc_variant: 2, variant: '' },
    ];
    const got = pickRetakeVariant(['1', '2', '3'], attempts, attempts[0], mcVariantKey, first);
    expect(got).toBe('3');
    expect(mcVariantKey({ mc_variant: 2 })).toBe('2');
    expect(mcVariantKey({})).toBe('');
  });

  it('ученик без аккаунта узнаётся по устройству', () => {
    const attempts = [
      { device_id: 'd1', mc_variant: 1 },
      { device_id: 'd2', mc_variant: 2 },
    ];
    const got = pickRetakeVariant(['1', '2'], attempts, attempts[0], mcVariantKey, first);
    expect(got).toBe('2');
  });
});
