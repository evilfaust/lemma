import { useState } from 'react';
import { Button, Result, Spin, Typography } from 'antd';
import { LoadingOutlined, StopOutlined, UserOutlined, RocketOutlined } from '@ant-design/icons';
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
      <div className="student-skeleton">
        <div className="student-skeleton-circle" />
        <div className="student-skeleton-line" style={{ width: '60%' }} />
        <div className="student-skeleton-line" style={{ width: '40%' }} />
        <div className="student-skeleton-btn" />
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

  const studentTitle = session.student_title?.trim() || 'Самостоятельная работа';

  return (
    <div className="student-entry">
      <div className="student-entry-hero">
        <div className="student-entry-badge">
          <RocketOutlined />
        </div>

        <Title level={3} className="student-entry-title">
          {studentTitle}
        </Title>

        {session.expand?.work?.title && (
          <Text className="student-entry-work-title">
            {session.expand.work.title}
          </Text>
        )}

        <div className="student-entry-student">
          <div className="student-entry-student-icon">
            <UserOutlined />
          </div>
          <span className="student-entry-student-name">
            {studentName}
          </span>
        </div>
      </div>

      <div className="student-entry-start-btn">
        <Button
          type="primary"
          size="large"
          block
          onClick={handleStart}
          loading={starting}
          icon={<RocketOutlined />}
        >
          Начать тест
        </Button>
      </div>
    </div>
  );
};

export default StudentEntryPage;
