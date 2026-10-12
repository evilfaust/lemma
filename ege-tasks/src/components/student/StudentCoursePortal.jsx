import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Segmented, Spin } from 'antd';
import {
  DownloadOutlined, LinkOutlined, PlayCircleOutlined, VideoCameraOutlined, FormOutlined, CheckCircleFilled,
  ClockCircleOutlined, ReadOutlined, RightOutlined, FundProjectionScreenOutlined, LockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { api } from '../../shared/services/pocketbase';
import { slotRangeFromCode } from '../workspace/lessonTime';
import { homeworkFeed, isNextDue, resolveHomework } from '../../utils/homework';
import { lessonsByDay, mergeRange, rangeToLoad } from '../../utils/studentWeek';
import { itemResult, resultLabel, resultTone, itemRequired, itemSection } from '../../utils/lessonResults';
import StudentWeekView from './StudentWeekView';
import MathRenderer from '../MathRenderer';
import './StudentCoursePortal.css';

/**
 * «Мои уроки» в кабинете ученика (v3.9.291; до этого — «Мои курсы»).
 * Уроки курсов и классов с включённым расписанием приходят из хука
 * /api/lessons/my уже без приватного. ДЗ «к следующему уроку» раскладывает по
 * урокам utils/homework.js — та же функция, что у учителя в модалке урока.
 * Два вида (v3.9.292): «Неделя» (StudentWeekView, по умолчанию; выбор помнится
 * в localStorage `student.lessons.view`) и «Списком». Неделя за пределами
 * загруженного окна догружается (`rangeToLoad`) и сливается с уже полученным.
 *
 * Карточка урока (v3.9.358) — три раздела: «Обязательно» (сделать, со
 * статусом сдачи), «Материалы» и «Результаты» (работы на
 * бумаге). У работ — балл прямо в уроке и «Подробнее» → разбор в «Прогрессе»;
 * закрытые учителем — «результатов пока нет» (utils/lessonResults.js).
 */

const AGENDA_DAYS = 14;  // столько дней вперёд показываем сразу
const PAST_DAYS = 30;    // прошедшие — за месяц
const DAY_MS = 24 * 3600 * 1000;
const VIEW_KEY = 'student.lessons.view';

function readView() {
  try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'week'; } catch { return 'week'; }
}
function saveView(v) {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* приватный режим — не помним */ }
}

// Слить догруженное: уроки по id (свежие поверх), классы — объединением.
function mergeData(prev, next) {
  if (!prev) return next;
  const lessons = new Map(prev.lessons.map((l) => [l.id, l]));
  for (const l of next.lessons) lessons.set(l.id, l);
  const groups = new Map(prev.groups.map((g) => [g.id, g]));
  for (const g of next.groups) groups.set(g.id, g);
  return { groups: [...groups.values()], lessons: [...lessons.values()] };
}

