import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Button, Popconfirm } from 'antd';
import {
  EditOutlined, DeleteOutlined, CheckOutlined, ClockCircleOutlined,
  TeamOutlined, FlagFilled, CloseOutlined, PaperClipOutlined, FileTextOutlined,
  EyeOutlined, RightOutlined, BankOutlined, UserOutlined,
} from '@ant-design/icons';
import { Chip, GroupChip, LessonStatusChip, groupHex, lessonHex } from '../ui';
import { lessonStartEnd } from '../lessonTime';
import { api } from '../../../shared/services/pocketbase';
import { deadlineTitle } from './calendarUtils';
import { KIND_LABELS, KIND_COLORS } from '../../../shared/services/pb/schoolEvents';
import FilePreviewModal from '../FilePreviewModal';

const TYPE_CHIP = {
  lesson: { tone: 'blue', label: 'Урок' },
  deadline: { tone: 'amber', label: 'Дедлайн' },
  todo: { tone: 'teal', label: 'Дело' },
  school: { tone: 'slate', label: 'Школьное' },
};

/**
 * Боковой инспектор события (slide-over). Содержимое адаптируется под тип:
 * урок · дедлайн · дело. Правка/удаление — через колбэки оркестратора.
 */
export default function EventInspector({
  event, onClose, onEdit, onDelete, onToggleTodo, onToggleLessonDone, onOpenWork, onOpenNote,
  canEdit, canDelete, myTeacherId = '',
}) {
  const open = !!event;
  const r = event?.resource || {};
  const type = r.type;
  const chip = TYPE_CHIP[type];

  // Заметка урока (если уже существует) — для ссылки «Открыть заметку».
  const [note, setNote] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (type !== 'lesson' || !r.raw?.id) { setNote(null); return undefined; }
    api.getLessonNote(r.raw.id)
      .then((n) => { if (!cancelled) setNote(n); })
      .catch(() => { if (!cancelled) setNote(null); });
    return () => { cancelled = true; };
  }, [type, r.raw?.id]);

  // Предпросмотр файла-материала (перед скачиванием).
  const [preview, setPreview] = useState(null); // { record, url } | null
  const openMaterial = (m) => {
    if (m.type === 'material') {
      setPreview({
        url: m.url,
        record: { title: m.title, original_name: m.url ? m.url.split('?')[0] : m.title },
      });
    } else {
      onOpenWork(m.id);
    }
  };

  return (
    <>
      <div className={`cal-scrim${open ? ' is-open' : ''}`} onClick={onClose} />
      <div className={`cal-inspector${open ? ' is-open' : ''}`} role="dialog" aria-modal="true">
        {event && (
          <>
            <div className="ci-head">
              {chip && <Chip tone={chip.tone} dot={false}>{chip.label}</Chip>}
              <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
            </div>

            {/* ── Урок ── */}
            {type === 'lesson' && (() => {
              const l = r.raw;
              const { start, end } = lessonStartEnd(l);
              const mats = Array.isArray(l.materials) ? l.materials : [];
              return (
                <div className="ci-body">
                  <div className="ci-title">{l.title}</div>
                  <div className="ci-chips">
                    {r.groupName && <GroupChip id={r.groupId} name={r.groupName} />}
                    <LessonStatusChip status={r.status} />
                    {/* Тот же жест, что на блоке урока в сетке: кружок-галочка
                        переключает planned ⇄ done. */}
                    {canEdit && r.status !== 'cancelled' && (
                      <span
                        className={`ci-done${r.status === 'done' ? ' is-on' : ''}`}
                        role="checkbox"
                        aria-checked={r.status === 'done'}
                        aria-label={r.status === 'done' ? 'Вернуть в запланированные' : 'Отметить проведённым'}
                        title={r.status === 'done' ? 'Вернуть в запланированные' : 'Отметить проведённым'}
                        tabIndex={0}
                        style={r.status === 'done'
                          ? { borderColor: lessonHex(r.raw).base, background: lessonHex(r.raw).base }
                          : undefined}
                        onClick={() => onToggleLessonDone(l)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onToggleLessonDone(l); }
                        }}
                      >
                        <CheckOutlined />
                      </span>
                    )}
                  </div>
                  <div className="ci-meta">
                    <div><ClockCircleOutlined /> {dayjs(start).format('D MMMM, HH:mm')}–{dayjs(end).format('HH:mm')}</div>
                    {r.isForeign && (
                      <div><UserOutlined /> Ведёт: {r.ownerName || 'коллега'} · вы второй учитель</div>
                    )}
                  </div>

                  {note && (
                    <div className="ci-note-link">
                      <Button type="link" icon={<FileTextOutlined />} style={{ paddingLeft: 0 }}
                        onClick={() => onOpenNote(note.id)}>
                        Открыть заметку урока
                      </Button>
                    </div>
                  )}

                  <div className="ci-section-title">Материалы</div>
                  {mats.length === 0 ? (
                    <div className="ci-warn">
                      Материалы ещё не прикреплены
                      {canEdit && <Button size="small" type="link" onClick={() => onEdit(event)}>Собрать</Button>}
                    </div>
                  ) : (
                    <div className="ci-mats">
                      {mats.map((m) => (
                        <div key={m.id} className="ci-mat" role="button" tabIndex={0}
                          onClick={() => openMaterial(m)}>
                          {m.type === 'material' ? <FileTextOutlined /> : <PaperClipOutlined />}
                          <span className="ci-mat-title">{m.title || 'Работа'}</span>
                          {m.type === 'material' ? <EyeOutlined className="ci-mat-action" /> : <RightOutlined className="ci-mat-action" />}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="ci-actions">
                    <Button type="primary" icon={<TeamOutlined />} onClick={() => onEdit(event)}>
                      Отметить посещаемость
                    </Button>
                    {canEdit && <Button icon={<EditOutlined />} onClick={() => onEdit(event)} />}
                    {canDelete && (
                      <Popconfirm title="Удалить урок?" okText="Удалить" cancelText="Отмена"
                        okButtonProps={{ danger: true }} onConfirm={() => onDelete(event)}>
                        <Button danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Школьное мероприятие ── */}
            {type === 'school' && (() => {
              const e = r.raw;
              const hex = groupHex(r.color || KIND_COLORS[r.kind] || 'slate');
              const start = dayjs(e.date_start);
              const end = e.date_end ? dayjs(e.date_end) : null;
              const allDay = e.all_day !== false;
              const fmt = allDay ? 'D MMMM YYYY' : 'D MMMM YYYY, HH:mm';
              // Правит и удаляет только автор — у остальных PB вернёт 403.
              const mine = !!myTeacherId && e.owner === myTeacherId;
              return (
                <div className="ci-body">
                  <div className="ci-title">{e.title}</div>
                  <div className="ci-chips">
                    <Chip tone="neutral" dot={false} style={{ color: hex.ink, background: hex.soft }}>
                      <BankOutlined /> {KIND_LABELS[r.kind] || 'Мероприятие'}
                    </Chip>
                    {allDay && <Chip tone="neutral" dot={false}>весь день</Chip>}
                  </div>
                  <div className="ci-meta">
                    <div>
                      <ClockCircleOutlined />{' '}
                      {end && !end.isSame(start, 'day')
                        ? `${start.format('D MMMM')} — ${end.format(fmt)}`
                        : start.format(fmt)}
                    </div>
                    {r.ownerName && <div><UserOutlined /> Завёл: {r.ownerName}</div>}
                  </div>
                  {e.note_md && <div className="ci-warn" style={{ whiteSpace: 'pre-wrap' }}>{e.note_md}</div>}
                  {canEdit && mine && (
                    <div className="ci-actions">
                      <Button icon={<EditOutlined />} onClick={() => onEdit(event)}>Изменить</Button>
                      {canDelete && (
                        <Popconfirm title="Удалить мероприятие?" description="Оно пропадёт у всех учителей."
                          okText="Удалить" cancelText="Отмена"
                          okButtonProps={{ danger: true }} onConfirm={() => onDelete(event)}>
                          <Button danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Дедлайн ── */}
            {type === 'deadline' && (() => {
              const s = r.raw;
              return (
                <div className="ci-body">
                  <div className="ci-title">{deadlineTitle(s)}</div>
                  <div className="ci-chips">
                    <Chip tone="amber" dot={false}>дедлайн выдачи</Chip>
                  </div>
                  <div className="ci-meta">
                    <div><ClockCircleOutlined /> Срок: {dayjs(s.deadline).format('D MMMM YYYY, HH:mm')}</div>
                  </div>
                  <div className="ci-actions">
                    {s.work && (
                      <Button type="primary" onClick={() => onOpenWork(s.work)}>Открыть работу</Button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Дело ── */}
            {type === 'todo' && (() => {
              const t = r.raw;
              const accent = (r.group || r.groupId) ? groupHex(r.group || r.groupId).base : '#0D9488';
              return (
                <div className="ci-body">
                  <div className="ci-todo-title-row">
                    <span className="cal-todo-check ci-check"
                      style={{ borderColor: r.done ? '#B5BAC4' : accent, background: r.done ? accent : 'transparent' }}
                      onClick={() => onToggleTodo(t)} role="checkbox" aria-checked={r.done}>
                      {r.done && <CheckOutlined style={{ fontSize: 12, color: '#fff' }} />}
                    </span>
                    <span className={`ci-title${r.done ? ' is-done' : ''}`}>{t.title}</span>
                  </div>
                  <div className="ci-chips">
                    {r.groupName && <GroupChip id={r.groupId} name={r.groupName} />}
                    {r.priority === 'high' && <Chip tone="rose" dot={false}><FlagFilled /> приоритет</Chip>}
                  </div>
                  <div className="ci-meta">
                    {t.due_date && <div><ClockCircleOutlined /> Срок: {dayjs(t.due_date).format('D MMMM YYYY')}</div>}
                    {t.expand?.lesson && <div><TeamOutlined /> Урок: {t.expand.lesson.title}</div>}
                    {t.expand?.work && <div><PaperClipOutlined /> Работа: {t.expand.work.title}</div>}
                  </div>
                  <div className="ci-actions">
                    <Button type="primary" icon={<CheckOutlined />} onClick={() => onToggleTodo(t)}>
                      {r.done ? 'Вернуть в работу' : 'Отметить выполненным'}
                    </Button>
                    {canEdit && <Button icon={<EditOutlined />} onClick={() => onEdit(event)} />}
                    {canDelete && (
                      <Popconfirm title="Удалить дело?" okText="Удалить" cancelText="Отмена"
                        okButtonProps={{ danger: true }} onConfirm={() => onDelete(event)}>
                        <Button danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      <FilePreviewModal
        open={!!preview}
        record={preview?.record}
        url={preview?.url}
        onClose={() => setPreview(null)}
      />
    </>
  );
}
