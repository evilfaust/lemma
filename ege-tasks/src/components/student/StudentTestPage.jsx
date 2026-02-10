import { useState } from 'react';
import { Input, Button, Typography, Modal, App } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';
import { checkAnswer } from '../../utils/answerChecker';

const { Title, Text } = Typography;

const PB_URL = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';

/**
 * Страница прохождения теста.
 * Показывает задачи варианта с полями для ответов.
 */
const StudentTestPage = ({ studentSession }) => {
  const { message } = App.useApp();
  const { attempt, setAttempt, variant, tasks } = studentSession;
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

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

      // Сохранить ответы
      await api.batchCreateAttemptAnswers(answerRecords);

      // Обновить попытку
      const updated = await api.updateAttempt(attempt.id, {
        status: 'submitted',
        score,
        total: tasks.length,
        submitted_at: new Date().toISOString(),
      });

      setAttempt({ ...attempt, ...updated });
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
        <Text type="secondary">{attempt.student_name}</Text>
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
