import React, { useState, useEffect, useMemo } from 'react';
import { Button, Table, Tag, Progress, Space, Spin, Typography, Popover } from 'antd';
import {
  ArrowLeftOutlined, LineChartOutlined, BookOutlined,
  WarningOutlined, HistoryOutlined, TrophyOutlined, LoadingOutlined,
} from '@ant-design/icons';
import { api } from '../services/pocketbase';
import MathRenderer from './MathRenderer';
import './StudentDetailPage.css';

const { Title, Text } = Typography;

// ============================================
// SVG Line Chart (дублируем из StudentProgressPage с адаптацией)
// ============================================
const ScoreChart = ({ data }) => {
  if (data.length < 2) return null;

  const W = 640, H = 170;
  const PAD = { top: 14, right: 16, bottom: 30, left: 36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const points = data.map((d, i) => ({
    x: PAD.left + (i / (data.length - 1)) * plotW,
    y: PAD.top + plotH - (d.percent / 100) * plotH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD.top + plotH} L${points[0].x},${PAD.top + plotH} Z`;

  const maxLabels = 8;
  const step = data.length > maxLabels ? Math.ceil(data.length / maxLabels) : 1;
  const dayCountMap = data.reduce((acc, item) => {
    const key = item.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sdp-chart" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="sdpChartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4361ee" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#4361ee" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map(v => {
        const y = PAD.top + plotH - (v / 100) * plotH;
        return (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e8e8e8" strokeDasharray="4,4" />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#8c8c8c" fontFamily="Inter, -apple-system, sans-serif">{v}%</text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#sdpChartGrad)" />
      <path d={linePath} fill="none" stroke="#4361ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => {
        const color = p.percent >= 70 ? '#52c41a' : p.percent >= 40 ? '#faad14' : '#ff4d4f';
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke={color} strokeWidth="2" />
          </g>
        );
      })}
      {points.map((p, i) => {
        if (i % step !== 0 && i !== data.length - 1) return null;
        const dayLabel = p.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        const isDuplicateDay = (dayCountMap.get(dayLabel) || 0) > 1;
        const dateStr = isDuplicateDay
          ? `${dayLabel} ${p.date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
          : dayLabel;
        return (
          <text key={`d${i}`} x={p.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#8c8c8c" fontFamily="Inter, -apple-system, sans-serif">
            {dateStr}
          </text>
        );
      })}
    </svg>
  );
};

// ============================================
// Helpers
// ============================================
const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  if (m === 0) return `${seconds} сек`;
  return `${m} мин`;
};

const difficultyLabels = { 1: 'Базовый', 2: 'Средний', 3: 'Сложный' };
const difficultyColors = { 1: '#52c41a', 2: '#faad14', 3: '#ff4d4f' };

const normalizeUnlockedIds = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => (typeof item === 'string' ? item : item?.id)).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(i => typeof i === 'string' ? i : i?.id).filter(Boolean) : [];
    } catch { return []; }
  }
  return [];
};

