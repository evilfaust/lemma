import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Tag, Modal, Spin, Empty, Typography, Tooltip, App, Input } from 'antd';
import { PaperClipOutlined, CloseOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../services/pocketbase';
import { useOptionalAuth } from '../../contexts/AuthContext';
import { defaultDelivery, DELIVERIES, normalizeLessonItems, pickOpenSession, withDelivery } from '../../utils/lessonItems';
import { studentFacing, withMode } from '../../utils/homework';
import DeliveryModal from './DeliveryModal';

const { Text } = Typography;

function fmtLessonLabel(lesson) {
  const date = lesson.date_plan ? dayjs(lesson.date_plan).format('DD.MM.YYYY HH:mm') : '—';
  const group = lesson.expand?.group?.name;
  return `${date}${group ? ` · ${group}` : ''}${lesson.title ? ` · ${lesson.title}` : ''}`;
}

// Старые уроки могут хранить отдельную ссылку на выдачу или показ условий.
async function readLessonItems(lesson) {
  const materials = Array.isArray(lesson.materials) ? lesson.materials : [];
  const ids = materials.filter(m => m?.type === 'session').map(m => m.id);
  const sessions = ids.length ? await api.getSessionsByIds(ids) : [];
  const byId = new Map(sessions.map(s => [s.id, s]));
  return { materials, byId, items: normalizeLessonItems(materials, byId) };
}

/** Общая привязка работы к урокам: редактор, «Мои работы», тесты и геометрия. */
export default function WorkLessonLinks({ workId, workTitle, materialType = 'work', onWorkChange }) {
  const { message } = App.useApp();
  const canEdit = !!useOptionalAuth()?.canEdit;
  const isTest = materialType === 'mc_test';
  const noun = isTest ? 'Тест' : 'Работа';
  const [linked, setLinked] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [pending, setPending] = useState(null);
  const busy = useRef(false);
  const matches = useCallback(m => m.id === workId && (m.type || 'work') === materialType, [workId, materialType]);

  const loadLinked = useCallback(async () => {
    if (!workId) return;
    setLoading(true);
    try {
      const lessons = await api.getLessonsByMaterialId(workId, materialType);
      const entries = await Promise.all(lessons.map(async lesson => {
        const { items } = await readLessonItems(lesson);
        return { lesson, item: items.find(matches) };
      }));
      setLinked(entries.filter(e => e.item));
    } catch {
      message.error('Не удалось загрузить уроки работы');
    } finally {
      setLoading(false);
    }
  }, [workId, materialType, matches, message]);

  useEffect(() => { setLinked([]); setPending(null); setPickerOpen(false); loadLinked(); }, [loadLinked]);

  const openPicker = async () => {
    setQuery('');
    setCandidates([]);
    setPickerOpen(true);
    setCandidatesLoading(true);
    try {
      const from = dayjs().subtract(7, 'day').startOf('day').toISOString();
      const to = dayjs().add(60, 'day').endOf('day').toISOString();
      const lessons = await api.getLessons({ from, to });
      const linkedIds = new Set(linked.map(e => e.lesson.id));
      setCandidates(lessons.filter(l => l.status !== 'cancelled' && !linkedIds.has(l.id)));
    } catch {
      message.error('Не удалось загрузить список уроков');
    } finally {
      setCandidatesLoading(false);
    }
  };

  const attach = async (draft) => {
    if (!canEdit || busy.current) return;
    busy.current = true;
    setBusyId(draft.lesson.id);
    try {
      // Перечитываем урок перед записью: материалы могли изменить в календаре.
      const lesson = await api.getLesson(draft.lesson.id);
      const { materials, items } = await readLessonItems(lesson);
      if (items.some(matches)) {
        message.info(`${noun} уже в этом уроке`);
      } else {
        if (lesson.status === 'cancelled') throw new Error('Урок отменён');
        let item = { type: materialType, id: workId, title: workTitle || '' };
        let session;
        if (draft.deliver === 'online') {
          const sessions = isTest ? await api.getSessionsByMCTest(workId) : await api.getSessionsByWork(workId);
          session = pickOpenSession(sessions)?.id;
          if (!session) {
            const title = workTitle?.trim() || noun;
            const created = isTest
              ? await api.createMCTestSession(workId, { student_title: title })
              : await api.createSession({ work: workId, is_open: true, student_title: title });
            session = created.id;
          }
        } else if (draft.deliver === 'show') {
          if (materialType === 'geometry_work') {
            const work = await api.getGeometryWork(workId);
            if (!work.public) await api.setGeometryWorkSharing(workId, { public: true, groups: work.groups || [] });
          } else {
            const work = await api.getWork(workId);
            if (!work.show_open) {
              const updated = await api.setWorkShowSharing(workId, { open: true, groups: work.show_groups || [] });
              onWorkChange?.({ show_open: updated.show_open, show_groups: updated.show_groups });
            }
          }
        }
        if (draft.deliver !== 'paper' && draft.deliver !== 'none') {
          item = withMode(item, draft.mode);
          if (typeof draft.required === 'boolean') item.required = draft.required;
        }
        item = withDelivery(item, draft.deliver, { session });
        await api.updateLesson(lesson.id, { materials: [...materials, item] });
        message.success(`${noun} прикреплен${isTest ? '' : 'а'} к уроку ${fmtLessonLabel(lesson)}`);
      }
      setPending(null);
      setPickerOpen(false);
      await loadLinked();
    } catch (error) {
      message.error(`Не удалось прикрепить ${isTest ? 'тест' : 'работу'} к уроку: ${error?.message || 'ошибка'}`);
    } finally {
      busy.current = false;
      setBusyId(null);
    }
  };

  const chooseLesson = (lesson) => {
    const draft = {
      lesson, type: materialType, title: workTitle,
      deliver: defaultDelivery(materialType), mode: 'class',
    };
    if (!studentFacing(lesson.expand?.group)) {
      attach({ ...draft, deliver: 'none' });
    } else {
      setPickerOpen(false);
      setPending(draft);
    }
  };

  const detach = async (lesson) => {
    if (!canEdit || busy.current) return;
    busy.current = true;
    setBusyId(lesson.id);
    try {
      const latest = await api.getLesson(lesson.id);
      const { materials, byId } = await readLessonItems(latest);
      await api.updateLesson(lesson.id, {
        materials: materials.filter(m => !normalizeLessonItems([m], byId).some(matches)),
      });
      message.success(`${noun} откреплен${isTest ? '' : 'а'} от урока`);
      await loadLinked();
    } catch {
      message.error(`Не удалось открепить ${isTest ? 'тест' : 'работу'}`);
    } finally {
      busy.current = false;
      setBusyId(null);
    }
  };

  if (!workId) return null;
  const visibleCandidates = candidates.filter(l => fmtLessonLabel(l).toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      <Text type="secondary" style={{ fontSize: 13 }}><PaperClipOutlined /> Уроки:</Text>
      {loading && <Spin size="small" />}
      {!loading && linked.length === 0 && <Text type="secondary" style={{ fontSize: 13 }}>{isTest ? 'не прикреплён' : 'не прикреплена'}</Text>}
      {!loading && linked.map(({ lesson, item }) => (
        <Tag key={lesson.id} color="blue" style={{ margin: 0, maxWidth: '100%', whiteSpace: 'normal', display: 'inline-flex', alignItems: 'center' }} closable={canEdit && !busyId}
          closeIcon={<CloseOutlined aria-label="Открепить от урока" />}
          onClose={e => { e.preventDefault(); detach(lesson); }}
        >
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            {fmtLessonLabel(lesson)} · {DELIVERIES[item.deliver || 'none']?.label}
          </span>
        </Tag>
      ))}
      {canEdit && (
        <Tooltip title={`Прикрепить ${isTest ? 'тест' : 'работу'} к уроку календаря`}>
          <Button size="small" icon={<CalendarOutlined />} onClick={openPicker} disabled={loading || !!busyId}>
            Прикрепить к уроку
          </Button>
        </Tooltip>
      )}
      <Modal title="Прикрепить к уроку" open={pickerOpen}
        onCancel={() => { if (!busyId) setPickerOpen(false); }} closable={!busyId} maskClosable={!busyId}
        footer={[<Button key="close" disabled={!!busyId} onClick={() => setPickerOpen(false)}>Закрыть</Button>]} width={600}
      >
        <Input.Search placeholder="Найти по классу, дате или теме урока" aria-label="Поиск урока"
          value={query} onChange={e => setQuery(e.target.value)} allowClear style={{ marginBottom: 12 }} />
        <Text type="secondary">Уроки за последнюю неделю и ближайшие два месяца.</Text>
        {candidatesLoading ? <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
          : visibleCandidates.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={query.trim() ? 'Уроки не найдены' : 'Нет доступных уроков — создайте урок в календаре'} />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto', marginTop: 12 }}>
              {visibleCandidates.map(lesson => (
                <div key={lesson.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    {fmtLessonLabel(lesson)}
                    {(!studentFacing(lesson.expand?.group) || lesson.hidden_from_students) && (
                      <div><Text type="secondary" style={{ fontSize: 12 }}>
                        {lesson.hidden_from_students ? 'Урок скрыт от учеников' : 'Материалы только для вас'}
                      </Text></div>
                    )}
                  </div>
                  <Button size="small" type="primary" ghost loading={busyId === lesson.id} disabled={!!busyId}
                    onClick={() => chooseLesson(lesson)}>Прикрепить</Button>
                </div>
              ))}
            </div>}
      </Modal>
      <DeliveryModal pending={pending} setPending={setPending} busy={!!busyId} onOk={() => attach(pending)}
        notice={pending?.lesson.hidden_from_students ? 'Урок скрыт от учеников. Работа появится у них, когда вы откроете урок в календаре.' : undefined} />
    </div>
  );
}
