// node --test pocketbase/latex-fixer.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import katex from '../ege-tasks/node_modules/katex/dist/katex.mjs';

import {
  fixSlammedCommands,
  fixRussianTrig,
  fixDegreesArtifact,
  fixDegreeSymbol,
  fixPowerParens,
  fixSubscriptParens,
  fixMultiCharSuperSub,
  fixFunctionParenArg,
  fixDoubleSubscript,
  fixDecimalComma,
  fixLogBase,
  fixSpacesInParens,
  fixArcShortcut,
  fixMatrixShortcut,
  fixAbsShortcut,
  fixInfixOver,
  fixLatex,
} from './latex-fixer.js';

// ─────────────────────────────────────────────────────────────────────
// Точечные тесты по правилам
// ─────────────────────────────────────────────────────────────────────

test('fixSlammedCommands: \\angleABC → \\angle{ABC}', () => {
  assert.equal(fixSlammedCommands('\\angleABC'), '\\angle{ABC}');
  assert.equal(fixSlammedCommands('\\widehatAHC'), '\\widehat{AHC}');
  assert.equal(fixSlammedCommands('\\overrightarrowCM'), '\\overrightarrow{CM}');
  assert.equal(fixSlammedCommands('\\underseta'), '\\underset{a}');
  assert.equal(fixSlammedCommands('\\phantomn'), '\\phantom{n}');
});

test('fixSlammedCommands: не трогает уже правильное', () => {
  assert.equal(fixSlammedCommands('\\angle{ABC}'), '\\angle{ABC}');
  assert.equal(fixSlammedCommands('\\angle ABC'), '\\angle ABC');
});

test('fixSlammedCommands: \\angle сам по себе не ломает', () => {
  // \angle без следующих букв должен остаться неизменным
  assert.equal(fixSlammedCommands('\\angle '), '\\angle ');
  assert.equal(fixSlammedCommands('\\angle = 90'), '\\angle = 90');
});

test('fixRussianTrig: \\tg \\ctg \\arctg → \\operatorname{...}', () => {
  assert.equal(fixRussianTrig('\\tg x'), '\\operatorname{tg} x');
  assert.equal(fixRussianTrig('\\ctg \\alpha'), '\\operatorname{ctg} \\alpha');
  assert.equal(fixRussianTrig('\\arctg(x)'), '\\operatorname{arctg}(x)');
});

test('fixRussianTrig: не путать с длинными именами', () => {
  // \tgx — не команда \tg, оставляем как есть (этим займётся другая регулярка)
  assert.equal(fixRussianTrig('\\tgx'), '\\tgx');
});

test('fixDegreesArtifact: «90 г» → 90^{\\circ}', () => {
  assert.equal(fixDegreesArtifact('90 г,'), '90^{\\circ},');
  assert.equal(fixDegreesArtifact('= 90 г.'), '= 90^{\\circ}.');
  assert.equal(fixDegreesArtifact('180 г - 30 г = 150 г'), '180^{\\circ} - 30^{\\circ} = 150^{\\circ}');
});

test('fixDegreesArtifact: «г» как часть слова не трогать', () => {
  // Формул с словами обычно нет, но всё же
  assert.equal(fixDegreesArtifact('10 газ'), '10 газ');
});

test('fixDegreeSymbol: «30°» → 30^{\\circ}', () => {
  assert.equal(fixDegreeSymbol('30°'), '30^{\\circ}');
  assert.equal(fixDegreeSymbol('30 °'), '30^{\\circ}');
});

test('fixPowerParens: a^(x+b) → a^{x+b}', () => {
  // Регулярка съедает пробелы внутри скобок, но не до самого ^
  assert.equal(fixPowerParens('a ^ ( x + b )'), 'a ^{x + b}');
  assert.equal(fixPowerParens('2^(3+4)'), '2^{3+4}');
});

test('fixSubscriptParens: a_(i+j) → a_{i+j}', () => {
  assert.equal(fixSubscriptParens('a _ ( i + j )'), 'a _{i + j}');
});

