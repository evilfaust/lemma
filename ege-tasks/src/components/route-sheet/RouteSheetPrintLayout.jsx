import { forwardRef } from 'react';
import MathRenderer from '../../shared/components/MathRenderer';
import { circleNum } from '../../hooks/useRouteSheet';
import './RouteSheetPrintLayout.css';

/**
 * Печатный макет маршрутного листа.
 *
 * mode="student" — бланк ученика (пустые поля для ответов)
 * mode="teacher" — ключ учителя (подставлены реальные ответы)
 */
const RouteSheetPrintLayout = forwardRef(function RouteSheetPrintLayout(
  { title, tasks, effectiveLinks, mode = 'student' },
  ref
) {
  // Строим индекс: toIndex → fromIndex (откуда приходит ответ)
  const linkMap = {}; // toIndex → fromIndex
  for (const link of effectiveLinks) {
    linkMap[link.toIndex] = link.fromIndex;
  }

  // Замена плейсхолдеров [①], [②] и т.п. на реальные ответы (режим учителя)
  const renderStatement = (statement, taskIndex) => {
    if (!statement) return null;
    if (mode === 'teacher') {
      // Заменяем [①]…[⑳] на реальные ответы задач
      let result = statement;
      tasks.forEach((t, i) => {
        const placeholder = `[${circleNum(i)}]`;
        result = result.replaceAll(placeholder, t.answer || `[${circleNum(i)}]`);
      });
      return <MathRenderer content={result} />;
    }
    return <MathRenderer content={statement} />;
  };

  return (
    <div ref={ref} className="route-sheet-print-root">
      <div className="route-sheet-title">{title}</div>

      <div className="route-sheet-tasks">
        {tasks.map((task, idx) => {
          const fromIdx = linkMap[idx]; // откуда пришёл ответ на эту задачу
          const isFirst = idx === 0;
          const hasIncoming = fromIdx !== undefined;

          return (
            <div key={task.id} className="route-sheet-task-block">
              {/* Стрелка-соединитель (кроме первой задачи) */}
              {!isFirst && (
                <div className="route-sheet-connector">
                  <div className="route-sheet-connector-line" />
                  <div className="route-sheet-connector-arrow">▼</div>
                  {hasIncoming && (
                    <div className="route-sheet-connector-hint">
                      {mode === 'teacher'
                        ? `используй ответ ${circleNum(fromIdx)}: ${tasks[fromIdx]?.answer || '?'}`
                        : `используй ответ ${circleNum(fromIdx)}`}
                    </div>
                  )}
                </div>
              )}

              {/* Карточка задачи */}
              <div className={`route-sheet-task-card ${mode === 'teacher' ? 'route-sheet-task-card--teacher' : ''}`}>
                <div className="route-sheet-task-header">
                  <span className="route-sheet-task-num">{circleNum(idx)}</span>
                  {task.code && (
                    <span className="route-sheet-task-code">{task.code}</span>
                  )}
                </div>

                <div className="route-sheet-task-statement">
                  {renderStatement(task.statement_md, idx)}
                </div>

                {/* Поле ответа */}
                <div className="route-sheet-answer-row">
                  <span className="route-sheet-answer-label">Ответ:</span>
                  {mode === 'teacher' ? (
                    <span className="route-sheet-answer-value">{task.answer || '—'}</span>
                  ) : (
                    <span className="route-sheet-answer-blank" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {mode === 'teacher' && (
        <div className="route-sheet-teacher-badge">КЛЮЧ УЧИТЕЛЯ</div>
      )}
    </div>
  );
});

export default RouteSheetPrintLayout;
