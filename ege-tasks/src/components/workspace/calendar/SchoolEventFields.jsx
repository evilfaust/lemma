import { Form, Input, Select, DatePicker, Switch } from 'antd';
import { GroupColorPicker } from '../ui';
import { KIND_LABELS, KIND_COLORS } from '../../../shared/services/pb/schoolEvents';

export const KIND_OPTIONS = Object.entries(KIND_LABELS)
  .map(([value, label]) => ({ value, label }));

/**
 * Поля школьного мероприятия — общие для быстрого создания из сетки
 * (`CreateEventModal`) и для правки (`SchoolEventModal`).
 *
 * Дата хранится двумя полями, а не диапазоном: пустой «по» = однодневное
 * событие, и это ровно то, что лежит в базе (`date_end` необязателен).
 */
export default function SchoolEventFields({ form }) {
  const kind = Form.useWatch('kind', form) || 'other';
  const allDay = Form.useWatch('all_day', form) !== false;

  return (
    <>
      <Form.Item name="title" label="Название"
        rules={[{ required: true, message: 'Введите название' }]}>
        <Input placeholder="Педсовет / Осенние каникулы / Школьный этап ВОШ" maxLength={500} autoFocus />
      </Form.Item>

      <Form.Item name="kind" label="Тип">
        <Select options={KIND_OPTIONS} />
      </Form.Item>

      <Form.Item name="all_day" label="Весь день" valuePropName="checked">
        <Switch size="small" />
      </Form.Item>

      <div style={{ display: 'flex', gap: 12 }}>
        <Form.Item name="date_start" label="Дата" style={{ flex: 1 }}
          rules={[{ required: true, message: 'Укажите дату' }]}>
          <DatePicker
            showTime={allDay ? false : { format: 'HH:mm' }}
            format={allDay ? 'DD.MM.YYYY' : 'DD.MM.YYYY HH:mm'}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item name="date_end" label="По (если несколько дней)" style={{ flex: 1 }}>
          <DatePicker
            showTime={allDay ? false : { format: 'HH:mm' }}
            format={allDay ? 'DD.MM.YYYY' : 'DD.MM.YYYY HH:mm'}
            style={{ width: '100%' }}
            placeholder="—"
          />
        </Form.Item>
      </div>

      <Form.Item name="color" label="Цвет"
        tooltip="«По типу» — цвет берётся из типа мероприятия (каникулы зелёные, экзамен малиновый и т.д.)">
        <GroupColorPicker autoTone={KIND_COLORS[kind] || 'slate'} autoLabel="по типу" />
      </Form.Item>

      <Form.Item name="note_md" label="Заметка">
        <Input.TextArea rows={2} maxLength={10000} placeholder="Необязательно: детали, кабинет, ответственный" />
      </Form.Item>
    </>
  );
}
