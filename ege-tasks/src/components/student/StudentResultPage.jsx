import { useState, useEffect } from 'react';
import { Button, Typography, Spin, Input, message, Divider } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EditOutlined, SendOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';
import { checkAnswer } from '../../utils/answerChecker';

const { Title, Text } = Typography;

const PB_URL = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';

/**
 * Страница результатов ученика.
 * Показывает результат, ошибочные задачи и кнопку исправления.
 */
const StudentResultPage = ({ studentSession }) => {
  const { attempt, setAttempt, tasks } = studentSession;
  const [attemptAnswers, setAttemptAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [correcting, setCorrecting] = useState(false);
  const [corrections, setCorrections] = useState({});
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Загрузить ответы
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
  const canCorrect = attempt?.status === 'submitted' && !attempt?.correction_used;

  const startCorrection = () => {
    setCorrecting(true);
    // Предзаполняем старыми ответами
    const initial = {};
    wrongAnswers.forEach(a => {
      initial[a.id] = a.answer_raw || '';
    });
    setCorrections(initial);
  };

  const handleSubmitCorrection = async () => {
    setSubmittingCorrection(true);
    try {
      let newScore = score; // начинаем с текущего кол-ва правильных

      const updates = [];
      for (const answer of wrongAnswers) {
        const newRaw = corrections[answer.id] || '';
        const task = tasks.find(t => t.id === answer.task) || answer.expand?.task;
        if (!task) continue;

        const { isCorrect, normalized } = checkAnswer(newRaw, task.answer);
        if (isCorrect) newScore++;

        updates.push({
          id: answer.id,
          answer_raw: newRaw,
          answer_normalized: isNaN(normalized) ? 0 : normalized,
          is_correct: isCorrect,
        });
      }

      await api.batchUpdateAttemptAnswers(updates);

      const updated = await api.updateAttempt(attempt.id, {
        status: 'corrected',
        score: newScore,
        correction_used: true,
        corrected_at: new Date().toISOString(),
      });

      setAttempt({ ...attempt, ...updated });
      setCorrecting(false);
      message.success('Исправления отправлены');
    } catch (err) {
      console.error('Error submitting corrections:', err);
      message.error('Ошибка при отправке исправлений');
    }
    setSubmittingCorrection(false);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 4 }}>
          {attempt?.status === 'corrected' ? 'Финальный результат' : 'Результат'}
        </Title>
        <Text type="secondary">{attempt?.student_name}</Text>
      </div>

      <div className={`result-score ${scoreClass}`}>
        {score} из {total}
      </div>

      {/* Правильные ответы — краткая сводка */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {wrongAnswers.length === 0 ? (
          <Text style={{ fontSize: 18, color: '#52c41a' }}>
            <CheckCircleOutlined /> Все ответы верны!
          </Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 16 }}>
            Ошибок: {wrongAnswers.length}
          </Text>
        )}
      </div>

      {/* Список ошибочных задач */}
      {wrongAnswers.length > 0 && (
        <>
          <Divider>Ошибочные задачи</Divider>

          {wrongAnswers.map(answer => {
            const task = tasks.find(t => t.id === answer.task) || answer.expand?.task;
            if (!task) return null;
            const taskIndex = tasks.findIndex(t => t.id === answer.task);

            return (
              <div key={answer.id} className="error-task">
                <div className="task-number">Задача {taskIndex + 1}</div>
                <div className="task-statement">
                  <MathRenderer text={task.statement_md} />
                  {task.image && (
                    <img
                      src={`${PB_URL}/api/files/tasks/${task.id}/${task.image}`}
                      alt=""
                      style={{ maxWidth: '100%', marginTop: 8, borderRadius: 8 }}
                    />
                  )}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">Ваш ответ: </Text>
                  <Text className="wrong-badge">{answer.answer_raw || '(пусто)'}</Text>
                </div>

                {/* Поле для исправления */}
                {correcting && (
                  <div style={{ marginTop: 12 }}>
                    <Input
                      className="task-answer-input"
                      placeholder="Новый ответ"
                      inputMode="decimal"
                      value={corrections[answer.id] || ''}
                      onChange={e => setCorrections(prev => ({
                        ...prev,
                        [answer.id]: e.target.value,
                      }))}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Кнопка исправления */}
      {canCorrect && wrongAnswers.length > 0 && !correcting && (
        <div style={{ marginTop: 24 }}>
          <Button
            type="primary"
            size="large"
            block
            icon={<EditOutlined />}
            onClick={startCorrection}
          >
            Исправить ошибки (1 попытка)
          </Button>
        </div>
      )}

      {/* Кнопка отправки исправлений */}
      {correcting && (
        <div className="submit-bar">
          <Button
            type="primary"
            size="large"
            block
            icon={<SendOutlined />}
            onClick={handleSubmitCorrection}
            loading={submittingCorrection}
          >
            Отправить исправления
          </Button>
        </div>
      )}

      {/* Сообщение после финальной отправки */}
      {attempt?.status === 'corrected' && (
        <div style={{ textAlign: 'center', marginTop: 24, padding: 16, background: '#f6ffed', borderRadius: 12 }}>
          <Text style={{ fontSize: 16 }}>
            <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
            Работа завершена. Ожидайте результатов у учителя.
          </Text>
        </div>
      )}
    </div>
  );
};

export default StudentResultPage;