// ============================================
// MAIN COMPONENT
// ============================================
function StudentDetailPage({ studentId, onBack, onOpenWork }) {
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [allAnswers, setAllAnswers] = useState(null);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [expandedWeakTasks, setExpandedWeakTasks] = useState(() => new Set());
  const [isWeakTasksOpen, setIsWeakTasksOpen] = useState(false);

  // Загрузка основных данных
  useEffect(() => {
    if (!studentId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [students, attemptsData, achievementsData] = await Promise.all([
          api.getStudents(),
          api.getAttemptsByStudentAllWithWorks(studentId),
          api.getAchievements(),
        ]);

        const studentRecord = students.find(s => s.id === studentId);
        setStudent(studentRecord || null);

        const finished = attemptsData.filter(a => a.status === 'submitted' || a.status === 'corrected');
        finished.sort((a, b) => new Date(b.created) - new Date(a.created));
        setAttempts(finished);
        setAchievements(achievementsData);
      } catch (err) {
        console.error('Error loading student detail:', err);
      }
      setLoading(false);
    };
    load();
  }, [studentId]);

  // Автозагрузка ответов через 300ms (для тем + слабых задач)
  useEffect(() => {
    if (!attempts.length) return;
    const timer = setTimeout(async () => {
      setAnswersLoading(true);
      try {
        const ids = attempts.map(a => a.id);
        const answers = await api.getAttemptAnswersByAttemptsDetailed(ids);
        setAllAnswers(answers);
      } catch (err) {
        console.error('Error loading answers:', err);
        setAllAnswers([]);
      }
      setAnswersLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [attempts]);

  // ============ COMPUTED ============

  const stats = useMemo(() => {
    if (!attempts.length) return null;
    const workIds = new Set();
    attempts.forEach(a => {
      const workId = a.expand?.session?.expand?.work?.id || a.expand?.session?.work;
      if (workId) workIds.add(typeof workId === 'string' ? workId : workId);
    });
    const totalScore = attempts.reduce((s, a) => s + (a.score || 0), 0);
    const totalTasks = attempts.reduce((s, a) => s + (a.total || 0), 0);
    const avgPercent = totalTasks > 0 ? Math.round((totalScore / totalTasks) * 100) : 0;
    const bestPercent = attempts.reduce((best, a) => {
      const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
      return Math.max(best, pct);
    }, 0);
    const withTime = attempts.filter(a => a.duration_seconds > 0);
    const avgTime = withTime.length > 0
      ? Math.round(withTime.reduce((s, a) => s + a.duration_seconds, 0) / withTime.length)
      : 0;
    return { totalWorks: workIds.size, totalAttempts: attempts.length, avgPercent, bestPercent, avgTime };
  }, [attempts]);

  const chartData = useMemo(() => {
    return attempts
      .filter(a => a.total > 0)
      .map(a => ({
        date: new Date(a.submitted_at || a.created),
        percent: Math.round((a.score / a.total) * 100),
        title: a.expand?.session?.expand?.work?.title || 'Тест',
      }))
      .sort((a, b) => a.date - b.date);
  }, [attempts]);

  const topicStats = useMemo(() => {
    if (!allAnswers) return null;
    const byTopic = new Map();
    allAnswers.forEach(answer => {
      const topic = answer.expand?.task?.expand?.topic;
      if (!topic) return;
      if (!byTopic.has(topic.id)) byTopic.set(topic.id, { id: topic.id, title: topic.title, correct: 0, total: 0 });
      const entry = byTopic.get(topic.id);
      entry.total++;
      if (answer.is_correct) entry.correct++;
    });
    return Array.from(byTopic.values())
      .map(t => ({ ...t, percent: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0 }))
      .sort((a, b) => a.percent - b.percent);
  }, [allAnswers]);

  const weakTasks = useMemo(() => {
    if (!allAnswers) return null;
    const byTaskId = new Map();
    allAnswers.forEach(answer => {
      const task = answer.expand?.task;
      if (!task) return;
      const taskId = answer.task;
      if (!byTaskId.has(taskId)) {
        byTaskId.set(taskId, {
          key: taskId,
          task,
          topic: task.expand?.topic,
          totalAttempts: 0,
          wrongAttempts: 0,
          studentAnswers: [],
        });
      }
      const entry = byTaskId.get(taskId);
      entry.totalAttempts++;
      if (!answer.is_correct) entry.wrongAttempts++;
      if (!answer.is_correct && answer.answer_raw) {
        entry.studentAnswers.push(answer.answer_raw);
      }
    });
    return Array.from(byTaskId.values())
      .filter(t => t.wrongAttempts > 0)
      .map(t => ({ ...t, errorRate: Math.round((t.wrongAttempts / t.totalAttempts) * 100) }))
      .sort((a, b) => b.errorRate !== a.errorRate ? b.errorRate - a.errorRate : b.wrongAttempts - a.wrongAttempts);
  }, [allAnswers]);

  const achievementsById = useMemo(() => new Map(achievements.map(a => [a.id, a])), [achievements]);

  const earnedAchievementIds = useMemo(() => {
    const ids = new Set();
    attempts.forEach(a => {
      if (a.achievement) ids.add(typeof a.achievement === 'string' ? a.achievement : a.achievement);
      normalizeUnlockedIds(a.unlocked_achievements).forEach(id => ids.add(id));
    });
    return ids;
  }, [attempts]);

  const toggleWeakTaskExpanded = (taskId) => {
    setExpandedWeakTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // ============ COLUMNS ============

  const historyColumns = [
    {
      title: 'Дата',
      key: 'date',
      width: 120,
      render: (_, record) => {
        const d = new Date(record.submitted_at || record.created);
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
      },
    },
    {
      title: 'Работа',
      key: 'work',
      render: (_, record) => {
        const work = record.expand?.session?.expand?.work;
        const title = work?.title || 'Тест';
        return (
          <Space>
            <Text>{title}</Text>
            {work?.id && (
              <Button size="small" type="link" onClick={() => onOpenWork?.(work.id)}>Открыть</Button>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Результат',
      key: 'score',
      width: 160,
      render: (_, record) => {
        const pct = record.total ? Math.round((record.score / record.total) * 100) : 0;
        const color = pct >= 70 ? '#52c41a' : pct >= 40 ? '#faad14' : '#ff4d4f';
        return (
          <Space>
            <Progress type="circle" size={36} percent={pct} strokeColor={color}
              format={() => <span style={{ fontSize: 11, fontWeight: 700 }}>{pct}%</span>} />
            <Text type="secondary">{record.score}/{record.total}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Время',
      key: 'duration',
      width: 90,
      render: (_, record) => <Text type="secondary">{formatDuration(record.duration_seconds)}</Text>,
    },
    {
      title: 'Достижения',
      key: 'achievements',
      width: 120,
      render: (_, record) => {
        const ids = [
          ...(record.achievement ? [record.achievement] : []),
          ...normalizeUnlockedIds(record.unlocked_achievements),
        ];
        if (!ids.length) return <Text type="secondary">—</Text>;
        const names = ids.map(id => achievementsById.get(id)?.title).filter(Boolean);
        return (
          <Popover content={<div>{names.map((n, i) => <div key={i}>{n}</div>)}</div>} trigger="hover">
            <Tag color="gold" style={{ cursor: 'pointer' }}>{ids.length} шт.</Tag>
          </Popover>
        );
      },
    },
  ];

  // ============ RENDER ============

  if (loading) {
    return (
      <div className="sdp-page">
        <div className="sdp-loading">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 32, color: '#4361ee' }} spin />} />
          <p>Загрузка данных ученика...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="sdp-page">
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад к списку</Button>
        <div className="sdp-loading">
          <p>Ученик не найден</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sdp-page">
      {/* S1: Header */}
      <div className="sdp-header">
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
        <div className="sdp-student-info">
          <Title level={3} className="sdp-student-name">{student.name || student.username}</Title>
          <div className="sdp-student-meta">
            {student.student_class && <Tag color="geekblue">{student.student_class} класс</Tag>}
            <Tag>@{student.username}</Tag>
            <Text type="secondary">
              Регистрация: {new Date(student.created).toLocaleDateString('ru-RU')}
            </Text>
            <Text type="secondary">
              Попыток: {stats?.totalAttempts || 0}
            </Text>
          </div>
        </div>
      </div>

      {/* S2: Hero Stats */}
      {stats && (
        <div className="sdp-stats-grid">
          <div className="sdp-hero-card sdp-hero-card--works">
            <div className="sdp-hero-label">Работ выполнено</div>
            <div className="sdp-hero-value">{stats.totalWorks}</div>
            <div className="sdp-hero-suffix">{stats.totalAttempts} попыток</div>
          </div>
          <div className="sdp-hero-card sdp-hero-card--avg">
            <div className="sdp-hero-label">Средний балл</div>
            <div className="sdp-hero-value">{stats.avgPercent}%</div>
            <div className="sdp-hero-suffix">по всем работам</div>
          </div>
          <div className="sdp-hero-card sdp-hero-card--best">
            <div className="sdp-hero-label">Лучший результат</div>
            <div className="sdp-hero-value">{stats.bestPercent}%</div>
            <div className="sdp-hero-suffix">рекордный результат</div>
          </div>
          <div className="sdp-hero-card sdp-hero-card--time">
            <div className="sdp-hero-label">Среднее время</div>
            <div className="sdp-hero-value">{formatDuration(stats.avgTime)}</div>
            <div className="sdp-hero-suffix">на работу</div>
          </div>
        </div>
      )}

      {/* S3: Score Chart */}
      {chartData.length >= 2 && (
        <div className="sdp-section sdp-section--chart">
          <Title level={4} className="sdp-section-title">
            <LineChartOutlined /> Динамика результатов
          </Title>
          <ScoreChart data={chartData} />
        </div>
      )}

      {/* S4: Topic Breakdown */}
      <div className="sdp-section">
        <Title level={4} className="sdp-section-title">
          <BookOutlined /> Результаты по темам
        </Title>
        {answersLoading && <div className="sdp-answers-loading"><Spin size="small" /> Загрузка...</div>}
        {topicStats && topicStats.length > 0 && (
          <div className="sdp-topic-list">
            {topicStats.map(topic => {
              const level = topic.percent >= 70 ? 'good' : topic.percent >= 40 ? 'ok' : 'bad';
              return (
                <div key={topic.id} className="sdp-topic-row">
                  <div className="sdp-topic-name" title={topic.title}>{topic.title}</div>
                  <div className="sdp-topic-bar-wrap">
                    <div className={`sdp-topic-bar sdp-topic-bar--${level}`} style={{ width: `${topic.percent}%` }} />
                  </div>
                  <div className="sdp-topic-info">
                    <span className={`sdp-topic-pct sdp-topic-pct--${level}`}>{topic.percent}%</span>
                    <span className="sdp-topic-count">{topic.correct}/{topic.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {topicStats && topicStats.length === 0 && (
          <div className="sdp-empty-section">Нет данных по темам</div>
        )}
      </div>

      {/* S5: Weak Tasks */}
      <div className="sdp-section sdp-weak-tasks">
        <Title level={4} className="sdp-section-title">
          <WarningOutlined style={{ color: '#ff4d4f' }} /> Проблемные задачи
          {weakTasks && weakTasks.length > 0 && (
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 400, marginLeft: 8 }}>
              ({weakTasks.length})
            </Text>
          )}
          <Button
            size="small"
            type={isWeakTasksOpen ? 'default' : 'link'}
            onClick={() => setIsWeakTasksOpen(v => !v)}
            style={{ marginLeft: 'auto' }}
          >
            {isWeakTasksOpen ? 'Скрыть' : 'Показать'}
          </Button>
        </Title>
        {isWeakTasksOpen && answersLoading && <div className="sdp-answers-loading"><Spin size="small" /> Загрузка...</div>}
        {isWeakTasksOpen && weakTasks && weakTasks.length > 0 && (
          <div className="sdp-weak-list">
            {weakTasks.map((record) => {
              const d = record.task.difficulty;
              const errorColor = record.errorRate >= 70 ? '#ff4d4f' : record.errorRate >= 40 ? '#faad14' : '#52c41a';
              const isExpanded = expandedWeakTasks.has(record.key);
              const uniqueWrongAnswers = [...new Set(record.studentAnswers)].slice(0, 4);
              const taskStatement = record.task.statement_md || record.task.statement || record.task.condition || 'Нет условия';
              const taskImageUrl = api.getTaskImageUrl(record.task);
              return (
                <div key={record.key} className="sdp-weak-card">
                  <div className="sdp-weak-card-header">
                    <div className="sdp-weak-card-meta">
                      <Text strong style={{ fontFamily: 'monospace', fontSize: 15 }}>{record.task.code || '—'}</Text>
                      {record.topic && <Tag>{record.topic.title}</Tag>}
                      {d && (
                        <span style={{ color: difficultyColors[d], fontWeight: 600, fontSize: 12 }}>
                          {difficultyLabels[d]}
                        </span>
                      )}
                    </div>
                    <div className="sdp-weak-card-stats">
                      <span className="sdp-weak-card-error-count">
                        <Text type="danger" strong>{record.wrongAttempts}</Text>
                        <Text type="secondary"> / {record.totalAttempts}</Text>
                      </span>
                      <Progress
                        percent={record.errorRate}
                        size="small"
                        strokeColor={errorColor}
                        style={{ width: 100 }}
                        format={(pct) => `${pct}%`}
                      />
                      <Button size="small" type={isExpanded ? 'default' : 'link'} onClick={() => toggleWeakTaskExpanded(record.key)}>
                        {isExpanded ? 'Скрыть условие' : 'Условие'}
                      </Button>
                    </div>
                  </div>
                  <div className="sdp-weak-card-footer">
                    {uniqueWrongAnswers.length > 0 && (
                      <span className="sdp-weak-task-wrong">
                        <Text type="secondary">Ошибки ученика: </Text>
                        {uniqueWrongAnswers.map((a, i) => (
                          <Tag key={i} color="red">{a}</Tag>
                        ))}
                        {record.studentAnswers.length > uniqueWrongAnswers.length && (
                          <Text type="secondary">+{record.studentAnswers.length - uniqueWrongAnswers.length}</Text>
                        )}
                      </span>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="sdp-weak-card-body">
                      <MathRenderer text={taskStatement} />
                      {taskImageUrl && (
                        <img
                          src={taskImageUrl}
                          alt={`Иллюстрация к задаче ${record.task.code || ''}`}
                          className="sdp-weak-task-image"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {isWeakTasksOpen && weakTasks && weakTasks.length === 0 && (
          <div className="sdp-empty-section">Нет ошибок — ученик отвечает на все задачи правильно!</div>
        )}
      </div>

      {/* S6: Attempt History */}
      <div className="sdp-section sdp-history">
        <Title level={4} className="sdp-section-title">
          <HistoryOutlined /> История попыток ({attempts.length})
        </Title>
        <Table
          dataSource={attempts}
          columns={historyColumns}
          rowKey="id"
          pagination={attempts.length > 15 ? { pageSize: 15 } : false}
          size="small"
        />
      </div>

      {/* S7: Achievements */}
      {earnedAchievementIds.size > 0 && (
        <div className="sdp-section">
          <Title level={4} className="sdp-section-title">
            <TrophyOutlined style={{ color: '#f5a623' }} /> Достижения ({earnedAchievementIds.size})
          </Title>
          <div className="sdp-achievements-wrap">
            {[...earnedAchievementIds].map(id => {
              const ach = achievementsById.get(id);
              if (!ach) return null;
              return (
                <Tag key={id} color="gold">
                  {ach.icon} {ach.title}
                </Tag>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentDetailPage;
