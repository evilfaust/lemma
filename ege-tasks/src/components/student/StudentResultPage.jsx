import { useState, useEffect } from 'react';
import { Typography, Spin, Divider } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';

const { Title, Text } = Typography;

const PB_URL = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';

/**
 * Страница результатов ученика.
 * Показывает результат, ошибочные задачи и кнопку исправления.
 */
const StudentResultPage = ({ studentSession }) => {
  const { attempt, tasks } = studentSession;
  const [attemptAnswers, setAttemptAnswers] = useState([]);
  const [loading, setLoading] = useState(true);

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
          Результат
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
                  {(task.image_url || task.image) && (
                    <img
                      src={task.image_url || `${PB_URL}/api/files/tasks/${task.id}/${task.image}`}
                      alt=""
                      style={{ maxWidth: '100%', marginTop: 8, borderRadius: 8 }}
                    />
                  )}
                </div>
                <div style={{ marginTop: 8 }}>
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
