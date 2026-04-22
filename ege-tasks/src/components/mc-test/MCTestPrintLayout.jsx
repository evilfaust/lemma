import React from 'react';
import MathRenderer from '../MathRenderer';
import { shuffleOptionsWithSeed, hashStringToSeed } from '../../utils/distractorGenerator';
import { PB_BASE_URL } from '../../shared/services/pocketbaseUrl';
import './MCTestPrintLayout.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function getOrderedOptions(options, shuffleMode, seed) {
  if (shuffleMode === 'fixed') return options;
  return shuffleOptionsWithSeed(options, seed);
}

function TaskBlock({ task, taskRecord, taskIndex, shuffleMode, seedBase }) {
  const seed = hashStringToSeed(`${seedBase}-${taskIndex}-${task.task_id}`);
  const ordered = getOrderedOptions(task.options, shuffleMode, seed);
  const stmt = taskRecord?.statement_md || '_(задача не найдена)_';
  const imgUrl = taskRecord?.image_url
    || (taskRecord?.image ? `${PB_BASE_URL}/api/files/tasks/${taskRecord.id}/${taskRecord.image}` : null);

  return (
    <div className="mct-task">
      <div className="mct-task-head">
        <span className="mct-task-num">{taskIndex + 1}.</span>
        <div className="mct-task-stmt">
          <MathRenderer text={stmt} />
          {imgUrl && <img src={imgUrl} alt="" className="mct-task-img" />}
        </div>
      </div>
      <div className="mct-options">
        {ordered.map((opt, idx) => (
          <div key={idx} className="mct-option">
            <span className="mct-option-letter">{LETTERS[idx]})</span>
            <span className="mct-option-text">
              <MathRenderer text={opt.text || ''} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentPage({ variant, variantNumber, title, tasksMap, shuffleMode, seedBase }) {
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
        {variant.tasks.map((task, ti) => (
          <TaskBlock
            key={ti}
            task={task}
            taskRecord={tasksMap[task.task_id]}
            taskIndex={ti}
            shuffleMode={shuffleMode}
            seedBase={seedBase || `v${variantNumber}`}
          />
        ))}
      </div>

      <div className="mct-answer-grid">
        <div className="mct-answer-grid-title">Ответы:</div>
        <table className="mct-answer-table">
          <thead>
            <tr>
              <th>№</th>
              {variant.tasks.map((_, ti) => <th key={ti}>{ti + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Ответ</td>
              {variant.tasks.map((_, ti) => <td key={ti} className="mct-answer-cell" />)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeacherKeyPage({ variants, title, tasksMap, shuffleMode, seedBase }) {
  return (
    <div className="mct-page mct-key-page">
      <div className="mct-key-header">{title} — Ответы (для учителя)</div>
      <div className="mct-key-grid">
        {variants.map((variant, vi) => (
          <div key={vi} className="mct-key-variant">
            <div className="mct-key-variant-title">Вариант {variant.number}</div>
            {variant.tasks.map((task, ti) => {
              const seed = hashStringToSeed(`${seedBase || `v${variant.number}`}-${ti}-${task.task_id}`);
              const ordered = getOrderedOptions(task.options, shuffleMode, seed);
              const correctIdx = ordered.findIndex(o => o.is_correct);
              const correctLetter = correctIdx >= 0 ? LETTERS[correctIdx] : '?';
              const correctText = ordered[correctIdx]?.text || '';
              return (
                <div key={ti} className="mct-key-row">
                  <span className="mct-key-label">{ti + 1})</span>
                  <span className="mct-key-letter">{correctLetter}</span>
                  <span className="mct-key-ans">
                    <MathRenderer text={correctText} />
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

export default function MCTestPrintLayout({
  variants,
  tasksMap,
  title,
  shuffleMode = 'fixed',
  showTeacherKey = true,
  seedBase = '',
}) {
  if (!variants || !variants.length) return null;

  return (
    <div className="mct-print-root">
      {variants.map((variant, vi) => (
        <StudentPage
          key={vi}
          variant={variant}
          variantNumber={variant.number}
          title={title}
          tasksMap={tasksMap}
          shuffleMode={shuffleMode}
          seedBase={seedBase}
        />
      ))}
      {showTeacherKey && (
        <TeacherKeyPage
          variants={variants}
          title={title}
          tasksMap={tasksMap}
          shuffleMode={shuffleMode}
          seedBase={seedBase}
        />
      )}
    </div>
  );
}
