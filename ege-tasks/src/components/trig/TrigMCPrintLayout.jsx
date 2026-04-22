import katex from 'katex';
import { shuffleOptionsWithSeed, hashStringToSeed } from '../../utils/distractorGenerator';
import '../mc-test/MCTestPrintLayout.css';
import './TrigMCPrintLayout.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function MathInline({ latex }) {
  if (!latex) return null;
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function getOrderedOptions(options, shuffleMode, seed) {
  if (shuffleMode !== 'per_student') return options;
  return shuffleOptionsWithSeed(options, seed);
}

function TaskBlock({ task, taskIndex, shuffleMode, seedBase }) {
  const seed = hashStringToSeed(`${seedBase}-${taskIndex}-${task.question}`);
  const ordered = getOrderedOptions(task.options || [], shuffleMode, seed);

  return (
    <div className="mct-task">
      <div className="mct-task-head">
        <span className="mct-task-num">{taskIndex + 1}.</span>
        <div className="mct-task-stmt">
          <MathInline latex={task.question} />
        </div>
      </div>
      <div className="mct-options">
        {ordered.map((opt, idx) => (
          <div key={idx} className="mct-option">
            <span className="mct-option-letter">{LETTERS[idx]})</span>
            <span className="mct-option-text">
              <MathInline latex={opt.text || ''} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentPage({ variant, variantNumber, title, shuffleMode }) {
  const seedBase = `v${variantNumber}`;
  return (
    <div className="mct-page">
      <div className="mct-header">
        <span className="mct-variant-badge">Вариант {variantNumber}</span>
        <span className="mct-field">ФИО: <span className="mct-line mct-line--name" /></span>
        <span className="mct-field">Класс: <span className="mct-line mct-line--short" /></span>
        <span className="mct-field">Дата: <span className="mct-line mct-line--short" /></span>
      </div>
      <div className="mct-subtitle">{title}</div>
      <div className="mct-instruction">Выберите один правильный ответ:</div>

      <div className="mct-tasks">
        {(variant.tasks || []).map((task, ti) => (
          <TaskBlock
            key={ti}
            task={task}
            taskIndex={ti}
            shuffleMode={shuffleMode}
            seedBase={seedBase}
          />
        ))}
      </div>

      <div className="mct-answer-grid">
        <div className="mct-answer-grid-title">Ответы:</div>
        <table className="mct-answer-table">
          <thead>
            <tr>
              <th>№</th>
              {(variant.tasks || []).map((_, ti) => <th key={ti}>{ti + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Ответ</td>
              {(variant.tasks || []).map((_, ti) => <td key={ti} className="mct-answer-cell" />)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeacherKeyPage({ variants, title, shuffleMode }) {
  return (
    <div className="mct-page mct-key-page">
      <div className="mct-key-header">{title} — Ответы (для учителя)</div>
      <div className="mct-key-grid">
        {variants.map((variant, vi) => (
          <div key={vi} className="mct-key-variant">
            <div className="mct-key-variant-title">Вариант {variant.number}</div>
            {(variant.tasks || []).map((task, ti) => {
              const seedBase = `v${variant.number}`;
              const seed = hashStringToSeed(`${seedBase}-${ti}-${task.question}`);
              const ordered = getOrderedOptions(task.options || [], shuffleMode, seed);
              const correctIdx = ordered.findIndex(o => o.is_correct);
              const correctLetter = correctIdx >= 0 ? LETTERS[correctIdx] : '?';
              const correctText = ordered[correctIdx]?.text || task.answer || '';
              return (
                <div key={ti} className="mct-key-row">
                  <span className="mct-key-label">{ti + 1})</span>
                  <span className="mct-key-letter">{correctLetter}</span>
                  <span className="mct-key-ans">
                    <MathInline latex={correctText} />
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrigMCPrintLayout({
  variants,
  title,
  shuffleMode = 'fixed',
  showTeacherKey = true,
}) {
  if (!variants || !variants.length) return null;

  return (
    <div className="trig-mc-print-root">
      {variants.map((variant, vi) => (
        <StudentPage
          key={vi}
          variant={variant}
          variantNumber={variant.number}
          title={title}
          shuffleMode={shuffleMode}
        />
      ))}
      {showTeacherKey && (
        <TeacherKeyPage
          variants={variants}
          title={title}
          shuffleMode={shuffleMode}
        />
      )}
    </div>
  );
}
