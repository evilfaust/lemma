import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { ConfigProvider, Button, notification, theme } from 'antd';
import { ArrowLeftOutlined, TrophyOutlined, LinkOutlined, BarChartOutlined, CalendarOutlined, HomeOutlined, SunOutlined, MoonOutlined, LoginOutlined, ReadOutlined } from '@ant-design/icons';

// Нижнее меню кабинета ученика (показывается залогиненному на всех экранах, кроме теста).
// go(key) — навигация: в кабинете меняет homeView, на странице сессии ведёт на /student/.
// «Выйти» — в меню профиля на главной (v3.9.316), каникулярное — только пока есть программа.
function StudentBottomNav({ active, go, hasSummer }) {
  const Item = ({ k, icon, label }) => (
    <button
      type="button"
      className={`student-bnav-item${active === k ? ' is-active' : ''}`}
      onClick={() => go(k)}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <nav className="student-bnav">
      <Item k="home" icon={<HomeOutlined />} label="Главная" />
      <Item k="courses" icon={<ReadOutlined />} label="Уроки" />
      {hasSummer && <Item k="program" icon={<CalendarOutlined />} label="Каникулы" />}
      <Item k="progress" icon={<BarChartOutlined />} label="Прогресс" />
      <Item k="gallery" icon={<TrophyOutlined />} label="Достижения" />
    </nav>
  );
}

// Каникулярное задание видно, пока у ученика есть программа этого лета — и
// только в сезон (июнь–сентябрь), а не круглый год.
function useHasSummerProgram(student) {
  const [has, setHas] = useState(false);
  useEffect(() => {
    if (!student?.id || !summerSeason()) { setHas(false); return undefined; }
    let cancelled = false;
    api.getStudyProgramForStudent(student.id, { season: 'summer', year: new Date().getFullYear() })
      .then((prog) => { if (!cancelled) setHas(!!prog); })
      .catch(() => { if (!cancelled) setHas(false); });
    return () => { cancelled = true; };
  }, [student?.id]);
  return has;
}

// Кнопка смены темы в правом верхнем углу (на всех экранах ученика).
function ThemeCornerBtn({ isDark, onToggle }) {
  return (
    <button
      type="button"
      className="student-theme-toggle student-theme-corner"
      onClick={onToggle}
      title={isDark ? 'Светлая тема' : 'Тёмная тема'}
    >
      {isDark ? <SunOutlined /> : <MoonOutlined />}
    </button>
  );
}
import { useStudentSession } from './hooks/useStudentSession';
import StudentAuthPage from './components/student/StudentAuthPage';
import StudentPasswordChange from './components/student/StudentPasswordChange';
import StudentEntryPage from './components/student/StudentEntryPage';
import StudentTestPage from './components/student/StudentTestPage';
import StudentMCTestPage from './components/student/StudentMCTestPage';
import StudentResultPage from './components/student/StudentResultPage';
import AchievementGallery from './components/student/AchievementGallery';
import StudentProgressPage from './components/student/StudentProgressPage';
import StudentSummerProgram from './components/student/StudentSummerProgram';
import StudentCoursePortal from './components/student/StudentCoursePortal';
import { api } from './services/pocketbase';
import { useVersionSync } from './shared/version/useVersionSync';
import MarathonLiveBoard from './components/marathon/MarathonLiveBoard';
import StudentHome from './components/student/StudentHome';
import { summerSeason } from './utils/studentHome';
import { roomCodeFromPath, manualIdFromPath } from './utils/stereo/room';
import { workFromLocation } from './utils/geometryWorkLink';
import { showFromLocation } from './utils/workShowLink';
import { articleIdFromPath } from './utils/theoryLink';

