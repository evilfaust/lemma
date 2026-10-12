import { useEffect, useMemo, useState } from 'react';
import {
  Button, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Typography,
} from 'antd';
import { FileTextOutlined, VideoCameraOutlined, RetweetOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import AttendanceRoster from '../AttendanceRoster';
import LessonJournalBlock from './LessonJournalBlock';
import LessonMaterialsEditor from './LessonMaterialsEditor';
import { Chip, GroupColorPicker } from '../ui';
import { PAIRS, guessSlot, slotRangeFromCode, lessonStart } from '../lessonTime';
import { groupOptions, resolveGroup } from './calendarUtils';
import LessonAccessBar from './LessonAccessBar';
import DateTimeField from './DateTimeField';
import useIsMobile from '../../../hooks/useIsMobile';
import { api } from '../../../shared/services/pocketbase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  materialVisible, isNextDue, nextLessonFor, incomingFor, studentFacing as groupFacesStudents,
} from '../../../utils/homework';
import { parseStudentLink } from '../../../utils/lessonMaterials';
import { normalizeLessonItems } from '../../../utils/lessonItems';

/**
 * Полная форма урока (создание/правка) + посещаемость + журнал + материалы + заметка.
 * Вынесена из TeacherCalendar без изменения поведения (редизайн календаря v3.9.108).
 * Материалы с v3.9.358 — один список `LessonMaterialsEditor` (раньше работа
 * добавлялась в «Материалы урока» для учителя и отдельно в «Задания-ссылки»).
 */
