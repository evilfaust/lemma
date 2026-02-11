import { useEffect, useMemo, useState } from 'react';
import { Input, Button, Typography, Modal, App } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';
import { PB_BASE_URL } from '../../services/pocketbaseUrl';
import { checkAnswer } from '../../utils/answerChecker';
import { getRandomAchievement, checkUnlockedAchievements, getPreviouslyUnlockedIds } from '../../utils/achievementEngine';

const { Title, Text } = Typography;

const PB_URL = PB_BASE_URL;

/**
 * Страница прохождения теста.
 * Показывает задачи варианта с полями для ответов.
 */
const StudentTestPage = ({ studentSession }) => {
  const { message } = App.useApp();
  const { attempt, setAttempt, variant, tasks, session } = studentSession;
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(Date.now()); // Засечь время начала теста
  const storageKey = useMemo(
    () => (attempt?.id ? `ege_student_answers_${attempt.id}` : null),
    [attempt?.id]
  );

  useEffect(() => {
    if (!storageKey) return;

    try {
      const savedRaw = localStorage.getItem(storageKey);
      if (!savedRaw) return;

      const saved = JSON.parse(savedRaw);
      if (!saved || typeof saved !== 'object') return;

      const validTaskIds = new Set(tasks.map(t => t.id));
      const restored = Object.entries(saved).reduce((acc, [taskId, value]) => {
        if (validTaskIds.has(taskId)) {
          acc[taskId] = typeof value === 'string' ? value : String(value ?? '');
        }
        return acc;
      }, {});

      setAnswers(restored);
    } catch (err) {
      console.error('Error restoring saved student answers:', err);
    }
  }, [storageKey, tasks]);

  useEffect(() => {
    if (!storageKey) return;

    try {
      const hasAnyAnswer = Object.values(answers).some(v => (v || '').trim().length > 0);
      if (!hasAnyAnswer) {
        localStorage.removeItem(storageKey);
        return;
      }
      localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch (err) {
      console.error('Error saving student answers draft:', err);
    }
  }, [answers, storageKey]);

  const updateAnswer = (taskId, value) => {
    setAnswers(prev => ({ ...prev, [taskId]: value }));
  };

  const handleSubmit = () => {
    Modal.confirm({
      title: 'Отправить ответы?',
      content: `Вы ответили на ${Object.values(answers).filter(a => a?.trim()).length} из ${tasks.length} вопросов. После отправки изменить ответы нельзя.`,
      okText: 'Отправить',
      cancelText: 'Вернуться',
      onOk: doSubmit,
    });
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      // Вычислить время прохождения
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      const durationMinutes = durationSeconds / 60;

      // Проверить каждый ответ
      let score = 0;
      const answerRecords = [];

      for (const task of tasks) {
        const raw = answers[task.id] || '';
        const { isCorrect, normalized } = checkAnswer(raw, task.answer);
        if (isCorrect) score++;

        answerRecords.push({
          attempt: attempt.id,
          task: task.id,
          answer_raw: raw,
          answer_normalized: isNaN(normalized) ? 0 : normalized,
          is_correct: isCorrect,
        });
      }

      // Вычислить процент правильных ответов
      const percentage = tasks.length > 0 ? (score / tasks.length) * 100 : 0;

      // Проверить, включены ли достижения для этой сессии
      let randomBadge = null;
      let unlocked = [];

      if (session.achievements_enabled) {
        // Загрузить все достижения
        const achievements = await api.getAchievements();

        // Выбрать случайный значок на основе процента
        randomBadge = getRandomAchievement(achievements, percentage);

        // Получить все попытки студента для проверки условий
        const deviceId = localStorage.getItem('ege_device_id');
        const allAttempts = await api.getAttemptsByDevice(session.id, deviceId);

        // Проверить разблокированные достижения за условия
        const previouslyUnlockedIds = getPreviouslyUnlockedIds(allAttempts);
        unlocked = checkUnlockedAchievements(
          achievements,
          {
            percentage,
            durationMinutes,
            submittedAt: new Date(),
          },
          [...allAttempts, { id: attempt.id }], // Включить текущую попытку для подсчета
          previouslyUnlockedIds
        );
      }

      // Сохранить ответы
      await api.batchCreateAttemptAnswers(answerRecords);

      // Обновить попытку с достижениями
      const updated = await api.updateAttempt(attempt.id, {
        status: 'submitted',
        score,
        total: tasks.length,
        submitted_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        achievement: randomBadge?.id || null,
        unlocked_achievements: unlocked.map(a => a.id),
      });

      if (storageKey) {
        localStorage.removeItem(storageKey);
      }

      // Сохранить expand данные для отображения в результатах
      const updatedWithExpand = {
        ...updated,
        expand: {
          achievement: randomBadge,
          unlocked_achievements: unlocked,
        },
      };

      setAttempt({ ...attempt, ...updatedWithExpand });
      message.success('Ответы отправлены');
    } catch (err) {
      console.error('Error submitting answers:', err);
      message.error('Ошибка при отправке ответов');
    }
    setSubmitting(false);
  };

  if (!variant || !tasks.length) {
    return <div style={{ textAlign: 'center', padding: 40 }}>Загрузка варианта...</div>;
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 4 }}>
          Вариант {variant.number}
        </Title>
        <Text type="secondary">
          {attempt.student_name}
          {attempt?.issueNumber ? ` • Выдача №${attempt.issueNumber}` : ''}
        </Text>
      </div>

      {tasks.map((task, idx) => (
        <div key={task.id} className="task-item">
          <div className="task-number">Задача {idx + 1}</div>
          <div className="task-statement">
            <MathRenderer text={task.statement_md} />
            {(task.image_url || task.image) && (
              <img
                src={task.image_url || `${PB_URL}/api/files/tasks/${task.id}/${task.image}`}
                alt=""
                style={{ maxWidth: '100%', marginTop: 8, borderRadius: 8 }}
              />
            )}
          </div>
          <Input
            className="task-answer-input"
            placeholder="Ответ"
            inputMode="text"
            type="text"
            value={answers[task.id] || ''}
            onChange={e => updateAnswer(task.id, e.target.value)}
          />
        </div>
      ))}

      <div className="submit-bar">
        <Button
          type="primary"
          size="large"
          block
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

export default StudentTestPage;
