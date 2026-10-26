import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Checkbox, DatePicker, InputNumber, Modal, Segmented, Select, Space, Typography,
} from 'antd';
import dayjs from 'dayjs';
import { KTP_TEMPLATES, ktpTemplate } from '../../utils/ktpTemplates';
import {
  DEFAULT_WEEKS, KTP_UNITS, buildKtpRows, formatAmount, perWeekOf, scaleTemplate, sectionSummary, unitOf,
} from '../../utils/ktpPlan';
import { academicYearStartDate } from '../../utils/academicYear';

const { Text } = Typography;

function defaultStart(course) {
  const iso = academicYearStartDate(course?.year);
  return iso ? dayjs(iso.slice(0, 10)) : null;
}

/**
 * «Рыба» КТП: шаблон гос. программы → строки под свою сетку (уроки/пары,
 * занятий в неделю, недель в году). Сама раскладка — `utils/ktpPlan.js`.
 * onApply({ entries, unit, perWeek }) — строки уже с неделями (и датами).
 */
export default function KtpTemplateModal({ open, course, initialKey, existingCount = 0, saving, onApply, onCancel }) {
  const [key, setKey] = useState(initialKey || KTP_TEMPLATES[0]?.key);
  const [unit, setUnit] = useState('lesson');
  const [perWeek, setPerWeek] = useState(2);
  const [weeks, setWeeks] = useState(DEFAULT_WEEKS);
  const [withDates, setWithDates] = useState(false);
  const [start, setStart] = useState(null);

  useEffect(() => {
    if (!open) return;
    setKey(initialKey || KTP_TEMPLATES[0]?.key);
    setUnit(unitOf(course).key);
    setPerWeek(perWeekOf(course));
    setWeeks(DEFAULT_WEEKS);
    setStart(defaultStart(course));
    setWithDates(false);
  }, [open, course, initialKey]);

  const template = ktpTemplate(key);
  const u = KTP_UNITS[unit];
  const totalSlots = Math.max(1, Math.round((perWeek || 0) * (weeks || 0)));

  const plan = useMemo(() => {
    if (!template) return null;
    const scaled = scaleTemplate(template.items, totalSlots);
    return { ...scaled, sections: sectionSummary(scaled.rows) };
  }, [template, totalSlots]);

  // Во сколько раз больше времени, чем в программе (в академических часах).
  const timeRatio = plan?.base ? (plan.total * u.academic) / plan.base : 1;

  const handleOk = () => {
    if (!template) return;
    const { entries } = buildKtpRows(template, {
      totalSlots,
      perWeek,
      startDate: withDates && start && !existingCount ? start.toDate() : null,
    });
    onApply({ entries, unit, perWeek });
  };

  return (
    <Modal
      open={open}
      title="Заполнить КТП по шаблону"
      onCancel={onCancel}
      onOk={handleOk}
      okText={existingCount ? 'Добавить в конец плана' : 'Заполнить'}
      cancelText="Отмена"
      confirmLoading={saving}
      okButtonProps={{ disabled: !template }}
      width={640}
      destroyOnHidden
    >
      <Space direction="vertical" size={14} style={{ width: '100%', marginTop: 8 }}>
        <div>
          <Text strong>Программа</Text>
          <Select
            style={{ width: '100%', marginTop: 6 }}
            value={key}
            onChange={setKey}
            options={KTP_TEMPLATES.map((t) => ({ value: t.key, label: t.title }))}
          />
          {template?.description && (
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>{template.description}</Text>
          )}
        </div>

        <Space size="large" wrap align="end">
          <div>
            <Text strong>Занятие</Text>
            <div style={{ marginTop: 6 }}>
              <Segmented
                value={unit}
                onChange={setUnit}
                options={Object.values(KTP_UNITS).map((x) => ({ value: x.key, label: x.label }))}
              />
            </div>
          </div>
          <div>
            <Text strong>{unit === 'pair' ? 'Пар' : 'Уроков'} в неделю</Text>
            <div style={{ marginTop: 6 }}>
              <InputNumber min={0.5} max={20} step={0.5} value={perWeek} onChange={(v) => setPerWeek(v || 1)} />
            </div>
          </div>
          <div>
            <Text strong>Учебных недель</Text>
            <div style={{ marginTop: 6 }}>
              <InputNumber min={1} max={52} value={weeks} onChange={(v) => setWeeks(v || 1)} />
            </div>
          </div>
        </Space>

        <Space wrap>
          <Checkbox checked={withDates && !existingCount} disabled={existingCount > 0} onChange={(e) => setWithDates(e.target.checked)}>
            Проставить даты по неделям, начиная с
          </Checkbox>
          <DatePicker
            format="DD.MM.YYYY"
            value={start}
            onChange={setStart}
            disabled={!withDates || existingCount > 0}
            placeholder="1 сентября"
          />
        </Space>

        {plan && (
          <div className="ws-card" style={{ padding: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <Text>
                {weeks} нед. × {String(perWeek).replace('.', ',')} = <b>{formatAmount(plan.total, u)}</b>
                {u.academic > 1 && <> ({plan.total * u.academic} ч)</>}
                {' · '}в программе {formatAmount(plan.base, KTP_UNITS.lesson)}
              </Text>
              {Math.abs(timeRatio - 1) > 0.05 && (
                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                  Времени в {String(Math.round(timeRatio * 10) / 10).replace('.', ',')} раза
                  {timeRatio > 1 ? ' больше' : ' меньше'}, чем в программе: темы растянуты пропорционально,
                  контрольные и зачёты — по одному занятию.
                </Text>
              )}
            </div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <tbody>
                {plan.sections.map((s) => (
                  <tr key={s.title} style={{ borderTop: '1px solid var(--lemma-border, #eee)' }}>
                    <td style={{ padding: '4px 0' }}>{s.title}</td>
                    <td style={{ padding: '4px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatAmount(s.slots, u)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {plan?.overflow > 0 && (
          <Alert
            type="warning"
            showIcon
            message={`Занятий не хватает: на каждую тему нужно хотя бы одно — план выйдет на ${formatAmount(plan.overflow, u)} длиннее.`}
          />
        )}
        {existingCount > 0 && (
          <Alert type="info" showIcon message={`В плане уже есть строки (${existingCount}) — шаблон добавится после них, недели пересчитаются по всему плану.`} />
        )}
        <Text type="secondary" style={{ fontSize: 12 }}>
          Это заготовка: темы, часы и формулировки потом правятся как обычные строки КТП.
        </Text>
      </Space>
    </Modal>
  );
}
