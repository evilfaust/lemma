import { useEffect, useMemo, useRef } from 'react';
import {
  AutoComplete, Button, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Popconfirm,
  Segmented, Select, Space, Switch, Typography,
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  CATEGORY_SUGGESTIONS, DEFAULT_THRESHOLDS, SCALE_LABELS, WEIGHT_OPTIONS,
  normalizeThresholds, thresholdPoints, toStoredDate, formatNumber, lessonDay, shortDay,
  dayOf, rangeLabel,
} from '../../../utils/classJournal';
import { slotLabel } from '../lessonTime';

const { Text } = Typography;

const SCALE_HINT = {
  points: 'Баллы из максимума — в оценку переводятся по порогам ниже.',
  grade: 'Сразу оценка 2–5, можно с «+», «−», «=» — в средний идёт цифрой.',
  pass: 'Зачёт / незачёт — в средний балл не входит.',
  percent: 'Процент выполнения — в оценку по порогам ниже.',
};

/** Название колонки по уроку: его тема или «Урок 25.09». */
export function lessonColumnTitle(lesson) {
  return String(lesson?.title || '').trim() || `Урок ${shortDay(lessonDay(lesson))}`;
}

/** Подпись урока в выборе: «25.09 · интенсив, пары 2–4 · Логарифмы». */
export function lessonOptionLabel(lesson) {
  return [shortDay(lessonDay(lesson)), slotLabel(lesson?.time_slot), lesson?.title]
    .filter(Boolean).join(' · ');
}

const ROLE_OPTIONS = [
  { value: 'work', label: 'Работа' },
  { value: 'day', label: 'За день' },
  { value: 'final', label: 'Зачёт' },
  { value: 'total', label: 'Итог' },
];
const ROLE_HINT = {
  work: 'Работа дня: из её оценок складывается подсказка «за день».',
  day: 'Оценка за день — ставите вы; пустая клетка покажет среднюю по работам дня.',
  final: 'Зачётная работа: в расчёте итога весит больше дней (доля — в настройках интенсива).',
  total: 'Итог интенсива — ставите вы; пустая клетка покажет расчёт. В средний за год интенсив идёт этой колонкой.',
};
// Название по роли — для новых колонок «за день», зачёта и итога.
const ROLE_TITLES = { day: 'За день', final: 'Зачёт', total: 'Итог' };

// Интенсив, в даты которого попадает день.
function blockOnDay(blocks, day) {
  return blocks.find((b) => {
    const a = dayOf(b.date_from);
    const z = dayOf(b.date_to) || a;
    return a && day >= a && day <= z;
  }) || null;
}

// Единственный урок класса в этот день — его и предлагаем; два и больше — нет:
// угадывать между парами одного дня нельзя.
function lessonOnDay(lessons, day) {
  const same = lessons.filter((l) => l.status !== 'cancelled' && lessonDay(l) === day);
  return same.length === 1 ? same[0] : null;
}

/**
 * Настройки колонки журнала: новой ручной, существующей или онлайн-работы.
 * column — колонка из mergeColumns (null = новая ручная), defaults — чем
 * заполнить новую (прошлая колонка класса: шкала, максимум, пороги, «№ + 1»).
 * lessons — уроки класса; presetLesson — урок, из которого колонку заводят
 * (карточка урока в календаре); pickLesson — сразу открыть выбор урока.
 */
