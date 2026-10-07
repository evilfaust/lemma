import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';
import { DrawingPrintContext } from '../shared/drawingPrintContext';
import { splitSideFigure } from '../print-sheet/sideFigure';
import {
  figureBoxMm, kimImageBoxStyle, kimImageImgStyle, KIM_LETTER_MM, KIM_TEXT_WIDTH_MM,
} from '../../utils/kimImageSize';

// Блок ```planim / ```stereo строится под своё место в миллиметрах
// (DrawingPrintContext): фигура вписывается, буквы — как формулы условия.
const BUILT_FENCE = /^\s*(`{3,}|~{3,})\s*(planim|stereo)\b/i;

/** Есть ли в условии чертёж наших редакторов — его размер тоже S/M/L/XL. */
export const hasBuiltDrawing = (task) => /(`{3,}|~{3,})\s*(planim|stereo)\b/i.test(task?.statement_md || '');

/** Место чертежа КИМ при размере S/M/L/XL — как у картинки задачи. */
export const kimDrawingPlace = (size) => ({
  ...figureBoxMm(size, KIM_TEXT_WIDTH_MM),
  letterMm: KIM_LETTER_MM,
});

/**
 * Содержимое задачи в КИМ-буклете (база, профиль, ОГЭ): условие и рисунок.
 *
 * Картинка задачи (`has_image`) — как раньше: блок справа после текста.
 * Единственный чертёж ```planim / ```stereo в условии встаёт так же справа,
 * но ПЕРВЫМ в разметке — текст его обтекает, как в бланке ФИПИ. На XL (вся
 * ширина) и при нескольких рисунках чертёж остаётся на своём месте в тексте.
 * Размер места в обоих случаях — переключатель S/M/L/XL задачи.
 */
export default function KimTaskContent({ task }) {
  const imageUrl = task.has_image ? api.getTaskImageUrl(task) : null;
  const size = task.kimImageSize;
  const place = kimDrawingPlace(size);

  const split = !imageUrl && size !== 'xl' ? splitSideFigure(task.statement_md) : null;
  const aside = split?.figure?.kind === 'drawing' && BUILT_FENCE.test(split.figure.md)
    ? split.figure
    : null;

  return (
    <div className="kim-book-task-content">
      <DrawingPrintContext.Provider value={place}>
        {aside && (
          <div className="kim-book-task-drawing">
            <MathRenderer text={aside.md} />
          </div>
        )}
        <MathRenderer text={aside ? split.text : task.statement_md} />
      </DrawingPrintContext.Provider>
      {imageUrl && (
        <div className="kim-book-task-image" style={kimImageBoxStyle(size)}>
          <img src={imageUrl} alt="" style={kimImageImgStyle(size)} />
        </div>
      )}
    </div>
  );
}