export default function LessonModal({
  open, initial, groups, works, onSave, onDelete, onCancel, onOpenNote, onOpenMaterial, onRepeat, saving, canEdit,
}) {
  const [form] = Form.useForm();
  const isMobile = useIsMobile();
  const watchedGroup = Form.useWatch('group', form);
  const selectedGroup = useMemo(
    // Группа прошлого года в списки пикеров не попадает — берём из самой записи.
    () => resolveGroup(groups, watchedGroup, initial?.expand?.group),
    [groups, watchedGroup, initial],
  );
  const isCourse = selectedGroup?.kind === 'course';
  // Урок видят ученики: курс — пока не завершён, класс — если учитель открыл
  // ему расписание (teaching_groups.student_schedule, v3.9.291).
  const studentFacing = groupFacesStudents(selectedGroup);
  const courseDone = isCourse && !!selectedGroup?.completed;
  const { teacher } = useAuth();
  const watchedDate = Form.useWatch('date_plan', form);
  const watchedStatus = Form.useWatch('status', form);
  const [items, setItems] = useState([]);           // материалы урока (utils/lessonItems.js)
  const [itemsLoading, setItemsLoading] = useState(false);
  const [visibleToStudents, setVisibleToStudents] = useState(true);
  const [neighbours, setNeighbours] = useState([]); // уроки класса вокруг — для ДЗ «к след.»
  const [mode, setMode] = useState('single');
  const [pair, setPair] = useState(null);
  const [part, setPart] = useState('full');
  const [endPair, setEndPair] = useState(null);

  useEffect(() => {
    if (open) {
      const startDate = initial?.date_plan ? dayjs(lessonStart(initial))
        : (initial?.slotDate ? dayjs(initial.slotDate) : dayjs());
      form.setFieldsValue({
        title: initial?.title || '',
        group: initial?.group || undefined,
        color: initial?.color || '',
        date_plan: startDate,
        status: initial?.status || 'planned',
        conference_url: initial?.conference_url || '',
      });
      const ts = initial?.time_slot || '';
      const inten = /^(\d)-(\d)$/.exec(ts);
      const half = /^(\d)([ab])$/.exec(ts);
      if (inten) { setMode('intensive'); setPair(inten[1]); setEndPair(inten[2]); setPart('full'); }
      else if (half) { setMode('single'); setPair(half[1]); setPart(half[2] === 'a' ? '1' : '2'); setEndPair(null); }
      else if (ts && PAIRS.some((p) => p.key === ts)) { setMode('single'); setPair(ts); setPart('full'); setEndPair(null); }
      else if (initial?.slotPair) { setMode('single'); setPair(initial.slotPair); setPart('full'); setEndPair(null); }
      else { const g = guessSlot(startDate.toDate()); setMode('single'); setPair(g.pair); setPart(g.part); setEndPair(null); }
    }
  }, [open, initial, form]);

  // Материалы: старые записи приводятся к единому списку (utils/lessonItems.js).
  // Выдача старого вида (`session`) узнаёт свою работу по записи выдачи —
  // тогда учительская строка этой же работы не задваивается.
  useEffect(() => {
    let cancelled = false;
    if (!open) return undefined;
    const all = Array.isArray(initial?.materials) ? initial.materials : [];
    const sessionIds = all
      .filter((m) => m?.type === 'session' && m.id && parseStudentLink(m.id)?.type === 'session')
      .map((m) => m.id);
    if (!sessionIds.length) {
      setItems(normalizeLessonItems(all));
      setItemsLoading(false);
      return undefined;
    }
    setItems([]);
    setItemsLoading(true);
    api.getSessionsByIds(sessionIds)
      .then((list) => new Map((list || []).map((x) => [x.id, x])))
      .catch(() => new Map())
      .then((byId) => {
        if (cancelled) return;
        setItems(normalizeLessonItems(all, byId));
        setItemsLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, initial]);

  // Флаг «показывать ученикам» живёт в самом уроке (до v3.9.291 — в витрине курса).
  useEffect(() => {
    if (!open) return;
    setVisibleToStudents(!initial?.hidden_from_students);
  }, [open, initial]);

  // Уроки того же класса вокруг этого: куда уйдёт ДЗ «к следующему» и что
  // задали к этому уроку раньше. Окно — от даты урока при открытии.
  const groupId = selectedGroup?.id;
  useEffect(() => {
    let cancelled = false;
    if (!open || !groupId || !studentFacing) { setNeighbours([]); return undefined; }
    const base = initial?.date_plan ? dayjs(initial.date_plan) : dayjs();
    api.getLessons({
      groupId,
      from: base.subtract(60, 'day').toISOString(),
      to: base.add(120, 'day').toISOString(),
    })
      .then((list) => { if (!cancelled) setNeighbours(list); })
      .catch(() => { if (!cancelled) setNeighbours([]); });
    return () => { cancelled = true; };
  }, [open, groupId, studentFacing, initial?.date_plan]);

  const setStartTime = (str) => {
    const [h, m] = str.split(':').map(Number);
    const cur = form.getFieldValue('date_plan') || dayjs();
    form.setFieldsValue({ date_plan: dayjs(cur).hour(h).minute(m).second(0).millisecond(0) });
  };

  const applySlot = (p, prt) => {
    setPair(p);
    setPart(prt);
    if (!p) return;
    const def = PAIRS.find((x) => x.key === p);
    if (def) setStartTime((p === '0' || prt === 'full') ? def.full[0] : (prt === '1' ? def.halves[0][0] : def.halves[1][0]));
  };

  const applyIntensive = (s, e) => {
    setPair(s);
    setEndPair(e);
    if (!s) return;
    const def = PAIRS.find((x) => x.key === s);
    if (def) setStartTime(def.full[0]);
  };

  const currentSlotCode = () => {
    if (mode === 'intensive') {
      if (!pair || !endPair || Number(endPair) <= Number(pair)) return '';
      return `${pair}-${endPair}`;
    }
    if (!pair) return '';
    if (pair === '0' || part === 'full') return pair;
    return pair + (part === '1' ? 'a' : 'b');
  };

  const slotRange = slotRangeFromCode(currentSlotCode());
  const intensiveCount = (mode === 'intensive' && pair && endPair && Number(endPair) > Number(pair))
    ? Number(endPair) - Number(pair) + 1 : 0;

  const handleFinish = (v) => {
    onSave({
      title: v.title,
      group: v.group || '',
      // Свой цвет — только у урока без класса: с классом урок красится им.
      color: v.group ? '' : (v.color || ''),
      date_plan: v.date_plan ? v.date_plan.toISOString() : dayjs().toISOString(),
      status: v.status || 'planned',
      time_slot: currentSlotCode(),
      conference_url: (v.conference_url || '').trim(),
      hidden_from_students: !visibleToStudents,
      materials: items,
    });
  };

  // ДЗ «к следующему уроку»: куда уйдёт и что пришло к этому уроку.
  const owner = initial?.owner || teacher?.id || '';
  const draft = watchedDate && groupId
    ? { id: initial?.id, group: groupId, owner, date_plan: dayjs(watchedDate).toISOString(), status: watchedStatus }
    : null;
  const hasNextHw = items.some((m) => isNextDue(m) && materialVisible(m, isCourse));
  const nextLesson = studentFacing && draft && hasNextHw ? nextLessonFor(draft, neighbours) : null;
  const incoming = studentFacing && draft
    // Скрытый от учеников урок своих ДЗ ученикам не показывает — и здесь их нет.
    ? incomingFor(draft, neighbours, (l) => (l.hidden_from_students ? [] : (l.materials || []).filter((m) => materialVisible(m, isCourse))))
    : [];

  const editingExisting = initial?.id;

  return (
    <Modal
      open={open}
      title={editingExisting ? 'Урок' : 'Новый урок'}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Сохранить"
      cancelText="Отмена"
      okButtonProps={{ disabled: !canEdit }}
      width={studentFacing ? 760 : 600}
      destroyOnHidden
      style={isMobile ? { top: 12 } : undefined}
      footer={(_, { OkBtn, CancelBtn }) => (
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space>
            {editingExisting && canEdit && (
              <Popconfirm title="Удалить урок?" okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }} onConfirm={onDelete}>
                <Button danger>Удалить</Button>
              </Popconfirm>
            )}
            {editingExisting && canEdit && onRepeat && (
              <Button icon={<RetweetOutlined />} onClick={() => onRepeat(initial)} title="Запланировать серию занятий по расписанию">
                Повторить серию
              </Button>
            )}
          </Space>
          <Space><CancelBtn /><OkBtn /></Space>
        </Space>
      )}
    >
      <LessonAccessBar lesson={initial} canEdit={canEdit} onShared={() => {}} />

      <Form form={form} layout="vertical" onFinish={handleFinish} style={{ marginTop: 8 }} disabled={!canEdit}>
        <Form.Item name="title" label="Тема урока" rules={[{ required: true, message: 'Введите тему' }]}>
          {/* Открыли существующий урок — клавиатура на телефоне не нужна */}
          <Input placeholder="Тема урока" maxLength={500} autoFocus={!initial?.id} />
        </Form.Item>
        <Space size="large" style={{ display: 'flex' }} wrap={isMobile}>
          <Form.Item name="group" label="Группа" style={{ flex: 1, minWidth: isMobile ? 200 : undefined }}>
            <Select allowClear placeholder="Группа" options={groupOptions(groups, initial?.expand?.group)} />
          </Form.Item>
          <Form.Item name="status" label="Статус" style={{ flex: 1 }}>
            <Select options={[
              { value: 'planned', label: 'Запланирован' },
              { value: 'done', label: 'Проведён' },
              { value: 'cancelled', label: 'Отменён' },
            ]} />
          </Form.Item>
        </Space>
        <LessonColorField form={form} />
        <Form.Item label="Время по расписанию" style={{ marginBottom: 8 }}>
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Segmented value={mode}
              onChange={(m) => {
                setMode(m);
                if (m === 'intensive') { if (pair) applyIntensive(pair, endPair); }
                else if (pair) applySlot(pair, part);
              }}
              options={[
                { value: 'single', label: 'Пара' },
                { value: 'intensive', label: 'Интенсив (2–4 пары)' },
              ]} />
            {mode === 'single' ? (
              <Space wrap>
                <Select allowClear placeholder="— своё время —" style={{ width: 150 }}
                  value={pair ?? undefined}
                  onChange={(v) => applySlot(v ?? null, v === '0' ? 'full' : part)}
                  options={PAIRS.map((p) => ({ value: p.key, label: p.label }))} />
                <Segmented value={part} disabled={!pair || pair === '0'}
                  onChange={(v) => applySlot(pair, v)}
                  options={[
                    { value: 'full', label: 'Вся пара' },
                    { value: '1', label: '1-я пол.' },
                    { value: '2', label: '2-я пол.' },
                  ]} />
                {slotRange && <Chip tone="blue" dot={false}>{slotRange[0]}–{slotRange[1]}</Chip>}
              </Space>
            ) : (
              <Space wrap>
                <Select placeholder="с пары" style={{ width: 130 }} value={pair ?? undefined}
                  onChange={(v) => applyIntensive(v ?? null, endPair)}
                  options={PAIRS.map((p) => ({ value: p.key, label: p.label }))} />
                <span>→</span>
                <Select placeholder="по пару" style={{ width: 130 }} value={endPair ?? undefined}
                  onChange={(v) => applyIntensive(pair, v ?? null)}
                  options={PAIRS.map((p) => ({ value: p.key, label: p.label }))} />
                {slotRange && (
                  <Chip tone="violet" dot={false}>{slotRange[0]}–{slotRange[1]} · {intensiveCount} пары</Chip>
                )}
                {pair && endPair && Number(endPair) <= Number(pair) && (
                  <Typography.Text type="danger" style={{ fontSize: 12 }}>конец должен быть позже начала</Typography.Text>
                )}
              </Space>
            )}
          </Space>
        </Form.Item>
        <Form.Item name="date_plan" label="Дата и время" rules={[{ required: true }]}>
          <DateTimeField
            onChange={(d) => { if (d) { const g = guessSlot(d.toDate()); setPair(g.pair); setPart(g.part); } }} />
        </Form.Item>
        {isCourse && (
          <Form.Item
            name="conference_url"
            label="Ссылка на конференцию (этого занятия)"
            tooltip="Пусто → используется постоянная комната курса. Видна ученикам курса."
          >
            <Input
              prefix={<VideoCameraOutlined />}
              allowClear
              placeholder={selectedGroup?.conference_url ? `по умолчанию: ${selectedGroup.conference_url}` : 'https://telemost.yandex.ru/j/...'}
              maxLength={1000}
            />
          </Form.Item>
        )}
      </Form>

      <LessonMaterialsEditor
        items={items}
        setItems={setItems}
        loading={itemsLoading}
        lessonId={initial?.id}
        works={works}
        canEdit={canEdit}
        onOpenMaterial={onOpenMaterial}
        studentFacing={studentFacing}
        isCourse={isCourse}
        courseDone={courseDone}
        group={selectedGroup}
        visibleToStudents={visibleToStudents}
        onVisibleChange={setVisibleToStudents}
        incoming={incoming}
        nextLesson={nextLesson}
        hasNextHw={hasNextHw}
      />

      <div style={{ margin: '4px 0 12px', paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
        {editingExisting ? (
          <AttendanceRoster lessonId={initial.id} groupId={watchedGroup} canEdit={canEdit} isCourse={isCourse} />
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Сохраните урок, чтобы отметить посещаемость.
          </Typography.Text>
        )}
      </div>

      {editingExisting && initial.group && (
        <div style={{ margin: '0 0 12px', paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
          {/* Сохранённый класс урока, а не значение формы: журнал ведётся по нему. */}
          <LessonJournalBlock lessonId={initial.id} groupId={initial.group} canEdit={canEdit} />
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        {editingExisting ? (
          <Button icon={<FileTextOutlined />} onClick={() => onOpenNote(initial)} block>
            Открыть заметку урока (формулы, блоки)
          </Button>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Сохраните урок, чтобы добавить заметку с формулами.
          </Typography.Text>
        )}
      </div>

    </Modal>
  );
}

/**
 * Цвет урока без класса (v3.9.228). С выбранным классом поле прячется: урок
 * красится цветом класса, и второй источник цвета только запутал бы.
 * Значение при этом держится в форме — снял класс, и выбор вернулся.
 */
export function LessonColorField({ form }) {
  const group = Form.useWatch('group', form);
  return (
    <Form.Item name="color" label="Цвет" hidden={!!group}
      tooltip="Урок без класса. С классом урок красится цветом класса">
      <GroupColorPicker />
    </Form.Item>
  );
}
