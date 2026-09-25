import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { App } from 'antd';
import PrintSheet from '../components/print-sheet/PrintSheet';
import { isSidePlacement, splitSideFigure } from '../components/print-sheet/sideFigure';
import { figureSizeVars } from '../utils/kimImageSize';

const wrapper = ({ children }) => <App>{children}</App>;

const PLOT = '```plot\nx -5 2\ny -1 6\nf 2^(x+3)\n```';

describe('splitSideFigure — какой рисунок уходит вбок', () => {
  it('картинка задачи — единственный рисунок, текст не трогаем', () => {
    const md = 'Найдите площадь треугольника.';
    expect(splitSideFigure(md, { externalImage: true }))
      .toEqual({ figure: { kind: 'external' }, text: md });
  });

  it('блочный чертёж вырезается из условия целиком', () => {
    const md = `На рисунке изображён график функции.\n\n${PLOT}\n\nНайдите $f(8)$.`;
    const { figure, text } = splitSideFigure(md);
    expect(figure).toEqual({ kind: 'drawing', md: PLOT });
    expect(text).not.toContain('```');
    expect(text).toContain('На рисунке изображён график функции.');
    expect(text).toContain('Найдите $f(8)$.');
  });

  it('числовая прямая и векторы — тоже чертежи', () => {
    expect(splitSideFigure('Прямая\n```numline\ndomain 0 2\n```').figure.kind).toBe('drawing');
    expect(splitSideFigure('Векторы\n``` vectors\nvec a 0 0 1 1\n```').figure.kind).toBe('drawing');
  });

  it('картинка markdown в своей строке', () => {
    const md = 'Найдите угол $ABC$.\n\n![image](https://a.test/f.png)\n\nОтвет дайте в градусах.';
    const { figure, text } = splitSideFigure(md);
    expect(figure).toEqual({ kind: 'image', md: '![image](https://a.test/f.png)' });
    expect(text).toBe('Найдите угол $ABC$.\n\n\nОтвет дайте в градусах.');
  });

  it('картинка в начале строки с текстом после неё — текст остаётся', () => {
    const md = '![image](https://a.test/maze.png)На рисунке изображён лабиринт.';
    const { figure, text } = splitSideFigure(md);
    expect(figure.md).toBe('![image](https://a.test/maze.png)');
    expect(text).toBe('На рисунке изображён лабиринт.');
  });

  it('переводы строк Windows (\\r\\n) не мешают', () => {
    const md = 'Условие.\r\n\r\n```plot\r\nx -1 1\r\n```\r\n\r\nНайдите.';
    const { figure, text } = splitSideFigure(md);
    expect(figure.kind).toBe('drawing');
    expect(text).toContain('Найдите.');
    expect(text).not.toContain('plot');
  });

  it('незакрытый блок чертежа тянется до конца — как у react-markdown', () => {
    const { figure, text } = splitSideFigure('Условие.\n```plot\nx -1 1');
    expect(figure).toEqual({ kind: 'drawing', md: '```plot\nx -1 1' });
    expect(text).toBe('Условие.');
  });

  it('нет рисунков — нечего выносить', () => {
    expect(splitSideFigure('Найдите $x$').figure).toBeNull();
    expect(splitSideFigure('').figure).toBeNull();
    expect(splitSideFigure(undefined)).toEqual({ figure: null, text: '' });
  });

  it('несколько рисунков (галерея ответов) — задача остаётся как есть', () => {
    const md = 'На каком рисунке…\n\n1)\n\n2)\n\n![image](a.png)\n\n![image](b.png)';
    expect(splitSideFigure(md)).toEqual({ figure: null, text: md });
  });

  it('картинка задачи плюс рисунок в условии — тоже «несколько»', () => {
    const md = `Точки на прямой.\n\n${PLOT}`;
    expect(splitSideFigure(md, { externalImage: true }).figure).toBeNull();
  });

  it('картинки с подписями «А)» не выносятся — они часть соответствия', () => {
    expect(splitSideFigure('Установите соответствие.\n\nА) ![image](a.svg)').figure).toBeNull();
  });

  it('чертёж в ячейке таблицы остаётся в таблице', () => {
    const md = '| А) $x<1$ | 1) `numline: domain 0 3; ray left 1` |';
    expect(splitSideFigure(md).figure).toBeNull();
  });

  it('картинка в строке таблицы без ведущей черты не выносится', () => {
    expect(splitSideFigure('![a](a.png) | подпись').figure).toBeNull();
  });

  it('поле в клетку — не рисунок: не выносится и не мешает вынести чертёж', () => {
    expect(splitSideFigure('Решите.\n```grid\n10x6\n```').figure).toBeNull();
    const md = `График.\n${PLOT}\nРешение:\n\`\`\`клетка\n10x6\n\`\`\``;
    const { figure, text } = splitSideFigure(md);
    expect(figure.kind).toBe('drawing');
    expect(text).toContain('```клетка');
  });

  it('картинка внутри обычного блока кода — не рисунок', () => {
    const md = 'Пример разметки:\n```\n![](x.png)\n```\n![image](real.png)';
    expect(splitSideFigure(md).figure).toEqual({ kind: 'image', md: '![image](real.png)' });
  });

  it('тройные кавычки в строке — inline-код, а не начало блока', () => {
    // Приняв строку за открытие блока, разбор «проглотил» бы картинку ниже.
    const md = '```plot``` — так в тексте пишут код.\n\n![image](f.png)';
    expect(splitSideFigure(md).figure).toEqual({ kind: 'image', md: '![image](f.png)' });
  });

  it('режим: сбоку — только left/right', () => {
    expect(isSidePlacement('left')).toBe(true);
    expect(isSidePlacement('right')).toBe(true);
    expect(isSidePlacement('below')).toBe(false);
    expect(isSidePlacement(undefined)).toBe(false);
  });
});