test('fixMultiCharSuperSub: x^23 → x^{23}, x^abc → x^{abc}', () => {
  assert.equal(fixMultiCharSuperSub('x^23'), 'x^{23}');
  assert.equal(fixMultiCharSuperSub('x^abc'), 'x^{abc}');
  assert.equal(fixMultiCharSuperSub('x_ij'), 'x_{ij}');
  // Один символ не трогаем
  assert.equal(fixMultiCharSuperSub('x^2'), 'x^2');
  assert.equal(fixMultiCharSuperSub('x_i'), 'x_i');
  // Уже в скобках — не двойной обёрткой
  assert.equal(fixMultiCharSuperSub('x^{23}'), 'x^{23}');
});

test('fixFunctionParenArg: \\sqrt(x+1) → \\sqrt{x+1}', () => {
  assert.equal(fixFunctionParenArg('\\sqrt(x+1)'), '\\sqrt{x+1}');
  assert.equal(fixFunctionParenArg('\\sqrt ( a + b )'), '\\sqrt{a + b}');
});

test('fixDoubleSubscript: S_A_1B_1 → S_{A_1B_1}', () => {
  assert.equal(fixDoubleSubscript('S_A_1B_1C_1'), 'S_{A_1B_1C_1}');
});

test('fixDecimalComma: 0,5 → 0{,}5', () => {
  assert.equal(fixDecimalComma('0,5'), '0{,}5');
  assert.equal(fixDecimalComma('3,14 + 2,7'), '3{,}14 + 2{,}7');
  // Запятая между цифрой и нецифрой — не трогать (разделитель списка)
  assert.equal(fixDecimalComma('a=1, b=2'), 'a=1, b=2');
});

test('fixLogBase: \\log a 32 → \\log_{a} 32', () => {
  assert.equal(fixLogBase('\\log a 32'), '\\log_{a} 32');
  assert.equal(fixLogBase('\\log 2 x'), '\\log_{2} x');
  assert.equal(fixLogBase('\\log ( a ) x'), '\\log_{a} x');
  assert.equal(fixLogBase('\\lg ( a ) x'), '\\lg_{a} x');
});

test('fixSpacesInParens: ( x ) → (x)', () => {
  assert.equal(fixSpacesInParens('f ( x )'), 'f (x)');
  // Один пробел только внутри
  assert.equal(fixSpacesInParens('( a + b )'), '(a + b)');
});

// ─────────────────────────────────────────────────────────────────────
// Интеграционные тесты: пайплайн fixLatex + валидация через KaTeX
// ─────────────────────────────────────────────────────────────────────

function rendersOk(formula) {
  try {
    katex.renderToString(formula, { throwOnError: true, strict: false });
    return true;
  } catch {
    return false;
  }
}

// Пары [сырая → ожидаемая] на основе реальных формул из dataset cat-272/276/277/282
const REAL_CASES = [
  // \angle + буквы
  ['\\angleABC + \\angle BLA=90 г + 90 г=180 г,',
   '\\angle{ABC} + \\angle BLA=90^{\\circ} + 90^{\\circ}=180^{\\circ},'],

  ['\\angleKAC = \\angleKEH',
   '\\angle{KAC} = \\angle{KEH}'],

  ['\\frac{MK}{AC} = \\cos \\angleABC = \\cos 30 г= \\frac{\\sqrt{3}}{2} .',
   '\\frac{MK}{AC} = \\cos \\angle{ABC} = \\cos 30^{\\circ}= \\frac{\\sqrt{3}}{2} .'],

  // \widehat
  ['\\widehatABC = 180 г - \\widehatAHC=120 г',
   '\\widehat{ABC} = 180^{\\circ} - \\widehat{AHC}=120^{\\circ}'],

  // \overrightarrow
  ['\\overrightarrowCM = ( \\frac{n}{2} ; \\frac{m}{2} ) ,',
   '\\overrightarrow{CM} = (\\frac{n}{2} ; \\frac{m}{2}) ,'],

  // \ctg
  ['BH=AC \\ctg \\widehatAHC = \\frac{AC}{\\sqrt{3}} .',
   'BH=AC \\operatorname{ctg} \\widehat{AHC} = \\frac{AC}{\\sqrt{3}} .'],

  // Степень в скобках
  ['f ( x ) =a ^ ( x + b )',
   'f (x) =a^{x + b}'],

  // log без основания
  ['f ( x ) =b + \\log ( a ) x',
   'f (x) =b + \\log_{a} x'],

  ['- 2=b + \\log a 2',
   '- 2=b + \\log_{a} 2'],

  // Двойной subscript
  ['S_A_1B_1C_1= \\frac{S}{4} .',
   'S_{A_1B_1C_1}= \\frac{S}{4} .'],

  // \underset слитный
  ['1=a ^{2} - 3 \\Leftrightarrow a ^{2} =4 \\underseta > 0\\mathop \\Leftrightarrow a=2',
   '1=a^{2} - 3 \\Leftrightarrow a^{2} =4 \\underset{a} > 0\\mathop \\Leftrightarrow a=2'],
];

