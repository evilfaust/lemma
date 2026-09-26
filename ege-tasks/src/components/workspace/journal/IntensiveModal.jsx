import { useEffect, useMemo, useState } from 'react';
import {
  Button, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Slider, Space, Typography,
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  DEFAULT_FINAL_SHARE, finalShareOf, intensiveDays, shortDay, toStoredDate, dayOf,
} from '../../../utils/classJournal';
import { slotLabel } from '../lessonTime';

const { Text } = Typography;
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function dayLabel({ day, lesson }) {
  const wd = WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()];
  const parts = [`${wd} ${shortDay(day)}`];
  if (lesson) parts.push([slotLabel(lesson.time_slot), lesson.title].filter(Boolean).join(' · ') || 'урок');
  return parts.join(' — ');
}

/**
 * Интенсив в журнале класса: тема, даты, доля зачёта в расчёте итога. Новый
 * интенсив сразу заводит колонки: «за день» на каждый выбранный день (с
 * уроком календаря, если он в этот день один — тогда «н» придёт из
 * посещаемости), зачётную работу и итог. Работы дня добавляются потом —
 * из меню интенсива в шапке журнала.
 *
 * onSave(data, plan) — plan только у нового: { days: [{ day, lesson }],
 * withDay, withFinal, finalMax, withTotal }.
 */
