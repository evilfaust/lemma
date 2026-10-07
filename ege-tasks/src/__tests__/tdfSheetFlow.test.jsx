import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TDFSheetFlow from '../components/tdf/TDFSheetFlow';

vi.mock('../services/pocketbase', () => ({
  api: {
    getTdfItemDrawingUrl: () => null,
    getTdfItemControlDrawingUrl: () => null,
  },
}));

// Лист «Корень n-й степени. 10 класс» — тот, с которого начинался «Лист».
const ITEMS = [
  {
    id: 'i1',
    type: 'definition',
    name: 'Определение арифметического корня n-й степени:',
    formulation_md: 'Арифметическим корнем натуральной степени $n \\ge 2$ из числа $a$ называется [[неотрицательное]] число, $n$-я степень которого равна $a$.\n\n$b = \\sqrt[n]{a} \\Leftrightarrow \\begin{cases} b \\ge [[0]] \\\\ [[b^n = a]] \\end{cases}$',
  },
  {
    id: 'i2',
    type: 'property',
    name: 'Свойства арифметических корней (5 шт.):',
    formulation_md: '```свойства\n\\sqrt[n]{ab} = [[\\sqrt[n]{a} \\cdot \\sqrt[n]{b}]]\n\\sqrt[n]{\\dfrac{a}{b}} = [[\\dfrac{\\sqrt[n]{a}}{\\sqrt[n]{b}}]]\n---\nn \\in \\mathbb{N},\\ n \\ge 2\na \\ge 0,\\ b \\ge 0\n```',
  },
  { id: 's1', is_section_header: true, section_title: 'Тождества и графики' },
  {
    id: 'i3',
    type: 'identity',
    name: 'Важные тождества:',
    formulation_md: '$\\sqrt[n]{a^n} = \\begin{cases} [[|a|]], & \\text{если } n \\text{ чётное} \\\\ [[a]], & \\text{если } n \\text{ нечётное} \\end{cases}$',
  },
  {
    id: 'i4',
    type: 'graph',
    name: 'Графики функций $y = \\sqrt{x}$ и $y = \\sqrt[3]{x}$.',
    formulation_md: '```plot пропуск\nx -1 6\ny -1 3\nf sqrt(x)\n```',
  },
  {
    id: 'i5',
    type: 'definition',
    name: 'Нечётный корень',
    formulation_md: 'При нечётном $n$ корень $\\sqrt[n]{a}$ определён для любого $a$.',
  },
];

const set = { id: 'set1', title: 'Корень n-й степени', class_number: 10 };

const pagesText = (container) => Array.from(container.querySelectorAll('.tdfs-page'))
  .map(p => p.textContent).join('\n');

describe('TDFSheetFlow — «Лист»', () => {
  beforeEach(() => { localStorage.clear(); });

  it('шапка «ФИ» + название, разделы и пункты по порядку, номер у каждого пункта', async () => {
    const { container } = render(<TDFSheetFlow tdfSet={set} items={ITEMS} onBack={() => {}} />);
    await waitFor(() => expect(container.querySelector('.tdfs-pages .tdfs-item')).toBeTruthy());
    const page = container.querySelector('.tdfs-pages');
    expect(page.textContent).toContain('ТДФ «Корень n-й степени». 10 класс.');
    expect(page.querySelector('.tdfs-head__fio')).toBeTruthy();
    const nums = Array.from(page.querySelectorAll('.tdfs-item__num')).map(n => n.textContent);
    expect(nums).toEqual(['1.', '2.', '3.', '4.', '5.']);
    expect(page.querySelector('.tdfs-section').textContent).toBe('Тождества и графики');
  });

  it('по умолчанию — с пропусками: ответа нет, линии есть, пустые оси без графика', async () => {
    const { container } = render(<TDFSheetFlow tdfSet={set} items={ITEMS} onBack={() => {}} />);
    await waitFor(() => expect(container.querySelector('.tdfs-pages .tdfs-item')).toBeTruthy());
    const text = pagesText(container);
    expect(text).not.toContain('неотрицательное число');
    expect(container.querySelector('.tdfs-pages .katex')).toBeTruthy();
    // пункт без пропусков по умолчанию печатается целиком
    expect(text).toContain('определён для любого');
    // график: оси нарисованы, кривой нет
    const plot = container.querySelectorAll('.tdfs-pages .mr-figure svg');
    expect(plot.length).toBe(1);
    const blankPaths = plot[0].querySelectorAll('path').length;
    // эталон: та же рамка + кривая — на один path больше (стрелки осей — тоже path)
    fireEvent.click(screen.getByText('Эталон'));
    await waitFor(() => expect(pagesText(container)).toContain('неотрицательное'));
    const etalonPaths = container.querySelector('.tdfs-pages .mr-figure svg').querySelectorAll('path').length;
    expect(etalonPaths).toBe(blankPaths + 1);
  });

  it('только заголовки: под каждым пунктом место для записи, текста пунктов нет', async () => {
    const { container } = render(<TDFSheetFlow tdfSet={set} items={ITEMS} onBack={() => {}} />);
    fireEvent.click(screen.getByText('Только заголовки'));
    await waitFor(() => expect(container.querySelectorAll('.tdfs-pages .tdfs-space').length).toBe(5));
    const text = pagesText(container);
    expect(text).not.toContain('неотрицательное');
    expect(text).not.toContain('определён для любого');
    expect(text).toContain('Свойства арифметических корней');
    for (const sp of container.querySelectorAll('.tdfs-pages .tdfs-space')) {
      const mm = parseFloat(sp.style.height);
      expect(mm % 5).toBe(0);
      expect(mm).toBeGreaterThanOrEqual(10);
    }
  });

  it('пункты без пропусков можно отдать под запись', async () => {
    const { container } = render(<TDFSheetFlow tdfSet={set} items={ITEMS} onBack={() => {}} />);
    fireEvent.click(screen.getByText('место для записи'));
    await waitFor(() => expect(container.querySelectorAll('.tdfs-pages .tdfs-space').length).toBe(1));
    expect(pagesText(container)).not.toContain('определён для любого');
  });

  it('номер из названия не дублируется', async () => {
    const items = [{ id: 'x', name: '7. Свойство', formulation_md: 'текст' }];
    const { container } = render(<TDFSheetFlow tdfSet={set} items={items} onBack={() => {}} />);
    await waitFor(() => expect(container.querySelector('.tdfs-pages .tdfs-item')).toBeTruthy());
    expect(container.querySelector('.tdfs-pages .tdfs-item__num')).toBeFalsy();
  });
});
