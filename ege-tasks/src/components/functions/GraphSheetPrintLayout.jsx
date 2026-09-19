import React from 'react';
import CoordPlotSVG from '../shared/CoordPlotSVG';
import MathText from '../shared/MathText';
import { sheetOptions, sheetSpacingStyle, keyAnswerLatex } from '../trig/sheetOptions';
import { MathInline } from '../shared/MathInline';
import { CATEGORY_LABELS_GRAPH, MATCH_LETTERS } from '../../utils/derivativeGraphTasks';
import './graphSheet.css';

// Печатный лист заданий «по графику»: у задания не формула, а чертёж, поэтому
// своя раскладка — карточка «номер + условие + график + строка ответа».
// Оформление общее с движком `print-sheet`: только чёрная краска, иерархия
// кеглем и толщиной линеек (серые линии на ч/б принтере пропадают).
//
// Пагинации по измерению здесь нет: задание не рвётся (`break-inside: avoid`),
// а вариант, который не поместился, продолжается на следующем листе.

const FIGURE_WIDTH = { s: 220, m: 280, l: 340 };

// Задание на соответствие: слева точки (А, Б, В, Г), справа значения (1–4).
// Ответ — четыре цифры, поэтому вместо линии ставим клетки под буквами.
function MatchLists({ matching }) {
  return (
    <div className="gsp-match">
      <div className="gsp-match-col">
        <div className="gsp-match-head">ТОЧКИ</div>
        {matching.points.map((p, i) => (
          <div key={p} className="gsp-match-row">{MATCH_LETTERS[i]}) {p}</div>
        ))}
      </div>
      <div className="gsp-match-col">
        <div className="gsp-match-head">ЗНАЧЕНИЯ ПРОИЗВОДНОЙ</div>
        {matching.values.map((v, i) => (
          <div key={i} className="gsp-match-row">
            {i + 1}) <MathInline latex={v} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchAnswer({ matching }) {
  return (
    <div className="gsp-answer gsp-answer--cells">
      <span>Ответ:</span>
      <span className="gsp-cells">
        {matching.points.map((p, i) => (
          <span key={p} className="gsp-cell-box">
            <span className="gsp-cell-letter">{MATCH_LETTERS[i]}</span>
            <span className="gsp-cell" />
          </span>
        ))}
      </span>
    </div>
  );
}

function TaskCard({ task, no, opts, figureSize }) {
  return (
    <div className="gsp-task">
      <div className="gsp-task-head">
        <span className="gsp-num">{no}</span>
        <span className="gsp-question"><MathText text={task.question} /></span>
      </div>
      {task.matching && <MatchLists matching={task.matching} />}
      <div className="gsp-figure">
        <CoordPlotSVG spec={task.plot} width={FIGURE_WIDTH[figureSize] || FIGURE_WIDTH.m} />
      </div>
      {task.note && <div className="gsp-note"><MathText text={task.note} /></div>}
      {opts.showAnswerSpace && (task.matching
        ? <MatchAnswer matching={task.matching} />
        : <div className="gsp-answer">Ответ: <span className="gsp-answer-line" /></div>
      )}
    </div>
  );
}

/** Порядок заданий на листе: план `layout` с чертами, нумерация — по заданиям. */
function orderedTasks(variant, layout) {
  if (!layout || !layout.length) return variant.map((task, i) => ({ kind: 'task', task, no: i + 1 }));
  const out = [];
  let n = 0;
  layout.forEach((item, i) => {
    if (item.kind === 'divider') { out.push({ kind: 'divider', key: `d${i}` }); return; }
    const task = variant[item.idx];
    if (task) out.push({ kind: 'task', task, no: ++n });
  });
  return out;
}

function StudentPage({
  variant, variantIndex, variantsTotal, title, opts, layout, columnsCount, figureSize, instruction,
}) {
  return (
    <div className="gsp-page">
      {opts.showHeader && (
        <div className="gsp-head">
          <div className="gsp-head-row">
            {variantsTotal > 1 && <span className="gsp-variant">Вариант {variantIndex + 1}</span>}
            <span className="gsp-field">Фамилия, имя: <span className="gsp-line gsp-line--name" /></span>
          </div>
          <div className="gsp-head-row gsp-head-row--thin">
            {opts.showClassField && <span className="gsp-field">Класс: <span className="gsp-line gsp-line--short" /></span>}
            <span className="gsp-field">Дата: <span className="gsp-line gsp-line--short" /></span>
          </div>
        </div>
      )}
      {opts.showTitle && title && <div className="gsp-title">{title}</div>}
      {opts.showInstruction && instruction && <div className="gsp-instruction">{instruction}</div>}

      <div className={`gsp-grid gsp-grid--${columnsCount === 1 ? '1col' : '2col'}`}>
        {orderedTasks(variant, layout).map((item, i) => (item.kind === 'divider'
          ? <div key={item.key} className="gsp-divider" />
          : (
            <TaskCard
              key={`t${i}`}
              task={item.task}
              no={item.no}
              opts={opts}
              figureSize={figureSize}
            />
          )))}
      </div>
    </div>
  );
}

/** Ключ учителя: тот же порядок, что на листе ученика, но без чертежей. */
function TeacherKeyPage({ tasksData, title, layout, opts }) {
  return (
    <div className="gsp-key-page">
      <div className="gsp-key-title">{title} — ответы (лист учителя)</div>
      <div className="gsp-key-variants">
        {tasksData.map((variant, vi) => (
          <div key={vi} className="gsp-key-variant">
            <div className="gsp-key-variant-title">Вариант {vi + 1}</div>
            <div className="gsp-key-grid">
              {orderedTasks(variant, layout).filter((it) => it.kind === 'task').map((it) => (
                <div key={it.no} className="gsp-key-row">
                  <span className="gsp-key-num">{it.no}</span>
                  <span className="gsp-key-ans">
                    <MathInline latex={keyAnswerLatex(it.task.resultLatex, opts)} />
                  </span>
                  {/* Тип задания: по одному числу не понять, что спрашивали */}
                  <span className="gsp-key-cat">{CATEGORY_LABELS_GRAPH[it.task.cat] || ''}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GraphSheetPrintLayout({
  tasksData, settings = {}, title, layout, instruction, screenMode = false,
}) {
  if (!tasksData) return null;
  const opts = sheetOptions(settings);
  const { columnsCount = 2, figureSize = 'm', showTeacherKey } = settings;

  const inner = (
    <>
      {tasksData.map((variant, vi) => (
        <StudentPage
          key={vi}
          variant={variant}
          variantIndex={vi}
          variantsTotal={tasksData.length}
          title={title}
          opts={opts}
          layout={layout}
          columnsCount={columnsCount}
          figureSize={figureSize}
          instruction={instruction}
        />
      ))}
      {showTeacherKey && (
        <TeacherKeyPage tasksData={tasksData} title={title} layout={layout} opts={opts} />
      )}
    </>
  );

  return (
    <div
      className={screenMode ? 'gsp-screen-root' : 'gsp-print-root'}
      style={sheetSpacingStyle(opts.lineSpacing)}
    >
      {inner}
    </div>
  );
}
