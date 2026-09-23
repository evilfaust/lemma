import { useEffect, useState } from 'react';
import { Modal, Segmented, Form, Input, Select, DatePicker, App } from 'antd';
import dayjs from 'dayjs';
import { PAIRS } from '../lessonTime';
import { api } from '../../../shared/services/pocketbase';
import useIsMobile from '../../../hooks/useIsMobile';
import { groupHex } from '../ui';
import SchoolEventFields from './SchoolEventFields';
import DateTimeField from './DateTimeField';
import { schoolEventFormToData } from './calendarUtils';
import { LessonColorField } from './LessonModal';
import './mobile.css';

const TYPES = [
  { value: 'lesson', label: 'Урок' },
  { value: 'deadline', label: 'Дедлайн' },
  { value: 'todo', label: 'Дело' },
  { value: 'school', label: 'Мероприятие' },
];

/**
 * Единое быстрое создание из сетки: табы Урок / Дедлайн / Дело.
 * Поля адаптируются под тип. Дата предзаполняется днём ячейки.
 */
export default function CreateEventModal({
  open, type: initType, day, pair: initPair, groups, works, onClose, onCreated,
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [type, setType] = useState(initType || 'lesson');
  const [pair, setPair] = useState(initPair || null);
  const [part, setPart] = useState('full');
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (open) {
      setType(initType || 'lesson');
      setPair(initPair || null);
      setPart('full');
      const base = day ? dayjs(day) : dayjs();
      form.setFieldsValue({
        title: '', group: undefined, work: undefined,
        date: base, due: base,
        // школьное мероприятие
        kind: 'other', color: '', note_md: '', all_day: true,
        date_start: base, date_end: null,
      });
    }
  }, [open, initType, initPair, day, form]);

  // Старт урока по паре и её половине (вся / 1-я / 2-я).
  const applyPair = (key, prt = part) => {
    setPair(key);
    setPart(prt);
    const def = PAIRS.find((p) => p.key === key);
    if (!def) return;
    const hhmm = (!def.halves || prt === 'full') ? def.full[0] : def.halves[prt === '1' ? 0 : 1][0];
    const [h, m] = hhmm.split(':').map(Number);
    const cur = form.getFieldValue('date') || dayjs();
    form.setFieldsValue({ date: dayjs(cur).hour(h).minute(m).second(0).millisecond(0) });
  };

  const slotCode = () => {
    if (!pair) return '';
    if (pair === '0' || part === 'full') return pair;
    return pair + (part === '1' ? 'a' : 'b');
  };

  const handleOk = async () => {
    let v;
    try { v = await form.validateFields(); } catch { return; }
    setSaving(true);
    try {
      if (type === 'lesson') {
        await api.createLesson({
          title: v.title,
          group: v.group || '',
          color: v.group ? '' : (v.color || ''),
          date_plan: (v.date || dayjs()).toISOString(),
          status: 'planned',
          time_slot: slotCode(),
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
          title: v.title,
          group: v.group || '',
          due_date: v.due ? v.due.toISOString() : '',
        });
      }
      message.success('Создано');
      onCreated();
      onClose();
    } catch {
      message.error('Не удалось создать');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Создать"
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={saving}
      okText="Создать"
      cancelText="Отмена"
      destroyOnHidden
      style={isMobile ? { top: 12 } : undefined}
    >
      <Segmented block options={TYPES} value={type} onChange={setType} style={{ margin: '8px 0 16px' }} />
      <Form form={form} layout="vertical">
        {type === 'school' && <SchoolEventFields form={form} />}
        {type !== 'school' && (type === 'deadline' ? (
          <Form.Item name="work" label="Работа" rules={[{ required: true, message: 'Выберите работу' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Выберите работу"
              options={(works || []).map((w) => ({ value: w.id, label: w.title }))}
            />
          </Form.Item>
        ) : (
          <Form.Item name="title" label={type === 'lesson' ? 'Тема урока' : 'Что нужно сделать'}
            rules={[{ required: true, message: 'Введите название' }]}>
            <Input placeholder={type === 'lesson' ? 'Тема урока' : 'Например: проверить тетради'} maxLength={500} autoFocus />
          </Form.Item>
        ))}

        {type !== 'deadline' && type !== 'school' && (
          <Form.Item name="group" label="Группа">
            {isMobile
              ? <GroupPills groups={groups} />
              : <Select allowClear placeholder="Группа" options={groups.map((g) => ({ value: g.id, label: g.name }))} />}
          </Form.Item>
        )}

        {type === 'lesson' && <LessonColorField form={form} />}

        {type !== 'school' && (type === 'lesson' ? (
          <>
            <Form.Item label="Пара по расписанию">
              <div className="ce-pairs">
                {PAIRS.map((p) => (
                  <span key={p.key}
                    className={`ce-pair${pair === p.key ? ' is-active' : ''}`}
                    onClick={() => applyPair(p.key, p.halves ? part : 'full')} role="button" tabIndex={0}>
                    {p.label}
                  </span>
                ))}
              </div>
              {pair && pair !== '0' && (
                <Segmented size="small" value={part} style={{ marginTop: 8 }}
                  onChange={(v) => applyPair(pair, v)}
                  options={[
                    { value: 'full', label: 'Вся пара' },
                    { value: '1', label: '1-я половина' },
                    { value: '2', label: '2-я половина' },
                  ]} />
              )}
            </Form.Item>
            <Form.Item name="date" label="Дата и время" rules={[{ required: true }]}>
              <DateTimeField />
            </Form.Item>
          </>
        ) : (
          <Form.Item name="due" label="Срок" rules={type === 'deadline' ? [{ required: true }] : []}>
            {type === 'deadline'
              ? <DateTimeField />
              : <DatePicker format="DD.MM.YYYY" inputReadOnly={isMobile} style={{ width: '100%' }} />}
          </Form.Item>
        ))}
      </Form>
    </Modal>
  );
}

// Классы кнопками — на телефоне выбор из выпадающего списка неудобен.
function GroupPills({ groups, value, onChange }) {
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
