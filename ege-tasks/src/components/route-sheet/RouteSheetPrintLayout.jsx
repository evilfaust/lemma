import MathRenderer from '../../shared/components/MathRenderer';
import RouteStatementRenderer from './RouteStatementRenderer';
import { circleNum } from '../../hooks/useRouteSheet';
import './RouteSheetPrintLayout.css';

function resolveStatement(statement, allTasks, upToIndex) {
  let result = statement || '';
  for (let i = 0; i < upToIndex; i++) {
    const ph = `[${circleNum(i)}]`;
    result = result.replaceAll(ph, allTasks[i]?.answer || `[${circleNum(i)}]`);
  }
  return result;
}

// ─── Карточка задачи — ученик ─────────────────────────────────────────────────
function StudentCard({ task, index }) {
  return (
    <div className="rs-task">
      <div className="rs-task-content">
        <div className="rs-task-num">{circleNum(index)}</div>
        <div className="rs-task-body">
          <div className="rs-task-stmt">
            <RouteStatementRenderer content={task.statement_md || ''} />
          </div>
          <div className="rs-answer-row">
            <span className="rs-answer-label">Ответ:</span>
            <span className="rs-answer-blank" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Карточка задачи — учитель ────────────────────────────────────────────────
function TeacherCard({ task, index, allTasks }) {
  const resolved = resolveStatement(task.statement_md, allTasks, index);
  return (
    <div className="rs-task rs-task--teacher">
      <div className="rs-task-content">
        <div className="rs-task-num rs-task-num--teacher">{circleNum(index)}</div>
        <div className="rs-task-body">
          <div className="rs-task-stmt">
            <MathRenderer content={resolved} />
          </div>
          <div className="rs-answer-row">
            <span className="rs-answer-label">Ответ:</span>
            <span className="rs-answer-value">{task.answer || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Таблица ответов учителя ──────────────────────────────────────────────────
function AnswerSummary({ tasks }) {
  return (
    <div className="rs-answer-summary">
      {tasks.map((task, idx) => (
        <div key={task.id} className="rs-answer-summary-item">
          <span className="rs-answer-summary-num">{circleNum(idx)}</span>
          <span className="rs-answer-summary-val">{task.answer || '—'}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function RouteSheetPrintLayout({ title, tasks, showTeacherKey }) {
  return (
    <div className="rs-print-root">

      {/* ═══════════ СТРАНИЦА УЧЕНИКА ═══════════ */}
      <div className="rs-page">
        <div className="rs-header">
          <div className="rs-title">{title}</div>
          <div className="rs-info-line">
            <span className="rs-info-field">ФИО: <span className="rs-info-blank rs-info-blank--name" /></span>
            <span className="rs-info-field">Класс: <span className="rs-info-blank rs-info-blank--short" /></span>
            <span className="rs-info-field">Дата: <span className="rs-info-blank rs-info-blank--short" /></span>
          </div>
        </div>

        <p className="rs-instruction">
          Задачи связаны цепочкой: ответ каждой задачи используется в следующей.
          Бледные символы ①②③ в условии — это места для ответов из соответствующих задач.
        </p>

        <div className="rs-chain">
          {tasks.map((task, idx) => (
            <div key={task.id} className={`rs-task-block${idx > 0 ? ' rs-task-block--sep' : ''}`}>
              <StudentCard task={task} index={idx} />
            </div>
          ))}
        </div>

        <div className="rs-footer">© Lemma 2025–2026</div>
      </div>

      {/* ═══════════ СТРАНИЦА КЛЮЧА УЧИТЕЛЯ ═══════════ */}
      {showTeacherKey && (
        <div className="rs-page rs-page--teacher-key">
          <div className="rs-header">
            <div className="rs-title">{title}</div>
            <div className="rs-teacher-badge">КЛЮЧ УЧИТЕЛЯ</div>
          </div>

          <AnswerSummary tasks={tasks} />

          <div className="rs-divider-dashed" />

          <div className="rs-chain">
            {tasks.map((task, idx) => (
              <div key={task.id} className={`rs-task-block${idx > 0 ? ' rs-task-block--sep' : ''}`}>
                <TeacherCard task={task} index={idx} allTasks={tasks} />
              </div>
            ))}
          </div>

          <div className="rs-footer">© Lemma 2025–2026 · Ключ учителя</div>
        </div>
      )}
    </div>
  );
}
