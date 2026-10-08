import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';
import { DrawingPrintContext } from '../shared/drawingPrintContext';
import { splitSideFigure } from '../print-sheet/sideFigure';
import { hasFigure } from '../print-sheet/SheetTask';
import { splitAnswerTable } from '../../utils/kimAnswerTable';
import {
  figureBoxMm, kimFigureVars, kimImageBoxStyle, kimImageImgStyle, KIM_LETTER_MM, KIM_TEXT_WIDTH_MM,
} from '../../utils/kimImageSize';

// Блок ```planim / ```stereo строится под своё место в миллиметрах
// (DrawingPrintContext): фигура вписывается, буквы — как формулы условия.
const BUILT_FENCE = /^\s*(`{3,}|~{3,})\s*(planim|stereo)\b/i;

/** Есть ли в условии чертёж наших редакторов — его размер тоже S/M/L/XL. */
export const hasBuiltDrawing = (task) => /(`{3,}|~{3,})\s*(planim|stereo)\b/i.test(task?.statement_md || '');

/**
 * Есть ли у задачи рисунок, которому КИМ даёт размер S/M/L/XL: картинка
 * задачи, чертёж редактора, график/диаграмма/числовая прямая — блоком или
 * в ячейке таблицы.
 */
export const hasKimFigure = (task) => hasFigure(task || {});

/**
 * Размер графика по умолчанию — «как в условии»: у ```plot свой `size`, и
 * старые варианты не должны поменять вёрстку от одного обновления. Картинке
 * и чертежу редактора размер был всегда (M).
 */
export const kimSizeIsNatural = (task) => !task.has_image && !hasBuiltDrawing(task);

/** Место чертежа КИМ при размере S/M/L/XL — как у картинки задачи. */
export const kimDrawingPlace = (size, { side = false } = {}) => ({
  ...figureBoxMm(size, KIM_TEXT_WIDTH_MM, { side }),
  letterMm: KIM_LETTER_MM,
});

/** Условие для буклета: таблица-бланк «А Б В Г» уходит в строку «Ответ:». */
export const kimStatement = (task, { answerTable = false } = {}) => {
  const md = task.statement_md || '';
  return (answerTable && splitAnswerTable(md)?.text) || md;
};

/**
 * Где встаёт рисунок задачи в буклете.
 *
 * Сбоку (с обтеканием) может встать только ЕДИНСТВЕННЫЙ рисунок — тот, что
 * находит `splitSideFigure`. Выбор учителя — `task.figurePlacement`
 * (left | below | right, тот же ключ, что у листа Генератора; сохраняется в
 * `variants.order`). Без выбора чертёж редактора стоит справа (кроме XL —
 * во всю ширину), остальное — на своём месте в тексте, как раньше.
 *
 * @returns {{ figure, text, built, side: null | 'left' | 'right', placement }}
 *   `placement` — что показать на переключателе (null — переключателя нет).
 */
export function kimFigureLayout(task, { answerTable = false, imageUrl = null } = {}) {
  const md = kimStatement(task, { answerTable });
  const { figure, text } = splitSideFigure(md, { externalImage: !!imageUrl });
  const built = figure?.kind === 'drawing' && BUILT_FENCE.test(figure.md);
  const chosen = task.figurePlacement;

  let side = null;
  if (figure && (chosen === 'left' || chosen === 'right')) side = chosen;
  else if (figure && !chosen && built && task.kimImageSize !== 'xl') side = 'right';

  return {
    figure,
    text: side && figure.kind !== 'external' ? text : md,
    built,
    side,
    placement: figure ? (side || 'below') : null,
  };
}

/**
 * Содержимое задачи в КИМ-буклете (база, профиль, ОГЭ): условие и рисунок.
 *
 * Рисунок сбоку стоит в разметке ПЕРВЫМ — текст его обтекает, как в бланке
 * ФИПИ (float обтекает только то, что после него). Под условием картинка
 * задачи — как раньше, блоком справа после текста.
 *
 * Размер S/M/L/XL: чертёж редактора строится под место в мм, картинка
 * ограничивается инлайном, графики/диаграммы/прямые (SVG) — CSS-переменными
 * `kimFigureVars` на корне. График без выбора размера — в размере из условия.
 *
 * @param {boolean} answerTable — у задачи есть строка ответа: таблица-бланк
 *   «А Б В Г» печатается в ней (KimAnswer), а из условия уходит.
 */
export default function KimTaskContent({ task, answerTable = false }) {
  const imageUrl = task.has_image ? api.getTaskImageUrl(task) : null;
  const size = task.kimImageSize;
  const { figure, text, built, side } = kimFigureLayout(task, { answerTable, imageUrl });

  // Чертёж редактора сбоку в XL занял бы всю полосу — сбоку он берёт долю
  // «сбоку» (60 %), как картинка.
  const place = kimDrawingPlace(size, { side: !!side && size === 'xl' });
  const aside = side && figure.kind !== 'external' ? figure : null;

  const className = [
    'kim-book-task-content',
    size ? 'kim-book-task-content--sized' : '',
    side ? `kim-book-task-content--side kim-book-task-content--side-${side}` : '',
  ].filter(Boolean).join(' ');

  const image = imageUrl && (side ? (
    <div className="kim-book-task-image kim-book-task-aside">
      <img src={imageUrl} alt="" />
    </div>
  ) : (
    <div className="kim-book-task-image" style={kimImageBoxStyle(size)}>
      <img src={imageUrl} alt="" style={kimImageImgStyle(size)} />
    </div>
  ));

  return (
    <div className={className} style={kimFigureVars(size)}>
      <DrawingPrintContext.Provider value={place}>
        {side && image}
        {aside && (
          <div
            className={[
              'kim-book-task-aside',
              `kim-book-task-aside--${aside.kind}`,
              built ? 'kim-book-task-drawing kim-book-task-aside--fit' : '',
            ].filter(Boolean).join(' ')}
          >
            <MathRenderer text={aside.md} />
          </div>
        )}
        <MathRenderer text={text} />
      </DrawingPrintContext.Provider>
      {!side && image}
    </div>
  );
}

/**
 * Строка «Ответ:» под задачей буклета. Если в условии была таблица-бланк
 * «А Б В Г», она печатается здесь же — компактно, вместо черты (как в КИМ
 * ФИПИ), а не второй копией места для ответа.
 */
export function KimAnswer({ task }) {
  const blank = splitAnswerTable(task.statement_md || '');
  if (blank) {
    return (
      <div className="kim-book-answer kim-answer-table">
        <span>Ответ:</span>
        <table>
          <thead>
            <tr>{blank.letters.map((l, i) => <th key={i}>{l}</th>)}</tr>
          </thead>
          <tbody>
            <tr>{blank.letters.map((l, i) => <td key={i} />)}</tr>
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="kim-book-answer">
      <span>Ответ:</span>
      <span className="kim-book-answer-line" />
      <span className="kim-book-answer-dot">.</span>
    </div>
  );
}
