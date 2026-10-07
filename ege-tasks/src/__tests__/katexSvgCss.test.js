import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Радикал KaTeX (\sqrt) — инлайновый <svg width="400em" height="1.08em"> с
// preserveAspectRatio="slice". Общее правило вида `.x svg { max-width: 100%;
// height: auto }` пересчитывает его высоту по viewBox (400000 × 1080) от
// ужатой ширины — радикал схлопывается почти в ноль, и корень пропадает.
// Так корни пропали на печати (28.08.2026) и у учеников в «Показе условий»
// (07.10.2026). Правило по svg допустимо только внутри обёртки чертежа или с
// исключением `:not(.katex svg)`.

const SRC = join(__dirname, '..');

function cssFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : cssFiles(path);
    return name.endsWith('.css') ? [path] : [];
  });
}

// Обёртки, внутри которых svg — заведомо чертёж или иконка, а не формула.
const DRAWING_SCOPE = /mr-figure|stereo|planim|numline|coordplot|plot|figure|drawing|anticon|subtab|icon|qr|pixel|unit-?circle|chart|graph/i;

/** Селекторы, у которых последний составной селектор — голый `svg`. */
function bareSvgSelectors(css) {
  const out = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{/g;
  let m;
  while ((m = re.exec(text))) {
    const head = m[1].trim();
    if (head.startsWith('@')) continue;
    head.split(',').map((s) => s.trim()).forEach((sel) => {
      if (/svg:not\(\.katex svg\)$/.test(sel)) return;
      const last = sel.replace(/\([^)]*\)/g, '').split(/[\s>+~]+/).pop();
      if (!/^svg(?![\w-])/.test(last)) return;
      if (DRAWING_SCOPE.test(sel)) return;
      out.push(sel);
    });
  }
  return out;
}

describe('CSS не трогает радикал KaTeX', () => {
  it('нет общих правил по svg без :not(.katex svg)', () => {
    const offenders = cssFiles(SRC).flatMap((file) => bareSvgSelectors(readFileSync(file, 'utf8'))
      .map((sel) => `${relative(SRC, file)}: ${sel}`));
    expect(offenders).toEqual([]);
  });

  it('сторож ловит опасное правило и пропускает безопасные', () => {
    expect(bareSvgSelectors('.sgw-task__body svg { height: auto; }')).toEqual(['.sgw-task__body svg']);
    expect(bareSvgSelectors('.sgw-task__body svg:not(.katex svg) { height: auto; }')).toEqual([]);
    expect(bareSvgSelectors('.ps-task-text .mr-figure svg { width: 100%; }')).toEqual([]);
  });
});
