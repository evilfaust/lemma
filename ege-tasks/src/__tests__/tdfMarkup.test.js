import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  tdfMarkdown, tdfHasGaps, tdfItemHasGaps, applyMathGaps, applyTextGaps,
  propertiesLatex, matchingMarkdown, matchingOrder, parseMatching, plotFrameOnly,
  TDF_SNIPPETS,
} from '../utils/tdfMarkup';
import { parseCoordPlot } from '../utils/coordPlot';

/** Все формулы `$…$`/`$$…$$` текста рендерятся KaTeX без ошибки. */
function expectKatexOk(md) {
  const formulas = [];
  md.replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => { formulas.push([f, true]); return ''; })
    .replace(/\$([^$\n]+?)\$/g, (_, f) => { formulas.push([f, false]); return ''; });
  expect(formulas.length).toBeGreaterThan(0);
  for (const [f, displayMode] of formulas) {
    expect(() => katex.renderToString(f, { throwOnError: true, displayMode, strict: 'ignore', trust: true }))
      .not.toThrow();
  }
}

describe('пропуски в тексте', () => {
  const src = 'Корнем называется [[неотрицательное]] число, $n$-я степень которого равна $a$.';

  it('эталон — слово как есть, без скобок', () => {
    expect(tdfMarkdown(src, 'etalon')).toBe('Корнем называется неотрицательное число, $n$-я степень которого равна $a$.');
  });

  it('бланк — слова нет, на его месте подчёркнутая пустота той же ширины', () => {
    const out = tdfMarkdown(src, 'gaps');
    expect(out).not.toContain('неотрицательное число');
    expect(out).toContain('\\phantom{\\text{неотрицательное}}');
    expect(out).toContain('\\underline');
    expectKatexOk(out);
  });

  it('длинный пропуск режется по словам — строка может перенестись', () => {
    const out = applyTextGaps('[[неотрицательное число, n-я степень которого]]', 'gaps');
    expect(out.split('\u200B')).toHaveLength(5);
    expectKatexOk(out);
  });

  it('формула внутри текстового пропуска остаётся формулой', () => {
    const out = applyTextGaps('Это [[число $b \\ge 0$]]', 'gaps');
    expect(out).toContain('\\phantom{b \\ge 0}');
    expectKatexOk(out);
  });

  it('спецсимволы текста экранируются', () => {
    const out = applyTextGaps('[[50% & #1]]', 'gaps');
    expectKatexOk(out);
  });

  it('инлайн-код (чертёж в ячейке) не трогается', () => {
    const src2 = '`plot: x [[0]] 1` и [[слово]]';
    expect(applyTextGaps(src2, 'gaps')).toMatch(/^`plot: x \[\[0\]\] 1`/);
  });
});

describe('пропуски в формуле', () => {
  it('[[…]] и \\gap{…} внутри $…$', () => {
    const src = '$b = \\sqrt[n]{a} \\Leftrightarrow \\begin{cases} b \\ge [[0]] \\\\ \\gap{b^n} = a \\end{cases}$';
    expect(tdfMarkdown(src, 'etalon')).toBe('$b = \\sqrt[n]{a} \\Leftrightarrow \\begin{cases} b \\ge {0} \\\\ {b^n} = a \\end{cases}$');
    const blank = tdfMarkdown(src, 'gaps');
    expect(blank).toContain('\\phantom{0}');
    expect(blank).toContain('\\phantom{b^n}');
    expectKatexOk(blank);
    expectKatexOk(tdfMarkdown(src, 'etalon'));
  });

  it('\\gap со вложенными скобками', () => {
    expect(applyMathGaps('\\gap{\\frac{a}{b}} + 1', 'etalon')).toBe('{\\frac{a}{b}} + 1');
    expect(applyMathGaps('\\gap{\\frac{a}{b}}', 'gaps')).toContain('\\phantom{\\frac{a}{b}}');
  });

  it('кусочная функция из заготовки рендерится в обоих видах', () => {
    expectKatexOk(tdfMarkdown(TDF_SNIPPETS.piecewise, 'etalon'));
    expectKatexOk(tdfMarkdown(TDF_SNIPPETS.piecewise, 'gaps'));
    expect(tdfMarkdown(TDF_SNIPPETS.piecewise, 'etalon')).toContain('{|a|}');
  });

  it('экранированный доллар — не формула', () => {
    expect(applyTextGaps('цена \\$5 и [[слово]]', 'etalon')).toBe('цена \\$5 и слово');
  });
});

