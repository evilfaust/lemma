import { useEffect, useMemo, useState } from 'react';
import {
  Modal, Segmented, Form, Input, Select, DatePicker, App, Button, Space,
} from 'antd';
import {
  BookOutlined, FlagOutlined, CheckSquareOutlined, BankOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { PAIRS } from '../lessonTime';
import { api } from '../../../shared/services/pocketbase';
import useIsMobile from '../../../hooks/useIsMobile';
import { groupHex } from '../ui';
import SchoolEventFields from './SchoolEventFields';
import DateTimeField from './DateTimeField';
import { schoolEventFormToData } from './calendarUtils';
import { LessonColorField, LessonSlotPicker, useLessonSlot } from './LessonFormFields';
import './mobile.css';
import './lessonModal.css';

const TYPES = [
  { value: 'lesson', label: 'Урок', icon: <BookOutlined /> },
  { value: 'deadline', label: 'Дедлайн', icon: <FlagOutlined /> },
  { value: 'todo', label: 'Дело', icon: <CheckSquareOutlined /> },
  { value: 'school', label: 'Мероприятие', icon: <BankOutlined /> },
];

const TYPE_META = {
  lesson: {
    title: 'Новый урок', noun: 'Урок', ok: 'Создать урок',
    hint: 'Занятие в расписании. Материалы, ДЗ и посещаемость — в окне урока после создания.',
  },
  deadline: {
    title: 'Новый дедлайн', noun: 'Дедлайн', ok: 'Поставить дедлайн',
    hint: 'Работа открывается ученикам онлайн и должна быть сдана к сроку.',
  },
  todo: {
    title: 'Новое дело', noun: 'Дело', ok: 'Добавить дело',
    hint: 'Напоминание для себя — появится в списке дел и в календаре.',
  },
  school: {
    title: 'Школьное мероприятие', noun: 'Мероприятие', ok: 'Добавить мероприятие',
    hint: 'Событие школы: каникулы, педсовет, собрание, олимпиада.',
  },
};

// Классов много — выпадающий список, иначе кнопками (один клик вместо двух).
const PILLS_MAX = 12;

// Срок дедлайна «на день» — до конца этого дня, а не в его полночь.
const endOfDayIfMidnight = (d) => (d && d.hour() === 0 && d.minute() === 0
  ? d.hour(23).minute(59).second(0).millisecond(0) : d);

const fmtDay = (d) => (d ? dayjs(d).format('dd, D MMMM') : '');

/**
 * Быстрое создание из сетки: Урок / Дедлайн / Дело / Мероприятие.
 * Дата предзаполняется днём ячейки, пара — парой ячейки.
 * С v3.9.393: класс кнопками, темы прошлых уроков класса подсказками, пара
 * и интенсив — общим `LessonSlotPicker`, итог «что будет создано» перед
 * кнопкой и «Создать и открыть» (сразу в окно урока за материалами).
 */
export default function CreateEventModal({
  open, type: initType, day, pair: initPair, groups, works, onClose, onCreated,
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [type, setTypeRaw] = useState(initType || 'lesson');
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState([]); // темы прошлых уроков выбранного класса
  const isMobile = useIsMobile();
  const slot = useLessonSlot(form, 'date');
  const loadSlot = slot.load;

  const title = Form.useWatch('title', form);
  const group = Form.useWatch('group', form);
  const date = Form.useWatch('date', form);
  const due = Form.useWatch('due', form);
  const work = Form.useWatch('work', form);

  useEffect(() => {
    if (!open) return;
    setTypeRaw(initType || 'lesson');
    // Клик по ячейке пары: день приходит полночью — ставим время старта пары,
    // иначе урок сохранялся на 00:00.
    const pairDef = PAIRS.find((p) => p.key === initPair);
    const [ph, pm] = pairDef ? pairDef.full[0].split(':').map(Number) : [];
    const base = pairDef
      ? dayjs(day || undefined).hour(ph).minute(pm).second(0).millisecond(0)
      : (day ? dayjs(day) : dayjs());
    form.setFieldsValue({
      title: '', group: undefined, work: undefined,
      date: base,
      due: initType === 'deadline' ? endOfDayIfMidnight(base) : base,
      // школьное мероприятие
      kind: 'other', color: '', note_md: '', all_day: true,
      date_start: base, date_end: null,
    });
    loadSlot({ slotPair: pairDef ? initPair : null });
  }, [open, initType, initPair, day, form, loadSlot]);

  const setType = (t) => {
    setTypeRaw(t);
    if (t === 'deadline') form.setFieldsValue({ due: endOfDayIfMidnight(form.getFieldValue('due')) });
  };

  // Темы недавних уроков класса — частый случай «продолжаем ту же тему».
  useEffect(() => {
    let cancelled = false;
    if (!open || type !== 'lesson' || !group) { setRecent([]); return undefined; }
    const now = dayjs();
    api.getLessons({ groupId: group, from: now.subtract(45, 'day').toISOString(), to: now.add(14, 'day').toISOString() })
      .then((list) => {
        if (cancelled) return;
        const seen = new Set();
        const titles = [];
        [...(list || [])].reverse().forEach((l) => {
          const t = (l.title || '').trim();
          if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); titles.push(t); }
        });
        setRecent(titles.slice(0, 6));
      })
      .catch(() => { if (!cancelled) setRecent([]); });
    return () => { cancelled = true; };
  }, [open, type, group]);

  const handleOk = async ({ openAfter = false } = {}) => {
    let v;
    try { v = await form.validateFields(); } catch { return; }
    if (type === 'lesson' && slot.invalid) { message.warning('Конец интенсива должен быть позже начала'); return; }
    setSaving(true);
    try {
      let rec = null;
      if (type === 'lesson') {
        rec = await api.createLesson({
          title: v.title.trim(),
          group: v.group || '',
          color: v.group ? '' : (v.color || ''),
          date_plan: (v.date || dayjs()).toISOString(),
          status: 'planned',
          time_slot: slot.code,
          materials: [],
        });
      } else if (type === 'school') {
        await api.createSchoolEvent(schoolEventFormToData(v));
      } else if (type === 'deadline') {
        await api.createSession({
          work: v.work,
          is_open: true,
          deadline: (v.due || dayjs()).toISOString(),
        });
      } else {
        await api.createTodo({
          title: v.title.trim(),
          group: v.group || '',
          due_date: v.due ? v.due.toISOString() : '',
        });
      }
      message.success(type === 'lesson' ? 'Урок создан' : 'Создано');
      onCreated(rec, { open: openAfter && !!rec });
      onClose();
    } catch {
      message.error('Не удалось создать');
    } finally {
      setSaving(false);
    }
  };

  const meta = TYPE_META[type];
  const groupName = (groups || []).find((g) => g.id === group)?.name;
  const workTitle = (works || []).find((w) => w.id === work)?.title;
  const summary = useMemo(() => {
    if (type === 'lesson') {
      const when = date ? `${fmtDay(date)}, ${slot.range ? `${slot.range[0]}–${slot.range[1]}` : dayjs(date).format('HH:mm')}` : '';
      return [title?.trim() ? `«${title.trim()}»` : null, groupName, when].filter(Boolean);
    }
    if (type === 'deadline') {
      return [workTitle ? `«${workTitle}»` : null, due ? `сдать до ${fmtDay(due)}, ${dayjs(due).format('HH:mm')}` : null].filter(Boolean);
    }
    if (type === 'todo') {
      return [title?.trim() ? `«${title.trim()}»` : null, groupName, due ? `срок — ${fmtDay(due)}` : 'без срока'].filter(Boolean);
    }
    return [];
  }, [type, title, groupName, date, due, workTitle, slot.range]);

  const submitOnEnter = (e) => { if (!e.nativeEvent.isComposing) { e.preventDefault(); handleOk(); } };
  const usePills = isMobile || (groups || []).length <= PILLS_MAX;
  const groupField = (
    <Form.Item name="group" label="Класс / группа">
      {usePills
        ? <GroupPills groups={groups || []} />
        : <Select allowClear showSearch optionFilterProp="label" placeholder="Без класса"
          options={(groups || []).map((g) => ({ value: g.id, label: g.name }))} />}
    </Form.Item>
  );

  return (
    <Modal
      open={open}
      title={(
        <div className="ce-head">
          <span>{meta.title}</span>
          {type !== 'school' && (type === 'lesson' ? date : due) && (
            <span className="ce-head__day">{fmtDay(type === 'lesson' ? date : due)}</span>
          )}
        </div>
      )}
      onCancel={onClose}
      width={type === 'lesson' ? 620 : 520}
      destroyOnHidden
      style={isMobile ? { top: 12 } : undefined}
      footer={(
        <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Отмена</Button>
          {type === 'lesson' && (
            <Button loading={saving} onClick={() => handleOk({ openAfter: true })}
              title="Создать и сразу открыть урок — добавить материалы и ДЗ">
              Создать и открыть
            </Button>
          )}
          <Button type="primary" loading={saving} onClick={() => handleOk()}>{meta.ok}</Button>
        </Space>
      )}
    >
      <Segmented block options={TYPES} value={type} onChange={setType} style={{ marginTop: 8 }} />
      <div className="ce-hint">{meta.hint}</div>

      <Form form={form} layout="vertical" requiredMark={false}>
        {type === 'school' && <SchoolEventFields form={form} />}

        {type === 'lesson' && (
          <>
            {groupField}
            <Form.Item name="title" label="Тема урока" style={{ marginBottom: recent.length ? 6 : undefined }}
              rules={[{ required: true, whitespace: true, message: 'Напишите тему урока' }]}>
              <Input placeholder="Например: Квадратные уравнения" maxLength={500} autoFocus onPressEnter={submitOnEnter} />
            </Form.Item>
            {recent.length > 0 && (
              <div className="ce-recent">
                <span className="ce-recent__label">Недавно в классе:</span>
                {recent.map((t) => (
                  <button key={t} type="button" className={`ce-recent__chip${title === t ? ' is-on' : ''}`}
                    onClick={() => form.setFieldsValue({ title: t })} title="Взять эту тему">
                    {t}
                  </button>
                ))}
              </div>
            )}
            <LessonColorField form={form} />
            <Form.Item name="date" label="Дата и время" rules={[{ required: true, message: 'Выберите дату' }]}>
              <DateTimeField onChange={slot.guess} />
            </Form.Item>
            <Form.Item label="Время по расписанию">
              <LessonSlotPicker slot={slot} />
            </Form.Item>
          </>
        )}

        {type === 'deadline' && (
          <>
            <Form.Item name="work" label="Какую работу выдать" rules={[{ required: true, message: 'Выберите работу' }]}>
              <Select showSearch optionFilterProp="label" placeholder="Начните вводить название работы" autoFocus
                notFoundContent="Работа не найдена"
                options={(works || []).map((w) => ({ value: w.id, label: w.title }))} />
            </Form.Item>
            <Form.Item name="due" label="Сдать до" rules={[{ required: true, message: 'Укажите срок' }]}
              style={{ marginBottom: 6 }}>
              <DateTimeField />
            </Form.Item>
            <QuickDates form={form} keepTime />
          </>
        )}

        {type === 'todo' && (
          <>
            <Form.Item name="title" label="Что нужно сделать"
              rules={[{ required: true, whitespace: true, message: 'Напишите, что сделать' }]}>
              <Input placeholder="Например: проверить тетради 9 «Б»" maxLength={500} autoFocus onPressEnter={submitOnEnter} />
            </Form.Item>
            {groupField}
            <Form.Item name="due" label="Срок" style={{ marginBottom: 6 }}>
              <DatePicker format="DD.MM.YYYY" inputReadOnly={isMobile} style={{ width: '100%' }} placeholder="Без срока" />
            </Form.Item>
            <QuickDates form={form} allowNone />
          </>
        )}
      </Form>

      {summary.length > 0 && (
        <div className="ce-summary">
          <span className="ce-summary__label">{meta.noun}:</span>
          {' '}{summary.join(' · ')}
        </div>
      )}
    </Modal>
  );
}

