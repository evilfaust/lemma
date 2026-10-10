import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Segmented, Select,
  Space, Tooltip, Typography,
} from 'antd';
import {
  ArrowDownOutlined, ArrowUpOutlined, CloseOutlined, DeleteOutlined, PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  BLOCK_KIND_LABELS, EXAM_PART_PRESETS, PART_FORMAT_LABELS, WEIGHT_OPTIONS,
  blockKind, dayOf, lessonDay, toStoredDate,
} from '../../../utils/classJournal';
import { lessonOptionLabel } from './JournalColumnModal';

const { Text } = Typography;

const KIND_OPTIONS = [
  { value: 'credit', label: BLOCK_KIND_LABELS.credit },
  { value: 'exam', label: BLOCK_KIND_LABELS.exam },
];
const FORMAT_OPTIONS = [
  { value: 'written', label: PART_FORMAT_LABELS.written },
  { value: 'oral', label: PART_FORMAT_LABELS.oral },
];
const PART_SCALES = [
  { value: 'points', label: 'Баллы' },
  { value: 'grade', label: 'Оценка 2–5' },
  { value: 'pass', label: 'Зачёт' },
];
const TOTAL_SCALES = [
  { value: 'grade', label: 'Оценка 2–5' },
  { value: 'pass', label: 'Зачёт / незачёт' },
];
const weightOptions = WEIGHT_OPTIONS.map((w) => ({ value: w, label: `×${String(w).replace('.', ',')}` }));

let partSeq = 0;
function newPart(preset = {}) {
  partSeq += 1;
  return {
    key: `p${partSeq}`,
    title: preset.title || '',
    format: preset.format || 'written',
    scale: preset.scale || 'points',
    max_score: preset.scale === 'points' || !preset.scale ? (preset.max_score || 10) : undefined,
    weight: 1,
    note: '',
  };
}

// Уроки класса в день зачёта (без отменённых).
function lessonsOnDay(lessons, day) {
  if (!day) return [];
  return lessons.filter((l) => l.status !== 'cancelled' && lessonDay(l) === day);
}

/** Ошибки списка частей: пустое название, нет максимума у баллов. */
export function partsErrors(parts) {
  const out = {};
  for (const p of parts) {
    if (!String(p.title || '').trim()) out[p.key] = 'Назовите часть';
    else if (p.scale === 'points' && !(Number(p.max_score) > 0)) out[p.key] = 'Укажите максимум баллов';
  }
  return out;
}

/**
 * Зачёт / экзамен в журнале класса (v3.9.334): контрольное мероприятие на
 * пару, две пары или день. Новый сразу заводит колонки: по одной на каждую
 * часть (письменную или устную, своя шкала) и «Итог». Части дописываются
 * потом из меню над колонками; настройки части — как у любой колонки.
 *
 * onSave(data, plan) — plan только у нового: { parts: [{ title, format,
 * scale, max_score, weight, note }], lessonId, total: { scale, weight } }.
 */
