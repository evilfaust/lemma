import MathInline from '../shared/MathInline';
import MathRenderer from '../MathRenderer';

/**
 * Уравнение банка на экране и в печати.
 *
 * Своё уравнение учитель пишет чистым LaTeX («x^2 - 5x = 0») — так быстрее и
 * так его печатает KaTeX. Задача, взятая из каталога, приходит markdown-текстом
 * с формулами внутри, и её нельзя отдать инлайновому KaTeX как формулу.
 * Поэтому два поля и один компонент, который выбирает рендер.
 */
export function ClassifyItemView({ item }) {
  if (item?.md) return <MathRenderer text={item.md} />;
  return <MathInline latex={item?.latex || ''} />;
}

export default ClassifyItemView;
