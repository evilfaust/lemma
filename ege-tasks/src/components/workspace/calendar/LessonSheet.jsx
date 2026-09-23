import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Drawer, Input, Popconfirm } from 'antd';
import {
  CheckOutlined, ClockCircleOutlined, CloseOutlined, EditOutlined, FileTextOutlined,
  PaperClipOutlined, RightOutlined, StopOutlined, UndoOutlined, UserOutlined, VideoCameraOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AttendanceRoster from '../AttendanceRoster';
import { GroupChip, LessonStatusChip, lessonHex } from '../ui';
import { lessonStartEnd, slotLabel } from '../lessonTime';
import { extractNoteText } from '../notesText';
import { api } from '../../../shared/services/pocketbase';
import useIsMobile from '../../../hooks/useIsMobile';
import './mobile.css';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Строки быстрой заметки → блоки BlockNote. «- текст» становится пунктом списка.
function textToBlocks(text) {
  return text.split('\n').map((t) => t.trim()).filter(Boolean).map((t) => {
    const bullet = /^[-–•]\s+/.exec(t);
    return {
      type: bullet ? 'bulletListItem' : 'paragraph',
      content: [{ type: 'text', text: bullet ? t.slice(bullet[0].length) : t, styles: {} }],
    };
  });
}

// Хвостовые пустые абзацы BlockNote держит в конце документа всегда —
// без обрезки каждая быстрая запись шла бы после пустой строки.
function trimTrailingEmpty(body) {
  const out = [...body];
  while (out.length) {
    const b = out[out.length - 1];
    const empty = b?.type === 'paragraph'
      && (!b.content || (Array.isArray(b.content) && b.content.length === 0))
      && !(Array.isArray(b.children) && b.children.length);
    if (!empty) break;
    out.pop();
  }
  return out;
}

/**
 * Карточка урока «в кармане»: всё, что делают на уроке с телефона, —
 * отметить проведённым, посещаемость, дописать заметку, подключиться к
 * конференции. На телефоне — шторка снизу, на компьютере — панель справа.
 * Полная правка (время, материалы, курс) остаётся в LessonModal через onEdit.
 */
export default function LessonSheet({ lesson, onClose, onChange, onEdit, canEdit, myTeacherId = '' }) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { message } = App.useApp();
  // Держим последний урок, чтобы шторка не пустела во время анимации закрытия.
  const lastRef = useRef(lesson);
  if (lesson) lastRef.current = lesson;
  const l = lesson || lastRef.current;

  const [note, setNote] = useState(null);
  const [draft, setDraft] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setNote(null);
    setDraft('');
    if (!lesson?.id) return undefined;
    api.getLessonNote(lesson.id)
      .then((n) => { if (!cancelled) setNote(n); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lesson?.id]);

  const noteLines = useMemo(() => {
    const body = Array.isArray(note?.body) ? note.body : [];
    return body.map((b) => extractNoteText([b])).filter(Boolean);
  }, [note]);

  if (!l) return null;

  const { start, end } = lessonStartEnd(l);
  const status = l.status || 'planned';
  const group = l.expand?.group;
  const isCourse = group?.kind === 'course';
  const conference = (l.conference_url || group?.conference_url || '').trim();
  const foreign = !!(myTeacherId && l.owner && l.owner !== myTeacherId);
  const topic = l.expand?.ktp_entry?.title || '';
  const mats = (Array.isArray(l.materials) ? l.materials : [])
    .filter((m) => m.type === 'work' || m.type === 'material');
  const slot = slotLabel(l.time_slot);
  const hex = lessonHex(l);

  const setStatus = async (next) => {
    setStatusBusy(true);
    try {
      await api.updateLesson(l.id, { status: next });
      onChange?.({ ...l, status: next });
      if (next === 'done') message.success('Урок отмечен проведённым');
    } catch {
      message.error('Не удалось обновить урок');
    } finally {
      setStatusBusy(false);
    }
  };

  const addToNote = async () => {
    const blocks = textToBlocks(draft);
    if (!blocks.length) return;
    setNoteBusy(true);
    try {
      const base = note || await api.getOrCreateLessonNote(l);
      // Перечитываем перед записью: заметку могли править с компьютера.
      const fresh = await api.getNote(base.id).catch(() => base);
      const body = trimTrailingEmpty(Array.isArray(fresh.body) ? fresh.body : []);
      const saved = await api.updateNote(fresh.id, { body: [...body, ...blocks] });
      setNote(saved);
      setDraft('');
      message.success('Записано в заметку урока');
    } catch {
      message.error('Не удалось сохранить заметку');
    } finally {
      setNoteBusy(false);
    }
  };

  const openFullNote = async () => {
    try {
      const n = note || await api.getOrCreateLessonNote(l);
      onClose?.();
      navigate(`/app/notes?note=${n.id}`);
    } catch {
      message.error('Не удалось открыть заметку');
    }
  };

  const openMaterial = (m) => {
    if (m.type === 'material') { if (m.url) window.open(m.url, '_blank', 'noopener'); return; }
    onClose?.();
    navigate(`/app/works/${m.id}/edit`);
  };

  return (
    <Drawer
      open={!!lesson}
      onClose={onClose}
      placement={isMobile ? 'bottom' : 'right'}
      height={isMobile ? '92%' : undefined}
      width={isMobile ? undefined : 460}
      closable={false}
      rootClassName={`lesson-sheet${isMobile ? ' lesson-sheet--mobile' : ''}`}
      styles={{ body: { padding: 0 } }}
    >
      <div className="ls">
        {isMobile && <div className="ls-grab" onClick={onClose} role="presentation" />}
        <div className="ls-head">
          <span className="ls-when" style={{ color: hex.ink || hex.base }}>
            <ClockCircleOutlined />
            {cap(dayjs(start).format('dd, D MMMM'))} · {dayjs(start).format('HH:mm')}–{dayjs(end).format('HH:mm')}
            {slot && <span className="ls-slot">{slot}</span>}
          </span>
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} aria-label="Закрыть" />
        </div>

        <div className="ls-title">{l.title || 'Урок'}</div>
        {topic && topic !== l.title && <div className="ls-topic">{topic}</div>}
        <div className="ls-chips">
          {group && <GroupChip id={group.id} name={group.name} />}
          <LessonStatusChip status={status} />
          {foreign && (
            <span className="ls-foreign"><UserOutlined /> ведёт {l.expand?.owner?.name || 'коллега'}</span>
          )}
        </div>

        <div className="ls-actions">
          {canEdit && status !== 'cancelled' && (
            <Button
              size="large"
              type={status === 'done' ? 'default' : 'primary'}
              icon={status === 'done' ? <UndoOutlined /> : <CheckOutlined />}
              loading={statusBusy}
              onClick={() => setStatus(status === 'done' ? 'planned' : 'done')}
            >
              {status === 'done' ? 'Не проведён' : 'Провёл'}
            </Button>
          )}
          <Button size="large" icon={<FileTextOutlined />} onClick={openFullNote}>Заметка</Button>
          {canEdit && onEdit && (
            <Button size="large" icon={<EditOutlined />} onClick={() => onEdit(l)}>Изменить</Button>
          )}
        </div>

        {conference && (
          <Button block size="large" icon={<VideoCameraOutlined />} href={conference} target="_blank"
            rel="noreferrer" className="ls-conf">
            Подключиться к конференции
          </Button>
        )}

        <section className="ls-section">
          <AttendanceRoster lessonId={l.id} groupId={l.group} canEdit={canEdit} isCourse={isCourse} />
        </section>

        <section className="ls-section">
          <div className="ls-section__title"><FileTextOutlined /> Заметка урока</div>
          {noteLines.length > 0 && (
            <div className="ls-note-lines" onClick={openFullNote} role="button" tabIndex={0}>
              {noteLines.slice(-6).map((t, i) => <div key={i} className="ls-note-line">{t}</div>)}
              {noteLines.length > 6 && <div className="ls-note-more">ещё {noteLines.length - 6} — открыть целиком</div>}
            </div>
          )}
          {canEdit && (
            <>
              <Input.TextArea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoSize={{ minRows: 2, maxRows: 6 }}
                placeholder="Что прошли, кому что задать… («- » в начале строки — пункт списка)"
                maxLength={4000}
              />
              <Button type="primary" block className="ls-note-add" loading={noteBusy}
                disabled={!draft.trim()} onClick={addToNote}>
                Дописать в заметку
              </Button>
            </>
          )}
        </section>

        {mats.length > 0 && (
          <section className="ls-section">
            <div className="ls-section__title"><PaperClipOutlined /> Материалы · {mats.length}</div>
            {mats.map((m) => (
              <div key={`${m.type}-${m.id}`} className="ls-mat" role="button" tabIndex={0} onClick={() => openMaterial(m)}>
                {m.type === 'material' ? <FileTextOutlined /> : <PaperClipOutlined />}
                <span className="ls-mat__title">{m.title || 'Работа'}</span>
                <RightOutlined className="ls-mat__go" />
              </div>
            ))}
          </section>
        )}

        {canEdit && (
          <div className="ls-foot">
            {status === 'cancelled' ? (
              <Button type="link" icon={<UndoOutlined />} loading={statusBusy} onClick={() => setStatus('planned')}>
                Вернуть урок в расписание
              </Button>
            ) : (
              <Popconfirm title="Отметить урок отменённым?" okText="Отменить урок" cancelText="Нет"
                onConfirm={() => setStatus('cancelled')}>
                <Button type="link" danger icon={<StopOutlined />}>Урок отменён</Button>
              </Popconfirm>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
