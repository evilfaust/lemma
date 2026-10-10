import { useLayoutEffect, useRef, useState } from 'react';
import { Button, Tooltip, Segmented } from 'antd';
import {
  EditOutlined, SwapOutlined, HolderOutlined, PicLeftOutlined, PicCenterOutlined, PicRightOutlined,
} from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';
import { filterTaskText } from '../../utils/filterTaskText';
import {
  figureSizeVars, figureBoxMm, psLetterMm, KIM_IMAGE_SIZE_OPTIONS,
} from '../../utils/kimImageSize';
import { DrawingPrintContext } from '../shared/drawingPrintContext';
import SolutionFill, { NotchFrame } from './SolutionFill';
import { BODY_W_MM, MM, NUM_COL_MM, NUM_COL_WIDE_MM, SOLUTION_GAP_MM } from './geometry';
import { isSidePlacement, splitSideFigure } from './sideFigure';

// Поле «Ответ» справа от условия (`.ps-answer-box` 26 мм + зазор `.ps-task-row` 4 мм).
const ANSWER_BOX_MM = 26 + 4;

// Чертёж сбоку — блок ```planim / ```stereo: он строится под своё место и сам
// знает ширину.
const FIT_FENCE = /^\s*(`{3,}|~{3,})\s*(planim|stereo)\b/i;

// Пустой угол под коротким условием рядом с высоким чертежом сбоку: когда
// место для решения, начатое под текстом, заходит рядом с рисунком хотя бы на
// столько миллиметров, оно обтекает рисунок. Меньше — как раньше, под рисунком.
const WRAP_MIN_MM = 4;
// Зазор между клеткой и рисунком по горизонтали, мм.
const NOTCH_CLEAR_MM = 2;

const floorMm = (mm) => Math.floor(mm * 10 + 1e-6) / 10;

/**
 * Пустой угол под текстом рядом с чертежом сбоку: { gapMm, asideMm } —
 * от низа текста до низа рисунка (с его отступом) и ширина рисунка, мм.
 * Меряется по живому DOM; положение решения на это не влияет (оно ниже
 * текста), поэтому петли нет.
 */
function useSideGap(active, asideRef, textRef) {
  const [gap, setGap] = useState({ gapMm: 0, asideMm: 0 });
  useLayoutEffect(() => {
    if (!active) { setGap((g) => (g.gapMm ? { gapMm: 0, asideMm: 0 } : g)); return undefined; }
    const measure = () => {
      const aside = asideRef.current;
      const text = textRef.current;
      if (!aside || !text) return;
      const mb = parseFloat(getComputedStyle(aside).marginBottom) || 0;
      const gapPx = (aside.offsetTop + aside.offsetHeight + mb) - (text.offsetTop + text.offsetHeight);
      const next = { gapMm: floorMm(gapPx / MM), asideMm: Math.ceil((aside.offsetWidth / MM) * 10) / 10 };
      setGap((g) => (g.gapMm === next.gapMm && g.asideMm === next.asideMm ? g : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    // Шрифты KaTeX и картинки догружаются позже первого замера.
    const ro = new ResizeObserver(measure);
    if (asideRef.current) ro.observe(asideRef.current);
    if (textRef.current) ro.observe(textRef.current);
    return () => ro.disconnect();
  }, [active, asideRef, textRef]);
  return gap;
}

// Место чертежа у одной задачи — в том порядке, в каком он встанет на листе.
const PLACEMENT_OPTIONS = [
  { value: 'left', icon: <PicLeftOutlined />, title: 'Чертёж слева' },
  { value: 'below', icon: <PicCenterOutlined />, title: 'Под условием' },
  { value: 'right', icon: <PicRightOutlined />, title: 'Чертёж справа' },
];

/**
 * Есть ли у задачи чертёж: внешняя картинка, картинка markdown или наш SVG.
 * У встроенных чертежей ДВЕ формы записи — блочная ```numline и inline
 * `numline: …` для ячеек таблиц (fenced в ячейке не работает), и вторая
 * встречается как раз в задачах «на каком рисунке изображено…».
 */
export const hasFigure = (task) => {
  const md = task.statement_md || '';
  return !!task.has_image
    || /!\[/.test(md)
    || /```\s*(numline|plot|vectors|chart|stereo|planim)\b/i.test(md)
    || /`\s*(numline|plot|vectors|chart|stereo|planim)\s*:/i.test(md);
};

/**
 * Одна задача печатного листа.
 *
 * @param {number} solutionMm — высота зоны решения (0 — зоны нет). Считается
 *   снаружи: в режиме «N на лист» она разная на разных страницах.
 * @param {Object} editing — правка на экране: { dragDropHandlers, onEditTask,
 *   onReplaceTask, variantIndex }. В зоне измерения не передаётся — кнопки
 *   позиционированы абсолютно и высоту не меняют, но лишний рендер ни к чему.
 *
 * `task.numberLabel` подменяет порядковый номер меткой: у шифровки в квадрате
 * стоят не «1, 2, 3», а номера клеток ответа, куда пойдёт найденная буква.
 * Колонка номера под метку шире (NUM_COL_WIDE_MM) — это учитывает и ширина
 * зоны решения.
 */
export default function SheetTask({
  task, number, taskIndex, options, solutionMm = 0, editing, contentWidthMm = BODY_W_MM,
}) {
  const {
    answerStyle = 'line',
    solutionFill = 'grid',
    hideTaskPrefixes = false,
    showTaskCode = false,
    showAnswersInline = false,
  } = options;

  const numberLabel = task.numberLabel || '';
  const raw = task.statement_md || '';
  const text = hideTaskPrefixes ? filterTaskText(raw) : raw;
  // `figureUrl` — готовый адрес чертежа от вызывающего (у геометрии чертёж
  // живёт не в tasks: SVG или свой файл, см. utils/geometrySheet.js).
  const imageUrl = task.figureUrl || (task.has_image ? api.getTaskImageUrl(task) : null);

  const dnd = editing?.dragDropHandlers;
  const vi = editing?.variantIndex ?? 0;
  const dragging = dnd?.isDragging(vi, taskIndex);
  const dragOver = dnd?.isDragOver(vi, taskIndex);

  // Чертёж сбоку (`options.figurePlacement`: left | right). Личный выбор
  // задачи (`task.figurePlacement`) действует только внутри этого режима:
  // «под условием» печатает лист ровно как раньше. Сбоку встаёт единственный
  // рисунок задачи — с несколькими рисунками задача остаётся как есть
  // (см. sideFigure.js).
  const sheetPlacement = options.figurePlacement || 'below';
  const sideMode = options.showFigures !== false && isSidePlacement(sheetPlacement);
  const side = sideMode ? splitSideFigure(text, { externalImage: !!imageUrl }) : null;
  const placement = sideMode ? (task.figurePlacement || sheetPlacement) : 'below';
  const aside = side?.figure && isSidePlacement(placement) ? side.figure : null;

  const code = showTaskCode && task.code ? <div className="ps-task-code">{task.code}</div> : null;

  // Место чертежа в мм — для планиметрических чертежей, которые строятся под
  // лист (буквы как в условии), а не ужимаются картинкой. Ширина полосы
  // условия — та же, от которой CSS считает --ps-fig-w / --ps-fig-side-w.
  const showBox = answerStyle === 'box' && !showAnswersInline;
  const textWidthMm = contentWidthMm - (numberLabel ? NUM_COL_WIDE_MM : NUM_COL_MM) - (showBox ? ANSWER_BOX_MM : 0);
  const figSize = task.kimImageSize || options.figureSize || 'm';
  const letterMm = psLetterMm(options.fontScale);
  const belowPlace = { ...figureBoxMm(figSize, textWidthMm), letterMm };
  const sidePlace = { ...figureBoxMm(figSize, textWidthMm, { side: true }), letterMm };
  const asideFits = aside?.kind === 'drawing' && FIT_FENCE.test(aside.md);

  // Место для решения обтекает чертёж сбоку: начинается сразу под текстом и
  // идёт под рисунком (рисунок закрывает его белым фоном), а высота зоны
  // растёт ровно на пустой угол — низ задачи остаётся там же, где его
  // посчитала пагинация. С полем ответа справа и с ответом в тексте — как
  // раньше: там между условием и решением своя вёрстка.
  const asideRef = useRef(null);
  const sideTextRef = useRef(null);
  const wrapActive = !!aside && solutionMm > 0 && !showBox && !showAnswersInline;
  const sideGap = useSideGap(wrapActive, asideRef, sideTextRef);
  // Зона начинается на SOLUTION_GAP_MM ниже текста, поэтому рядом с рисунком
  // у неё остаётся угол высотой gap − зазор.
  const notchH = wrapActive ? floorMm(sideGap.gapMm - SOLUTION_GAP_MM) : 0;
  const wrapMm = notchH >= WRAP_MIN_MM ? sideGap.gapMm : 0;

  const solutionWidthMm = contentWidthMm - (numberLabel ? NUM_COL_WIDE_MM : NUM_COL_MM);
  const notch = wrapMm ? {
    side: placement === 'left' ? 'left' : 'right',
    w: Math.min(solutionWidthMm, sideGap.asideMm + NOTCH_CLEAR_MM),
    h: notchH,
  } : null;
  const solutionZone = (heightMm) => (
    <div
      className={notch ? 'ps-solution ps-solution--wrap' : 'ps-solution'}
      style={{ height: `${heightMm}mm` }}
    >
      <span
        className="ps-solution-label"
        // У рисунка слева угол занят — подпись встаёт сразу за ним.
        style={notch?.side === 'left' ? { left: `${notch.w + 2}mm` } : undefined}
      >
        Решение
      </span>
      <SolutionFill fill={solutionFill} heightMm={heightMm} widthMm={solutionWidthMm} notch={notch} />
      {notch && <NotchFrame notch={notch} />}
    </div>
  );

  // Рисунок идёт в разметке ПЕРВЫМ: float обтекает только то, что после него.
  const statement = aside ? (
    <div className={`ps-task-text ps-task-text--side ps-task-text--side-${placement}${notch ? ' ps-task-text--wrapfill' : ''}`}>
      <div ref={asideRef} className={`ps-task-aside ps-task-aside--${aside.kind === 'drawing' ? 'drawing' : 'image'}${asideFits ? ' ps-task-aside--fit' : ''}`}>
        {aside.kind === 'external'
          ? <img src={imageUrl} alt="" />
          : (
            <DrawingPrintContext.Provider value={sidePlace}>
              <MathRenderer text={aside.md} />
            </DrawingPrintContext.Provider>
          )}
      </div>
      <div ref={sideTextRef} className="ps-task-side-text">
        <DrawingPrintContext.Provider value={belowPlace}>
          <MathRenderer text={side.text} />
        </DrawingPrintContext.Provider>
        {code}
      </div>
      {notch && solutionZone(solutionMm + wrapMm)}
    </div>
  ) : (
    <div className="ps-task-text">
      <DrawingPrintContext.Provider value={belowPlace}>
        <MathRenderer text={text} />
      </DrawingPrintContext.Provider>
      {imageUrl && (
        <div className="ps-task-image">
          <img src={imageUrl} alt="" />
        </div>
      )}
      {code}
    </div>
  );

  // Готовый ответ под условием и пустое поле для ответа — взаимоисключающие
  // (showBox — выше, от него зависит ширина полосы условия).

  const className = [
    'ps-task',
    editing ? 'ps-task--draggable' : '',
    dragging ? 'ps-task--dragging' : '',
    dragOver ? 'ps-task--dragover' : '',
  ].filter(Boolean).join(' ');

  // Личный размер чертежа задачи перебивает общий по листу (переменные листа
  // ставит PrintSheet на .ps-root).
  const figVars = task.kimImageSize ? figureSizeVars(task.kimImageSize) : undefined;

  return (
    <article
      className={className}
      style={figVars}
      draggable={!!dnd}
      onDragStart={dnd ? (e => dnd.handleDragStart(e, vi, taskIndex)) : undefined}
      onDragOver={dnd ? (e => dnd.handleDragOver(e, vi, taskIndex)) : undefined}
      onDragLeave={dnd ? dnd.handleDragLeave : undefined}
      onDrop={dnd ? (e => dnd.handleDrop(e, vi, taskIndex)) : undefined}
      onDragEnd={dnd ? dnd.handleDragEnd : undefined}
    >
      <div className={numberLabel ? 'ps-task-num ps-task-num--label' : 'ps-task-num'}>
        {numberLabel || number}
      </div>

      <div className="ps-task-main">
        {showBox ? (
          <div className="ps-task-row">
            {statement}
            <div className="ps-answer-box" />
          </div>
        ) : statement}

        {showAnswersInline && task.answer && (
          <div className="ps-task-answer">
            <span className="ps-task-answer-label">Ответ:</span>
            <MathRenderer text={task.answer} />
          </div>
        )}

        {solutionMm > 0 && !notch && solutionZone(solutionMm)}

        {answerStyle === 'line' && !showAnswersInline && (
          <div className="ps-answer">
            <span className="ps-answer-label">Ответ:</span>
            <span className="ps-answer-rule" />
          </div>
        )}
      </div>

      {editing && (
        <div className="ps-task-controls no-print">
          {dnd && <HolderOutlined className="ps-task-grip" />}
          {editing.onSetFigureSize && hasFigure(task) && (
            <Tooltip title="Размер чертежа этой задачи (общий для листа — в «Оформлении»)">
              <Segmented
                size="small"
                options={KIM_IMAGE_SIZE_OPTIONS}
                value={task.kimImageSize || options.figureSize || 'm'}
                onChange={(val) => editing.onSetFigureSize(vi, taskIndex, val)}
              />
            </Tooltip>
          )}
          {editing.onSetFigurePlacement && side?.figure && (
            <Tooltip title="Где чертёж этой задачи: слева, под условием или справа (общий режим — в «Оформлении»)">
              <Segmented
                size="small"
                options={PLACEMENT_OPTIONS}
                value={placement}
                onChange={(val) => editing.onSetFigurePlacement(vi, taskIndex, val)}
              />
            </Tooltip>
          )}
          {editing.onEditTask && (
            <Tooltip title="Редактировать задачу">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => editing.onEditTask(task)}
              />
            </Tooltip>
          )}
          {editing.onReplaceTask && (
            <Tooltip title="Заменить задачу">
              <Button
                type="text"
                size="small"
                icon={<SwapOutlined />}
                onClick={() => editing.onReplaceTask(vi, taskIndex, task)}
              />
            </Tooltip>
          )}
        </div>
      )}
    </article>
  );
}
