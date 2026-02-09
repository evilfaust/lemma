import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Button, Space, Typography, Spin, Empty, message, Modal } from 'antd';
import { ReloadOutlined, SwapOutlined, CheckCircleOutlined, CloseCircleOutlined, CheckOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { shuffleArray } from '../../utils/shuffle';

const { Text } = Typography;

/**
 * Панель результатов учителя.
 * Таблица попыток учеников с возможностью просмотра ответов, ручного зачёта и выдачи нового варианта.
 */
const TeacherResultsDashboard = ({ sessionId }) => {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedAnswers, setExpandedAnswers] = useState({});

  const loadAttempts = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await api.getAttemptsBySession(sessionId);
      setAttempts(data);
    } catch (err) {
      console.error('Error loading attempts:', err);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    loadAttempts();
    const interval = setInterval(loadAttempts, 15000);
    return () => clearInterval(interval);
  }, [loadAttempts]);

  const loadAnswers = async (attemptId) => {
    if (expandedAnswers[attemptId]) return;
    try {
      const answers = await api.getAttemptAnswers(attemptId);
      setExpandedAnswers(prev => ({ ...prev, [attemptId]: answers }));
    } catch (err) {
      console.error('Error loading answers:', err);
    }
  };

  // Перезагрузить ответы для конкретной попытки (после зачёта)
  const reloadAnswers = async (attemptId) => {
    try {
      const answers = await api.getAttemptAnswers(attemptId);
      setExpandedAnswers(prev => ({ ...prev, [attemptId]: answers }));
    } catch (err) {
      console.error('Error reloading answers:', err);
    }
  };

  // Засчитать ответ вручную
  const handleAcceptAnswer = async (answer, attemptId) => {
    try {
      await api.updateAttemptAnswer(answer.id, { is_correct: true });

      // Пересчитать score
      const attempt = attempts.find(a => a.id === attemptId);
      if (attempt) {
        const newScore = (attempt.score || 0) + 1;
        await api.updateAttempt(attemptId, { score: newScore });
        setAttempts(prev => prev.map(a =>
          a.id === attemptId ? { ...a, score: newScore } : a
        ));
      }

      // Обновить ответы в развёрнутой строке
      await reloadAnswers(attemptId);
      message.success('Ответ засчитан');
    } catch (err) {
      console.error('Error accepting answer:', err);
      message.error('Ошибка при зачёте ответа');
    }
  };

  // Отменить зачёт (снять галочку)
  const handleRejectAnswer = async (answer, attemptId) => {
    try {
      await api.updateAttemptAnswer(answer.id, { is_correct: false });

      const attempt = attempts.find(a => a.id === attemptId);
      if (attempt) {
        const newScore = Math.max(0, (attempt.score || 0) - 1);
        await api.updateAttempt(attemptId, { score: newScore });
        setAttempts(prev => prev.map(a =>
          a.id === attemptId ? { ...a, score: newScore } : a
        ));
      }

      await reloadAnswers(attemptId);
      message.info('Зачёт отменён');
    } catch (err) {
      console.error('Error rejecting answer:', err);
      message.error('Ошибка при отмене зачёта');
    }
  };

  // Выдать другой вариант
  const handleNewVariant = async (attempt) => {
    Modal.confirm({
      title: 'Выдать другой вариант?',
      content: `Ученику ${attempt.student_name} будет назначен новый вариант. Текущая попытка сохранится.`,
      okText: 'Да, выдать',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          const session = await api.getSession(sessionId);
          if (!session) return;

          const allVariants = await api.getVariantsByWork(session.work);
          if (allVariants.length === 0) {
            message.error('В работе нет вариантов');
            return;
          }

          const allAttempts = await api.getAttemptsBySession(sessionId);
          const assignmentCount = {};
          allVariants.forEach(v => { assignmentCount[v.id] = 0; });
          allAttempts.forEach(a => {
            if (assignmentCount[a.variant] !== undefined) {
              assignmentCount[a.variant]++;
            }
          });

          const minCount = Math.min(...Object.values(assignmentCount));
          let candidates = Object.keys(assignmentCount).filter(
            id => assignmentCount[id] === minCount
          );
          if (candidates.length > 1) {
            candidates = candidates.filter(id => id !== attempt.variant);
          }

          const shuffled = shuffleArray([...candidates]);
          const chosenVariantId = shuffled[0];
          const chosenVariant = allVariants.find(v => v.id === chosenVariantId);

          const taskList = chosenVariant.expand?.tasks || [];
          await api.createAttempt({
            session: sessionId,
            student_name: attempt.student_name,
            device_id: attempt.device_id,
            variant: chosenVariantId,
            status: 'started',
            score: 0,
            total: taskList.length,
          });

          message.success(`Ученику ${attempt.student_name} назначен Вариант ${chosenVariant.number}`);
          loadAttempts();
        } catch (err) {
          console.error('Error assigning new variant:', err);
          message.error('Ошибка при назначении варианта');
        }
      },
    });
  };

  const statusMap = {
    started: { color: 'default', text: 'Начат' },
    submitted: { color: 'blue', text: 'Отправлен' },
    corrected: { color: 'green', text: 'Исправлен' },
  };

  const columns = [
    {
      title: 'Ученик',
      dataIndex: 'student_name',
      key: 'student_name',
      width: 160,
    },
    {
      title: 'Вариант',
      key: 'variant',
      width: 80,
      render: (_, record) => record.expand?.variant?.number || '—',
    },
    {
      title: 'Результат',
      key: 'score',
      width: 100,
      render: (_, record) => {
        if (record.status === 'started') return <Text type="secondary">—</Text>;
        return <Text strong>{record.score} / {record.total}</Text>;
      },
    },
    {
      title: 'Статус',
      key: 'status',
      width: 110,
      render: (_, record) => {
        const s = statusMap[record.status] || { color: 'default', text: record.status };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: 'Исправление',
      key: 'correction',
      width: 100,
      render: (_, record) => record.correction_used ?
        <Tag color="orange">Да</Tag> :
        <Text type="secondary">Нет</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_, record) => (
        <Button
          type="text"
          icon={<SwapOutlined />}
          onClick={() => handleNewVariant(record)}
          title="Другой вариант"
          size="small"
        />
      ),
    },
  ];

  // Expandable: ответы по задачам с кнопкой «Засчитать»
  const expandedRowRender = (record) => {
    const answers = expandedAnswers[record.id];
    if (!answers) return <Spin size="small" />;

    if (answers.length === 0) {
      return <Text type="secondary">Нет ответов</Text>;
    }

    const answerColumns = [
      {
        title: 'Задача',
        key: 'task',
        width: 100,
        render: (_, a) => a.expand?.task?.code || '—',
      },
      {
        title: 'Ответ ученика',
        dataIndex: 'answer_raw',
        key: 'answer_raw',
        width: 120,
        render: (val) => val || <Text type="secondary">(пусто)</Text>,
      },
      {
        title: 'Правильный',
        key: 'correct',
        width: 120,
        render: (_, a) => a.expand?.task?.answer || '—',
      },
      {
        title: 'Результат',
        key: 'is_correct',
        width: 120,
        render: (_, a) => {
          if (a.is_correct) {
            return (
              <Space size={4}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <Button
                  type="text"
                  size="small"
                  danger
                  onClick={() => handleRejectAnswer(a, record.id)}
                  style={{ fontSize: 12, padding: '0 4px' }}
                >
                  Отменить
                </Button>
              </Space>
            );
          }
          return (
            <Space size={4}>
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleAcceptAnswer(a, record.id)}
                style={{ color: '#52c41a', fontSize: 12, padding: '0 4px' }}
              >
                Засчитать
              </Button>
            </Space>
          );
        },
      },
    ];

    return (
      <Table
        columns={answerColumns}
        dataSource={answers}
        rowKey="id"
        pagination={false}
        size="small"
      />
    );
  };

  if (loading && attempts.length === 0) {
    return <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong>Попытки учеников ({attempts.length})</Text>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadAttempts}
          loading={loading}
          size="small"
        >
          Обновить
        </Button>
      </div>

      {attempts.length === 0 ? (
        <Empty description="Пока нет ни одной попытки" />
      ) : (
        <Table
          columns={columns}
          dataSource={attempts}
          rowKey="id"
          size="small"
          pagination={false}
          expandable={{
            expandedRowRender,
            onExpand: (expanded, record) => {
              if (expanded) loadAnswers(record.id);
            },
          }}
          scroll={{ x: 600 }}
        />
      )}
    </div>
  );
};

export default TeacherResultsDashboard;