// Точный отсчёт до начала занятия (учитывает конец пары → «идёт сейчас»).
function untilLabel(pub, d) {
  if (!d) return '';
  const now = dayjs();
  const r = slotRangeFromCode(pub.time_slot);
  if (r) {
    const [eh, em] = r[1].split(':').map(Number);
    const end = d.hour(eh).minute(em);
    if (now.isAfter(end)) return 'Завершилось';
    if (!now.isBefore(d)) return 'Идёт сейчас';
  } else if (now.isAfter(d)) {
    return 'Завершилось';
  }
  const mins = d.diff(now, 'minute');
  if (mins < 1) return 'Вот-вот начнётся';
  if (mins < 60) return `Через ${mins} мин`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Через ${hours} ч ${mins % 60} мин`;
  const days = Math.floor(hours / 24);
  return `Через ${days} дн ${hours % 24} ч`;
}

const dateOf = (l) => (l?.date_plan ? dayjs(l.date_plan).locale('ru') : null);
const shortDate = (l) => { const d = dateOf(l); return d ? d.format('D MMM, dd') : ''; };

// Контекст результатов: попытки ученика и переход к разбору в «Прогресс».
const NO_RESULTS = { attempts: [], onOpenAttempt: null };

function ResultBadge({ res }) {
  if (res.state !== 'done') return null;
  return <span className={`sc-score is-${resultTone(res.pct)}`}>{res.total ? `${res.pct}%` : '✓'}</span>;
}

/**
 * Строка пункта: нажимается вся (на телефоне не надо целиться в кнопку),
 * справа — метка действия «Решать ›». Без ссылки — просто строка.
 */
function ItemLine({ icon, title, status, action, primary, href, external, onClick, tone }) {
  const body = (
    <>
      <span className={`sc-item-icon${tone ? ` is-${tone}` : ''}`}>{icon}</span>
      <span className="sc-item-body">
        <span className="sc-item-title">{title}</span>
        {status}
      </span>
      {action && (
        <span className={`sc-act${primary ? ' sc-act--primary' : ''}`}>
          {action}<RightOutlined className="sc-act-arrow" />
        </span>
      )}
    </>
  );
  if (href) {
    return (
      <a className="sc-item sc-item--link" href={href}
        target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
        {body}
      </a>
    );
  }
  if (onClick) return <button type="button" className="sc-item sc-item--link" onClick={onClick}>{body}</button>;
  return <div className="sc-item">{body}</div>;
}

function ItemRow({ item, meta, when, results = NO_RESULTS }) {
  const res = itemResult(item, results.attempts);
  const label = resultLabel(item, res);
  const openResult = res.state === 'done' && results.onOpenAttempt && res.attempt
    ? () => results.onOpenAttempt(res.attempt.id) : null;
  const status = label
    ? <span className={`sc-item-status is-${res.state}`}><ResultBadge res={res} />{res.state === 'done' ? ' ' : ''}{label}</span>
    : null;
  let line;
  if (item.kind === 'work') {
    const finished = res.state === 'done' || res.state === 'hidden';
    if (finished) {
      line = (
        <ItemLine icon={<CheckCircleFilled />} tone="done" title={item.title || 'Работа'} status={status}
          action={openResult ? 'Подробнее' : null} onClick={openResult} />
      );
    } else {
      line = (
        <ItemLine icon={<PlayCircleOutlined />} title={item.title || 'Работа'} status={status}
          action={item.session_id ? (res.state === 'started' ? 'Продолжить' : 'Решать') : null} primary
          href={item.session_id ? `/student/${item.session_id}` : null} />
      );
    }
  } else if (item.kind === 'paper') {
    // Писали на бумаге (v3.9.358): решать нечего — только результат.
    line = (
      <ItemLine icon={res.state === 'done' ? <FormOutlined /> : <LockOutlined />} title={item.title || 'Работа'}
        status={status} action={openResult ? 'Подробнее' : null} onClick={openResult} />
    );
  } else if (item.kind === 'show') {
    // Работа в режиме показа (v3.9.306): только условия, решают в тетради.
    // geometry — работа по геометрии (/w/<id>, v3.9.308), иначе обычная (/r/<id>).
    line = (
      <ItemLine icon={<ReadOutlined />} title={item.title || 'Задания'} action={item.work_id ? 'Открыть' : null}
        href={item.work_id ? `/student/${item.geometry ? 'w' : 'r'}/${item.work_id}` : null} />
    );
  } else if (item.kind === 'file') {
    line = (
      <ItemLine icon={<DownloadOutlined />} title={item.title || 'Материал'} action={item.file_url ? 'Открыть' : null}
        href={item.file_url || null} external />
    );
  } else {
    line = (
      <div className="sc-item sc-item--text">
        <MathRenderer text={item.description || ''} inline={false} />
      </div>
    );
  }
  const sub = [when, meta].filter(Boolean).join(' · ');
  if (!sub) return line;
  return <div className="sc-item-wrap">{line}<div className="sc-item-meta">{sub}</div></div>;
}

function timeRange(pub, d) {
  const r = slotRangeFromCode(pub.time_slot);
  if (r) return `${r[0]}–${r[1]}`;
  return d ? d.format('HH:mm') : '';
}

// Тело урока: что задано к нему раньше, затем три раздела — обязательно,
// материалы (для удобства), результаты (работы на бумаге). Когда сдавать —
// подписью у пункта: на уроке / ДЗ к этому уроку / ДЗ к следующему.
const SECTIONS = [
  { key: 'required', head: '✅ Обязательно', cls: 'sc-block--required' },
  { key: 'materials', head: '📎 Материалы', cls: 'sc-block--materials' },
  { key: 'results', head: '📊 Результаты', cls: 'sc-block--results' },
];

function LessonBody({ lesson, hw, results }) {
  const items = Array.isArray(lesson.items) ? lesson.items : [];
  const incoming = hw.incoming.get(lesson.id) || [];
  if (!incoming.length && !items.length) {
    return lesson.status === 'cancelled' ? null : <div className="sc-empty-note">Материалы появятся позже</div>;
  }
  const target = hw.targetOf.get(lesson.id);
  const whenOf = (it) => {
    if (it.kind === 'paper') return '';
    if (isNextDue(it)) return `ДЗ к следующему уроку · ${target ? shortDate(target) : 'дата уточняется'}`;
    if (it.role === 'homework') return 'ДЗ к этому уроку';
    return 'на уроке';
  };
  return (
    <>
      {incoming.length > 0 && (
        <div className="sc-block sc-block--due">
          <div className="sc-block-head">📌 Сделать к этому уроку</div>
          {incoming.map(({ item, from }, i) => (
            <ItemRow
              key={`in${i}`}
              item={item}
              results={results}
              when={itemRequired(item) ? '' : 'по желанию'}
              meta={`задано на уроке ${shortDate(from)}`}
            />
          ))}
        </div>
      )}
      {SECTIONS.map((sec) => {
        const list = items.filter((it) => itemSection(it) === sec.key);
        if (!list.length) return null;
        return (
          <div key={sec.key} className={`sc-block ${sec.cls}`}>
            <div className="sc-block-head">
              {sec.head}
            </div>
            {list.map((it, i) => <ItemRow key={`${sec.key}${i}`} item={it} when={whenOf(it)} results={results} />)}
          </div>
        );
      })}
    </>
  );
}

function GroupChip({ group }) {
  if (!group) return null;
  return <span className="sc-group-chip">{group.kind === 'course' ? '🎓' : '📘'} {group.name}</span>;
}

// Компактная карточка занятия (расписание/прошедшие).
function LessonCard({ lesson, hw, dimmed, group, results }) {
  const d = dateOf(lesson);
  const cancelled = lesson.status === 'cancelled';
  const until = dimmed || cancelled ? '' : untilLabel(lesson, d);
  return (
    <div className={`sc-card${dimmed ? ' sc-card--dim' : ''}${cancelled ? ' sc-card--cancel' : ''}`}>
      {/* Дата — только в шапке: материалы ниже идут на всю ширину карточки. */}
      <div className="sc-card-head">
        <div className="sc-date">
          <span className="sc-date-day">{d ? d.format('D') : '—'}</span>
          <span className="sc-date-mon">{d ? d.format('MMM') : ''}</span>
        </div>
        <div className="sc-card-main">
          <div className="sc-card-top">
            <span className="sc-card-title">{lesson.title || 'Урок'}</span>
            <span className="sc-card-time"><ClockCircleOutlined /> {timeRange(lesson, d)}</span>
          </div>
          {(group || cancelled) && (
            <div className="sc-card-sub">
              <GroupChip group={group} />
              {cancelled && <span className="sc-cancel-note">Урок отменён</span>}
            </div>
          )}
          {until && <div className="sc-card-until">{until}</div>}
        </div>
      </div>
      <LessonBody lesson={lesson} hw={hw} results={results} />
    </div>
  );
}

// Крупная карточка ближайшего занятия.
function NextLessonHero({ lesson, hw, group, results }) {
  const d = dateOf(lesson);
  const boardUrl = group?.board_url;
  return (
    <div className="sc-hero">
      <div className="sc-hero-head">
        <div>
          <div className="sc-hero-rel">{d ? untilLabel(lesson, d) : 'Ближайший урок'}</div>
          <div className="sc-hero-title">{lesson.title || 'Урок'}</div>
          <div className="sc-hero-when">
            {d ? d.format('dddd, D MMMM') : ''} · <b>{timeRange(lesson, d)}</b>
            {group && <> · {group.name}</>}
          </div>
        </div>
        {(lesson.conference_url || boardUrl) && (
          <div className="sc-hero-actions">
            {lesson.conference_url && (
              <Button type="primary" icon={<VideoCameraOutlined />} href={lesson.conference_url} target="_blank" className="sc-hero-join sc-btn">
                Подключиться
              </Button>
            )}
            {boardUrl && (
              <Button icon={<FundProjectionScreenOutlined />} href={boardUrl} target="_blank" className="sc-hero-join sc-btn">
                Доска
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="sc-hero-body"><LessonBody lesson={lesson} hw={hw} results={results} /></div>
    </div>
  );
}

// Лента «Домашнее задание»: всё обязательное, что сделать, по сроку.
// ДЗ «для удобства» (справочный файл к ДЗ) остаётся в карточке урока.
function HomeworkFeed({ feed, groupOf, results }) {
  if (!feed.length) return null;
  return (
    <section className="sc-hw-feed">
      <div className="sc-section-title">🏠 Домашнее задание</div>
      {feed.map(({ item, from, due }, i) => {
        let when;
        if (!due) when = 'к следующему уроку — дата уточняется';
        else if (due.id === from.id && !dayjs(from.date_plan).isAfter(dayjs())) {
          when = `задано на уроке ${shortDate(from)}`;
        }
        else when = `к уроку ${shortDate(due)}`;
        const g = groupOf(from);
        return <ItemRow key={i} item={item} results={results} meta={g ? `${when} · ${g.name}` : when} />;
      })}
    </section>
  );
}

export default function StudentCoursePortal({ student, onOpenAttempt = null }) {
  const [data, setData] = useState(undefined); // undefined — грузим, null — хук недоступен
  const [loaded, setLoaded] = useState(null);  // загруженное окно { from, to } в мс
  const [extending, setExtending] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState(readView);
  const [day, setDay] = useState(() => dayjs().startOf('day'));
  const [attempts, setAttempts] = useState([]); // попытки ученика — результаты у пунктов урока

  useEffect(() => {
    let cancelled = false;
    if (!api.getStudentLessonAttempts) return undefined;
    api.getStudentLessonAttempts(student.id)
      .then((list) => { if (!cancelled) setAttempts(list || []); })
      .catch(() => { /* без попыток пункты просто без балла */ });
    return () => { cancelled = true; };
  }, [student.id]);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setLoaded(null);
    const now = Date.now();
    const range = { from: now - 60 * DAY_MS, to: now + 120 * DAY_MS };
    api.getMyLessons({ from: new Date(range.from).toISOString(), to: new Date(range.to).toISOString() })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        if (res) setLoaded(range);
      })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [student.id]);

  // Листают неделю за пределы загруженного — догружаем окрестность. Ответ
  // сливается всегда (даже если ученик уже ушёл дальше): данные верные, а
  // запрос в полёте (`pendingRef`) не даёт быстрому листанию плодить новые.
  const pendingRef = useRef(null);
  useEffect(() => {
    if (!loaded || view !== 'week') return;
    const range = rangeToLoad(day, loaded, pendingRef.current);
    if (!range) return;
    pendingRef.current = range;
    setExtending(true);
    api.getMyLessons({ from: new Date(range.from).toISOString(), to: new Date(range.to).toISOString() })
      .then((res) => {
        if (!res) return;
        setData((prev) => mergeData(prev, res));
        setLoaded((prev) => mergeRange(prev, range));
      })
      .catch(() => { /* неделя останется пустой — пусть ученик полистает ещё раз */ })
      .finally(() => {
        if (pendingRef.current === range) { pendingRef.current = null; setExtending(false); }
      });
  }, [day, loaded, view]);

  const changeView = (v) => { setView(v); saveView(v); };

  const groups = data?.groups || [];
  const lessons = useMemo(
    () => [...(data?.lessons || [])].sort((a, b) => new Date(a.date_plan) - new Date(b.date_plan)),
    [data],
  );
  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  // Подписывать класс у урока — только когда их несколько.
  const groupOf = (l) => (groups.length > 1 ? groupsById.get(l.group) : null);
  const hw = useMemo(() => resolveHomework(lessons, (l) => l.items), [lessons]);
  const feed = useMemo(() => homeworkFeed(lessons).filter(({ item }) => itemRequired(item)), [lessons]);
  const results = useMemo(() => ({ attempts, onOpenAttempt }), [attempts, onOpenAttempt]);
  const byDay = useMemo(() => lessonsByDay(lessons), [lessons]);

  if (data === undefined) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>;

  if (data === null) {
    return <div style={{ padding: 24 }}><Empty description="Расписание сейчас недоступно. Попробуй открыть позже." /></div>;
  }

  if (!groups.length) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="Здесь появятся уроки и домашние задания, как только учитель откроет расписание твоего класса или курса." />
      </div>
    );
  }

  const today = dayjs().startOf('day');
  const upcoming = lessons.filter((l) => !dayjs(l.date_plan).isBefore(today));
  const past = lessons
    .filter((l) => dayjs(l.date_plan).isBefore(today) && !dayjs(l.date_plan).isBefore(today.subtract(PAST_DAYS, 'day')))
    .reverse();
  // Герой — ближайший урок, который ещё не прошёл и не отменён.
  const hero = upcoming.find((l) => l.status !== 'cancelled' && untilLabel(l, dateOf(l)) !== 'Завершилось')
    || upcoming.find((l) => l.status !== 'cancelled');
  const rest = upcoming.filter((l) => l !== hero);
  const horizon = today.add(AGENDA_DAYS, 'day');
  const shown = showAll ? rest : rest.filter((l) => dayjs(l.date_plan).isBefore(horizon));
  const hidden = rest.length - shown.length;

  // Расписание по дням.
  const days = [];
  for (const l of shown) {
    const key = dayjs(l.date_plan).format('YYYY-MM-DD');
    if (!days.length || days[days.length - 1].key !== key) days.push({ key, list: [] });
    days[days.length - 1].list.push(l);
  }
  const courses = groups.filter((g) => g.kind === 'course' && (g.conference_url || g.board_url));

  return (
    <div className="sc-portal">
      <h2 className="sc-portal-title"><ReadOutlined /> Мои уроки</h2>

      {courses.map((course) => (
        <div key={course.id} className="sc-course-head">
          <div className="sc-course-name">🎓 {course.name}</div>
          <div className="sc-course-links">
            {course.conference_url && (
              <Button size="small" className="sc-btn" icon={<LinkOutlined />} href={course.conference_url} target="_blank">
                Комната курса
              </Button>
            )}
            {course.board_url && (
              <Button size="small" className="sc-btn" icon={<FundProjectionScreenOutlined />} href={course.board_url} target="_blank">
                Доска
              </Button>
            )}
          </div>
        </div>
      ))}

      <HomeworkFeed feed={feed} groupOf={groupOf} results={results} />

      <Segmented
        className="sc-view-switch"
        block
        value={view}
        onChange={changeView}
        options={[{ value: 'week', label: 'Неделя' }, { value: 'list', label: 'Списком' }]}
      />

      {view === 'week' && (
        <StudentWeekView
          day={day}
          onDay={setDay}
          lessonsMap={byDay}
          hw={hw}
          loading={extending}
          renderLesson={(l) => (
            <LessonCard key={l.id} lesson={l} hw={hw} group={groupOf(l)} results={results} dimmed={dayjs(l.date_plan).isBefore(today)} />
          )}
        />
      )}

      {view === 'list' && (
        <ListView
          {...{ lessons, hw, hero, days, hidden, past, showPast, setShowPast, setShowAll, groupsById, groupOf, results }}
        />
      )}
    </div>
  );
}

// Вид «списком»: ближайший урок, расписание на две недели, прошедшие.
function ListView({ lessons, hw, hero, days, hidden, past, showPast, setShowPast, setShowAll, groupsById, groupOf, results }) {
  return (
    <>
      {hero && <NextLessonHero lesson={hero} hw={hw} group={groupsById.get(hero.group)} results={results} />}
      {!hero && !lessons.length && <div className="sc-empty-note">Уроков пока нет</div>}

      {days.length > 0 && (
        <div className="sc-section">
          <div className="sc-section-title">Расписание</div>
          {days.map(({ key, list }) => (
            <div key={key} className="sc-day">
              <div className="sc-day-head">{dayjs(key).locale('ru').format('dddd, D MMMM')}</div>
              {list.map((l) => <LessonCard key={l.id} lesson={l} hw={hw} group={groupOf(l)} results={results} />)}
            </div>
          ))}
        </div>
      )}
      {hidden > 0 && (
        <button type="button" className="sc-past-toggle" onClick={() => setShowAll(true)}>
          <RightOutlined className="sc-past-caret" /> Показать дальше ({hidden})
        </button>
      )}

      {past.length > 0 && (
        <div className="sc-section">
          <button type="button" className="sc-past-toggle" onClick={() => setShowPast((v) => !v)}>
            <RightOutlined className={`sc-past-caret${showPast ? ' is-open' : ''}`} />
            Прошедшие уроки ({past.length})
          </button>
          {showPast && past.map((l) => <LessonCard key={l.id} lesson={l} hw={hw} group={groupOf(l)} results={results} dimmed />)}
        </div>
      )}
    </>
  );
}