describe('«свойства + условия»', () => {
  const body = [
    '\\sqrt[n]{ab} = \\sqrt[n]{a} \\cdot \\sqrt[n]{b}',
    '$\\sqrt[n]{\\dfrac{a}{b}} = \\dfrac{\\sqrt[n]{a}}{\\sqrt[n]{b}}$',
    '3) (\\sqrt[n]{a})^k = \\sqrt[n]{a^k}',
    '---',
    'n \\in \\mathbb{N},\\ n \\ge 2',
    'a \\ge 0,\\ b \\ge 0',
  ].join('\n');

  it('нумерует свойства, обёртка $ и ручной номер снимаются', () => {
    const latex = propertiesLatex(body);
    expect(latex).toContain('&1)');
    expect(latex).toContain('&3)\\;\\; (\\sqrt[n]{a})^k');
    expect(latex).not.toContain('3) (');
    expect(latex).not.toMatch(/\$/);
  });

  it('скобка условий тянется на всю высоту списка', () => {
    const latex = propertiesLatex(body);
    expect(latex).toContain('\\left\\{\\vphantom{\\begin{aligned}');
    expect(latex).toContain('\\right.');
    expect(() => katex.renderToString(latex, { throwOnError: true, displayMode: true })).not.toThrow();
  });

  it('без черты — только список', () => {
    expect(propertiesLatex('a = b\nc = d')).not.toContain('\\left\\{');
  });

  it('в листе — блочная формула, пропуски внутри работают', () => {
    const md = `Свойства:\n\n\`\`\`свойства\n\\sqrt[n]{ab} = [[\\sqrt[n]{a} \\cdot \\sqrt[n]{b}]]\n---\na \\ge 0\n\`\`\`\n`;
    const etalon = tdfMarkdown(md, 'etalon');
    expect(etalon).toMatch(/\$\$\n\\begin\{aligned\}/);
    expect(etalon).not.toContain('```');
    const blank = tdfMarkdown(md, 'gaps');
    expect(blank).toContain('\\phantom{\\sqrt[n]{a} \\cdot \\sqrt[n]{b}}');
    expectKatexOk(blank);
    expectKatexOk(etalon);
  });

  it('заготовка редактора рендерится', () => {
    expectKatexOk(tdfMarkdown(TDF_SNIPPETS.properties, 'gaps'));
  });
});

describe('соответствие', () => {
  const body = [
    '# ФУНКЦИИ -> ГРАФИКИ',
    '$y = \\sqrt{x}$ -> `plot: x -1 6; f sqrt(x)`',
    '$y = |x|$ → `plot: x -3 3; f abs(x)`',
    '$y = x^2$ -> `plot: x -3 3; f x^2`',
    '// комментарий',
  ].join('\n');

  it('разбор: заголовки и пары по «->» и «→»', () => {
    const { heads, pairs } = parseMatching(body);
    expect(heads).toEqual(['ФУНКЦИИ', 'ГРАФИКИ']);
    expect(pairs).toHaveLength(3);
    expect(pairs[1]).toEqual({ left: '$y = |x|$', right: '`plot: x -3 3; f abs(x)`' });
  });

  it('перестановка детерминирована и не тождественна', () => {
    for (let n = 2; n <= 8; n++) {
      for (const seed of ['a', 'b', 'xyz', '']) {
        const o = matchingOrder(n, seed);
        expect([...o].sort((x, y) => x - y)).toEqual([...Array(n).keys()]);
        expect(o.every((v, i) => v === i)).toBe(false);
        expect(matchingOrder(n, seed)).toEqual(o);
      }
    }
  });

  it('эталон: ответ — номер правого элемента, совпадающего с левым', () => {
    const md = matchingMarkdown(body, 'etalon', 'item1');
    const order = matchingOrder(3, `item1\n${body}`);
    const lines = md.split('\n');
    const answerRow = lines[lines.length - 2];
    const answers = answerRow.split('|').map(s => s.trim()).filter(Boolean).map(Number);
    answers.forEach((num, leftIdx) => {
      expect(order[num - 1]).toBe(leftIdx);
    });
    expect(md).toContain('{без линий}');
    expect(md).toContain('| А | Б | В |');
  });

  it('бланк: строка ответа пустая, левый и правый столбцы те же', () => {
    const blank = matchingMarkdown(body, 'gaps', 'item1');
    const etalon = matchingMarkdown(body, 'etalon', 'item1');
    const lastRow = blank.split('\n').slice(-2)[0];
    expect(lastRow.replace(/[|\s]/g, '')).toBe('');
    expect(blank.split('\n').slice(0, 7)).toEqual(etalon.split('\n').slice(0, 7));
  });

  it('модуль в формуле не ломает таблицу', () => {
    const md = matchingMarkdown(body, 'etalon', 's');
    expect(md).toContain('$y = \\vert x\\vert $');
  });

  it('без заголовка — таблица без шапки', () => {
    expect(matchingMarkdown('a -> 1\nb -> 2', 'etalon')).toContain('{без линий, без шапки}');
  });

  it('блок в тексте пункта', () => {
    const md = `Установите соответствие.\n\n\`\`\`соответствие\n${body}\n\`\`\``;
    const out = tdfMarkdown(md, 'gaps', { seed: 'id1' });
    expect(out).not.toContain('```');
    expect(out).toContain('А)');
  });
});

