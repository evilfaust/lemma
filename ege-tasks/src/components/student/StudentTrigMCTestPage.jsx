import { useEffect, useMemo, useState } from 'react';
import { Button, Typography, Modal, App, Radio } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import katex from 'katex';
import { api } from '../../services/pocketbase';
import { getRandomAchievement, checkUnlockedAchievements, getPreviouslyUnlockedIds, getPreviouslyEarnedBadgeIds } from '../../utils/achievementEngine';

const { Title, Text } = Typography;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function MathInline({ latex }) {
  const html = useMemo(() => {
    try { return katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
    catch { return latex; }
  }, [latex]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Страница прохождения тригонометрического MC-теста (задания из генераторов, inline LaTeX).
 * Ответы хранятся по индексу задачи, не по task.id.
 */
const StudentTrigMCTestPage = ({ studentSession }) => {
  const { message } = App.useApp();
  const { attempt, setAttempt, variant, tasks, session } = studentSession;
  const [answers, setAnswers] = useState({}); // { taskIndex: optionIndex }
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  const storageKey = useMemo(
    () => (attempt?.id ? `ege_student_trig_mc_answers_${attempt.id}` : null),
    [attempt?.id]
  );

  // Восстановить ответы из localStorage
  useEffect(() => {
    if (!storageKey || !tasks.length) return;
    try {
      const savedRaw = localStorage.getItem(storageKey);
      if (!savedRaw) return;
      const saved = JSON.parse(savedRaw);
      if (!saved || typeof saved !== 'object') return;
      const restored = {};
      Object.entries(saved).forEach(([idx, optIdx]) => {
        const i = Number(idx);
        if (Number.isInteger(i) && i >= 0 && i < tasks.length && Number.isInteger(optIdx)) {
          restored[i] = optIdx;
        }
      });
      setAnswers(restored);
    } catch { /* ignore */ }
  }, [storageKey, tasks]);

  // Сохранять ответы в localStorage при изменении
  useEffect(() => {
    if (!storageKey || !tasks.length) return;
    try {
      const has = Object.keys(answers).length > 0;
      if (!has) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch { /* ignore */ }
  }, [answers, storageKey, tasks.length]);

  const updateAnswer = (taskIndex, optionIndex) => {
    setAnswers(prev => ({ ...prev, [taskIndex]: optionIndex }));
  };

  const answeredCount = Object.keys(answers).length;
  const progressPercent = tasks.length > 0 ? (answeredCount / tasks.length) * 100 : 0;
  const testTitle = session?.student_title?.trim() || 'Тест';

  const handleSubmit = () => {
    Modal.confirm({
      title: 'Отправить ответы?',
      content: `Вы ответили на ${answeredCount} из ${tasks.length} вопросов.`,
      okText: 'Отправить',
      cancelText: 'Вернуться',
      onOk: doSubmit,
    });
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      const durationMinutes = durationSeconds / 60;

      let score = 0;
      const answerRecords = [];
      tasks.forEach((task, idx) => {
        const optIdx = answers[idx];
        const opts = task.mc_options || [];
        const chosen = typeof optIdx === 'number' ? opts[optIdx] : null;
        const isCorrect = !!chosen?.is_correct;
        if (isCorrect) score++;
        answerRecords.push({
          attempt: attempt.id,
          // task field omitted — trig MC tasks have no PocketBase task ID
          answer_raw: String(idx),
          answer_normalized: typeof optIdx === 'number' ? optIdx : 0,
          is_correct: isCorrect,
        });
      });

      const percentage = tasks.length > 0 ? (score / tasks.length) * 100 : 0;

      let randomBadge = null;
      let unlocked = [];
      if (session.achievements_enabled) {
        const achievements = await api.getAchievements();
        const authStudent = api.getAuthStudent();
        let allAttempts = [];
        if (authStudent?.id) {
          const deviceId = localStorage.getItem('ege_device_id');
          const [studentAttempts, deviceAttempts] = await Promise.all([
            api.getAttemptsByStudentAll(authStudent.id),
            deviceId ? api.getAttemptsByDeviceAll(deviceId) : Promise.resolve([]),
          ]);
          const byId = new Map();
          [...studentAttempts, ...deviceAttempts].forEach(a => byId.set(a.id, a));
          allAttempts = Array.from(byId.values());
        } else {
          const deviceId = localStorage.getItem('ege_device_id');
          if (deviceId) allAttempts = await api.getAttemptsByDeviceAll(deviceId);
        }
        const previouslyEarnedBadgeIds = getPreviouslyEarnedBadgeIds(allAttempts);
        randomBadge = getRandomAchievement(achievements, percentage, previouslyEarnedBadgeIds);
        const previouslyUnlockedIds = getPreviouslyUnlockedIds(allAttempts);
        const attemptsIncludingCurrent = allAttempts.some(a => a.id === attempt.id)
          ? allAttempts : [...allAttempts, { id: attempt.id }];
        unlocked = checkUnlockedAchievements(
          achievements,
          { percentage, durationMinutes, submittedAt: new Date().toISOString() },
          attemptsIncludingCurrent,
          previouslyUnlockedIds
        );
      }

      // attempt_answers не создаём — поле task обязательное в схеме БД,
      // а у тригонометрических тестов задачи не привязаны к коллекции tasks.

      const updated = await api.updateAttempt(attempt.id, {
        status: 'submitted',
        score,
        total: tasks.length,
        submitted_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        achievement: randomBadge?.id || null,
        unlocked_achievements: unlocked.map(a => a.id),
      });

      if (storageKey) localStorage.removeItem(storageKey);

      setAttempt({
        ...attempt, ...updated,
        expand: { achievement: randomBadge, unlocked_achievements: unlocked },
      });
      message.success('Ответы отправлены');
    } catch (err) {
      console.error('[StudentTrigMCTest] error:', err);
      message.error('Ошибка при отправке: ' + (err.message || ''));
    }
    setSubmitting(false);
  };

  if (!variant || !tasks.length) {
    return (
      <div className="student-skeleton">
        <div className="student-skeleton-line" style={{ width: '50%' }} />
        <div className="student-skeleton-line" style={{ width: '30%' }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="student-skeleton-btn" style={{ height: 100, marginTop: 16 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="student-test">
      <div className="student-test-header">
        <Title level={4} className="student-test-variant-title">
          Вариант {variant.number}
        </Title>
        <Text className="student-test-title">{testTitle}</Text>
        <Text className="student-test-meta">
          {attempt.student_name}
          {attempt?.issueNumber ? ` · Выдача №${attempt.issueNumber}` : ''}
        </Text>
      </div>

      <div className="student-test-progress">
        <div className="student-test-progress-bar">
          <div className="student-test-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="student-test-progress-text">
          <span>Отвечено: {answeredCount} из {tasks.length}</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
      </div>

      {tasks.map((task, idx) => {
        const isFilled = answers[idx] !== undefined;
        const opts = task.mc_options || [];
        return (
          <div
            key={idx}
            className={`task-item ${isFilled ? 'task-item--filled' : ''}`}
            style={{ animationDelay: `${0.05 * idx}s` }}
          >
            <div className="task-number">Задача {idx + 1}</div>
            <div className="task-statement">
              <MathInline latex={task.question} />
            </div>
            <Radio.Group
              value={answers[idx]}
              onChange={(e) => updateAnswer(idx, e.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}
            >
              {opts.map((opt, oi) => (
                <Radio
                  key={oi}
                  value={oi}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: '1px solid var(--ant-color-border, #d9d9d9)',
                    background: answers[idx] === oi ? 'var(--ant-color-primary-bg, #e6f4ff)' : 'transparent',
                    margin: 0,
                    alignItems: 'flex-start',
                  }}
                >
                  <strong style={{ marginRight: 8 }}>{LETTERS[oi]}.</strong>
                  <MathInline latex={opt.text || ''} />
                </Radio>
              ))}
            </Radio.Group>
          </div>
        );
      })}

      <div className="submit-bar">
        <Button
          type="primary" size="large" block
          icon={<SendOutlined />}
          onClick={handleSubmit}
          loading={submitting}
        >
          Отправить ответы
        </Button>
      </div>
    </div>
  );
};

export default StudentTrigMCTestPage;
