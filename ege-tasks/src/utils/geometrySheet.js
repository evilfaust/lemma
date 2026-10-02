import { sanitizeSvg } from './sanitizeSvg';

/**
 * Геометрическая задача → задача печатного листа (движок print-sheet, тот же,
 * что у Генератора). Лист печатает условие markdown-ом, а чертёж геометрии
 * живёт отдельно от условия: SVG (`drawing_svg`) или файл-картинка. Чертёж
 * уходит в лист картинкой (`figureUrl`) — так на него действуют все рычаги
 * листа: размер S/M/L/XL, «справа / слева» с обтеканием, перемер после
 * загрузки.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
// Сторона, до которой растягиваем собственный размер SVG: размер на листе
// задают потолки --ps-fig-w / --ps-fig-h, а маленький чертёж без этого так и
// печатался бы маленьким.
const SVG_MIN_SIDE_PX = 800;

const ATTR = (name) => new RegExp(`\\s${name}\\s*=\\s*("[^"]*"|'[^']*')`, 'i');
const attrOf = (tag, name) => {
  const m = ATTR(name).exec(tag);
  return m ? m[1].slice(1, -1) : null;
};
const dropAttr = (tag, name) => tag.replace(new RegExp(ATTR(name).source, 'gi'), '');

/**
 * Корень SVG — под картинку: свои ширина и высота в px по пропорциям viewBox.
 * У чертежей геометрии корень обычно `width="100%" style="width:100%"` — в
 * <img> процентная ширина собственным размером не считается, и картинка
 * схлопывается или растягивается непредсказуемо (особенно плавающая сбоку).
 * Возвращает '' для пустого или неразборчивого SVG.
 */
export function svgForImage(svg) {
  const clean = sanitizeSvg(svg);
  const open = /<svg\b[^>]*>/i.exec(clean);
  if (!open) return '';
  let tag = open[0];

  let box = (attrOf(tag, 'viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (box.length !== 4 || box.some((n) => !Number.isFinite(n)) || box[2] <= 0 || box[3] <= 0) {
    const w = parseFloat(attrOf(tag, 'width'));
    const h = parseFloat(attrOf(tag, 'height'));
    const pxLike = (v) => /^\s*[\d.]+\s*(px)?\s*$/i.test(v || '');
    if (!(w > 0 && h > 0 && pxLike(attrOf(tag, 'width')) && pxLike(attrOf(tag, 'height')))) return '';
    box = [0, 0, w, h];
    tag = tag.replace(/<svg\b/i, `<svg viewBox="0 0 ${w} ${h}"`);
  }

  const k = Math.max(1, SVG_MIN_SIDE_PX / Math.max(box[2], box[3]));
  const width = Math.round(box[2] * k);
  const height = Math.round(box[3] * k);
  tag = ['width', 'height', 'style', 'preserveAspectRatio'].reduce(dropAttr, tag);
  if (!/\sxmlns\s*=/i.test(tag)) tag = tag.replace(/<svg\b/i, `<svg xmlns="${SVG_NS}"`);
  tag = tag.replace(/<svg\b/i, `<svg width="${width}" height="${height}"`);

  return clean.slice(0, open.index) + tag + clean.slice(open.index + open[0].length);
}

export const svgDataUrl = (svg) => {
  const ready = svgForImage(svg);
  return ready ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ready)}` : '';
};

/**
 * Адрес чертежа задачи для листа ('' — чертежа в раздатке нет). Правило то же,
 * что у остальных печатей геометрии: SVG — если задача показывает SVG, иначе
 * файл; картинка решения (`image_role = 'solution'`, банк МЦНМО) с условием
 * не печатается.
 *
 * @param {Function} imageUrlOf — task → адрес файла чертежа (api.getGeometryImageUrl)
 */
export function geometryFigureUrl(task, imageUrlOf) {
  if (!task) return '';
  if (task.drawing_view === 'svg' && task.drawing_svg) return svgDataUrl(task.drawing_svg);
  if (task.image_role === 'solution') return '';
  return imageUrlOf?.(task) || '';
}

/**
 * Задача листа из геометрической. `has_image` нужен движку: по нему лист
 * понимает, что у задачи есть чертёж (кнопки размера, перемер).
 */
export function geometrySheetTask(task, imageUrlOf) {
  const figureUrl = geometryFigureUrl(task, imageUrlOf);
  return {
    id: task.id,
    code: task.code || '',
    statement_md: task.statement_md || '',
    answer: task.answer == null ? '' : String(task.answer),
    has_image: !!figureUrl,
    figureUrl,
  };
}
