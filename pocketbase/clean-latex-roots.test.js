// node --test pocketbase/clean-latex-roots.test.js
//
// Корни в alt-тексте sdamgia: маркеры «начало/конец аргумента» должны стать
// скобками на своих местах. Раньше лишние маркеры вырезались, и вложенный
// корень превращался в «\sqrt{6 + \sqrt: 15}» (~1300 задач в БД, v3.9.353).
//
// pdf-service.js при импорте поднимает сервер, поэтому cleanLatexFormula
// достаём из исходника и собираем отдельно (зависит только от fixLatex).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fixLatex } from './latex-fixer.js';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'pdf-service.js'), 'utf8');
const start = src.indexOf('function cleanLatexFormula(');
const end = src.indexOf('\n}\n', start) + 3;
const cleanLatexFormula = new Function('fixLatex', `${src.slice(start, end)}\nreturn cleanLatexFormula;`)(fixLatex);

const SH = '­';
const norm = (s) => s.replace(/\s+/g, ' ').trim();

test('вложенный корень — пробельный формат', () => {
  assert.equal(
    norm(cleanLatexFormula('\\sqrt: начало аргумента: 6 + \\sqrt: начало аргумента: 15 конец аргумента конец аргумента')),
    '\\sqrt{6 + \\sqrt{15}}',
  );
});

test('вложенный корень — слитный формат', () => {
  assert.equal(
    norm(cleanLatexFormula('\\sqrt:началоаргумента: 6 + \\sqrt:началоаргумента:15конецаргументаконецаргумента')),
    '\\sqrt{6 + \\sqrt{15}}',
  );
});

test('старый формат с мягкими переносами', () => {
  const alt = `ко${SH}рень из: на${SH}ча${SH}ло ар${SH}гу${SH}мен${SH}та: 26 конец ар${SH}гу${SH}мен${SH}та`;
  assert.equal(norm(cleanLatexFormula(alt)), '\\sqrt{26}');
});

test('корень N-й степени', () => {
  assert.equal(
    norm(cleanLatexFormula('корень 3 степени из: начало аргумента: x плюс 1 конец аргумента')),
    '\\sqrt[3]{x + 1}',
  );
});

test('два корня подряд не сливаются', () => {
  assert.equal(
    norm(cleanLatexFormula('\\sqrt: начало аргумента: x конец аргумента + \\sqrt: начало аргумента: y конец аргумента')),
    '\\sqrt{x} + \\sqrt{y}',
  );
});

test('ни маркеров, ни «\\sqrt:» в результате', () => {
  const out = cleanLatexFormula('(2 \\sqrt: начало аргумента: 3 конец аргумента минус 1) в квадрате');
  assert.doesNotMatch(out, /аргумент|\\sqrt\s*:/);
  assert.equal(norm(out), '(2 \\sqrt{3} - 1)^{2}');
});