// Эфир стереочертежа — отдельный чанк: у остальных учеников он не грузится.
const StudentStereoBoard = lazy(() => import('./components/stereo/StudentStereoBoard'));
const StudentStereoManual = lazy(() => import('./components/stereo/StudentStereoManual'));
const StudentGeometryWork = lazy(() => import('./components/geometry/student/StudentGeometryWork'));
// Работа в режиме показа (только условия, без выдачи) — /r/<id>
const StudentWorkShow = lazy(() => import('./components/student/StudentWorkShow'));
// Статья теории по ссылке — отдельный чанк (markdown + KaTeX + стили темы).
const StudentTheoryArticle = lazy(() => import('./components/theory/StudentTheoryArticle'));
import 'katex/dist/katex.min.css';
import './StudentApp.css';

function StudentHomeLanding({ isDark, onToggleTheme, student, authChecked, onAuthSuccess, onLogout, hasSummer }) {
  const [sessionCode, setSessionCode] = useState('');
  const [homeView, setHomeView] = useState(() => {
    const v = new URLSearchParams(window.location.search).get('v');
    return ['program', 'progress', 'gallery', 'courses'].includes(v) ? v : null;
  });

  // Минимальный псевдо-session для страниц прогресса/галереи
  const homeStudentSession = useMemo(() => ({ student, attempt: null, session: null }), [student]);

  const openSession = () => {
    const code = sessionCode.trim();
    if (!code) return;
    window.location.href = `/student/${encodeURIComponent(code)}`;
  };

  const handleAuthSuccess = (s) => {
    onAuthSuccess(s);
    setHomeView(null);
  };

  const go = (k) => {
    setHomeView(k === 'home' ? null : k);
    window.scrollTo(0, 0);
  };
  const navBar = <StudentBottomNav active={homeView || 'home'} go={go} hasSummer={hasSummer || homeView === 'program'} />;
  const themeCorner = <ThemeCornerBtn isDark={isDark} onToggle={onToggleTheme} />;
  const backBar = (
    <div className="student-top-bar">
      <div className="student-top-bar-left">
        <button
          className="student-theme-toggle student-top-bar-back"
          onClick={() => setHomeView(null)}
          title="Назад"
        >
          <ArrowLeftOutlined />
          <span className="student-top-bar-back-label">Назад</span>
        </button>
      </div>
      <div className="student-top-bar-right">{themeCorner}</div>
    </div>
  );

  // ---- Страница авторизации ----
  if (homeView === 'login' || homeView === 'register') {
    return (
      <div className={`student-app${isDark ? ' student-theme-dark' : ''}`}>
        {backBar}
        <StudentAuthPage onAuthSuccess={handleAuthSuccess} initialTab={homeView} cabinet />
      </div>
    );
  }

  // ---- Смена пароля (меню профиля) ----
  if (homeView === 'password' && student) {
    return (
      <div className={`student-app${isDark ? ' student-theme-dark' : ''}`}>
        {backBar}
        <StudentPasswordChange
          student={student}
          voluntary
          onDone={(rec) => { onAuthSuccess(rec); setHomeView(null); }}
          onLater={() => setHomeView(null)}
        />
      </div>
    );
  }

  // ---- Разделы кабинета ----
  const SECTIONS = {
    courses: () => <StudentCoursePortal student={student} />,
    program: () => <StudentSummerProgram student={student} />,
    progress: () => <StudentProgressPage studentSession={homeStudentSession} />,
    gallery: () => <AchievementGallery studentSession={homeStudentSession} />,
  };
  if (student && SECTIONS[homeView]) {
    return (
      <div className={`student-app student-has-bnav${isDark ? ' student-theme-dark' : ''}`}>
        {themeCorner}
        {SECTIONS[homeView]()}
        {navBar}
      </div>
    );
  }

  const legal = (
    <div className="student-home-legal">
      Lemma &copy; 2026 Oleg Pavlyuchenko ·{' '}
      <a href="https://github.com/evilfaust/lemma" target="_blank" rel="noreferrer">
        AGPL-3.0, исходный код
      </a>
    </div>
  );

  // ---- Главная вошедшего: лента «что делать» (v3.9.316) ----
  if (student) {
    return (
      <div className={`student-home student-home--cabinet student-has-bnav${isDark ? ' student-theme-dark' : ''}`}>
        <StudentHome
          student={student}
          isDark={isDark}
          onToggleTheme={onToggleTheme}
          onLogout={onLogout}
          onChangePassword={() => go('password')}
          go={go}
          hasSummer={hasSummer}
        />
        {legal}
        {navBar}
      </div>
    );
  }

  // ---- Гость: сначала вход, тест по коду — ниже ----
  return (
    <div className={`student-home${isDark ? ' student-theme-dark' : ''}`}>
      {themeCorner}
      <div className="student-home-card">
        <div className="student-home-logo">
          <img src="/lemma-logo-new.png" alt="Лемма" />
        </div>
        <h1 className="student-home-title">Кабинет ученика</h1>
        <p className="student-home-guest-lead">
          Уроки, домашние задания и результаты тестов — в одном месте.
        </p>

        {authChecked && (
          <>
            <Button
              type="primary"
              className="student-home-guest-login"
              icon={<LoginOutlined />}
              onClick={() => setHomeView('login')}
            >
              Войти
            </Button>
            <button type="button" className="student-home-guest-register" onClick={() => setHomeView('register')}>
              Нет логина? <b>Зарегистрироваться</b>
            </button>
          </>
        )}

        <div className="student-home-section-divider student-home-guest-code">
          <span>или</span>
        </div>
        <div className="student-home-guest-code-label">Есть код теста от учителя?</div>
        <div className="student-home-input-wrap">
          <input
            type="text"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value)}
            placeholder="Код с доски"
            className="student-home-input"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            aria-label="Код теста"
            onKeyDown={(e) => {
              if (e.key === 'Enter') openSession();
            }}
          />
          <Button
            className="student-home-btn"
            icon={<LinkOutlined />}
            onClick={openSession}
            disabled={!sessionCode.trim()}
          >
            Открыть тест
          </Button>
        </div>
        <div className="student-home-hint">
          На телефоне удобнее навести камеру на QR-код с доски.
        </div>
      </div>
      {legal}
    </div>
  );
}