describe('пустые оси под график', () => {
  const spec = 'x -1 6\ny -1 3\ngrid 1\nf sqrt(x)\nlabel 4 2.4 y=\\sqrt{x}\npoint 1 1; xtick 1 1';

  it('остаются оси, сетка, засечки; уходят график, точки и подписи', () => {
    const frame = plotFrameOnly(spec);
    expect(frame.split('\n')).toEqual(['x -1 6', 'y -1 3', 'grid 1', 'xtick 1 1']);
    const model = parseCoordPlot(frame);
    expect(model.funcs?.length || 0).toBe(0);
  });

  it('```plot пропуск: бланк — только оси, эталон — график без флага', () => {
    const md = `Графики:\n\n\`\`\`plot пропуск\n${spec}\n\`\`\``;
    expect(tdfMarkdown(md, 'gaps')).toContain('```plot\nx -1 6\ny -1 3\ngrid 1\nxtick 1 1\n```');
    const etalon = tdfMarkdown(md, 'etalon');
    expect(etalon).toContain('```plot\nx -1 6');
    expect(etalon).toContain('f sqrt(x)');
    expect(etalon).not.toContain('пропуск');
  });

  it('обычный ```plot не трогается ни в каком виде', () => {
    const md = `\`\`\`plot\n${spec}\n\`\`\``;
    expect(tdfMarkdown(md, 'gaps')).toBe(md);
  });

  it('пропуски внутри чужих fenced-блоков не трогаются', () => {
    const md = '```planim\nтекст [[A]]\n```';
    expect(tdfMarkdown(md, 'gaps')).toBe(md);
  });
});

describe('tdfHasGaps', () => {
  it('видит пропуски, соответствие и пустые оси', () => {
    expect(tdfHasGaps('слово [[x]]')).toBe(true);
    expect(tdfHasGaps('$\\gap{x}$')).toBe(true);
    expect(tdfHasGaps('```соответствие\na -> b\n```')).toBe(true);
    expect(tdfHasGaps('```plot пропуск\nx 0 1\n```')).toBe(true);
    expect(tdfHasGaps('```plot\nx 0 1\n```')).toBe(false);
    expect(tdfHasGaps('просто текст $x^2$')).toBe(false);
    expect(tdfHasGaps('')).toBe(false);
  });

  it('по пункту — в любом из двух полей', () => {
    expect(tdfItemHasGaps({ formulation_md: 'a', short_notation_md: '$[[b]]$' })).toBe(true);
    expect(tdfItemHasGaps({ formulation_md: 'a' })).toBe(false);
  });
});

describe('обратная совместимость', () => {
  it('текст без новой разметки проходит без изменений', () => {
    const md = 'Две прямые называются **перпендикулярными**, если угол равен $90°$.\n\n| a | b |\n|---|---|\n| 1 | 2 |';
    expect(tdfMarkdown(md, 'etalon')).toBe(md);
    expect(tdfMarkdown(md, 'gaps')).toBe(md);
  });

  it('пустое и не-строка', () => {
    expect(tdfMarkdown('', 'gaps')).toBe('');
    expect(tdfMarkdown(null, 'gaps')).toBe('');
  });
});
