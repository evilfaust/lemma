import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, waitFor, screen, fireEvent } from '@testing-library/react';
import { App as AntApp } from 'antd';
import MathRenderer from '../shared/components/MathRenderer';
import { useMarkdownProcessor } from '../hooks/useMarkdownProcessor';
// Тулбар теории живёт внутри AuthProvider (пикер Библиотеки спрашивает права).
vi.mock('../contexts/AuthContext', async (orig) => ({
  ...(await orig()),
  useAuth: () => ({ canEdit: true, canDelete: true, isSuperAdmin: false }),
  useOptionalAuth: () => null,
}));

// eslint-disable-next-line import/first
import EditorToolbar from '../components/theory/EditorToolbar';
import { findStereoAtCursor } from '../utils/plotSnippet';
import { stereoSpecFromInline, stereoInlineFromSpec } from '../utils/stereo/inline';
import { stereoBlockMarkdown, parseStereoBlock } from '../utils/stereo/dsl';
import { evaluateScene } from '../utils/stereo';

// Чертёж с параллельной — в строке у неё палки «|», которые в ячейке таблицы
// обязаны быть экранированы.
const scene = {
  body: { kind: 'cube', a: 4 },
  ops: [
    { id: 'p', type: 'pointOnLine', name: 'P', ref: ['A', 'A1'], t: 0.5, ratio: [1, 1], note: 'середина; ребра' },
    { id: 'par', type: 'parallel', through: 'P', ref: ['A', 'B'] },
    { id: 'k', type: 'pointOnLine', name: 'K', ref: 'par', t: 0.5 },
  ],
};

describe('стереочертёж в строку: `stereo: …`', () => {
  it('туда и обратно: команды через «;», палки экранированы, подписи и комментарии убраны', () => {
    const md = stereoBlockMarkdown(scene, { yaw: 30, pitch: 20, zoom: 1 }, { format: 'inline' });
    expect(md.startsWith('`stereo: куб 4; ')).toBe(true);
    expect(md).not.toContain('\n');
    expect(md).toContain('K на (P\\|\\|AB) 0,5');
    expect(md).not.toContain('середина;'); // подпись шага в строку не идёт
    const spec = stereoSpecFromInline(md.slice('`stereo: '.length, -1));
    const back = parseStereoBlock(spec);
    expect(back.errors).toEqual([]);
    expect(back.camera).toMatchObject({ yaw: 30, pitch: 20 });
    const a = evaluateScene(scene).points.K.pos;
    const b = evaluateScene(back.scene).points.K.pos;
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.z).toBeCloseTo(a.z, 9);
  });

  it('преобразования строки', () => {
    expect(stereoSpecFromInline('куб 4; M на AA1 1:2 ;  ; X = (M\\|\\|AB) ∩ BB1')).toBe('куб 4\nM на AA1 1:2\nX = (M||AB) ∩ BB1');
    expect(stereoInlineFromSpec('куб 4\n# коммент\nM на AA1 1:2 // подпись\nвид 30 20')).toBe('куб 4; M на AA1 1:2; вид 30 20');
  });

  it('курсор внутри `stereo: …` в ячейке — правка этого чертежа', () => {
    const text = '| Рисунок | Ответ |\n| --- | --- |\n| `stereo: куб 4; M на AA1 1:2` | 5 |';
    const pos = text.indexOf('M на');
    const found = findStereoAtCursor(text, pos);
    expect(found.format).toBe('inline');
    expect(found.spec).toBe('куб 4\nM на AA1 1:2');
    expect(text.slice(found.start, found.end)).toBe('`stereo: куб 4; M на AA1 1:2`');
    expect(findStereoAtCursor(text, text.indexOf('5 |'))).toBeNull();
  });

  it('MathRenderer (задачи): чертёж в ячейке таблицы, с параллельной', () => {
    const md = `| Рисунок | Ответ |\n| --- | --- |\n| ${stereoBlockMarkdown(scene, undefined, { format: 'inline' })} | 5 |`;
    const { container } = render(<MathRenderer text={md} />);
    const svg = container.querySelector('td .stereo-inline svg');
    expect(svg).toBeTruthy();
    expect(container.querySelector('.stereo-svg-errors')).toBeFalsy();
  });

  it('теория: чертёж в ячейке таблицы переживает DOMPurify', async () => {
    const md = `| Рисунок | Ответ |\n| --- | --- |\n| ${stereoBlockMarkdown(scene, undefined, { format: 'inline' })} | 5 |`;
    const { result } = renderHook(() => useMarkdownProcessor(md));
    await waitFor(() => expect(result.current).toContain('stereo-inline'));
    expect(result.current).toContain('<svg');
    expect(result.current).not.toContain('stereo-svg-errors');
  });
});

describe('редактор теории: кнопка «Стерео»', () => {
  it('открывает стереоредактор с выбором «блоком / в строку»', async () => {
    const editorRef = { current: { insert: () => {}, view: null } };
    render(<AntApp><EditorToolbar editorRef={editorRef} /></AntApp>);
    fireEvent.click(screen.getByLabelText('Стереочертёж'));
    expect(await screen.findByText('В строку (для таблиц)', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText('Вставить чертёж')).toBeTruthy();
  });
});