test('fixLatex: реальные случаи из sdamgia — точное совпадение', () => {
  for (const [input, expected] of REAL_CASES) {
    const actual = fixLatex(input);
    assert.equal(actual, expected, `\n  IN:  ${input}\n  OUT: ${actual}\n  EXP: ${expected}`);
  }
});

test('fixLatex: после фикса всё рендерится KaTeX', () => {
  const failures = [];
  for (const [input] of REAL_CASES) {
    const fixed = fixLatex(input);
    if (!rendersOk(fixed)) {
      failures.push({ input, fixed });
    }
  }
  if (failures.length) {
    const msg = failures.map(f => `\n  IN:    ${f.input}\n  FIXED: ${f.fixed}`).join('\n');
    assert.fail(`${failures.length} формул всё ещё не рендерятся:${msg}`);
  }
});

test('fixLatex: идемпотентность — повторное применение ничего не меняет', () => {
  for (const [input] of REAL_CASES) {
    const once = fixLatex(input);
    const twice = fixLatex(once);
    assert.equal(twice, once, `Не идемпотентно:\n  ONCE:  ${once}\n  TWICE: ${twice}`);
  }
});

test('fixLatex: уже корректные формулы не портятся', () => {
  const OK = [
    '\\frac{a}{b}',
    '\\sqrt{x^2 + y^2}',
    '\\sin x + \\cos x = 1',
    'x^{10} + y_{ij}',
    '\\log_{2} 8 = 3',
    '\\angle ABC = 90^{\\circ}',
    'f(x) = ax^2 + bx + c',
    '2 \\sqrt{3}',
    '\\frac{1}{2}',
  ];
  for (const f of OK) {
    const fixed = fixLatex(f);
    assert.ok(rendersOk(fixed), `Сломали корректную формулу:\n  IN:    ${f}\n  FIXED: ${fixed}`);
  }
});

// ─── TeX-сокращения из alt «Решу» (v3.9.354) ───

test('дуга: \\overset\\smileBC → \\overset{\\smile}{BC}', () => {
  assert.equal(fixArcShortcut('\\overset\\smileBC=2 \\alpha'), '\\overset{\\smile}{BC}=2 \\alpha');
  assert.equal(fixArcShortcut('\\overset\\smileD_1B=3 \\alpha'), '\\overset{\\smile}{D_1B}=3 \\alpha');
  assert.equal(fixArcShortcut('\\overset\\smile{AB}'), '\\overset{\\smile}{AB}');
  assert.ok(rendersOk(fixLatex('\\frac{1}{2} \\overset\\smileBD')));
});

test('\\beginmatrix: система, совокупность, голая матрица', () => {
  assert.equal(
    fixMatrixShortcut('\\left\\{ \\beginmatrix (3 - a)^{2} - 16 < 0, (3 + a)^{2} - 64 < 0 \\endmatrix .'),
    '\\begin{cases} (3 - a)^{2} - 16 < 0 \\\\ (3 + a)^{2} - 64 < 0 \\end{cases}',
  );
  assert.equal(
    fixMatrixShortcut('\\left[ \\beginmatrix x \\leq - 4, - 1 \\leq x < 0. \\endmatrix'),
    '\\left[\\begin{array}{l} x \\leq - 4 \\\\ - 1 \\leq x < 0. \\end{array}\\right.',
  );
  // десятичная запятая в {,} и запятая без пробела строку не делят
  assert.equal(fixMatrixShortcut('\\beginmatrix x = 0{,}5, y=1,2 \\endmatrix'), '\\begin{matrix} x = 0{,}5 \\\\ y=1,2 \\end{matrix}');
  assert.ok(rendersOk(fixLatex('\\left\\{ \\beginmatrix x > 1, x < 3 \\endmatrix . \\Leftrightarrow 1 < x < 3')));
});

