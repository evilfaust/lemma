import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Spin } from 'antd';
import { LoadingOutlined, RightOutlined, DownOutlined, ArrowLeftOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import MathRenderer from '../MathRenderer';

// ==========================================
// SVG Line Chart (чистый SVG, без библиотек)
// ==========================================
const ScoreChart = ({ data }) => {
  if (data.length < 2) return null;

  const W = 600, H = 220;
  const PAD = { top: 20, right: 20, bottom: 40, left: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const points = data.map((d, i) => ({
    x: PAD.left + (i / (data.length - 1)) * plotW,
    y: PAD.top + plotH - (d.percent / 100) * plotH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD.top + plotH} L${points[0].x},${PAD.top + plotH} Z`;

  // Прореживание дат: показываем макс 7 меток
  const maxLabels = 7;
  const step = data.length > maxLabels ? Math.ceil(data.length / maxLabels) : 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sp-chart" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="spChartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4361ee" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#4361ee" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Горизонтальные линии сетки */}
      {[0, 25, 50, 75, 100].map(v => {
        const y = PAD.top + plotH - (v / 100) * plotH;
        return (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e8e8e8" strokeDasharray="4,4" />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#8c8c8c" fontFamily="Inter, sans-serif">{v}%</text>
          </g>
        );
      })}

      {/* Заливка под линией */}
      <path d={areaPath} fill="url(#spChartGrad)" />

      {/* Линия */}
      <path d={linePath} fill="none" stroke="#4361ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Точки */}
      {points.map((p, i) => {
        const color = p.percent >= 70 ? '#52c41a' : p.percent >= 40 ? '#faad14' : '#ff4d4f';
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#fff" stroke={color} strokeWidth="2.5" />
            {/* Значение над точкой при наведении (показываем для всех при малом кол-ве) */}
            {data.length <= 10 && (
              <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fill="#333" fontWeight="600" fontFamily="Inter, sans-serif">
                {p.percent}%
              </text>
            )}
          </g>
        );
      })}

      {/* Даты по оси X */}
      {points.map((p, i) => {
        if (i % step !== 0 && i !== data.length - 1) return null;
        const dateStr = p.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        return (
          <text key={`d${i}`} x={p.x} y={H - 8} textAnchor="middle" fontSize="10" fill="#8c8c8c" fontFamily="Inter, sans-serif">
            {dateStr}
          </text>
        );
      })}
    </svg>
  );
};

// ==========================================
// Горизонтальный bar для темы
// ==========================================
const TopicBar = ({ title, percent, correct, total }) => {
  const level = percent >= 70 ? 'good' : percent >= 40 ? 'ok' : 'bad';
  return (
    <div className="sp-topic-row">
      <div className="sp-topic-name" title={title}>{title}</div>
      <div className="sp-topic-bar-wrap">
        <div className={`sp-topic-bar sp-topic-bar--${level}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="sp-topic-info">
        <span className={`sp-topic-pct sp-topic-pct--${level}`}>{percent}%</span>
        <span className="sp-topic-count">{correct}/{total}</span>
      </div>
    </div>
  );
};

// ==========================================
// Форматирование времени
// ==========================================
const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} сек`;
  return `${m} мин`;
};

const formatDurationShort = (seconds) => {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  return m > 0 ? `${m} мин` : '<1 мин';
};

// ==========================================
// Детальный просмотр одной попытки
// ==========================================
const AttemptDetailView = ({ attempt, answers, loading, onBack }) => {
  const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
  const scoreClass = pct >= 70 ? 'good' : pct >= 40 ? 'ok' : 'bad';
  const workTitle = attempt.expand?.session?.expand?.work?.title || 'Тест';
  const date = new Date(attempt.submitted_at || attempt.created);
  const correctCount = answers.filter(a => a.is_correct).length;
  const wrongCount = answers.filter(a => !a.is_correct).length;

  return (
    <div className="student-progress" style={{ animation: 'studentFadeInUp 0.3s ease-out' }}>
      {/* Шапка */}
      <div className="sp-detail-header">
        <button className="sp-back-btn" onClick={onBack}>
          <ArrowLeftOutlined /> Назад
        </button>
        <div className="sp-detail-info">
          <h2 className="sp-detail-title">{workTitle}</h2>
          <p className="sp-detail-meta">
            {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            {attempt.duration_seconds > 0 && ` · ${formatDuration(attempt.duration_seconds)}`}
          </p>
        </div>
        <div className={`sp-detail-score sp-detail-score--${scoreClass}`}>
          <span className="sp-detail-score-pct">{pct}%</span>
          <span className="sp-detail-score-raw">{attempt.score}/{attempt.total}</span>
        </div>
      </div>

      {/* Мини-сводка */}
      {!loading && answers.length > 0 && (
        <div className="sp-detail-summary">
          <div className="sp-detail-summary-item sp-detail-summary-item--correct">
            <CheckOutlined />
            <span>{correctCount} верно</span>
          </div>
          <div className="sp-detail-summary-sep" />
          <div className="sp-detail-summary-item sp-detail-summary-item--wrong">
            <CloseOutlined />
            <span>{wrongCount} ошибок</span>
          </div>
        </div>
      )}

      {/* Список ответов */}
      {loading ? (
        <div className="sp-loading">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 28, color: '#4361ee' }} spin />} />
          <p className="sp-loading-text">Загрузка ответов...</p>
        </div>
      ) : answers.length === 0 ? (
        <div className="sp-empty">
          <div className="sp-empty-icon">📭</div>
          <p className="sp-empty-text">Ответы не найдены</p>
        </div>
      ) : (
        <div className="sp-answers-list">
          {answers.map((answer, idx) => {
            const task = answer.expand?.task;
            return (
              <div
                key={answer.id}
                className={`sp-answer-item sp-answer-item--${answer.is_correct ? 'correct' : 'wrong'}`}
                style={{ animationDelay: `${Math.min(idx * 0.04, 0.4)}s` }}
              >
                <div className="sp-answer-num">
                  <span className={`sp-answer-badge sp-answer-badge--${answer.is_correct ? 'correct' : 'wrong'}`}>
                    {idx + 1}
                  </span>
                </div>
                <div className="sp-answer-body">
                  {task?.statement_md ? (
                    <div className="sp-answer-statement">
                      <MathRenderer content={task.statement_md} />
                    </div>
                  ) : (
                    <div className="sp-answer-statement sp-answer-statement--empty">
                      Задача #{task?.code || (idx + 1)}
                    </div>
                  )}
                  <div className="sp-answer-responses">
                    <span className={`sp-answer-user-answer sp-answer-user-answer--${answer.is_correct ? 'correct' : 'wrong'}`}>
                      {answer.is_correct ? <CheckOutlined /> : <CloseOutlined />}
                      {' '}Ваш ответ: <strong>{answer.answer_raw || '—'}</strong>
                    </span>
                    {!answer.is_correct && task?.answer && (
                      <span className="sp-answer-correct-answer">
                        Правильно: <strong>{task.answer}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================
function StudentProgressPage({ studentSession }) {
  const [loading, setLoading] = useState(true);
  const [allAttempts, setAllAttempts] = useState([]);
  const [topicStats, setTopicStats] = useState(null);
  const [topicStatsLoading, setTopicStatsLoading] = useState(false);
  const [topicStatsOpen, setTopicStatsOpen] = useState(false);

  // Детальный просмотр попытки
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [attemptAnswers, setAttemptAnswers] = useState([]);
  const [answersLoading, setAnswersLoading] = useState(false);

  // Загрузка всех попыток при mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const student = api.getAuthStudent();
        const deviceId = localStorage.getItem('ege_device_id');

        let allAtts = [];
        if (student) {
          const [studentAttempts, deviceAttempts] = await Promise.all([
            api.getAttemptsByStudentAllWithWorks(student.id),
            deviceId ? api.getAttemptsByDeviceAllWithWorks(deviceId) : Promise.resolve([]),
          ]);
          // Дедупликация по ID (паттерн из AchievementGallery)
          const byId = new Map();
          [...studentAttempts, ...deviceAttempts].forEach(a => byId.set(a.id, a));
          allAtts = Array.from(byId.values());
        } else if (deviceId) {
          allAtts = await api.getAttemptsByDeviceAllWithWorks(deviceId);
        }

        // Только завершённые попытки
        allAtts = allAtts.filter(a => a.status === 'submitted' || a.status === 'corrected');
        allAtts.sort((a, b) => new Date(b.created) - new Date(a.created));

        setAllAttempts(allAtts);
      } catch (err) {
        console.error('Error loading progress:', err);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Открыть детальный просмотр попытки
  const openAttemptDetail = useCallback(async (attempt) => {
    setSelectedAttemptId(attempt.id);
    setAttemptAnswers([]);
    setAnswersLoading(true);
    try {
      const answers = await api.getAttemptAnswers(attempt.id);
      setAttemptAnswers(answers);
    } catch (err) {
      console.error('Error loading attempt answers:', err);
      setAttemptAnswers([]);
    }
    setAnswersLoading(false);
  }, []);

  const closeAttemptDetail = useCallback(() => {
    setSelectedAttemptId(null);
    setAttemptAnswers([]);
  }, []);

  // Вычисляем сводную статистику
  const stats = useMemo(() => {
    if (!allAttempts.length) return null;

    const workIds = new Set();
    allAttempts.forEach(a => {
      const workId = a.expand?.session?.work || a.expand?.session?.expand?.work?.id;
      if (workId) workIds.add(typeof workId === 'string' ? workId : workId);
    });

    const totalScore = allAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
    const totalTasks = allAttempts.reduce((sum, a) => sum + (a.total || 0), 0);
    const avgPercent = totalTasks > 0 ? Math.round((totalScore / totalTasks) * 100) : 0;

    const bestPercent = allAttempts.reduce((best, a) => {
      const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
      return Math.max(best, pct);
    }, 0);

    const withTime = allAttempts.filter(a => a.duration_seconds > 0);
    const avgTime = withTime.length > 0
      ? Math.round(withTime.reduce((s, a) => s + a.duration_seconds, 0) / withTime.length)
      : 0;

    // Текущая серия (streak) — подряд ≥70% с конца
    const sorted = [...allAttempts].sort((a, b) => new Date(a.submitted_at || a.created) - new Date(b.submitted_at || b.created));
    let streak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const pct = sorted[i].total ? (sorted[i].score / sorted[i].total) * 100 : 0;
      if (pct >= 70) streak++;
      else break;
    }

    return {
      totalWorks: workIds.size,
      totalAttempts: allAttempts.length,
      avgPercent,
      bestPercent,
      avgTime,
      streak,
    };
  }, [allAttempts]);

  // Данные для графика (хронологический порядок)
  const chartData = useMemo(() => {
    return allAttempts
      .filter(a => a.total > 0)
      .map(a => ({
        date: new Date(a.submitted_at || a.created),
        percent: Math.round((a.score / a.total) * 100),
        title: a.expand?.session?.expand?.work?.title || 'Тест',
      }))
      .sort((a, b) => a.date - b.date);
  }, [allAttempts]);

  // Ленивая загрузка статистики по темам
  const loadTopicStats = useCallback(async () => {
    if (topicStats !== null || topicStatsLoading) return;
    setTopicStatsLoading(true);
    try {
      const attemptIds = allAttempts.map(a => a.id);
      const allAnswers = await api.getAttemptAnswersByAttempts(attemptIds);

      const byTopic = new Map();
      allAnswers.forEach(answer => {
        const topic = answer.expand?.task?.expand?.topic;
        if (!topic) return;
        if (!byTopic.has(topic.id)) {
          byTopic.set(topic.id, { id: topic.id, title: topic.title, correct: 0, total: 0 });
        }
        const entry = byTopic.get(topic.id);
        entry.total++;
        if (answer.is_correct) entry.correct++;
      });

      const sorted = Array.from(byTopic.values())
        .map(t => ({ ...t, percent: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0 }))
        .sort((a, b) => a.percent - b.percent); // Слабые темы первыми

      setTopicStats(sorted);
    } catch (err) {
      console.error('Error loading topic stats:', err);
      setTopicStats([]);
    }
    setTopicStatsLoading(false);
  }, [allAttempts, topicStats, topicStatsLoading]);

  const handleToggleTopics = useCallback(() => {
    const newOpen = !topicStatsOpen;
    setTopicStatsOpen(newOpen);
    if (newOpen && topicStats === null) {
      loadTopicStats();
    }
  }, [topicStatsOpen, topicStats, loadTopicStats]);

  // ==========================================
  // RENDER
  // ==========================================

  if (loading) {
    return (
      <div className="student-progress">
        <div className="sp-loading">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 32, color: '#4361ee' }} spin />} />
          <p className="sp-loading-text">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (!allAttempts.length) {
    return (
      <div className="student-progress">
        <div className="sp-empty">
          <div className="sp-empty-icon">📊</div>
          <h3 className="sp-empty-title">Пока нет данных</h3>
          <p className="sp-empty-text">Завершите хотя бы один тест, чтобы увидеть свой прогресс</p>
        </div>
      </div>
    );
  }

  // Детальный просмотр попытки
  if (selectedAttemptId) {
    const selectedAttempt = allAttempts.find(a => a.id === selectedAttemptId);
    if (selectedAttempt) {
      return (
        <AttemptDetailView
          attempt={selectedAttempt}
          answers={attemptAnswers}
          loading={answersLoading}
          onBack={closeAttemptDetail}
        />
      );
    }
  }

  return (
    <div className="student-progress">
      {/* Заголовок */}
      <div className="sp-header">
        <h2 className="sp-title">Мой прогресс</h2>
        <p className="sp-subtitle">
          {stats.totalAttempts} {stats.totalAttempts === 1 ? 'попытка' : stats.totalAttempts < 5 ? 'попытки' : 'попыток'} за всё время
        </p>
      </div>

      {/* Серия (streak) */}
      {stats.streak >= 2 && (
        <div className="sp-streak-banner">
          🔥 Серия {stats.streak} {stats.streak < 5 ? 'теста' : 'тестов'} подряд с результатом ≥ 70%!
        </div>
      )}

      {/* Сводка 2x2 */}
      <div className="sp-stats-grid">
        <div className="sp-stat-card">
          <div className="sp-stat-value">{stats.totalWorks}</div>
          <div className="sp-stat-label">Работ</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-value">{stats.avgPercent}%</div>
          <div className="sp-stat-label">Средний балл</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-value sp-stat-value--best">{stats.bestPercent}%</div>
          <div className="sp-stat-label">Лучший результат</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-value">{formatDurationShort(stats.avgTime)}</div>
          <div className="sp-stat-label">Среднее время</div>
        </div>
      </div>

      {/* График динамики */}
      {chartData.length >= 2 && (
        <div className="sp-section">
          <h3 className="sp-section-title">Динамика результатов</h3>
          <div className="sp-chart-wrapper">
            <ScoreChart data={chartData} />
          </div>
        </div>
      )}

      {/* Статистика по темам (ленивая) */}
      {allAttempts.length > 0 && (
        <div className="sp-section">
          <div className="sp-section-header" onClick={handleToggleTopics}>
            <h3 className="sp-section-title sp-section-title--clickable">
              Статистика по темам
            </h3>
            <span className="sp-section-toggle">
              {topicStatsOpen ? <DownOutlined /> : <RightOutlined />}
            </span>
          </div>

          {topicStatsOpen && (
            <div className="sp-topic-content">
              {topicStatsLoading && (
                <div className="sp-loading-small">
                  <Spin size="small" />
                  <span>Загрузка...</span>
                </div>
              )}
              {topicStats && topicStats.length > 0 && (
                <div className="sp-topic-list">
                  {topicStats.map(topic => (
                    <TopicBar
                      key={topic.id}
                      title={topic.title}
                      percent={topic.percent}
                      correct={topic.correct}
                      total={topic.total}
                    />
                  ))}
                </div>
              )}
              {topicStats && topicStats.length === 0 && (
                <p className="sp-topic-empty">Нет данных по темам</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* История попыток */}
      <div className="sp-section">
        <h3 className="sp-section-title">История</h3>
        <p className="sp-history-hint">Нажмите на работу, чтобы увидеть разбор ответов</p>
        <div className="sp-history-list">
          {allAttempts.map((a, idx) => {
            const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
            const scoreClass = pct >= 70 ? 'good' : pct >= 40 ? 'ok' : 'bad';
            const workTitle = a.expand?.session?.expand?.work?.title || 'Тест';
            const date = new Date(a.submitted_at || a.created);
            const duration = a.duration_seconds;

            return (
              <div
                key={a.id}
                className="sp-history-item sp-history-item--clickable"
                style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s` }}
                onClick={() => openAttemptDetail(a)}
              >
                <div className={`sp-history-indicator sp-history-indicator--${scoreClass}`} />
                <div className="sp-history-content">
                  <div className="sp-history-title">{workTitle}</div>
                  <div className="sp-history-meta">
                    {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                    {duration > 0 && ` · ${formatDuration(duration)}`}
                    {' · '}{a.score}/{a.total}
                  </div>
                </div>
                <div className={`sp-history-score sp-history-score--${scoreClass}`}>
                  {pct}%
                </div>
                <div className="sp-history-arrow">
                  <RightOutlined />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default StudentProgressPage;
