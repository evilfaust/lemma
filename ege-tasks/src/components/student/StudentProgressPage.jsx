import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Spin } from 'antd';
import { LoadingOutlined, RightOutlined, DownOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';

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
// MAIN COMPONENT
// ==========================================
function StudentProgressPage({ studentSession }) {
  const [loading, setLoading] = useState(true);
  const [allAttempts, setAllAttempts] = useState([]);
  const [topicStats, setTopicStats] = useState(null);
  const [topicStatsLoading, setTopicStatsLoading] = useState(false);
  const [topicStatsOpen, setTopicStatsOpen] = useState(false);

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

    return {
      totalWorks: workIds.size,
      totalAttempts: allAttempts.length,
      avgPercent,
      bestPercent,
      avgTime,
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

  return (
    <div className="student-progress">
      {/* Заголовок */}
      <div className="sp-header">
        <h2 className="sp-title">Мой прогресс</h2>
        <p className="sp-subtitle">
          {stats.totalAttempts} {stats.totalAttempts === 1 ? 'попытка' : stats.totalAttempts < 5 ? 'попытки' : 'попыток'} за всё время
        </p>
      </div>

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
                className="sp-history-item"
                style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s` }}
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default StudentProgressPage;
