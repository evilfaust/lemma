import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Button, Dropdown } from 'antd';
import {
  CheckCircleFilled, ClockCircleOutlined, DownloadOutlined, FileTextOutlined, LinkOutlined,
  LockOutlined, LogoutOutlined, MobileOutlined, MoonOutlined, PlayCircleOutlined, ReadOutlined, RightOutlined,
  SunOutlined, CalendarOutlined, VideoCameraOutlined, FundProjectionScreenOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../shared/services/pocketbase';
import { addressOf } from '../../utils/studentAddress';
import { retakeLabel } from '../../utils/attemptRetake';
import {
  currentLesson, nextLesson, lessonTimeLabel, untilLabel, unfinishedAttempts, recentResults, retakeOffers,
  todoList, todayLabel, relDayLabel,
} from '../../utils/studentHome';
import { useStereoFeed, LiveRoomCards, TeacherMaterials, hasTeacherMaterials } from './StudentStereoFeed';
import { InstallAppCard, useInstallAction } from '../../student/pwa/InstallApp';
import './studentHome.css';

// Формулы в тексте задания — отдельным чанком (v3.9.374): ради одного
// описания главная тянула markdown, KaTeX и движки чертежей (~250 КБ сжатых).
// Пока чанк едет, текст виден как есть.
const MathRenderer = lazy(() => import('../MathRenderer'));

/**
 * Главная вошедшего ученика (v3.9.316) — лента «что делать», блоки по
 * срочности: Сейчас (эфир, недорешённый тест, идущий урок) → Сделать (ДЗ) →
 * Ближайший урок → От учителя → Последние результаты → код теста.
 * Пустые блоки не показываются. Раскладка данных — `utils/studentHome.js`.
 */

const TODO_SHOW = 5;
const DAY_MS = 24 * 3600 * 1000;

const KIND_ICON = {
  work: <PlayCircleOutlined />,
  show: <ReadOutlined />,
  file: <DownloadOutlined />,
  text: <FileTextOutlined />,
};

function Section({ title, extra, children }) {
  return (
    <section className="sh-section">
      <div className="sh-section-head">
        <h2 className="sh-section-title">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function MoreLink({ onClick, children }) {
  return (
    <button type="button" className="sh-more" onClick={onClick}>
      {children} <RightOutlined />
    </button>
  );
}

function TodoRow({ row }) {
  const { link } = row;
  return (
    <div className={`sh-todo${row.done ? ' is-done' : ''}`}>
      <span className="sh-todo-icon">{row.done ? <CheckCircleFilled /> : KIND_ICON[row.kind] || KIND_ICON.text}</span>
      <div className="sh-todo-main">
        {row.kind === 'text' && row.item.description
          ? <div className="sh-todo-text">
              <Suspense fallback={row.item.description}>
                <MathRenderer text={row.item.description} inline={false} />
              </Suspense>
            </div>
          : <div className="sh-todo-title">{row.title}</div>}
        <div className="sh-todo-due">
          {row.done ? 'сдано' : row.dueLabel}
          {row.retake && <span className="sh-retake-note"> · можно пересдать</span>}
        </div>
      </div>
      {link && row.retake && (
        <Button size="small" className="sh-btn" href={link.href}>Пересдать</Button>
      )}
      {link && !row.done && (
        <Button
          size="small"
          type={row.kind === 'work' ? 'primary' : 'default'}
          className="sh-btn"
          href={link.href}
          target={link.external ? '_blank' : undefined}
        >
          {link.action}
        </Button>
      )}
    </div>
  );
}

function ResultRow({ r }) {
  if (r.hidden) {
    return (
      <a className="sh-result sh-result--hidden" href={`/student/${r.sessionId}`}>
        <div className="sh-result-main">
          <div className="sh-result-title">{r.title}</div>
          <div className="sh-result-note">Сдано · результат появится позже</div>
          {r.retake && <div className="sh-retake-note">{retakeLabel(r.retake)}</div>}
        </div>
        <div className="sh-result-score">
          <span>{relDayLabel(r.date)}</span>
        </div>
      </a>
    );
  }
  const tone = r.pct >= 85 ? 'good' : r.pct >= 50 ? 'mid' : 'low';
  return (
    <a className="sh-result" href={`/student/${r.sessionId}`}>
      <div className="sh-result-main">
        <div className="sh-result-title">{r.title}</div>
        <div className="sh-result-bar"><span className={`is-${tone}`} style={{ width: `${r.pct}%` }} /></div>
        {r.retake && <div className="sh-retake-note">{retakeLabel(r.retake)}</div>}
      </div>
      <div className="sh-result-score">
        <b>{r.score}</b>/{r.total}
        <span>{relDayLabel(r.date)}</span>
      </div>
    </a>
  );
}

function CodeEntry() {
  const [code, setCode] = useState('');
  const open = () => {
    const c = code.trim();
    if (c) window.location.href = `/student/${encodeURIComponent(c)}`;
  };
  return (
    <div className="sh-code">
      <div className="sh-code-label">Есть код теста от учителя?</div>
      <div className="sh-code-row">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
          placeholder="Код с доски"
          className="sh-code-input"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          aria-label="Код теста"
        />
        <Button type="primary" icon={<LinkOutlined />} onClick={open} disabled={!code.trim()} className="sh-btn">
          Открыть
        </Button>
      </div>
    </div>
  );
}

export default function StudentHome({ student, isDark, onToggleTheme, onLogout, onChangePassword, go, hasSummer }) {
  const [lessonsData, setLessonsData] = useState(undefined); // undefined — грузим, null — недоступно
  const [attempts, setAttempts] = useState(undefined);
  const [now, setNow] = useState(() => dayjs());
  const feed = useStereoFeed();
  const install = useInstallAction();

  useEffect(() => {
    let cancelled = false;
    const t = Date.now();
    api.getMyLessons({
      from: new Date(t - 8 * DAY_MS).toISOString(),
      to: new Date(t + 30 * DAY_MS).toISOString(),
    })
      .then((res) => { if (!cancelled) setLessonsData(res); })
      .catch(() => { if (!cancelled) setLessonsData(null); });
    api.getRecentStudentAttempts(student.id)
      .then((res) => { if (!cancelled) setAttempts(res || []); })
      .catch(() => { if (!cancelled) setAttempts([]); });
    return () => { cancelled = true; };
  }, [student.id]);

  // «Идёт сейчас» и отсчёт до урока живут по минутам.
  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const lessons = lessonsData?.lessons || [];
  const groups = lessonsData?.groups || [];
  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const nowLesson = useMemo(() => currentLesson(lessons, now), [lessons, now]);
  const upcoming = useMemo(() => nextLesson(lessons, now), [lessons, now]);
  const todos = useMemo(() => todoList(lessons, attempts || [], now), [lessons, attempts, now]);
  const unfinished = useMemo(() => unfinishedAttempts(attempts || [], now), [attempts, now]);
  const results = useMemo(() => recentResults(attempts || []), [attempts]);
  const retakes = useMemo(() => retakeOffers(attempts || [], now), [attempts, now]);

  const loading = lessonsData === undefined || attempts === undefined;
  const name = addressOf(student) || student.name;
  const className = groups.length === 1 ? groups[0].name : (student.student_class || '');
  const groupLabel = (id) => (groups.length > 1 ? groupsById.get(id)?.name : '');

  const rooms = feed?.rooms || [];
  const hasNow = rooms.length > 0 || unfinished.length > 0 || retakes.length > 0 || !!nowLesson;
  const openTodos = todos.filter((r) => !r.done);
  const shownTodos = todos.slice(0, TODO_SHOW);
  const hiddenTodos = todos.length - shownTodos.length;
  const nothing = !loading && !hasNow && !groups.length && !results.length
    && !hasTeacherMaterials(feed) && !hasSummer;

  const menu = {
    items: [
      { key: 'who', label: <span className="sh-menu-who">{student.name}<br /><small>{student.username}</small></span>, disabled: true },
      { type: 'divider' },
      { key: 'password', icon: <LockOutlined />, label: 'Сменить пароль' },
      ...(install.platform ? [{ key: 'install', icon: <MobileOutlined />, label: 'Установить на телефон' }] : []),
      { key: 'logout', icon: <LogoutOutlined />, label: 'Выйти', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') onLogout();
      if (key === 'password') onChangePassword();
      if (key === 'install') install.start();
    },
  };

  return (
    <div className="sh">
      <header className="sh-head">
        <div className="sh-head-text">
          <div className="sh-hello">Привет, {name}!</div>
          <div className="sh-date">
            {todayLabel(now)}
            {className && <span className="sh-class">{className}</span>}
          </div>
        </div>
        <div className="sh-head-actions">
          <button
            type="button"
            className="student-theme-toggle"
            onClick={onToggleTheme}
            title={isDark ? 'Светлая тема' : 'Тёмная тема'}
          >
            {isDark ? <SunOutlined /> : <MoonOutlined />}
          </button>
          <Dropdown menu={menu} trigger={['click']} placement="bottomRight">
            <button type="button" className="sh-avatar" title="Профиль" aria-label="Профиль">
              {(name || '?').trim().charAt(0).toUpperCase()}
            </button>
          </Dropdown>
        </div>
      </header>

      <InstallAppCard />

      {/* Пока едут уроки и попытки, лента пуста — без крутилки казалось, что
          у ученика ничего нет или приложение зависло (v3.9.373). */}
      {loading && (
        <div className="sh-loading" role="status">
          <span className="boot-spinner boot-spinner--sm" aria-hidden />
          Загружаем уроки и результаты…
        </div>
      )}

      {hasNow && (
        <Section title="Сейчас">
          <div className="sh-now">
            <LiveRoomCards rooms={rooms} />
            {nowLesson && (
              <div className="sh-now-card sh-now-card--lesson">
                <span className="sh-now-badge">идёт урок</span>
                <div className="sh-now-main">
                  <div className="sh-now-title">{nowLesson.title || 'Урок'}</div>
                  <div className="sh-now-sub">
                    {lessonTimeLabel(nowLesson)}
                    {groupLabel(nowLesson.group) && <> · {groupLabel(nowLesson.group)}</>}
                  </div>
                </div>
                {nowLesson.conference_url && (
                  <Button type="primary" icon={<VideoCameraOutlined />} href={nowLesson.conference_url} target="_blank" className="sh-btn">
                    Подключиться
                  </Button>
                )}
              </div>
            )}
            {unfinished.map((u) => (
              <a key={u.sessionId} className="sh-now-card" href={`/student/${u.sessionId}`}>
                <span className={`sh-now-badge ${u.issued ? 'sh-now-badge--retake' : 'sh-now-badge--test'}`}>
                  {u.issued ? 'новая попытка' : 'не закончен'}
                </span>
                <div className="sh-now-main">
                  <div className="sh-now-title">{u.title}</div>
                  <div className="sh-now-sub">
                    {u.issued ? `учитель дал ещё попытку · ${relDayLabel(u.started, now)}` : `начат ${relDayLabel(u.started, now)}`}
                  </div>
                </div>
                <span className="sh-now-go">{u.issued ? 'Начать' : 'Продолжить'} <RightOutlined /></span>
              </a>
            ))}
            {retakes.map((r) => (
              <a key={`retake-${r.sessionId}`} className="sh-now-card" href={`/student/${r.sessionId}`}>
                <span className="sh-now-badge sh-now-badge--retake">можно пересдать</span>
                <div className="sh-now-main">
                  <div className="sh-now-title">{r.title}</div>
                  <div className="sh-now-sub">
                    {r.pct != null ? `лучший результат ${r.pct}% · ` : ''}{retakeLabel(r).replace('Можно пересдать · ', '')}
                  </div>
                </div>
                <span className="sh-now-go">Пересдать <RightOutlined /></span>
              </a>
            ))}
          </div>
        </Section>
      )}

      {groups.length > 0 && (
        <Section
          title={openTodos.length ? `Сделать · ${openTodos.length}` : 'Сделать'}
          extra={<MoreLink onClick={() => go('courses')}>Уроки и ДЗ</MoreLink>}
        >
          {todos.length === 0
            ? <div className="sh-empty">Домашних заданий нет.</div>
            : (
              <div className="sh-card sh-list">
                {shownTodos.map((row) => <TodoRow key={row.key} row={row} />)}
                {hiddenTodos > 0 && (
                  <button type="button" className="sh-list-more" onClick={() => go('courses')}>
                    Ещё {hiddenTodos} — во всех уроках
                  </button>
                )}
              </div>
            )}
        </Section>
      )}

      {upcoming && (
        <Section title="Ближайший урок">
          <button type="button" className="sh-card sh-lesson" onClick={() => go('courses')}>
            <div className="sh-lesson-date">
              <span className="sh-lesson-day">{dayjs(upcoming.date_plan).format('D')}</span>
              <span className="sh-lesson-mon">{dayjs(upcoming.date_plan).locale('ru').format('MMM')}</span>
            </div>
            <div className="sh-lesson-main">
              <div className="sh-lesson-title">{upcoming.title || 'Урок'}</div>
              <div className="sh-lesson-sub">
                <ClockCircleOutlined /> {lessonTimeLabel(upcoming)}
                {groupLabel(upcoming.group) && <> · {groupLabel(upcoming.group)}</>}
              </div>
              <div className="sh-lesson-until">{untilLabel(upcoming, now)}</div>
            </div>
            <RightOutlined className="sh-lesson-arrow" />
          </button>
        </Section>
      )}

      {hasSummer && (
        <Section title="Каникулярное задание">
          <button type="button" className="sh-card sh-lesson" onClick={() => go('program')}>
            <span className="sh-summer-icon"><CalendarOutlined /></span>
            <div className="sh-lesson-main">
              <div className="sh-lesson-title">Моя программа на каникулы</div>
              <div className="sh-lesson-sub">Задания по неделям и что уже сделано</div>
            </div>
            <RightOutlined className="sh-lesson-arrow" />
          </button>
        </Section>
      )}

      {hasTeacherMaterials(feed) && (
        <Section title="От учителя">
          <div className="sh-materials"><TeacherMaterials feed={feed} /></div>
        </Section>
      )}

      {results.length > 0 && (
        <Section title="Последние результаты" extra={<MoreLink onClick={() => go('progress')}>Весь прогресс</MoreLink>}>
          <div className="sh-card sh-list">
            {results.map((r) => <ResultRow key={r.sessionId} r={r} />)}
          </div>
        </Section>
      )}

      {nothing && (
        <div className="sh-card sh-welcome">
          <FundProjectionScreenOutlined className="sh-welcome-icon" />
          <div className="sh-welcome-title">Пока здесь пусто</div>
          <div className="sh-welcome-text">
            Здесь появятся домашние задания, ближайшие уроки и результаты тестов,
            когда учитель откроет их твоему классу. А тест по коду можно открыть ниже.
          </div>
        </div>
      )}

      <CodeEntry />
      {install.modal}
    </div>
  );
}
