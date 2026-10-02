import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { App } from 'antd';
import PrintSheet from '../components/print-sheet/PrintSheet';
import {
  svgForImage, svgDataUrl, geometryFigureUrl, geometrySheetTask,
} from '../utils/geometrySheet';

const wrapper = ({ children }) => <App>{children}</App>;

// Корень, как у чертежей банка (GeoGebra → SVG): процентная ширина + viewBox
const GGB_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" style="width:100%;height:auto;display:block;" viewBox="301 195 455 350"><line x1="310" y1="200" x2="700" y2="500" stroke="black"/></svg>';
const urlOf = (t) => `https://pb/files/${t.id}/${t.geogebra_image_base64}`;

const rootTag = (svg) => /<svg\b[^>]*>/i.exec(svg)[0];

describe('svgForImage — корень SVG под картинку', () => {
  it('процентная ширина заменяется собственным размером по viewBox', () => {
    const tag = rootTag(svgForImage(GGB_SVG));
    expect(tag).not.toMatch(/100%/);
    expect(tag).not.toMatch(/style=/);
    expect(tag).toMatch(/viewBox="301 195 455 350"/);
    // пропорции viewBox сохранены, длинная сторона растянута до 800
    expect(tag).toMatch(/width="800"/);
    expect(tag).toMatch(/height="615"/);
  });

  it('без viewBox — строится из пиксельных width/height', () => {
    const tag = rootTag(svgForImage('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><circle cx="5" cy="5" r="3"/></svg>'));
    expect(tag).toMatch(/viewBox="0 0 200 100"/);
    expect(tag).toMatch(/width="800"/);
    expect(tag).toMatch(/height="400"/);
  });

  it('крупный чертёж не ужимается', () => {
    const tag = rootTag(svgForImage('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600"></svg>'));
    expect(tag).toMatch(/width="1200"/);
    expect(tag).toMatch(/height="600"/);
  });

  it('xmlns обязателен — без него <img> SVG не нарисует', () => {
    const out = svgForImage('<svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>');
    expect(rootTag(out)).toMatch(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it('скрипты вырезаются, размер без опор — пустая строка', () => {
    expect(svgForImage('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>')).not.toMatch(/script/);
    expect(svgForImage('<svg width="100%"></svg>')).toBe('');
    expect(svgForImage('')).toBe('');
    expect(svgDataUrl('не svg')).toBe('');
  });

  it('data URL раскодируется обратно в тот же SVG', () => {
    const url = svgDataUrl(GGB_SVG);
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(url.split(',').slice(1).join(','))).toBe(svgForImage(GGB_SVG));
  });
});

describe('geometryFigureUrl — какой чертёж идёт в раздатку', () => {
  it('SVG — если задача показывает SVG', () => {
    const url = geometryFigureUrl({ id: 'a', drawing_view: 'svg', drawing_svg: GGB_SVG, geogebra_image_base64: 'x.png' }, urlOf);
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('иначе файл чертежа', () => {
    expect(geometryFigureUrl({ id: 'a', drawing_view: 'image', drawing_svg: GGB_SVG, geogebra_image_base64: 'x.png' }, urlOf))
      .toBe('https://pb/files/a/x.png');
  });

  it('картинка решения (МЦНМО) с условием не печатается', () => {
    expect(geometryFigureUrl({ id: 'a', image_role: 'solution', geogebra_image_base64: 'x.png' }, urlOf)).toBe('');
  });

  it('нет чертежа — пусто', () => {
    expect(geometryFigureUrl({ id: 'a' }, () => '')).toBe('');
  });
});

describe('geometrySheetTask — задача листа', () => {
  it('несёт условие, ответ строкой и признак чертежа', () => {
    const t = geometrySheetTask({ id: 'g1', code: 'GEO-7', statement_md: 'Найдите $x$.', answer: 12, geogebra_image_base64: 'x.png' }, urlOf);
    expect(t).toEqual({
      id: 'g1', code: 'GEO-7', statement_md: 'Найдите $x$.', answer: '12',
      has_image: true, figureUrl: 'https://pb/files/g1/x.png',
    });
  });

  it('без чертежа has_image = false', () => {
    expect(geometrySheetTask({ id: 'g2', statement_md: 'Докажите.' }, () => '').has_image).toBe(false);
  });
});

describe('PrintSheet печатает чертёж геометрии', () => {
  const task = geometrySheetTask({ id: 'g1', statement_md: 'В треугольнике $ABC$…', answer: '5', drawing_view: 'svg', drawing_svg: GGB_SVG }, urlOf);
  const page = (c) => c.querySelector('.ps-page');

  it('под условием — картинкой с адресом из figureUrl', () => {
    const { container } = render(
      <PrintSheet variants={[{ number: 1, tasks: [task] }]} showAnswersPage={false} />,
      { wrapper }
    );
    const img = page(container).querySelector('.ps-task-image img');
    expect(img.getAttribute('src')).toBe(task.figureUrl);
  });

  it('сбоку — в колонке рядом с условием', () => {
    const { container } = render(
      <PrintSheet
        variants={[{ number: 1, tasks: [task] }]}
        options={{ figurePlacement: 'right' }}
        showAnswersPage={false}
      />,
      { wrapper }
    );
    const img = page(container).querySelector('.ps-task-aside img');
    expect(img.getAttribute('src')).toBe(task.figureUrl);
    expect(page(container).querySelector('.ps-task-image')).toBeNull();
  });

  it('без обработчиков правки кнопок «Редактировать/Заменить» нет', () => {
    const { container } = render(
      <PrintSheet
        variants={[{ number: 1, tasks: [task] }]}
        editing={{ onSetFigureSize: () => {} }}
        showAnswersPage={false}
      />,
      { wrapper }
    );
    const controls = page(container).querySelector('.ps-task-controls');
    expect(controls).not.toBeNull();
    expect(controls.querySelector('.anticon-edit')).toBeNull();
    expect(controls.querySelector('.anticon-swap')).toBeNull();
  });
});
