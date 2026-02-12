import { useState } from 'react';
import { Button, Result, Spin, Typography, Space } from 'antd';
import { LoadingOutlined, StopOutlined, UserOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';

const { Title, Text } = Typography;

/**
 * Страница подтверждения входа ученика.
 * Показывает приветствие и кнопку начала теста.
 */
const StudentEntryPage = ({ sessionId, deviceId, studentSession }) => {
  const { session, loading, error, startAttempt } = studentSession;
  const [starting, setStarting] = useState(false);

  const student = api.getAuthStudent();
  const studentName = student?.name || 'Студент';

  const handleStart = async () => {
    setStarting(true);
    await startAttempt(studentName);
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

  // Приветствие и кнопка начала
  const studentTitle = session.student_title?.trim() || 'Самостоятельная работа';

  return (
    <div style={{ padding: '40px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Title level={3} style={{ marginBottom: 8 }}>{studentTitle}</Title>
        {session.expand?.work?.title && (
          <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 16 }}>
            {session.expand.work.title}
          </Text>
        )}
        <Space style={{ marginTop: 24, justifyContent: 'center' }}>
          <UserOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Text strong style={{ fontSize: 18 }}>
            {studentName}
          </Text>
        </Space>
      </div>

      <Button
        type="primary"
        size="large"
        block
        onClick={handleStart}
        loading={starting}
      >
        Начать тест
      </Button>
    </div>
  );
};

export default StudentEntryPage;
