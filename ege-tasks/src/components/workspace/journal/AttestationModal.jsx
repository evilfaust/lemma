import { useEffect, useMemo, useState } from 'react';
import {
  Button, DatePicker, Form, Input, Modal, Popconfirm, Segmented, Tag, Typography,
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  ATTESTATION_TITLES, DEFAULT_ROUND_EDGE, ROUND_EDGES, formatAvg, parsePeriodRange, periodLabel,
  planAttestationFill, rangePeriod, roundAverage,
} from '../../../utils/classJournal';

const { Text } = Typography;
const LS_EDGE = 'journal.attestationEdge';
const readEdge = () => {
  try {
    const v = Number(localStorage.getItem(LS_EDGE));
    return ROUND_EDGES.includes(v) ? v : DEFAULT_ROUND_EDGE;
  } catch { return DEFAULT_ROUND_EDGE; }
};
const writeEdge = (v) => { try { localStorage.setItem(LS_EDGE, String(v)); } catch { /* приватный режим */ } };

const FILL_OPTIONS = [
  { value: 'none', label: 'Не выставлять' },
  { value: 'empty', label: 'В пустые клетки' },
  { value: 'all', label: 'Всем, заменить' },
];
const FILL_HINTS = {
  none: 'В пустых клетках будет видна подсказка «≈4,36» — оценки поставите сами.',
  empty: 'Округлённый средний ляжет в пустые клетки, выставленные оценки не тронутся.',
  all: 'Округлённый средний заменит и уже выставленные оценки.',
};

/**
 * Аттестация в журнале (v3.9.414): колонка «I четверть», «Год»… с периодом,
 * который выбирает учитель. Окно показывает средний каждого ученика за
 * период и может сразу выставить округлённые оценки.
 *
 * averagesFor(period) → [{ student, avg, count, stored, text, comment }];
 * suggestPeriod(title) → '2026-09-01..2026-10-26' — период для названия;
 * onSave({ title, period, fill: { edge, overwrite } | null }).
 */