describe('Лист задач — чертёж сбоку', () => {
  const imgTask = {
    id: 'i1',
    code: 'EGE-09',
    statement_md: 'На рисунке изображён график производной. Найдите точку максимума.',
    has_image: true,
    image_url: 'https://example.test/figure.png',
    answer: '3',
  };
  const plotTask = {
    id: 'p1',
    statement_md: `На рисунке изображён график функции.\n\n${PLOT}\n\nНайдите $f(1)$.`,
    answer: '16',
  };
  const galleryTask = {
    id: 'g1',
    statement_md: 'На каком рисунке…\n\n![image](a.png)\n\n![image](b.png)',
    answer: '2',
  };
  const plainTask = { id: 't1', statement_md: 'Найдите $2+2$', answer: '4' };

  const sheet = (tasks, options = {}, extra = {}) => render(
    <PrintSheet
      variants={[{ number: 1, tasks }]}
      meta={{ title: 'Лист' }}
      headerMode="compact"
      layout="workbook"
      showAnswersPage={false}
      options={options}
      {...extra}
    />,
    { wrapper }
  );

  it('по умолчанию лист прежний: картинка под условием, бокового блока нет', () => {
    const { container } = sheet([imgTask, plotTask]);
    expect(container.querySelector('.ps-task-aside')).toBeNull();
    expect(container.querySelector('.ps-task-text--side')).toBeNull();
    expect(container.querySelector('.ps-page .ps-task-image img').getAttribute('src'))
      .toBe('https://example.test/figure.png');
    expect(container.querySelector('.ps-page .mr-figure .coordplot')).toBeTruthy();
  });

  it('«под условием» даёт ту же разметку, что и без настройки', () => {
    const before = sheet([imgTask, plotTask, galleryTask, plainTask]);
    const html = before.container.innerHTML;
    before.unmount();
    const below = sheet([imgTask, plotTask, galleryTask, plainTask], { figurePlacement: 'below' });
    expect(below.container.innerHTML).toBe(html);
  });

  it('справа: картинка задачи уходит в боковой блок ПЕРЕД текстом', () => {
    const { container } = sheet([imgTask], { figurePlacement: 'right' });
    const text = container.querySelector('.ps-page .ps-task-text');
    expect(text.classList.contains('ps-task-text--side')).toBe(true);
    expect(text.classList.contains('ps-task-text--side-right')).toBe(true);
    // float обтекает только то, что идёт после него
    expect(text.firstElementChild.classList.contains('ps-task-aside')).toBe(true);
    expect(text.querySelector('.ps-task-aside img').getAttribute('src'))
      .toBe('https://example.test/figure.png');
    expect(container.querySelector('.ps-page .ps-task-image')).toBeNull();
  });

  it('слева: чертёж из условия вынесен, в тексте его больше нет', () => {
    const { container } = sheet([plotTask], { figurePlacement: 'left' });
    const text = container.querySelector('.ps-page .ps-task-text');
    expect(text.classList.contains('ps-task-text--side-left')).toBe(true);
    const aside = text.querySelector('.ps-task-aside');
    expect(aside.classList.contains('ps-task-aside--drawing')).toBe(true);
    expect(aside.querySelectorAll('.coordplot').length).toBe(1);
    expect(text.querySelectorAll('.coordplot').length).toBe(1);
    expect(text.textContent).toContain('Найдите');
  });

  it('галерея рисунков и задача без рисунка печатаются как обычно', () => {
    const { container } = sheet([galleryTask, plainTask], { figurePlacement: 'right' });
    expect(container.querySelector('.ps-task-aside')).toBeNull();
    expect(container.querySelectorAll('.ps-page .ps-task-text img').length).toBe(2);
  });

  it('зона измерения меряет задачу в той же раскладке, что и печать', () => {
    const { container } = sheet([imgTask], { figurePlacement: 'right' });
    expect(container.querySelector('.ps-measure .ps-task-text--side-right .ps-task-aside')).toBeTruthy();
  });

  it('при выключенных чертежах бокового блока нет', () => {
    const { container } = sheet([imgTask], { figurePlacement: 'right', showFigures: false });
    expect(container.querySelector('.ps-task-aside')).toBeNull();
    expect(container.querySelector('.ps-root--nofig')).toBeTruthy();
  });

  it('личный выбор задачи работает внутри режима «сбоку»', () => {
    const { container } = sheet([
      { ...imgTask, figurePlacement: 'left' },
      { ...plotTask, figurePlacement: 'below' },
    ], { figurePlacement: 'right' });
    const texts = container.querySelectorAll('.ps-page .ps-task-text');
    expect(texts[0].classList.contains('ps-task-text--side-left')).toBe(true);
    expect(texts[1].classList.contains('ps-task-text--side')).toBe(false);
    expect(texts[1].querySelector('.mr-figure .coordplot')).toBeTruthy();
  });

  it('в режиме «под условием» личный выбор задачи не действует', () => {
    const { container } = sheet([{ ...imgTask, figurePlacement: 'right' }]);
    expect(container.querySelector('.ps-task-aside')).toBeNull();
    expect(container.querySelector('.ps-page .ps-task-image')).toBeTruthy();
  });

  it('переключатель места на карточке — только в режиме «сбоку» и только у выносимого рисунка', () => {
    const editing = { onEditTask: () => {}, onSetFigurePlacement: () => {} };
    const side = sheet([imgTask, galleryTask, plainTask], { figurePlacement: 'right' }, { editing });
    const controls = side.container.querySelectorAll('.ps-page .ps-task-controls');
    expect(controls[0].querySelectorAll('.ant-segmented').length).toBe(1);
    expect(controls[1].querySelector('.ant-segmented')).toBeNull();
    expect(controls[2].querySelector('.ant-segmented')).toBeNull();
    side.unmount();

    const below = sheet([imgTask], {}, { editing });
    expect(below.container.querySelector('.ps-page .ps-task-controls .ant-segmented')).toBeNull();
  });

  it('ширина бокового чертежа — своя шкала, личный размер её перебивает', () => {
    expect(['s', 'm', 'l', 'xl'].map(s => figureSizeVars(s)['--ps-fig-side-w']))
      .toEqual(['30%', '40%', '50%', '60%']);
    const { container } = sheet([{ ...imgTask, kimImageSize: 'l' }], { figurePlacement: 'right', figureSize: 's' });
    expect(container.querySelector('.ps-root').style.getPropertyValue('--ps-fig-side-w')).toBe('30%');
    expect(container.querySelector('.ps-page .ps-task').style.getPropertyValue('--ps-fig-side-w')).toBe('50%');
  });

  it('CSS: условие держит float внутри себя — высоту задачи меряет пагинация', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/components/print-sheet/printSheet.css'), 'utf-8'
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/\.ps-task-text--side\s*\{[^}]*display:\s*flow-root/);
    expect(css).toMatch(/\.ps-task-text--side-right \.ps-task-aside\s*\{[^}]*float:\s*right/);
    expect(css).toMatch(/\.ps-task-text--side-left \.ps-task-aside\s*\{[^}]*float:\s*left/);
    expect(css).toMatch(/\.ps-root--nofig \.ps-task-aside/);
  });
});
