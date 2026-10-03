import { describe, it, expect } from 'vitest';
import { useRef } from 'react';
import {
  render, renderHook, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { useMarkdownProcessor } from '../hooks/useMarkdownProcessor';
import { useStereoBlocks } from '../hooks/useStereoBlocks';
import TheoryStereoBlock from '../components/stereo/TheoryStereoBlock';
import {
  parseStereoBlock, isStillStereoSpec, stereoBlockMarkdown,
} from '../utils/stereo/dsl';

const SPEC = 'куб 4\nM на AA1 1:2 // делим ребро\nN на CC1\nсечение MNB\nвид 30 20';

describe('строка «статично»', () => {
  it('разбирается без ошибок и узнаётся по тексту блока', () => {
    const p = parseStereoBlock(`${SPEC}\nстатично`);
    expect(p.errors).toEqual([]);
    expect(p.still).toBe(true);
    expect(parseStereoBlock(SPEC).still).toBe(false);
    expect(isStillStereoSpec(`${SPEC}\nстатично`)).toBe(true);
    expect(isStillStereoSpec('куб 4\nM на AA1 // статично')).toBe(false);
  });

  it('переживает правку в конструкторе (stereoBlockMarkdown)', () => {
    const { scene, camera } = parseStereoBlock(SPEC);
    const md = stereoBlockMarkdown(scene, camera, { still: true });
    expect(md).toMatch(/\nстатично\n```/);
    expect(stereoBlockMarkdown(scene, camera)).not.toMatch(/статично/);
  });
});

describe('конвейер теории: исходник блока — в data-атрибуте', () => {
  it('обычный блок несёт исходник, «статично» — только картинку', async () => {
    const { result } = renderHook(() => useMarkdownProcessor(`\`\`\`stereo\n${SPEC}\n\`\`\`\n\n\`\`\`stereo\nкуб 4\nстатично\n\`\`\``));
    await waitFor(() => expect(result.current).toContain('stereo-block'));
    const div = document.createElement('div');
    div.innerHTML = result.current;
    const blocks = div.querySelectorAll('.stereo-block');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].getAttribute('data-stereo-spec')).toBe(SPEC);
    expect(blocks[0].querySelector('svg')).not.toBeNull();
    expect(blocks[1].hasAttribute('data-stereo-spec')).toBe(false);
  });
});

describe('живой блок', () => {
  it('начинает с готового построения и листает шаги', () => {
    render(<TheoryStereoBlock spec={SPEC} />);
    expect(screen.getByText('Всё построение · шагов: 3')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Предыдущий шаг'));
    expect(screen.getByText(/Шаг 2 из 3: N ∈ CC₁/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Предыдущий шаг'));
    expect(screen.getByText(/Шаг 1 из 3: .* — делим ребро/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Предыдущий шаг'));
    expect(screen.getByText('Само тело')).toBeInTheDocument();
    expect(screen.getByLabelText('Предыдущий шаг')).toBeDisabled();
  });

  it('тело без построений — без полосы шагов, кнопки вида на месте', () => {
    render(<TheoryStereoBlock spec="пирамида 4 4 5 S" />);
    expect(screen.queryByLabelText('Следующий шаг')).toBeNull();
    expect(screen.getByLabelText('Крупнее')).toBeInTheDocument();
    expect(screen.getByLabelText('Исходный вид')).toBeInTheDocument();
  });
});

function Article({ html }) {
  const ref = useRef(null);
  useStereoBlocks(ref, html);
  // eslint-disable-next-line react/no-danger
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}

describe('useStereoBlocks', () => {
  const block = (spec) => `<div class="stereo-block" data-stereo-spec="${spec.replace(/"/g, '&quot;')}"><svg></svg></div>`;

  it('ставит живой чертёж в блок с исходником и прячет картинку классом', async () => {
    const { container, rerender } = render(<Article html={`${block(SPEC)}<div class="stereo-block"><svg></svg></div>`} />);
    await waitFor(() => expect(container.querySelector('.stereo-live-block .theory-stereo')).not.toBeNull());
    const [live, still] = container.querySelectorAll('.stereo-block');
    expect(live.classList.contains('stereo-block--live')).toBe(true);
    expect(live.querySelector(':scope > svg')).not.toBeNull(); // картинка для печати осталась
    expect(still.classList.contains('stereo-block--live')).toBe(false);
    expect(container.querySelectorAll('.stereo-live-block')).toHaveLength(1);

    // Новый html — прежний корень уходит, новый ставится один раз
    rerender(<Article html={block('тетраэдр 4 D')} />);
    await waitFor(() => expect(container.querySelector('.stereo-live-block .theory-stereo')).not.toBeNull());
    expect(container.querySelectorAll('.stereo-live-block')).toHaveLength(1);
  });

  it('печать и PDF берут картинку: правила в CSS', () => {
    const css = readFileSync(resolve(__dirname, '../components/stereo/theoryStereo.css'), 'utf8');
    expect(css).toMatch(/\.stereo-block--live > svg,[\s\S]*?display: none/);
    expect(css).toMatch(/@media print \{[\s\S]*\.stereo-live-block \{ display: none !important; \}/);
    expect(css).toMatch(/\.theory-exporting \.stereo-live-block \{ display: none; \}/);
  });
});
