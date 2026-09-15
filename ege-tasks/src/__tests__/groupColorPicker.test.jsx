import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GroupColorPicker from '../components/workspace/ui/GroupColorPicker';
import { GROUP_COLORS, TONE_HEX, autoGroupTone } from '../shared/utils/groupColors';
import { groupOptions } from '../components/workspace/calendar/calendarUtils';

describe('GroupColorPicker', () => {
  it('рисует всю палитру плюс кнопку «авто»', () => {
    const html = renderToStaticMarkup(<GroupColorPicker value="" autoKey="grp_1" />);
    expect(html).toContain('ws-palette__auto is-active');
    for (const tone of GROUP_COLORS) {
      expect(html).toContain(TONE_HEX[tone].base);
    }
  });

  it('превью «авто» показывает именно хеш-цвет, а не выбранный', () => {
    const auto = autoGroupTone('grp_1');
    const pinned = GROUP_COLORS.find((c) => c !== auto);
    const html = renderToStaticMarkup(<GroupColorPicker value={pinned} autoKey="grp_1" />);
    expect(html).toContain(`ws-palette__dot" style="background:${TONE_HEX[auto].base}`);
    expect(html).not.toContain('ws-palette__auto is-active');
  });
});

describe('groupOptions', () => {
  const groups = [{ id: 'a', name: '7 кл' }, { id: 'b', name: '8 кл' }];

  it('обычный список групп не меняет', () => {
    expect(groupOptions(groups)).toEqual([
      { value: 'a', label: '7 кл' }, { value: 'b', label: '8 кл' },
    ]);
  });

  it('добавляет группу прошлого года, если её нет в списке', () => {
    const extra = { id: 'z', name: '12У', year: '2025/2026' };
    expect(groupOptions(groups, extra)).toHaveLength(3);
    expect(groupOptions(groups, extra)[2]).toEqual({ value: 'z', label: '12У · 2025/2026' });
  });

  it('не дублирует группу, которая уже в списке', () => {
    expect(groupOptions(groups, { id: 'a', name: '7 кл' })).toHaveLength(2);
  });
});