export default function ExamModal({
  open, block, lessons = [], columnsCount = 0, saving = false, canDelete = false,
  defaultKind = 'credit', onCancel, onSave, onDelete,
}) {
  const [form] = Form.useForm();
  const isNew = !block;
  const [parts, setParts] = useState([]);
  const [errors, setErrors] = useState({});
  const [withColumns, setWithColumns] = useState(false);
  // Урок подставлен по дате сам — при смене даты переподбираем.
  const lessonAuto = useRef(false);

  useEffect(() => {
    if (!open) return;
    const day = dayOf(block?.date_from) || dayjs().format('YYYY-MM-DD');
    const same = lessonsOnDay(lessons, day);
    lessonAuto.current = isNew && same.length === 1;
    form.setFieldsValue({
      kind: block ? blockKind(block) : defaultKind,
      title: block?.title || '',
      date: dayjs(day),
      lesson: isNew && same.length === 1 ? same[0].id : undefined,
      totalScale: 'grade',
      totalWeight: 1,
      note: block?.note || '',
    });
    setParts([]);
    setErrors({});
    setWithColumns(false);
  // Только на открытие: уроки догружаются вместе с журналом.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, block]);

  const kind = Form.useWatch('kind', form) || defaultKind;
  const date = Form.useWatch('date', form);
  const day = date ? date.format('YYYY-MM-DD') : '';
  const dayLessons = useMemo(() => lessonsOnDay(lessons, day), [lessons, day]);
  const lessonOptions = useMemo(
    () => dayLessons.map((l) => ({ value: l.id, label: lessonOptionLabel(l) })),
    [dayLessons],
  );

  const onDateChange = (d) => {
    if (!isNew || !d || !lessonAuto.current) return;
    const same = lessonsOnDay(lessons, d.format('YYYY-MM-DD'));
    form.setFieldsValue({ lesson: same.length === 1 ? same[0].id : undefined });
  };

  const patchPart = (key, p) => {
    setParts((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };
  const movePart = (i, d) => setParts((list) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const removePart = (key) => setParts((list) => list.filter((x) => x.key !== key));
  const addPart = (preset) => setParts((list) => [...list, newPart(preset)]);

  const submit = async () => {
    const v = await form.validateFields();
    const d = v.date.format('YYYY-MM-DD');
    const data = {
      kind: v.kind,
      title: v.title.trim(),
      date_from: toStoredDate(d),
      date_to: toStoredDate(d),
      note: (v.note || '').trim(),
    };
    let plan = null;
    if (isNew) {
      const errs = partsErrors(parts);
      if (Object.keys(errs).length) {
        setErrors(errs);
        return;
      }
      plan = {
        parts: parts.map((p) => ({
          title: p.title.trim(),
          format: p.format,
          scale: p.scale,
          ...(p.scale === 'points' ? { max_score: Number(p.max_score) } : {}),
          weight: p.weight || 1,
          note: (p.note || '').trim(),
        })),
        lessonId: v.lesson || '',
        total: { scale: v.totalScale || 'grade', weight: v.totalWeight || 1 },
      };
    }
    await onSave(data, plan);
  };

  const kindWord = kind === 'exam' ? 'экзамен' : 'зачёт';
  const kindGen = kind === 'exam' ? 'экзамена' : 'зачёта';

  return (
    <Modal
      open={open}
      title={isNew ? `Новый ${kindWord}` : (kind === 'exam' ? 'Экзамен' : 'Зачёт')}
      onCancel={onCancel}
      destroyOnHidden
      width={760}
      style={{ maxWidth: '96vw' }}
      footer={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isNew && canDelete && (
            <Popconfirm
              title={`Удалить ${kindWord}?`}
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
          Контрольное мероприятие на пару, две пары или весь день: несколько частей — письменных
          и устных, у каждой своя шкала. Журнал подсказывает итог по частям, оценку ставите вы;
          в средний за год {kindWord} идёт итогом.
        </Text>
        <Space.Compact block style={{ gap: 12, display: 'flex', flexWrap: 'wrap' }}>
          <Form.Item name="kind" label="Что это" style={{ flex: '0 0 auto' }}>
            <Segmented options={KIND_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="title"
            label="Тема"
            style={{ flex: '1 1 240px' }}
            rules={[{ required: true, whitespace: true, message: `Назовите ${kindWord}` }]}
          >
            <Input placeholder="Параллелограмм" autoFocus maxLength={200} />
          </Form.Item>
          <Form.Item name="date" label="Дата" style={{ flex: '0 0 160px' }} rules={[{ required: true, message: 'Укажите дату' }]}>
            <DatePicker format="DD.MM.YYYY" allowClear={false} style={{ width: '100%' }} onChange={onDateChange} />
          </Form.Item>
        </Space.Compact>

        {isNew && (
          <>
            <Form.Item
              name="lesson"
              label="Урок календаря"
              extra={dayLessons.length
                ? 'Кого не было на уроке, в пустых клетках частей сам получит «н» из посещаемости.'
                : 'Уроков класса в этот день в календаре нет — можно без урока.'}
            >
              <Select
                allowClear
                placeholder="Без урока"
                options={lessonOptions}
                onChange={() => { lessonAuto.current = false; }}
                notFoundContent="Уроков в этот день нет"
              />
            </Form.Item>

            <div className="cj-exam-parts">
              <div className="cj-exam-parts__head">
                <b>Части {kindGen}</b>
                <Text type="secondary" style={{ fontSize: 12.5 }}>
                  {parts.length ? `${parts.length} — по колонке на каждую` : 'добавьте части — сюжеты у каждого зачёта свои'}
                </Text>
              </div>
              {parts.map((p, i) => (
                <div key={p.key} className={`cj-exam-part${errors[p.key] ? ' is-err' : ''}`} data-testid="exam-part">
                  <div className="cj-exam-part__row">
                    <span className="cj-exam-part__num">{i + 1}</span>
                    <Input
                      value={p.title}
                      placeholder="Название части"
                      maxLength={200}
                      status={errors[p.key] && !p.title.trim() ? 'error' : undefined}
                      onChange={(e) => patchPart(p.key, { title: e.target.value })}
                      style={{ flex: '1 1 180px', minWidth: 0 }}
                      aria-label={`Название части ${i + 1}`}
                    />
                    <Segmented
                      size="small"
                      value={p.format}
                      options={FORMAT_OPTIONS}
                      onChange={(format) => patchPart(p.key, { format })}
                    />
                    <Select
                      size="small"
                      value={p.scale}
                      options={PART_SCALES}
                      style={{ width: 118 }}
                      onChange={(scale) => patchPart(p.key, {
                        scale, max_score: scale === 'points' ? (p.max_score || 10) : undefined,
                      })}
                      aria-label={`Шкала части ${i + 1}`}
                    />
                    {p.scale === 'points' && (
                      <Tooltip title="Максимум баллов">
                        <InputNumber
                          size="small"
                          min={1}
                          max={1000}
                          value={p.max_score}
                          status={errors[p.key] && p.title.trim() ? 'error' : undefined}
                          onChange={(max_score) => patchPart(p.key, { max_score })}
                          prefix="из"
                          style={{ width: 92 }}
                          aria-label={`Максимум части ${i + 1}`}
                        />
                      </Tooltip>
                    )}
                    <Space size={0}>
                      <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => movePart(i, -1)} aria-label="Выше" />
                      <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={i === parts.length - 1} onClick={() => movePart(i, 1)} aria-label="Ниже" />
                      <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => removePart(p.key)} aria-label="Убрать часть" />
                    </Space>
                  </div>
                  <div className="cj-exam-part__row cj-exam-part__row--sub">
                    <Input
                      size="small"
                      value={p.note}
                      maxLength={2000}
                      placeholder="Что проверяла часть — для обратной связи (необязательно)"
                      onChange={(e) => patchPart(p.key, { note: e.target.value })}
                      style={{ flex: '1 1 260px', minWidth: 0 }}
                    />
                    {p.scale !== 'pass' && (
                      <Tooltip title="Вес части в подсказке итога">
                        <Select
                          size="small"
                          value={p.weight}
                          options={weightOptions}
                          onChange={(weight) => patchPart(p.key, { weight })}
                          style={{ width: 76 }}
                          aria-label={`Вес части ${i + 1}`}
                        />
                      </Tooltip>
                    )}
                  </div>
                  {errors[p.key] && <div className="cj-exam-part__err">{errors[p.key]}</div>}
                </div>
              ))}
              <div className="cj-exam-parts__add">
                {EXAM_PART_PRESETS.map((preset) => (
                  <Button key={preset.key} size="small" icon={<PlusOutlined />} onClick={() => addPart(preset)}>
                    {preset.title}
                  </Button>
                ))}
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => addPart({ title: '' })}>
                  Своя часть
                </Button>
              </div>
            </div>

            <Space.Compact block style={{ gap: 12, display: 'flex', flexWrap: 'wrap', marginTop: 12 }}>
              <Form.Item
                name="totalScale"
                label={`Итог ${kindGen}`}
                style={{ flex: '0 0 auto' }}
                extra="Пустая клетка итога покажет подсказку по частям."
              >
                <Segmented options={TOTAL_SCALES} />
              </Form.Item>
              <Form.Item name="totalWeight" label="Вес итога в среднем за год" style={{ flex: '0 0 auto' }}>
                <Select options={weightOptions} style={{ width: 90 }} />
              </Form.Item>
            </Space.Compact>
          </>
        )}

        {!isNew && (
          <Text type="secondary" style={{ display: 'block', margin: '0 0 12px', fontSize: 12.5 }}>
            Части — колонки журнала: добавить — из меню над колонками, шкалу и название
            части — в её настройках. Дата {kindGen} переносится и на его колонки.
          </Text>
        )}

        <Form.Item name="note" label="Заметка" style={{ marginBottom: 0 }}>
          <Input.TextArea rows={2} maxLength={2000} placeholder="Пары 2–3, кабинет 31" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
