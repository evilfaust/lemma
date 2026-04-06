import { useState, useCallback } from 'react';
import { Button, Tooltip, Tag } from 'antd';
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';

/**
 * Очки за задачу:
 *  решена с 0 неудачных попыток  → +3
 *  решена с 1 неудачной попыткой → +2
 *  решена с 2 неудачными попытками → +1
 *  3 неудачные попытки (задача провалена) → 0
 */
function calcTaskScore(data) {
  if (!data || (!data.solved && !data.failed)) return 0;
  if (data.failed) return 0;
  if (data.solved) {
    const a = data.attempts || 0;
    if (a === 0) return 3;
    if (a === 1) return 2;
    return 1;
  }
  return 0;
}

function calcTotalScore(name, trackingData) {
  const data = trackingData[name] || {};
  return Object.values(data).reduce((sum, v) => sum + calcTaskScore(v), 0);
}

const SCORE_STYLE = {
  3: { color: '#52c41a', label: '+3' },
  2: { color: '#1890ff', label: '+2' },
  1: { color: '#faad14', label: '+1' },
  0: { color: '#999',    label: '0'  },
};

function TaskCell({ data, onSuccess, onFail, onReset }) {
  const attempts = data?.attempts || 0;

  if (data?.solved) {
    const score = calcTaskScore(data);
    const s = SCORE_STYLE[score] || SCORE_STYLE[0];
    return (
      <div className="mt-cell mt-cell--solved">
        <span style={{ fontWeight: 700, fontSize: 13, color: s.color }}>{s.label}</span>
        <Tooltip title="Сбросить">
          <button className="mt-cell__reset-btn" onClick={onReset}>↺</button>
        </Tooltip>
      </div>
    );
  }

  if (data?.failed) {
    return (
      <div className="mt-cell mt-cell--failed">
        <span style={{ fontWeight: 700, fontSize: 13, color: '#999' }}>0</span>
        <Tooltip title="Сбросить">
          <button className="mt-cell__reset-btn" onClick={onReset}>↺</button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="mt-cell mt-cell--active">
      {/* Кружки использованных попыток */}
      <div className="mt-cell__dots">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className={`mt-cell__dot ${i < attempts ? 'mt-cell__dot--used' : ''}`}
          />
        ))}
      </div>
      <div className="mt-cell__actions">
        <Tooltip title={`Решено! (+${3 - attempts} очка)`}>
          <button className="mt-cell__btn mt-cell__btn--ok" onClick={onSuccess}>
            <CheckOutlined />
          </button>
        </Tooltip>
        <Tooltip title={attempts < 2 ? `Неудача (попытка ${attempts + 1}/3)` : 'Последняя попытка — три неудачи дают 0 очков'}>
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
      if (onSaveTracking) onSaveTracking(next);
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

  const displayStudents = sortByScore
    ? [...students].sort((a, b) => calcTotalScore(b, trackingData) - calcTotalScore(a, trackingData))
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
          +3 / +2 / +1 за решение с 1, 2, 3-й попытки &nbsp;·&nbsp; −1 за три неудачи
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
              const total = calcTotalScore(student, trackingData);
              const maxScore = tasks.length * 3;
              return (
                <tr key={student} className={rowIdx % 2 === 0 ? 'mt-row--even' : ''}>
                  <td className="mt-td-name">
                    {rowIdx === 0 && sortByScore && total > 0 && (
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
                    <Tag color={total >= maxScore * 0.8 ? 'green' : total > 0 ? 'blue' : total < 0 ? 'red' : 'default'}>
                      {total > 0 ? `+${total}` : total}
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
        <span className="mt-legend__item" style={{ color: '#52c41a' }}>+3 — с первой попытки</span>
        <span className="mt-legend__item" style={{ color: '#1890ff' }}>+2 — со второй попытки</span>
        <span className="mt-legend__item" style={{ color: '#faad14' }}>+1 — с третьей попытки</span>
        <span className="mt-legend__item" style={{ color: '#999' }}>0 — три неудачи</span>
      </div>
    </div>
  );
}