export default function IntensiveModal({
  open, block, lessons = [], columnsCount = 0, saving = false, canDelete = false,
  onCancel, onSave, onDelete,
}) {
  const [form] = Form.useForm();
  const isNew = !block;
  const [picked, setPicked] = useState([]);
  const [withColumns, setWithColumns] = useState(false);

  useEffect(() => {
    if (!open) return;
    const from = dayOf(block?.date_from);
    const to = dayOf(block?.date_to);
    form.setFieldsValue({
      title: block?.title || '',
      range: from ? [dayjs(from), dayjs(to || from)] : [dayjs(), dayjs().add(4, 'day')],
      final_share: block ? finalShareOf(block) : DEFAULT_FINAL_SHARE,
      withDay: true,
      withFinal: true,
      finalMax: 20,
      withTotal: true,
      note: block?.note || '',
    });
    setWithColumns(false);
  }, [open, block, form]);

  const range = Form.useWatch('range', form);
  const share = Form.useWatch('final_share', form) ?? DEFAULT_FINAL_SHARE;
  const withDay = Form.useWatch('withDay', form);
  const withFinal = Form.useWatch('withFinal', form);

  const from = range?.[0]?.format('YYYY-MM-DD');
  const to = range?.[1]?.format('YYYY-MM-DD');
  const days = useMemo(() => intensiveDays(from, to, lessons), [from, to, lessons]);
  const fromLessons = days.some((d) => d.lesson);

  // Сменились даты — отмечаем все дни заново.
  useEffect(() => {
    setPicked(days.map((d) => d.day));
  }, [days]);

  const submit = async () => {
    const v = await form.validateFields();
    const [a, b] = v.range;
    const data = {
      title: v.title.trim(),
      date_from: toStoredDate(a.format('YYYY-MM-DD')),
      date_to: toStoredDate(b.format('YYYY-MM-DD')),
      final_share: v.final_share,
      note: (v.note || '').trim(),
    };
    const plan = isNew ? {
      days: days.filter((d) => picked.includes(d.day)),
      withDay: !!v.withDay,
      withFinal: !!v.withFinal,
      finalMax: v.finalMax,
      withTotal: !!v.withTotal,
    } : null;
    await onSave(data, plan);
  };

  const daysShare = 100 - share;

  return (
    <Modal
      open={open}
      title={isNew ? 'Новый интенсив' : 'Интенсив'}
      onCancel={onCancel}
      destroyOnHidden
      width={580}
      footer={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isNew && canDelete && (
            <Popconfirm
              title="Удалить интенсив?"
              description={(
                <div style={{ maxWidth: 300 }}>
                  <p style={{ margin: '0 0 8px' }}>
                    Без галочки колонки и отметки останутся в журнале обычными колонками.
                  </p>
                  <Checkbox checked={withColumns} onChange={(e) => setWithColumns(e.target.checked)}>
                    Удалить и его колонки ({columnsCount}) вместе с отметками
                  </Checkbox>
                </div>
              )}
              okText="Удалить"
              okButtonProps={{ danger: true }}
              cancelText="Отмена"
              onConfirm={() => onDelete(withColumns)}
            >
              <Button danger icon={<DeleteOutlined />}>Удалить</Button>
            </Popconfirm>
          )}
          <span style={{ flex: 1 }} />
          <Button onClick={onCancel}>Отмена</Button>
          <Button type="primary" loading={saving} onClick={submit}>
            {isNew ? 'Создать' : 'Сохранить'}
          </Button>
        </div>
      )}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
          Несколько дней по одной теме: в день — работы и оценка за день, в конце — зачёт.
          Журнал подсказывает среднюю по работам дня и расчёт итога, оценки ставите вы.
        </Text>
        <Form.Item
          name="title"
          label="Тема"
          rules={[{ required: true, whitespace: true, message: 'Назовите интенсив' }]}
        >
          <Input placeholder="Производная" autoFocus maxLength={200} />
        </Form.Item>
        <Form.Item name="range" label="Даты" rules={[{ required: true, message: 'Укажите даты' }]}>
          <DatePicker.RangePicker format="DD.MM.YYYY" allowClear={false} style={{ width: '100%' }} />
        </Form.Item>

        {isNew && (
          <>
            <Form.Item
              label="Дни интенсива"
              extra={fromLessons
                ? 'Дни взяты из уроков класса в календаре; урок дня привяжется к колонке «за день» — «н» придёт из посещаемости.'
                : 'Уроков класса в эти даты в календаре нет — предложены все дни, кроме воскресенья.'}
            >
              <Checkbox.Group
                value={picked}
                onChange={setPicked}
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                options={days.map((d) => ({ value: d.day, label: dayLabel(d) }))}
              />
              {!days.length && <Text type="secondary">Выберите даты</Text>}
            </Form.Item>
            <Form.Item label="Какие колонки завести сразу" style={{ marginBottom: 8 }}>
              <Space direction="vertical" size={6}>
                <Form.Item name="withDay" valuePropName="checked" noStyle>
                  <Checkbox>«За день» — оценка на каждый выбранный день ({withDay ? picked.length : 0})</Checkbox>
                </Form.Item>
                <Space size={8} align="center" wrap>
                  <Form.Item name="withFinal" valuePropName="checked" noStyle>
                    <Checkbox>Зачётная работа, максимум</Checkbox>
                  </Form.Item>
                  <Form.Item name="finalMax" noStyle rules={[{ required: !!withFinal, message: 'Максимум' }]}>
                    <InputNumber min={1} max={1000} size="small" disabled={!withFinal} style={{ width: 80 }} />
                  </Form.Item>
                  <Text type="secondary">баллов</Text>
                </Space>
                <Form.Item name="withTotal" valuePropName="checked" noStyle>
                  <Checkbox>Итог интенсива — оценка, которую ставите вы</Checkbox>
                </Form.Item>
              </Space>
            </Form.Item>
            <Text type="secondary" style={{ display: 'block', margin: '0 0 16px', fontSize: 12.5 }}>
              Работы дня (устный счёт, д/з, самостоятельные) добавляются потом — из меню интенсива
              в шапке журнала.
            </Text>
          </>
        )}

        <Form.Item
          name="final_share"
          label="Вес зачёта в расчёте итога, %"
          extra={`Подсказка итога: дни — ${daysShare} % поровну, зачёт — ${share} %. Без зачёта — средняя по дням. «w» в расчёт не входит.`}
        >
          <Slider min={0} max={90} step={5} marks={{ 0: '0', 40: '40', 90: '90' }} />
        </Form.Item>
        <Form.Item name="note" label="Заметка" style={{ marginBottom: 0 }}>
          <Input.TextArea rows={2} maxLength={2000} placeholder="Пары 1–4, кабинет 31" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