// Быстрый срок: сегодня / завтра / через неделю. Время у дедлайна сохраняется.
function QuickDates({ form, keepTime, allowNone }) {
  const due = Form.useWatch('due', form);
  const today = dayjs().startOf('day');
  const options = [
    { label: 'Сегодня', d: today },
    { label: 'Завтра', d: today.add(1, 'day') },
    { label: 'Через 3 дня', d: today.add(3, 'day') },
    { label: 'Через неделю', d: today.add(7, 'day') },
  ];
  const pick = (d) => {
    if (!d) { form.setFieldsValue({ due: null }); return; }
    const cur = due ? dayjs(due) : null;
    const next = keepTime
      ? d.hour(cur ? cur.hour() : 23).minute(cur ? cur.minute() : 59)
      : d;
    form.setFieldsValue({ due: next });
  };
  return (
    <div className="ce-quick">
      {options.map((o) => (
        <button key={o.label} type="button"
          className={`ce-quick__btn${due && dayjs(due).isSame(o.d, 'day') ? ' is-on' : ''}`}
          onClick={() => pick(o.d)}>
          {o.label}
        </button>
      ))}
      {allowNone && (
        <button type="button" className={`ce-quick__btn${!due ? ' is-on' : ''}`} onClick={() => pick(null)}>
          Без срока
        </button>
      )}
    </div>
  );
}

// Классы кнопками — выбор из выпадающего списка неудобен (особенно на телефоне).
export function GroupPills({ groups, value, onChange }) {
  return (
    <div className="qc-pills">
      {groups.map((g) => {
        const on = value === g.id;
        const hex = groupHex(g);
        return (
          <button type="button" key={g.id} className={`mc-pill${on ? ' is-on' : ''}`}
            style={on ? { background: hex.base, borderColor: hex.base, color: '#fff' } : { color: hex.ink || hex.base }}
            onClick={() => onChange?.(on ? undefined : g.id)}>
            {g.name}
          </button>
        );
      })}
    </div>
  );
}
