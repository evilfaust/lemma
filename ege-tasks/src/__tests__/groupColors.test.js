import { describe, it, expect, beforeEach } from 'vitest';
import {
  GROUP_COLORS, TONE_HEX, autoGroupTone, clearGroupColors, groupHex, groupTone,
  isGroupColor, registerGroupColors,
} from '../shared/utils/groupColors';

describe('groupColors', () => {
  beforeEach(() => { clearGroupColors(); });

  it('цвет по хешу стабилен и берётся из палитры', () => {
    const a = autoGroupTone('grp_1');
    expect(a).toBe(autoGroupTone('grp_1'));
    expect(GROUP_COLORS).toContain(a);
  });

  it('у каждого оттенка палитры есть HEX-набор', () => {
    for (const tone of GROUP_COLORS) {
      expect(TONE_HEX[tone]).toMatchObject({ base: expect.any(String), soft: expect.any(String) });
    }
  });

  it('выбранный цвет перебивает хеш — по id и по записи', () => {
    const hashed = autoGroupTone('grp_1');
    const pinned = GROUP_COLORS.find((c) => c !== hashed);
    expect(groupTone({ id: 'grp_1', color: pinned })).toBe(pinned);

    registerGroupColors([{ id: 'grp_1', color: pinned }]);
    expect(groupTone('grp_1')).toBe(pinned);
    expect(groupHex('grp_1')).toEqual(TONE_HEX[pinned]);
  });

  it('снятый цвет возвращает группу к автоподбору', () => {
    registerGroupColors([{ id: 'grp_1', color: 'lime' }]);
    registerGroupColors([{ id: 'grp_1', color: '' }]);
    expect(groupTone('grp_1')).toBe(autoGroupTone('grp_1'));
  });

  it('мусор вместо цвета игнорируется', () => {
    expect(isGroupColor('neutral')).toBe(false);
    expect(isGroupColor('маджента')).toBe(false);
    registerGroupColors([{ id: 'grp_1', color: 'маджента' }, { color: 'lime' }]);
    expect(groupTone('grp_1')).toBe(autoGroupTone('grp_1'));
  });

  it('запись без цвета красится по id, а не по имени', () => {
    expect(groupTone({ id: 'grp_1', name: '7 кл' })).toBe(autoGroupTone('grp_1'));
  });
});
