import { useState, useCallback } from 'react';
import { Button, Tooltip, Badge, Tag } from 'antd';
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';

const CELL_STATES = {
  EMPTY: 'empty',
  ATTEMPT_1: 'attempt_1',
  ATTEMPT_2: 'attempt_2',
  ATTEMPT_3: 'attempt_3',
  SOLVED: 'solved',
  FAILED: 'failed',
};

function getCellState(data) {
  if (!data || data.attempts === 0 && !data.solved && !data.failed) return CELL_STATES.EMPTY;
  if (data.solved) return CELL_STATES.SOLVED;
  if (data.failed) return CELL_STATES.FAILED;
  if (data.attempts === 1) return CELL_STATES.ATTEMPT_1;
  if (data.attempts === 2) return CELL_STATES.ATTEMPT_2;
  return CELL_STATES.EMPTY;
}

function TaskCell({ data, onSuccess, onFail, onReset }) {
  const state = getCellState(data);

  const attempts = data?.attempts || 0;
  const attemptsLeft = 3 - attempts;

  if (state === CELL_STATES.SOLVED) {
    return (
      <div className="mt-cell mt-cell--solved">
        <CheckOutlined style={{ color: '#52c41a', fontSize: 16 }} />
        <Tooltip title="Сбросить">
          <button className="mt-cell__reset-btn" onClick={onReset}>↺</button>
        </Tooltip>
      </div>
    );
  }

  if (state === CELL_STATES.FAILED) {
    return (
      <div className="mt-cell mt-cell--failed">
        <span style={{ fontSize: 11, color: '#ff4d4f' }}>✗✗✗</span>
        <Tooltip title="Сбросить">
          <button className="mt-cell__reset-btn" onClick={onReset}>↺</button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="mt-cell mt-cell--active">
      {/* Кружки попыток */}
      <div className="mt-cell__dots">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className={`mt-cell__dot ${i < attempts ? 'mt-cell__dot--used' : ''}`}
          />
        ))}
      </div>
      {/* Кнопки */}
      <div className="mt-cell__actions">
        <Tooltip title="Засчитать решение">
          <button className="mt-cell__btn mt-cell__btn--ok" onClick={onSuccess}>
            <CheckOutlined />
          </button>
        </Tooltip>
        <Tooltip title={attemptsLeft > 0 ? `Попытка ${attempts + 1} из 3` : 'Задача провалена'}>
          <button
            className="mt-cell__btn mt-cell__btn--fail"
            onClick={onFail}
            disabled={attempts >= 3}
          >
            <CloseOutlined />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

export default function MarathonTracker({
  tasks,
  students,
  trackingData,
  setTrackingData,
  onSaveTracking,
}) {
  const [sortByScore, setSortByScore] = useState(true);

  const handleAttempt = useCallback((studentName, taskIdx, success) => {
    setTrackingData(prev => {
      const next = { ...prev };
      const studentData = { ...(next[studentName] || {}) };
      const key = String(taskIdx);
      const current = studentData[key] || { attempts: 0, solved: false, failed: false };

      if (current.solved || current.failed) return prev;

      let updated;
      if (success) {
        updated = { ...current, solved: true };
      } else {
        const newAttempts = current.attempts + 1;
        updated = { ...current, attempts: newAttempts, failed: newAttempts >= 3 };
      }

      studentData[key] = updated;
      next[studentName] = studentData;

      // Автосохранение
      if (onSaveTracking) {
        onSaveTracking(next);
      }

      return next;
    });
  }, [setTrackingData, onSaveTracking]);

  const handleReset = useCallback((studentName, taskIdx) => {
    setTrackingData(prev => {
      const next = { ...prev };
      const studentData = { ...(next[studentName] || {}) };
      studentData[String(taskIdx)] = { attempts: 0, solved: false, failed: false };
      next[studentName] = studentData;
      if (onSaveTracking) onSaveTracking(next);
      return next;
    });
  }, [setTrackingData, onSaveTracking]);

  const countSolved = (name) => {
    const data = trackingData[name] || {};
    return Object.values(data).filter(v => v.solved).length;
  };

  const displayStudents = sortByScore
    ? [...students].sort((a, b) => countSolved(b) - countSolved(a))
    : students;

  if (!students.length || !tasks.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
        Добавьте учеников и задачи в разделе «Настройка»
      </div>
    );
  }

  return (
    <div className="marathon-tracker">
      <div className="marathon-tracker__toolbar">
        <Button
          size="small"
          type={sortByScore ? 'primary' : 'default'}
          onClick={() => setSortByScore(s => !s)}
          icon={<ReloadOutlined />}
        >
          {sortByScore ? 'Сортировка по счёту' : 'Порядок списка'}
        </Button>
        <span style={{ color: '#999', fontSize: 12 }}>
          Нажмите ✓ — задача решена, ✗ — попытка провалена (макс. 3 попытки)
        </span>
      </div>

      <div className="marathon-tracker__scroll">
        <table className="marathon-tracker__table">
          <thead>
            <tr>
              <th className="mt-th-name">Ученик</th>
              {tasks.map((_, idx) => (
                <th key={idx} className="mt-th-task">{idx + 1}</th>
              ))}
              <th className="mt-th-score">Счёт</th>
            </tr>
          </thead>
          <tbody>
            {displayStudents.map((student, rowIdx) => {
              const solved = countSolved(student);
              return (
                <tr key={student} className={rowIdx % 2 === 0 ? 'mt-row--even' : ''}>
                  <td className="mt-td-name">
                    {rowIdx === 0 && sortByScore && (
                      <span className="mt-leader-badge">🥇</span>
                    )}
                    {student}
                  </td>
                  {tasks.map((_, taskIdx) => {
                    const data = (trackingData[student] || {})[String(taskIdx)];
                    return (
                      <td key={taskIdx} className="mt-td-task">
                        <TaskCell
                          data={data}
                          onSuccess={() => handleAttempt(student, taskIdx, true)}
                          onFail={() => handleAttempt(student, taskIdx, false)}
                          onReset={() => handleReset(student, taskIdx)}
                        />
                      </td>
                    );
                  })}
                  <td className="mt-td-score">
                    <Tag color={solved >= tasks.length * 0.8 ? 'green' : solved > 0 ? 'blue' : 'default'}>
                      {solved} / {tasks.length}
                    </Tag>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Легенда */}
      <div className="marathon-tracker__legend">
        <span className="mt-legend__item">
          <span className="mt-cell__dot mt-cell__dot--used" /> — попытка провалена
        </span>
        <span className="mt-legend__item">
          <CheckOutlined style={{ color: '#52c41a' }} /> — решено
        </span>
        <span className="mt-legend__item">
          <span style={{ color: '#ff4d4f' }}>✗✗✗</span> — исчерпаны все попытки
        </span>
      </div>
    </div>
  );
}
