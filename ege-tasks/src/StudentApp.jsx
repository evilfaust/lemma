import { useState, useMemo } from 'react';
import { ConfigProvider } from 'antd';
import { useStudentSession } from './hooks/useStudentSession';
import StudentEntryPage from './components/student/StudentEntryPage';
import StudentTestPage from './components/student/StudentTestPage';
import StudentResultPage from './components/student/StudentResultPage';
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
