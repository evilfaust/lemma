import { useEffect, useMemo, useState } from 'react';
import {
  Button, Form, Input, Modal, Popconfirm, Select, Space, Typography,
} from 'antd';
import { FileTextOutlined, VideoCameraOutlined, RetweetOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import AttendanceRoster from '../AttendanceRoster';
import LessonJournalBlock from './LessonJournalBlock';
import LessonMaterialsEditor from './LessonMaterialsEditor';
import { lessonStart } from '../lessonTime';
import { groupOptions, resolveGroup } from './calendarUtils';
import LessonAccessBar from './LessonAccessBar';
import DateTimeField from './DateTimeField';
import {
  LessonColorField, LessonStatusField, LessonSlotPicker, useLessonSlot,
} from './LessonFormFields';
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
  const slot = useLessonSlot(form, 'date_plan');
  const loadSlot = slot.load;

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
      loadSlot({ timeSlot: initial?.time_slot || '', slotPair: initial?.slotPair, date: startDate });
    }
  }, [open, initial, form, loadSlot]);

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

  const handleFinish = (v) => {
    onSave({
      title: v.title,
      group: v.group || '',
      // Свой цвет — только у урока без класса: с классом урок красится им.
      color: v.group ? '' : (v.color || ''),
      date_plan: v.date_plan ? v.date_plan.toISOString() : dayjs().toISOString(),
      status: v.status || 'planned',
      time_slot: slot.code,
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
        <div className="lsf-row">
          <Form.Item name="group" label="Группа">
            <Select allowClear placeholder="Группа" options={groupOptions(groups, initial?.expand?.group)} />
          </Form.Item>
          <Form.Item name="status" label="Статус">
            <LessonStatusField disabled={!canEdit} />
          </Form.Item>
        </div>
        <LessonColorField form={form} />
        <Form.Item name="date_plan" label="Дата и время" rules={[{ required: true }]}>
          <DateTimeField onChange={slot.guess} />
        </Form.Item>
        <Form.Item label="Время по расписанию" style={{ marginBottom: 16 }}>
          <LessonSlotPicker slot={slot} disabled={!canEdit} />
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