test('\\abs: только однозначные случаи', () => {
  assert.equal(
    fixAbsShortcut('\\frac{\\abs0 + 0 + 0 - 6}{\\sqrt{1 + 1 + 1}} = \\frac{6}{\\sqrt{3}}'),
    '\\frac{\\left|0 + 0 + 0 - 6\\right|}{\\sqrt{1 + 1 + 1}} = \\frac{6}{\\sqrt{3}}',
  );
  assert.equal(fixAbsShortcut('\\abs{x - 1} + 2'), '\\left|x - 1\\right| + 2');
  assert.equal(fixAbsShortcut('9\\absx = 0'), '9\\left|x\\right| = 0');
  assert.equal(fixAbsShortcut('\\frac{\\abs - 1}{\\sqrt{2}}'), '\\frac{\\left|- 1\\right|}{\\sqrt{2}}');
  assert.equal(fixAbsShortcut('y = - t + \\absa'), 'y = - t + \\left|a\\right|');
  // граница модуля неоднозначна — не трогаем (4|y| + … или 4|y + …|?)
  assert.equal(fixAbsShortcut('4 \\absy + x^{2} + 8x = 0'), '4 \\absy + x^{2} + 8x = 0');
  assert.equal(fixAbsShortcut('\\absx + 3a + 8 + \\absa - x - 4'), '\\absx + 3a + 8 + \\absa - x - 4');
  assert.ok(rendersOk(fixLatex('\\rho = \\frac{\\abs8 - 20}{\\sqrt{16 + 4 + 25}}')));
});

test('\\over: числитель — произведение слева, знаменатель — атом справа', () => {
  assert.equal(fixInfixOver('AB = AC \\over \\cos A = 4 \\over 0{,}5 = 8'), 'AB = \\frac{AC}{\\cos A} = \\frac{4}{0{,}5} = 8');
  // \over связывает соседей, а не всю группу: √(1 − 20/25)
  assert.equal(fixInfixOver('\\sqrt{1 - 20 \\over 25}'), '\\sqrt{1 - \\frac{20}{25}}');
  assert.equal(fixInfixOver('AC \\sin A \\over \\sqrt{1 - \\sin^{2} A}'), '\\frac{AC \\sin A}{\\sqrt{1 - \\sin^{2} A}}');
  // цепочка: (a/5)·(5/√5), а не a/(5·5)/√5
  assert.equal(
    fixInfixOver('17 \\cdot 2 \\cdot \\sqrt{5} \\over 5 \\cdot 5 \\over \\sqrt{5} = 34'),
    '\\frac{\\frac{17 \\cdot 2 \\cdot \\sqrt{5}}{5} \\cdot 5}{\\sqrt{5}} = 34',
  );
  assert.ok(rendersOk(fixLatex('BC = 17 \\cdot 2 \\sqrt{5} \\over 5 \\over \\sqrt{1 - 20 \\over 25} = 34')));
});

test('новые правила идемпотентны и не трогают обычные формулы', () => {
  const samples = [
    'AB = AC \\over \\cos A = 4 \\over 0{,}5 = 8',
    '\\frac{\\abs8 - 20}{3}',
    '\\left\\{ \\beginmatrix x > 1, x < 3 \\endmatrix .',
    '\\overset\\smileAB',
  ];
  for (const f of samples) { const once = fixLatex(f); assert.equal(fixLatex(once), once, f); }
  for (const f of ['\\frac{a}{b}', '\\left|x\\right| < 3', '\\overline{AB}', '\\begin{cases} x \\\\ y \\end{cases}', '\\overrightarrow{AB}']) {
    assert.equal(fixInfixOver(fixAbsShortcut(fixMatrixShortcut(fixArcShortcut(f)))), f);
  }
});