function StudentApp() {
  // Detect marathon-live route: /student/marathon-live/{marathonId}
  const marathonLiveMatch = useMemo(
    () => window.location.pathname.match(/\/student\/marathon-live\/([^/]+)/),
    []
  );
  // Эфир стереочертежа: /b/{code} (или /student/b/{code})
  const stereoCode = useMemo(() => roomCodeFromPath(window.location.pathname), []);
  // Пошаговое пособие: /s/{id} (или /student/s/{id})
  const manualId = useMemo(() => manualIdFromPath(window.location.pathname), []);
  // Работа по геометрии: /w/{id} (или /student/w/{id}), вариант — ?v=N
  const geoWork = useMemo(() => workFromLocation(window.location.pathname, window.location.search), []);
  // Работа в режиме показа: /r/{id} (или /student/r/{id}), вариант — ?v=N
  const shownWork = useMemo(() => showFromLocation(window.location.pathname, window.location.search), []);
  // Статья теории по ссылке: /t/{id} (или /student/t/{id})
  const theoryArticleId = useMemo(() => articleIdFromPath(window.location.pathname), []);

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
  // marathon-live — специальный маршрут, не является sessionId
  const sessionId = useMemo(() => {
    if (marathonLiveMatch || stereoCode || manualId || geoWork || shownWork || theoryArticleId) return '';
    const parts = window.location.pathname.split('/student/');
    return parts[1]?.split('/')[0] || '';
  }, [marathonLiveMatch, stereoCode, manualId, geoWork, shownWork, theoryArticleId]);

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

  // Тема: светлая / тёмная
  const [isDark, setIsDark] = useState(() => localStorage.getItem('student-theme') === 'dark');
  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('student-theme', next ? 'dark' : 'light');
      return next;
    });
  };

  useVersionSync();

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
  // Пароль выдал учитель → «Придумай свой пароль»; «Позже» — до конца вкладки (v3.9.294).
  const [pwLater, setPwLater] = useState(() => {
    try { return sessionStorage.getItem('student.pwLater') === '1'; } catch { return false; }
  });
  const postponePassword = () => {
    try { sessionStorage.setItem('student.pwLater', '1'); } catch { /* приватный режим */ }
    setPwLater(true);
  };
  const canOpenAchievements = !!attempt;
  const hasSummer = useHasSummerProgram(student);

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

  if (marathonLiveMatch) {
    return <MarathonLiveBoard marathonId={marathonLiveMatch[1]} />;
  }

  if (theoryArticleId) {
    return (
      <Suspense fallback={null}>
        <StudentTheoryArticle id={theoryArticleId} />
      </Suspense>
    );
  }

  if (geoWork) {
    return (
      <Suspense fallback={null}>
        <StudentGeometryWork id={geoWork.id} variant={geoWork.variant} />
      </Suspense>
    );
  }

  if (shownWork) {
    return (
      <Suspense fallback={null}>
        <StudentWorkShow id={shownWork.id} variant={shownWork.variant} />
      </Suspense>
    );
  }

  if (manualId) {
    return (
      <Suspense fallback={null}>
        <StudentStereoManual id={manualId} />
      </Suspense>
    );
  }

  if (stereoCode) {
    return (
      <Suspense fallback={null}>
        <StudentStereoBoard code={stereoCode} />
      </Suspense>
    );
  }

  if (currentView === 'loading') {
    return null; // Или спиннер
  }

  const antdTheme = {
    token: { colorPrimary: '#4361ee', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' },
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
  };

  if (student?.must_change_password && !pwLater) {
    return (
      <ConfigProvider theme={antdTheme}>
        <div className={`student-app${isDark ? ' student-theme-dark' : ''}`}>
          <StudentPasswordChange student={student} onDone={setStudent} onLater={postponePassword} />
        </div>
      </ConfigProvider>
    );
  }

  if (!sessionId) {
    return (
      <ConfigProvider theme={antdTheme}>
        <StudentHomeLanding
          isDark={isDark}
          onToggleTheme={toggleTheme}
          student={student}
          authChecked={authChecked}
          onAuthSuccess={handleAuthSuccess}
          onLogout={handleLogout}
          hasSummer={hasSummer}
        />
      </ConfigProvider>
    );
  }

  const showSessionNav = !!student && !['test', 'auth'].includes(currentView);
  const sessionNavActive = currentView === 'progress' ? 'progress' : currentView === 'gallery' ? 'gallery' : null;
  const goCabinet = (k) => {
    const map = {
      home: '/student/', courses: '/student/?v=courses', program: '/student/?v=program',
      progress: '/student/?v=progress', gallery: '/student/?v=gallery',
    };
    window.location.href = map[k] || '/student/';
  };

  return (
    <ConfigProvider theme={antdTheme}>
      <div className={`student-app${showSessionNav ? ' student-has-bnav' : ''}${isDark ? ' student-theme-dark' : ''}`}>
        {/* Верхняя панель: «Назад» (для прогресса/галереи) + тема в углу */}
        {currentView !== 'auth' && (
          <div className="student-top-bar">
            <div className="student-top-bar-left">
              {(currentView === 'gallery' || currentView === 'progress') && (
                <button
                  className="student-theme-toggle student-top-bar-back"
                  onClick={() => setViewOverride(null)}
                  title="Назад"
                >
                  <ArrowLeftOutlined />
                  <span className="student-top-bar-back-label">Назад</span>
                </button>
              )}
            </div>
            <div className="student-top-bar-right">
              <button
                className="student-theme-toggle"
                onClick={toggleTheme}
                title={isDark ? 'Светлая тема' : 'Тёмная тема'}
              >
                {isDark ? <SunOutlined /> : <MoonOutlined />}
              </button>
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
          session?.mc_test
            ? <StudentMCTestPage studentSession={studentSession} />
            : <StudentTestPage studentSession={studentSession} />
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

        {currentView === 'progress' && (
          <StudentProgressPage
            studentSession={studentSession}
          />
        )}

        {showSessionNav && (
          <StudentBottomNav active={sessionNavActive} go={goCabinet} hasSummer={hasSummer} />
        )}
      </div>
    </ConfigProvider>
  );
}

export default StudentApp;