export default function AttestationModal({
  open, column, initialFill = 'empty', suggestTitle = '', suggestPeriod, averagesFor,
  presets, saving = false, canDelete = false, onCancel, onSave, onDelete,
}) {
  const [form] = Form.useForm();
  const isNew = !column;
  const [edge, setEdge] = useState(DEFAULT_ROUND_EDGE);
  const [fill, setFill] = useState(initialFill);

  useEffect(() => {
    if (!open) return;
    const title = column?.title || suggestTitle;
    const period = column?.period || suggestPeriod?.(title) || '';
    const r = parsePeriodRange(period);
    form.setFieldsValue({ title, range: r ? [dayjs(r.from), dayjs(r.to)] : null });
    setEdge(readEdge());
    setFill(initialFill);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, column]);

  const range = Form.useWatch('range', form);
  const titleNow = Form.useWatch('title', form);
  const period = range?.[0] && range?.[1]
    ? rangePeriod(range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'))
    : '';
  const rows = useMemo(
    () => (open && period ? averagesFor(period) : []),
    [open, period, averagesFor],
  );
  const active = rows.filter((r) => !r.student.former);
  const withMarks = active.filter((r) => r.avg != null).length;
  const writes = fill === 'none' ? [] : planAttestationFill(rows, { edge, overwrite: fill === 'all' });

  // Название из готовых: у новой колонки период подстраивается под него
  // («Год» — с 1 сентября, «II четверть» — после конца первой).
  const pickTitle = (t) => {
    form.setFieldValue('title', t);
    if (!isNew) return;
    const r = parsePeriodRange(suggestPeriod?.(t));
    if (r) form.setFieldValue('range', [dayjs(r.from), dayjs(r.to)]);
  };

  const submit = async () => {
    const v = await form.validateFields();
    writeEdge(edge);
    await onSave({
      title: v.title.trim(),
      period,
      fill: fill === 'none' ? null : { edge, overwrite: fill === 'all' },
    });
  };

  return (
    <Modal
      open={open}
      title={isNew ? 'Аттестация за период' : `Аттестация: ${column.title}`}
      onCancel={onCancel}
      destroyOnHidden
      width={640}
      footer={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isNew && canDelete && (
            <Popconfirm
              title="Удалить колонку аттестации?"
              description="Выставленные в ней оценки удалятся. Отметки за период останутся."
              okText="Удалить"
              okButtonProps={{ danger: true }}
              cancelText="Отмена"
              onConfirm={onDelete}
            >
              <Button danger icon={<DeleteOutlined />}>Удалить</Button>
            </Popconfirm>
          )}
          <span style={{ flex: 1 }} />
          <Button onClick={onCancel}>Отмена</Button>
          <Button type="primary" loading={saving} onClick={submit}>
            {isNew ? 'Создать' : 'Сохранить'}
            {writes.length > 0 && ` и выставить (${writes.length})`}
          </Button>
        </div>
      )}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
          Колонка с оценкой за период. Средний считается по всем оценкам класса за эти даты
          с весами колонок (скрытые колонки, «н» и зачёт не в счёт; интенсив и зачёт — итогом).
          В средний за год сама аттестация не входит.
        </Text>
        <Form.Item
          name="title"
          label="Название"
          rules={[{ required: true, whitespace: true, message: 'Назовите аттестацию' }]}
          style={{ marginBottom: 6 }}
        >
          <Input placeholder="I четверть" maxLength={200} />
        </Form.Item>
        <div className="cj-att-titles">
          {ATTESTATION_TITLES.map((t) => (
            <Tag.CheckableTag key={t} checked={titleNow === t} onChange={() => pickTitle(t)}>
              {t}
            </Tag.CheckableTag>
          ))}
        </div>
        <Form.Item
          name="range"
          label="Период"
          rules={[{ required: true, message: 'Укажите даты' }]}
          extra="Концы включительно. Колонка встанет в журнал последним днём периода."
        >
          <DatePicker.RangePicker
            format="DD.MM.YYYY"
            allowClear={false}
            presets={presets}
            placeholder={['с', 'по']}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <div className="cj-att-opts">
          <div>
            <div className="cj-att-label">Округление</div>
            <Segmented
              value={edge}
              onChange={setEdge}
              options={ROUND_EDGES.map((e) => ({
                value: e, label: `${formatAvg(4 + e)} → 5`,
              }))}
            />
          </div>
          <div>
            <div className="cj-att-label">Выставить оценки</div>
            <Segmented value={fill} onChange={setFill} options={FILL_OPTIONS} />
          </div>
        </div>
        <Text type="secondary" style={{ display: 'block', margin: '6px 0 10px', fontSize: 12.5 }}>
          {FILL_HINTS[fill]}
        </Text>

        <div className="cj-att-preview">
          <div className="cj-att-preview__head">
            {period
              ? `За ${periodLabel(period)}: оценки есть у ${withMarks} из ${active.length}`
              : 'Выберите период'}
          </div>
          {period && rows.length > 0 && (
            <div className="cj-att-preview__scroll">
              <table className="cj-att-table">
                <thead>
                  <tr>
                    <th>Ученик</th>
                    <th title="Сколько оценок вошло в средний">Оценок</th>
                    <th>Средний</th>
                    <th>Оценка</th>
                    <th>Стоит</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const grade = roundAverage(r.avg, edge);
                    const willWrite = writes.some((w) => w.student.id === r.student.id);
                    return (
                      <tr key={r.student.id} className={r.student.former ? 'is-former' : undefined}>
                        <td>{r.student.name || '—'}</td>
                        <td className={r.count > 0 && r.count < 3 ? 'is-few' : undefined}
                          title={r.count > 0 && r.count < 3 ? 'Мало оценок за период' : undefined}
                        >
                          {r.count || '—'}
                        </td>
                        <td>{r.avg == null ? '—' : formatAvg(r.avg, 2)}</td>
                        <td className={willWrite ? 'is-write' : undefined}>{grade ?? '—'}</td>
                        <td>{r.text || r.stored || ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Form>
    </Modal>
  );
}