export default function JournalColumnModal({
  open, column, defaults, categories = [], hasMarks = false, canDelete = false,
  lessons = [], presetLesson = null, pickLesson = false, sourceNote = '',
  blocks = [], blocksEnabled = false, presetBlock = null,
  onCancel, onSave, onDelete, saving = false,
}) {
  const [form] = Form.useForm();
  const isNew = !column;
  const online = !!column?.online;
  // Урок подставлен сам (по дате), а не выбран учителем: такой можно заменить
  // при смене даты. Выбранный руками не трогаем.
  const lessonAuto = useRef(false);
  // Название, подставленное из урока: сменили урок — меняем и его, если
  // учитель не переписал.
  const autoTitle = useRef('');
  // Интенсив подставлен по дате, а не выбран: при смене даты переподбираем.
  const blockAuto = useRef(false);

  const lessonById = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons]);

  useEffect(() => {
    if (!open) return;
    const src = column || defaults || {};
    const t = normalizeThresholds(src.thresholds);
    const w = Number(src.weight) > 0 ? Number(src.weight) : 1;

    let lesson = column ? (column.lessonId || undefined) : undefined;
    let day = src.day || null;
    let title = src.title || '';
    let block = column ? (column.blockId || undefined) : undefined;
    let role = column?.role || 'work';
    lessonAuto.current = false;
    autoTitle.current = '';
    blockAuto.current = false;
    if (isNew && presetBlock) {
      block = presetBlock.id;
      role = src.role || 'work';
      // Сегодня внутри интенсива — сегодня, иначе его последний день:
      // бумажные работы обычно вносят вечером того же дня или после.
      const today = dayjs().format('YYYY-MM-DD');
      const a = dayOf(presetBlock.date_from);
      const z = dayOf(presetBlock.date_to) || a;
      day = src.day || (a && today >= a && today <= z ? today : z || today);
    }
    if (isNew && presetLesson) {
      lesson = presetLesson.id;
      day = lessonDay(presetLesson);
      title = lessonColumnTitle(presetLesson);
      autoTitle.current = title;
    } else if (isNew) {
      const today = lessonOnDay(lessons, day || dayjs().format('YYYY-MM-DD'));
      if (today) {
        lesson = today.id;
        lessonAuto.current = true;
      }
    }
    if (isNew && !presetBlock && blocksEnabled) {
      const b = blockOnDay(blocks, day || dayjs().format('YYYY-MM-DD'));
      if (b) {
        block = b.id;
        blockAuto.current = true;
      }
    }

    form.setFieldsValue({
      lesson,
      block,
      role,
      title,
      date: day ? dayjs(day) : dayjs(),
      category: src.category || '',
      scale: online ? 'percent' : (src.scale || 'points'),
      max_score: src.max_score || 10,
      t5: t[5],
      t4: t[4],
      t3: t[3],
      weight: WEIGHT_OPTIONS.includes(w) ? w : 1,
      no_avg: !!src.no_avg,
      hidden: !!src.hidden,
      assigned: !!src.assigned,
      note: src.note || '',
    });
  // lessons не в зависимостях: список может догрузиться, а форму, в которой
  // учитель уже что-то поменял, заново заполнять нельзя.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, column, defaults, online, presetLesson, presetBlock, form]);

  const lessonOptions = useMemo(() => {
    const list = lessons.filter((l) => l.status !== 'cancelled');
    if (presetLesson && !list.some((l) => l.id === presetLesson.id)) list.push(presetLesson);
    return [...list]
      .sort((a, b) => String(lessonDay(b) || '').localeCompare(String(lessonDay(a) || '')))
      .map((l) => ({ value: l.id, label: lessonOptionLabel(l) }));
  }, [lessons, presetLesson]);

  // Выбрали урок — дата колонки = день урока, название — из урока, если его
  // не переписывали.
  const onLessonChange = (id) => {
    lessonAuto.current = false;
    const l = id ? (lessonById.get(id) || (presetLesson?.id === id ? presetLesson : null)) : null;
    if (!l) return;
    const patch = { date: dayjs(lessonDay(l)) };
    const cur = String(form.getFieldValue('title') || '').trim();
    if (!cur || cur === autoTitle.current) {
      patch.title = lessonColumnTitle(l);
      autoTitle.current = patch.title;
    }
    form.setFieldsValue(patch);
  };

  // Сменили дату у новой колонки — урок и интенсив, подставленные сами,
  // переподбираем.
  const onDateChange = (d) => {
    if (!isNew || !d) return;
    const day = d.format('YYYY-MM-DD');
    if (lessonAuto.current) {
      const l = lessonOnDay(lessons, day);
      form.setFieldsValue({ lesson: l ? l.id : undefined });
    }
    if (blockAuto.current && blocksEnabled) {
      const b = blockOnDay(blocks, day);
      form.setFieldsValue({ block: b ? b.id : undefined });
    }
  };

  // Роль «за день» / «итог» — это оценка учителя: шкала 2–5 и название по роли,
  // если учитель его не переписал.
  const onRoleChange = (role) => {
    if (!isNew) return;
    const patch = {};
    if (role === 'day' || role === 'total') patch.scale = 'grade';
    const cur = String(form.getFieldValue('title') || '').trim();
    const autoRoleTitles = Object.values(ROLE_TITLES);
    if (ROLE_TITLES[role] && (!cur || autoRoleTitles.includes(cur))) patch.title = ROLE_TITLES[role];
    form.setFieldsValue(patch);
  };

  const blockOptions = useMemo(() => blocks.map((b) => ({
    value: b.id,
    label: [b.title, rangeLabel(b.date_from, b.date_to)].filter(Boolean).join(' · '),
  })), [blocks]);
  const selectedBlock = Form.useWatch('block', form);
  const selectedRole = Form.useWatch('role', form);

  const selectedLesson = Form.useWatch('lesson', form);

  const scale = Form.useWatch('scale', form);
  const max = Form.useWatch('max_score', form);
  const t5 = Form.useWatch('t5', form);
  const t4 = Form.useWatch('t4', form);
  const t3 = Form.useWatch('t3', form);
  const noAvg = Form.useWatch('no_avg', form);

  const usesThresholds = online || scale === 'points' || scale === 'percent';
  const hint = useMemo(() => {
    if (scale !== 'points' || online) return null;
    const p = thresholdPoints(max, { 5: t5, 4: t4, 3: t3 });
    return p ? `Из ${formatNumber(Number(max))}: «5» — от ${p[5]}, «4» — от ${p[4]}, «3» — от ${p[3]}` : null;
  }, [scale, online, max, t5, t4, t3]);

  const categoryOptions = useMemo(() => {
    const all = [...new Set([...categories.filter(Boolean), ...CATEGORY_SUGGESTIONS])];
    return all.map((v) => ({ value: v }));
  }, [categories]);

  const submit = async () => {
    const v = await form.validateFields();
    const data = {
      title: v.title.trim(),
      date: toStoredDate(v.date ? v.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')),
      category: (v.category || '').trim(),
      weight: v.weight,
      no_avg: !!v.no_avg,
      note: (v.note || '').trim(),
    };
    if (!online) {
      data.scale = v.scale;
      if (v.scale === 'points') data.max_score = v.max_score;
    }
    if (online || v.scale === 'points' || v.scale === 'percent') {
      data.thresholds = { 5: v.t5, 4: v.t4, 3: v.t3 };
    }
    if (!isNew) data.hidden = !!v.hidden;
    if (online) data.assigned = !!v.assigned;
    // Пустая строка снимает привязку к уроку у существующей колонки.
    if (v.lesson || !isNew) data.lesson = v.lesson || '';
    if (blocksEnabled && (v.block || !isNew)) {
      data.block = v.block || '';
      data.role = v.block ? (v.role || 'work') : '';
    }
    await onSave(data);
  };

  const deleteLabel = online ? 'Убрать из журнала' : 'Удалить колонку';
  const deleteConfirm = online
    ? 'Настройки колонки и ручные правки клеток удалятся. Если по работе есть попытки, колонка вернётся с результатами из них.'
    : 'Колонка удалится вместе со всеми отметками в ней.';

  return (
    <Modal
      open={open}
      title={isNew
        ? (presetBlock ? `Новая колонка · интенсив «${presetBlock.title}»` : 'Новая колонка')
        : online ? 'Онлайн-работа в журнале' : 'Колонка журнала'}
      onCancel={onCancel}
      destroyOnHidden
      width={560}
      footer={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isNew && !column.virtual && canDelete && onDelete && (
            <Popconfirm
              title={`${deleteLabel}?`}
              description={<div style={{ maxWidth: 280 }}>{deleteConfirm}</div>}
              okText={deleteLabel}
              okButtonProps={{ danger: true }}
              cancelText="Отмена"
              onConfirm={onDelete}
            >
              <Button danger icon={<DeleteOutlined />}>{deleteLabel}</Button>
            </Popconfirm>
          )}
          <span style={{ flex: 1 }} />
          <Button onClick={onCancel}>Отмена</Button>
          <Button type="primary" loading={saving} onClick={submit}>
            {isNew ? 'Добавить' : 'Сохранить'}
          </Button>
        </div>
      )}
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit}>
        {sourceNote && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
            {sourceNote}
          </Text>
        )}
        {online && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
            Значения берутся из попыток учеников (лучший результат, в процентах). Клетку
            можно исправить вручную — например, если ученик переписал работу на бумаге.
          </Text>
        )}
        <Form.Item
          name="lesson"
          label="Урок календаря"
          extra={selectedLesson
            ? 'Кто не был на уроке, в пустой клетке сам получит «н» из посещаемости.'
            : 'Необязательно. С уроком дата берётся из него, а «н» — из посещаемости.'}
        >
          <Select
            allowClear
            showSearch
            autoFocus={pickLesson}
            defaultOpen={pickLesson}
            placeholder={lessonOptions.length ? 'Без урока' : 'У класса нет уроков в календаре'}
            options={lessonOptions}
            optionFilterProp="label"
            onChange={onLessonChange}
            notFoundContent="Уроков не найдено"
          />
        </Form.Item>
        {blocksEnabled && blocks.length > 0 && (
          <Space.Compact block style={{ gap: 12, display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item
              name="block"
              label="Интенсив"
              style={{ flex: '1 1 200px' }}
              extra={selectedBlock ? ROLE_HINT[selectedRole || 'work'] : 'Необязательно. Колонка войдёт в интенсив и его итог.'}
            >
              <Select
                allowClear
                placeholder="Не в интенсиве"
                options={blockOptions}
                onChange={() => { blockAuto.current = false; }}
              />
            </Form.Item>
            {selectedBlock && (
              <Form.Item name="role" label="Что это" style={{ flex: '0 0 auto' }}>
                <Segmented options={ROLE_OPTIONS} onChange={onRoleChange} />
              </Form.Item>
            )}
          </Space.Compact>
        )}
        <Form.Item
          name="title"
          label="Название"
          rules={[{ required: true, whitespace: true, message: 'Назовите колонку' }]}
        >
          <Input placeholder="Устный счёт 4" autoFocus={isNew && !pickLesson} maxLength={200} />
        </Form.Item>
        <Space.Compact block style={{ gap: 12, display: 'flex' }}>
          <Form.Item name="date" label="Дата" style={{ flex: '0 0 170px' }}>
            <DatePicker format="DD.MM.YYYY" allowClear={false} style={{ width: '100%' }} onChange={onDateChange} />
          </Form.Item>
          <Form.Item name="category" label="Категория" style={{ flex: 1 }}>
            <AutoComplete
              options={categoryOptions}
              placeholder="Устный счёт"
              filterOption={(input, opt) => String(opt?.value || '').toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
        </Space.Compact>

        {!online && (
          <>
            <Form.Item
              name="scale"
              label="Шкала"
              extra={hasMarks && !isNew ? 'В колонке уже есть отметки — шкалу не поменять.' : SCALE_HINT[scale]}
            >
              <Segmented
                block
                disabled={hasMarks && !isNew}
                options={Object.entries(SCALE_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
            {scale === 'points' && (
              <Form.Item
                name="max_score"
                label="Максимум баллов"
                rules={[{ required: true, message: 'Укажите максимум' }]}
              >
                <InputNumber min={1} max={1000} step={1} style={{ width: 170 }} />
              </Form.Item>
            )}
          </>
        )}

        {usesThresholds && (
          <Form.Item
            label="Перевод в оценку, % выполнения"
            extra={hint || `По умолчанию «5» от ${DEFAULT_THRESHOLDS[5]} %, «4» от ${DEFAULT_THRESHOLDS[4]} %, «3» от ${DEFAULT_THRESHOLDS[3]} %.`}
            style={{ marginBottom: 16 }}
          >
            <Space wrap size={[12, 8]}>
              <Form.Item name="t5" noStyle rules={[{ required: true }]}>
                <InputNumber min={0} max={100} addonBefore="«5» от" addonAfter="%" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item
                name="t4"
                noStyle
                dependencies={['t5']}
                rules={[{ required: true }, ({ getFieldValue }) => ({
                  validator: (_, v) => (v <= getFieldValue('t5') ? Promise.resolve() : Promise.reject(new Error('«4» не выше «5»'))),
                })]}
              >
                <InputNumber min={0} max={100} addonBefore="«4» от" addonAfter="%" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item
                name="t3"
                noStyle
                dependencies={['t4']}
                rules={[{ required: true }, ({ getFieldValue }) => ({
                  validator: (_, v) => (v <= getFieldValue('t4') ? Promise.resolve() : Promise.reject(new Error('«3» не выше «4»'))),
                })]}
              >
                <InputNumber min={0} max={100} addonBefore="«3» от" addonAfter="%" style={{ width: 150 }} />
              </Form.Item>
            </Space>
          </Form.Item>
        )}

        {scale !== 'pass' && (
          <Space size={16} align="center" style={{ marginBottom: 16 }} wrap>
            <Form.Item name="weight" label="Вес в среднем" style={{ marginBottom: 0 }}>
              <Select
                disabled={noAvg}
                style={{ width: 150 }}
                options={WEIGHT_OPTIONS.map((w) => ({ value: w, label: w === 1 ? 'обычный ×1' : `×${formatNumber(w)}` }))}
              />
            </Form.Item>
            <Form.Item name="no_avg" valuePropName="checked" style={{ marginBottom: 0, paddingTop: 30 }}>
              <Checkbox>не учитывать в среднем</Checkbox>
            </Form.Item>
          </Space>
        )}

        {online && (
          <Form.Item
            name="assigned"
            valuePropName="checked"
            label="Выдана всему классу"
            extra="Кто не сдал к сроку выдачи — попадает в долги, даже если работу не открывал."
          >
            <Switch />
          </Form.Item>
        )}

        {!isNew && (
          <Form.Item name="hidden" valuePropName="checked" label="Скрыть колонку" extra="Скрытая не видна в журнале и не входит в средний; вернуть — «Показать скрытые».">
            <Switch />
          </Form.Item>
        )}

        <Form.Item name="note" label="Заметка" style={{ marginBottom: 0 }}>
          <Input.TextArea rows={2} maxLength={2000} placeholder="Варианты 1–2, лист «Устный счёт №4»" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
