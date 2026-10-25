// @vitest-environment node
//
// Разбор страниц «Решу ЕГЭ / ОГЭ» — pocketbase/sdamgia-lib.mjs (им живёт
// ручка /parse-sdamgia: импорт задач и «Перепарсить» в редакторе).
// Фикстуры — блок .prob_maindiv настоящих страниц (print=true&crit=true).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as cheerio from 'cheerio';
import katex from 'katex';
import {
  parseSdamgiaHtml,
  cleanLatexFormula,
  splitAltPunct,
  convertMathRuns,
} from '../../../pocketbase/sdamgia-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const parse = (id) => parseSdamgiaHtml(
  readFileSync(join(here, 'fixtures/sdamgia', `${id}.html`), 'utf8'),
  { cheerio, katex, baseUrl: 'https://math-ege.sdamgia.ru' },
).problems[0];

const formulasOf = (md) => [...md.matchAll(/\$\$\n?([\s\S]+?)\n?\$\$|\$([^$\n]+)\$/g)].map(m => m[1] ?? m[2]);
const renders = (tex) => {
  try { katex.renderToString(tex, { throwOnError: true, strict: false }); return true; } catch { return false; }
};

describe('П19-349 (548492): параметр, два решения', () => {
  const p = parse('548492');

  it('повторяющиеся формулы не теряются (раньше дедуп по alt съедал «a ≠ 0» и «Ответ»)', () => {
    expect(p.solution).toContain('имеет два корня при $a \\ne 0$.');
    expect(p.solution).toContain('**Ответ:** $a \\ne 0$, $a \\ne \\pm 3$, $a \\ne \\pm 6$.');
  });

  it('«не равно» → \\ne, точка из alt — после формулы', () => {
    expect(p.solution).toContain('при всех $a \\ne 0$. Эти корни');
    expect(p.solution).not.toMatch(/не равно/);
  });

  it('системы — cases, «Решение.» и «Приведём другое решение» — разметка', () => {
    expect(p.solution).toContain('\\begin{cases} a=3x \\\\ a=x + 4 \\end{cases} \\Leftrightarrow \\begin{cases} x=2 \\\\ a=6 \\end{cases}');
    expect(p.solution.startsWith('Корнями исходного уравнения')).toBe(true);
    expect(p.solution).toContain('\n\n---\n\n### Другое решение\n\n');
  });

  it('формулы в тексте (<i>, <sub>, узкий пробел) → $…$', () => {
    expect(p.condition).toContain('Найдите все значения $a$, при');
    expect(p.solution).toContain('пару прямых $l_{1}$ и $l_{2}$');
    expect(p.solution).toContain('уравнениями $a = 3x$ и $a = -3x$');
    expect(p.solution).toContain('при $a < -6$; $-6 < a < -3$;');
  });

  it('выключная формула в <center> — блоком $$', () => {
    expect(p.condition).toContain('\n\n$$\n\\frac{9x^{2} - a^{2}}{x^{2} + 8x + 16 - a^{2}} =0\n$$\n\n');
  });

  it('ответ собран из формул блока .answer', () => {
    expect(p.answer).toBe('$a \\ne 0$, $a \\ne \\pm 3$, $a \\ne \\pm 6$. $(- \\infty ; - 6) \\cup (- 6; - 3) \\cup (- 3; 0) \\cup (0; 3) \\cup (3; 6) \\cup (6; + \\infty)$');
  });

  it('критерии, балл, номер задания; все формулы рисуются', () => {
    expect(p.max_score).toBe(4);
    expect(p.type_label).toBe('19');
    expect(p.criteria_md).toMatch(/^\| Критерии оценивания/);
    expect(p.latex_needs_review).toBe(false);
    for (const f of formulasOf(p.condition + p.solution + p.answer)) expect(renders(f), f).toBe(true);
  });
});

describe('ПА16-253 (640282): длинные формулы в нескольких вариантах вёрстки', () => {
  const p = parse('640282');
  it('из span.tex-span с одним data-formulaHash берётся только первый вариант', () => {
    expect(p.solution.match(/\\text\{П\}_1=/g)).toHaveLength(1);
    expect(p.solution).toContain('\\text{П}_1= 0{,}07 \\cdot 30S');
  });
  it('ответ-текст без формул', () => {
    expect(p.answer).toBe('во втором банке переплата будет меньше на 7% от суммы кредита');
  });
});

