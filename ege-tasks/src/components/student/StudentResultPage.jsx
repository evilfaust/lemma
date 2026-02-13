import { useState, useEffect } from 'react';
import { Typography, Spin, Button } from 'antd';
import { CheckCircleOutlined, TrophyOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';
import { PB_BASE_URL } from '../../services/pocketbaseUrl';
import AchievementBadge from './AchievementBadge';

const { Title, Text } = Typography;

const PB_URL = PB_BASE_URL;

/**
 * Страница результатов ученика.
 */
const StudentResultPage = ({ studentSession, onNavigateToGallery }) => {
  const { attempt, tasks, session } = studentSession;
  const [attemptAnswers, setAttemptAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvedAchievement, setResolvedAchievement] = useState(null);
  const [resolvedUnlocked, setResolvedUnlocked] = useState([]);

  useEffect(() => {
    if (!attempt) return;
    const load = async () => {
      setLoading(true);
      const answers = await api.getAttemptAnswers(attempt.id);
      setAttemptAnswers(answers);
      setLoading(false);
    };
    load();
  }, [attempt?.id, attempt?.status]);

  const wrongAnswers = attemptAnswers.filter(a => !a.is_correct);
  const score = attempt?.score || 0;
  const total = attempt?.total || tasks.length;
  const percentage = total > 0 ? (score / total) * 100 : 0;
  const scoreClass = percentage >= 70 ? 'good' : percentage >= 40 ? 'ok' : 'bad';
  const achievementsEnabled = session?.achievements_enabled || false;

  useEffect(() => {
    let cancelled = false;
    const loadAchievements = async () => {
      if (!achievementsEnabled || !attempt) {
        setResolvedAchievement(null);
        setResolvedUnlocked([]);
        return;
      }

      const expandedAchievement = attempt?.expand?.achievement;
      const expandedUnlocked = attempt?.expand?.unlocked_achievements;
      const achievementId = typeof attempt?.achievement === 'string'
        ? attempt.achievement : attempt?.achievement?.id;
      const unlockedIds = Array.isArray(attempt?.unlocked_achievements)
        ? attempt.unlocked_achievements : [];

      if (expandedAchievement && Array.isArray(expandedUnlocked)) {
        setResolvedAchievement(expandedAchievement);
        setResolvedUnlocked(expandedUnlocked);
        return;
      }

      const idsToLoad = [];
      if (!expandedAchievement && achievementId) idsToLoad.push(achievementId);
      if (!Array.isArray(expandedUnlocked) && unlockedIds.length > 0) idsToLoad.push(...unlockedIds);

      if (idsToLoad.length === 0) {
        setResolvedAchievement(expandedAchievement || null);
        setResolvedUnlocked(Array.isArray(expandedUnlocked) ? expandedUnlocked : []);
        return;
      }

      const loaded = await api.getAchievementsByIds(idsToLoad);
      if (cancelled) return;
      const byId = new Map(loaded.map((a) => [a.id, a]));

      setResolvedAchievement(expandedAchievement || (achievementId ? byId.get(achievementId) || null : null));
      setResolvedUnlocked(
        Array.isArray(expandedUnlocked)
          ? expandedUnlocked
          : unlockedIds.map((id) => byId.get(id)).filter(Boolean)
      );
    };

    loadAchievements();
    return () => { cancelled = true; };
  }, [achievementsEnabled, attempt?.id, attempt?.achievement, attempt?.unlocked_achievements, attempt?.expand]);

  const hasAchievement = achievementsEnabled && !!resolvedAchievement;
  const hasUnlockedAchievements = achievementsEnabled && resolvedUnlocked.length > 0;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="student-result">
      <div className="student-result-header">
        <Title level={4} className="student-result-title">Результат</Title>
        <Text className="student-result-meta">
          {attempt?.student_name}
          {attempt?.issueNumber ? ` · Выдача №${attempt.issueNumber}` : ''}
        </Text>
      </div>

      {/* Score card */}
      <div className="student-result-score-card">
        <div className={`student-result-score-value ${scoreClass}`}>
          {score} из {total}
        </div>
        <div className="student-result-score-label">
          {Math.round(percentage)}% правильных ответов
        </div>
        <div className="student-result-score-bar">
          <div className={`student-result-score-bar-fill ${scoreClass}`} style={{ width: `${percentage}%` }} />
        </div>
      </div>

      {/* Summary */}
      <div className={`student-result-summary ${wrongAnswers.length === 0 ? 'student-result-summary--perfect' : ''}`}>
        {wrongAnswers.length === 0 ? (
          <><CheckCircleOutlined /> Все ответы верны!</>
        ) : (
          <Text type="secondary" style={{ fontSize: 16 }}>Ошибок: {wrongAnswers.length}</Text>
        )}
      </div>

      {/* Полученный случайный значок */}
      {hasAchievement && (
        <div className="achievement-section achievement-reveal">
          <div className="achievement-header">
            <Title level={3} className="achievement-section-title">Получен значок!</Title>
          </div>
          <AchievementBadge achievement={resolvedAchievement} size="large" showDetails animated animationDelay={300} />
        </div>
      )}

      {/* Разблокированные достижения */}
      {hasUnlockedAchievements && (
        <div className="unlocked-section achievement-reveal">
          <div className="achievement-header">
            <Title level={3} className="achievement-section-title">Новые достижения!</Title>
          </div>
          <div className="unlocked-achievements-grid">
            {resolvedUnlocked.map((ach, index) => (
              <AchievementBadge key={ach.id} achievement={ach} size="medium" showDetails animated animationDelay={800 + index * 200} />
            ))}
          </div>
        </div>
      )}

      {/* Кнопка "Мои достижения" */}
      {(hasAchievement || hasUnlockedAchievements) && onNavigateToGallery && (
        <div className="student-result-gallery-btn">
          <Button type="dashed" icon={<TrophyOutlined />} size="large" onClick={onNavigateToGallery}>
            Посмотреть мои достижения
          </Button>
        </div>
      )}

      {/* Список ошибочных задач */}
      {wrongAnswers.length > 0 && (
        <>
          <div className="student-result-errors-title">Ошибочные задачи</div>
          {wrongAnswers.map((answer, i) => {
            const task = tasks.find(t => t.id === answer.task) || answer.expand?.task;
            if (!task) return null;
            const taskIndex = tasks.findIndex(t => t.id === answer.task);
            const taskNumber = taskIndex >= 0 ? taskIndex + 1 : i + 1;
            return (
              <div key={answer.id} className="error-task" style={{ animationDelay: `${0.08 * i}s` }}>
                <div className="task-number">Задача {taskNumber}</div>
                <div className="task-statement">
                  <MathRenderer text={task.statement_md} />
                  {(task.image_url || task.image) && (
                    <img src={task.image_url || `${PB_URL}/api/files/tasks/${task.id}/${task.image}`} alt="" style={{ maxWidth: '100%', marginTop: 8, borderRadius: 12 }} />
                  )}
                </div>
                <div style={{ marginTop: 10 }}>
                  <Text type="secondary">Ваш ответ: </Text>
                  <Text className="wrong-badge">{answer.answer_raw || '(пусто)'}</Text>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default StudentResultPage;
