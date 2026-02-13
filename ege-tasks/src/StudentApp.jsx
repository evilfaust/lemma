import { useState, useMemo, useEffect } from 'react';
import { ConfigProvider, Button } from 'antd';
import { ArrowLeftOutlined, TrophyOutlined, LogoutOutlined } from '@ant-design/icons';
import { useStudentSession } from './hooks/useStudentSession';
import StudentAuthPage from './components/student/StudentAuthPage';
import StudentEntryPage from './components/student/StudentEntryPage';
import StudentTestPage from './components/student/StudentTestPage';
import StudentResultPage from './components/student/StudentResultPage';
import AchievementGallery from './components/student/AchievementGallery';
import { api } from './services/pocketbase';
import 'katex/dist/katex.min.css';
import './StudentApp.css';

function StudentApp() {
  const generateDeviceId = () => {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }

    if (globalThis.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      // RFC 4122 variant and version 4
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
      return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
    }

    return `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  // Извлекаем sessionId из URL: /student/{sessionId}
  const sessionId = useMemo(() => {
    const parts = window.location.pathname.split('/student/');
    return parts[1]?.split('/')[0] || '';
  }, []);

  // device_id: генерируем или берём из localStorage
  const [deviceId] = useState(() => {
    let id = localStorage.getItem('ege_device_id');
    if (!id) {
      id = generateDeviceId();
      localStorage.setItem('ege_device_id', id);
    }
    return id;
  });

  const [student, setStudent] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Проверить авторизацию при загрузке
  useEffect(() => {
    if (api.isStudentAuthenticated()) {
      setStudent(api.getAuthStudent());
    }
    setAuthChecked(true);
  }, []);

  const studentSession = useStudentSession(sessionId, deviceId, student?.id || null);
  const { attempt, session } = studentSession;
  const [viewOverride, setViewOverride] = useState(null); // Для ручной смены экрана (например, галерея)
  const hasAttemptAchievements = !!attempt && (
    !!attempt.achievement
    || (Array.isArray(attempt.unlocked_achievements) && attempt.unlocked_achievements.length > 0)
  );
  const canOpenAchievements = !!attempt && (session?.achievements_enabled || hasAttemptAchievements);

  const handleAuthSuccess = (authStudent) => {
    setStudent(authStudent);
  };

  const handleLogout = () => {
    api.logoutStudent();
    setStudent(null);
    window.location.reload(); // Перезагрузить для сброса состояния
  };

  // Определяем текущий экран на основе состояния attempt
  const currentView = useMemo(() => {
    if (!authChecked) return 'loading';
    if (!student) return 'auth';
    if (viewOverride) return viewOverride;
    if (!attempt) return 'entry';
    if (attempt.status === 'started') return 'test';
    return 'result'; // submitted или corrected
  }, [authChecked, student, attempt, viewOverride]);

  if (currentView === 'loading') {
    return null; // Или спиннер
  }

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#4361ee' } }}>
      <div className="student-app">
        {/* Верхняя панель навигации */}
        {student && currentView !== 'auth' && (
          <div className="student-top-bar">
            <div className="student-top-bar-left">
              {/* Кнопка "Назад" на экране галереи */}
              {currentView === 'gallery' && (
                <Button
                  className="student-top-bar-btn"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setViewOverride(null)}
                >
                  Назад
                </Button>
              )}
            </div>
            <div className="student-top-bar-right">
              {/* Кнопка "Мои достижения" (показывать только если ачивки включены) */}
              {canOpenAchievements && currentView !== 'gallery' && (
                <Button
                  type="primary"
                  className="student-top-bar-btn student-top-bar-btn--primary"
                  icon={<TrophyOutlined />}
                  onClick={() => setViewOverride('gallery')}
                >
                  Достижения
                </Button>
              )}

              {/* Кнопка выхода */}
              <Button
                className="student-top-bar-btn"
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                title="Выйти"
              />
            </div>
          </div>
        )}

        {currentView === 'auth' && (
          <StudentAuthPage
            onAuthSuccess={handleAuthSuccess}
            sessionTitle={session?.student_title}
          />
        )}

        {currentView === 'entry' && (
          <StudentEntryPage
            sessionId={sessionId}
            deviceId={deviceId}
            studentSession={studentSession}
          />
        )}

        {currentView === 'test' && (
          <StudentTestPage
            studentSession={studentSession}
          />
        )}

        {currentView === 'result' && (
          <StudentResultPage
            studentSession={studentSession}
            sessionId={sessionId}
            deviceId={deviceId}
            onNavigateToGallery={() => setViewOverride('gallery')}
          />
        )}

        {currentView === 'gallery' && (
          <AchievementGallery
            studentSession={studentSession}
          />
        )}
      </div>
    </ConfigProvider>
  );
}

export default StudentApp;
