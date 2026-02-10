import { useState } from 'react';
import { Input, Button, Result, Spin, Typography, Space } from 'antd';
import { LoadingOutlined, StopOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * Страница входа ученика.
 * Показывает форму ввода ФИО или сообщение о закрытии приёма.
 */
const StudentEntryPage = ({ sessionId, deviceId, studentSession }) => {
  const { session, loading, error, startAttempt } = studentSession;
  const [studentName, setStudentName] = useState('');
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    const name = studentName.trim();
    if (!name) return;

    setStarting(true);
    await startAttempt(name);
    setStarting(false);
  };

  // Загрузка
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 40 }} spin />} />
        <div style={{ marginTop: 16, fontSize: 16, color: '#666' }}>Загрузка...</div>
      </div>
    );
  }

  // Ошибка
  if (error || !session) {
    return (
      <Result
        status="error"
        title="Ошибка"
        subTitle={error || 'Сессия не найдена. Проверьте ссылку.'}
      />
    );
  }

  // Приём закрыт
  if (!session.is_open) {
    return (
      <Result
        status="error"
        icon={<StopOutlined />}
        title="Приём ответов закрыт"
        subTitle="Учитель закрыл приём работ. Обратитесь к учителю, если считаете, что это ошибка."
      />
    );
  }

  // Форма входа
  const studentTitle = session.student_title?.trim() || 'Самостоятельная работа';

  return (
    <div style={{ padding: '40px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Title level={3} style={{ marginBottom: 8 }}>{studentTitle}</Title>
        {session.expand?.work?.title && (
          <Text type="secondary" style={{ fontSize: 16 }}>
            {session.expand.work.title}
          </Text>
        )}
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>
            Введите Фамилию и Имя
          </Text>
          <Input
            size="large"
            placeholder="Иванов Иван"
            value={studentName}
            onChange={e => setStudentName(e.target.value)}
            onPressEnter={handleStart}
            autoFocus
            style={{ fontSize: 18 }}
          />
        </div>

        <Button
          type="primary"
          size="large"
          block
          onClick={handleStart}
          loading={starting}
          disabled={!studentName.trim()}
        >
          Начать
        </Button>
      </Space>
    </div>
  );
};

export default StudentEntryPage;
