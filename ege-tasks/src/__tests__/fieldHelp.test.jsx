import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { App as AntApp } from 'antd';
import MathRenderer from '../shared/components/MathRenderer';
import FieldHelp from '../components/shared/FieldHelp';
import { FIELD_HELP, FIELD_TIPS } from '../utils/fieldHelp';
import { parseCoordPlot } from '../utils/coordPlot';
import { parseNumberLine } from '../utils/numberLine';
import { parseGridPaper } from '../utils/gridPaper';
import { parseStereoBlock } from '../utils/stereo/dsl';
import { stereoSpecFromInline } from '../utils/stereo/inline';
import { parsePlanimBlock } from '../utils/planim/dsl';
import { planimSpecFromInline } from '../utils/planim/inline';

// Все спецификации чертежа в примере: блоки ```lang и строки `lang: …`.
const LANG = { plot: ['plot', 'vectors'], numline: ['numline'], grid: ['grid'], stereo: ['stereo'], planim: ['planim'] };
function specsOf(md, kind) {
  const langs = LANG[kind];
  const out = [];
  for (const m of md.matchAll(/```(\w+)\n([\s\S]*?)\n```/g)) if (langs.includes(m[1])) out.push(m[2]);
  for (const m of md.matchAll(/`(\w+):\s*([^`]*)`/g)) {
    if (!langs.includes(m[1])) continue;
    out.push(kind === 'stereo' ? stereoSpecFromInline(m[2]) : kind === 'planim' ? planimSpecFromInline(m[2]) : m[2]);
  }
  return out;
}

const CHECK = {
  plot: (s) => {
    const m = parseCoordPlot(s);
    expect(m.errors).toEqual([]);
    expect(m.curves.length + m.vectors.length + m.points.length).toBeGreaterThan(0);
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

describe('справка по полю — сторож', () => {
  const drawings = FIELD_HELP.flatMap((sec) => sec.items).filter((it) => it.kind);

  it('разделы на месте, в каждом есть примеры', () => {
    expect(FIELD_HELP.map((s) => s.key)).toEqual(['text', 'table', 'numline', 'plot', 'grid', 'planim', 'stereo']);
    FIELD_HELP.forEach((s) => expect(s.items.length).toBeGreaterThan(0));
    expect(FIELD_TIPS.length).toBeGreaterThan(0);
  });

  it('каждый чертёж из справки разбирается своим парсером без ошибок', () => {
    expect(drawings.length).toBeGreaterThan(12);
    for (const it of drawings) {
      const specs = specsOf(it.md, it.kind);
      expect({ md: it.md, n: specs.length > 0 }).toEqual({ md: it.md, n: true });
      specs.forEach((s) => CHECK[it.kind](s));
    }
  });

  it('каждый пример рисуется: у чертежей — svg, без сообщений об ошибке', () => {
    for (const it of FIELD_HELP.flatMap((sec) => sec.items)) {
      const { container, unmount } = render(<MathRenderer text={it.md} />);
      if (it.kind) expect({ md: it.md, svg: !!container.querySelector('svg') }).toEqual({ md: it.md, svg: true });
      expect(container.querySelector('.stereo-svg-errors')).toBeFalsy();
      expect(container.querySelector('.katex-error')).toBeFalsy();
      unmount();
    }
  });
});

describe('кнопка «?» у панели вставки', () => {
  it('открывает справку, «Вставить» кладёт пример в поле', async () => {
    const onInsert = vi.fn();
    render(<AntApp><FieldHelp onInsert={onInsert} /></AntApp>);
    fireEvent.click(screen.getByLabelText('Справка по вставке'));
    const dlg = await screen.findByRole('dialog');
    fireEvent.click(within(dlg).getByText('График и векторы'));
    const pane = dlg.querySelector('.ant-tabs-tabpane-active');
    fireEvent.click(within(pane).getAllByText('Вставить')[0]);
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert.mock.calls[0][0]).toContain('```plot');
  });
});
