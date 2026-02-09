import { useState, useMemo } from 'react';
import { ConfigProvider } from 'antd';
import { useStudentSession } from './hooks/useStudentSession';
import StudentEntryPage from './components/student/StudentEntryPage';
import StudentTestPage from './components/student/StudentTestPage';
import StudentResultPage from './components/student/StudentResultPage';
import 'katex/dist/katex.min.css';
import './StudentApp.css';

function StudentApp() {
  // Извлекаем sessionId из URL: /student/{sessionId}
  const sessionId = useMemo(() => {
    const parts = window.location.pathname.split('/student/');
    return parts[1]?.split('/')[0] || '';
  }, []);

  // device_id: генерируем или берём из localStorage
  const [deviceId] = useState(() => {
    let id = localStorage.getItem('ege_device_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('ege_device_id', id);
    }
    return id;
  });

  const studentSession = useStudentSession(sessionId, deviceId);
  const { attempt } = studentSession;

  // Определяем текущий экран на основе состояния attempt
  const currentView = useMemo(() => {
    if (!attempt) return 'entry';
    if (attempt.status === 'started') return 'test';
    return 'result'; // submitted или corrected
  }, [attempt]);

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1890ff' } }}>
      <div className="student-app">
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
          />
        )}
      </div>
    </ConfigProvider>
  );
}

export default StudentApp;