describe('П16-550 (556548): вложенные системы', () => {
  const p = parse('556548');
  it('пары «система/совокупность» — по положению (у «Решу» слова перепутаны)', () => {
    expect(p.solution).toContain('\\begin{cases} \\left[\\begin{array}{l} 1 \\leq x^{2} - 2x + 1\\leqslant4 \\\\ x^{2} - 2x + 1 < 0 \\end{array}\\right. \\\\ x \\ne - 1 \\end{cases}');
  });
  it('«−1 < x ≤ 0,2 ≤ x ≤ 3» в совокупности — две строки', () => {
    expect(p.solution).toContain('\\left[\\begin{array}{l} - 1 < x\\leqslant0 \\\\ 2 \\leq x\\leqslant3 \\end{array}\\right.');
  });
  it('все формулы рисуются', () => {
    for (const f of formulasOf(p.solution)) expect(renders(f), f).toBe(true);
  });
});

describe('мелкие случаи', () => {
  it('П18-237: кириллическая «О» с индексом — это O₁', () => {
    expect(parse('558931').condition).toContain('точки $O_{1}$, $O_{2}$ и $O_{3}$');
  });
  it('П3-318: формула-знак между числами вливается в строчную формулу', () => {
    expect(parse('73567').solution).toContain('то $7 \\cdot 2 \\cdot x = 112$, откуда $x = 8$.');
  });
  it('ОГ12-016: знак ⋅ (U+22C5) в тексте, ответ первой части — числом', () => {
    const p = parse('392846');
    expect(p.condition).toContain('$C = 150+11 \\cdot (t - 5)$');
    expect(p.answer).toBe('238');
    expect(p.solution).toContain('=238\\text{руб}');
  });
});

describe('cleanLatexFormula', () => {
  it('арк-функции, котангенс, десятичный логарифм', () => {
    expect(cleanLatexFormula('x = арккосинус дробь: числитель: 3, знаменатель: 5 конец дроби')).toBe('x = \\arccos \\frac{3}{5}');
    expect(cleanLatexFormula('котангенс x')).toBe('\\cot x');
    expect(cleanLatexFormula('десятичный логарифм 100')).toBe('\\lg 100');
  });
  it('полуинтервал: квадратная + круглая скобка без \\left/\\right', () => {
    const tex = cleanLatexFormula('левая квадратная скобка минус 1;2 правая круглая скобка');
    expect(tex).toBe('[ - 1;2)');
    expect(renders(tex)).toBe(true);
  });
  it('условия «при …» в системе уходят во второй столбец', () => {
    const tex = cleanLatexFormula('система выражений 2x, при x больше 0, минус 2x, при x меньше или равно 0 конец системы');
    expect(tex).toBe('\\begin{cases} 2x, & \\text{ при } x > 0 \\\\ - 2x, & \\text{ при } x \\leq 0 \\end{cases}');
    expect(renders(tex)).toBe(true);
  });
  it('кириллица в формуле — текстом, в индексе — в скобках', () => {
    expect(cleanLatexFormula('S_бок = 12 см')).toBe('S_{\\text{бок}} = 12 \\text{ см}');
  });
  it('индексы внутри дроби и команда в индексе', () => {
    expect(cleanLatexFormula('h = дробь: числитель: 3V_A_1B_2CB, знаменатель: S_A_1B_2C конец дроби')).toBe('h = \\frac{3V_{A_1B_2CB}}{S_{A_1B_2C}}');
    expect(cleanLatexFormula('P_\\max = 4')).toBe('P_{\\max} = 4');
  });
  it('сырой LaTeX из alt: \\sqrta, непарный \\left|', () => {
    expect(cleanLatexFormula('x = \\sqrta')).toBe('x = \\sqrt{a}');
    expect(renders(cleanLatexFormula('\\left| x минус 1 | = 2'))).toBe(true);
  });
});

describe('splitAltPunct / convertMathRuns', () => {
  it('пунктуация предложения отделяется, точка-скобка системы — нет', () => {
    expect(splitAltPunct('a не равно 0.')).toEqual({ body: 'a не равно 0', punct: '.' });
    expect(splitAltPunct('a в квадрате ,')).toEqual({ body: 'a в квадрате', punct: ',' });
    expect(splitAltPunct('система выражений x=1, y=2 конец системы . ').punct).toBe('');
  });
  it('отрезок без переменной остаётся текстом', () => {
    expect(convertMathRuns('в отношении 1\u202F:\u202F2')).toBe('в отношении 1\u202F:\u202F2');
  });
});
