import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, App, Button, Card, Empty, Form, Input, InputNumber, Modal, Segmented, Space, Tag, Tooltip, Typography,
} from 'antd';
import {
  EyeOutlined, FileAddOutlined, PlusOutlined, ReloadOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { api } from '../../../shared/services/pocketbase';
import { useAuth } from '../../../contexts/AuthContext';
import { useGeometryBasket } from '../../../hooks/useGeometryBasket';
import { sanitizeSvg } from '../../../utils/sanitizeSvg';
import {
  SECTION_BODIES, SECTION_LEVELS, generateSectionTask, sectionTaskToRecord,
} from '../../../utils/stereo/sectionTasks';
import { stereoDrawingSvg } from '../../../utils/stereo/dsl';
import { DEFAULT_CAMERA } from '../../../utils/stereo/camera';
import { variantLabel } from '../../../utils/geometryWork';
import MathRenderer from '../../MathRenderer';
import SectionStepsModal from './SectionStepsModal';

const { Text } = Typography;

const BODY_OPTIONS = Object.entries(SECTION_BODIES).map(([value, b]) => ({ value, label: b.label }));
const TYPE_OPTIONS = [
  { value: 'build', label: 'Построить сечение' },
  { value: 'area', label: 'Площадь сечения куба' },
];
const LEVEL_OPTIONS = [1, 2, 3].map((v) => ({
  value: v,
  label: <Tooltip title={SECTION_LEVELS[v]}>{['Простое', 'Среднее', 'Сложное'][v - 1]}</Tooltip>,
}));

// Фасеты МЦНМО для сгенерированных задач (по точным именам справочника)
const FACETS = {
  cube: 'Куб',
  prism3: 'Правильная треугольная призма',
  pyramid4: 'Правильная четырёхугольная пирамида',
  tetra: 'Правильный тетраэдр',
};

const newSeed = () => Math.floor(Math.random() * 900000) + 100000;

/** Сетка «позиции × варианты»: одинаковые настройки — параллельные задания. */
function generateSheet(cfg, base) {
  const seen = new Set();
  return Array.from({ length: cfg.variants }, (_, v) => Array.from({ length: cfg.count }, (__, r) => {
    let seed = base + v * 1009 + r * 37;
    for (let k = 0; k < 12; k += 1, seed += 7919) {
      const t = generateSectionTask({ body: cfg.body, type: cfg.type, level: cfg.level, seed });
      if (t && !seen.has(t.statement)) { seen.add(t.statement); return t; }
    }
    return null;
  }));
}

function TaskCell({ task, onSteps, onReplace, index }) {
  const svg = useMemo(() => (task ? sanitizeSvg(stereoDrawingSvg(task.scene, DEFAULT_CAMERA, { width: 360, height: 300 })) : ''), [task]);
  if (!task) {
    return (
      <Card size="small" style={{ minHeight: 120 }}>
        <Text type="secondary">Не нашлось — ⟳</Text>
        <Button size="small" icon={<ReloadOutlined />} onClick={onReplace} style={{ marginLeft: 8 }} />
      </Card>
    );
  }
  return (
    <Card
      size="small"
      title={<Space size={6}><Text strong>№{index + 1}</Text><Tag style={{ margin: 0 }}>{task.polygon.word}</Tag></Space>}
      extra={(
        <Space size={2}>
          <Tooltip title="Решение по шагам"><Button size="small" type="text" icon={<EyeOutlined />} onClick={onSteps} /></Tooltip>
          <Tooltip title="Другое задание на это место"><Button size="small" type="text" icon={<ReloadOutlined />} onClick={onReplace} /></Tooltip>
        </Space>
      )}
      styles={{ body: { padding: 10 } }}
    >
      <div
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: svg }}
        style={{ maxWidth: 260, margin: '0 auto 6px', lineHeight: 0 }}
      />
      <div style={{ fontSize: 13, lineHeight: 1.45 }}><MathRenderer text={task.statement} /></div>
      <div style={{ marginTop: 6, fontSize: 13 }}>
        <Text type="secondary">Ответ: </Text><MathRenderer text={task.answer} />
      </div>
    </Card>
  );
}

/**
 * Генератор задач на сечения (GEOMETRY_TASKS_PLAN.md § 5): тело, тип,
 * сложность, сколько задач и вариантов → сетка заданий (одна позиция во всех
 * вариантах — параллельные задания) → работа или подборка. Задания сохраняются
 * задачами банка с origin = 'gen' (область «Генератор» в банке).
 */
export default function SectionGenerator() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { canEdit } = useAuth();
  const basket = useGeometryBasket();
  const [cfg, setCfg] = useState({ body: 'cube', type: 'build', level: 2, count: 4, variants: 2 });
  const [sheet, setSheet] = useState(null);
  const [steps, setSteps] = useState(null);
  const [saving, setSaving] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  const [form] = Form.useForm();

  const set = (patch) => setCfg((c) => {
    const next = { ...c, ...patch };
    if (next.type === 'area') next.body = 'cube';
    return next;
  });

  const run = () => setSheet({ cfg, rows: generateSheet(cfg, newSeed()) });

  const replace = (v, r) => setSheet((s) => {
    const rows = s.rows.map((col) => [...col]);
    const taken = new Set(rows.flat().filter(Boolean).map((t) => t.statement));
    for (let k = 0; k < 20; k += 1) {
      const t = generateSectionTask({ ...s.cfg, seed: newSeed() });
      if (t && !taken.has(t.statement)) { rows[v][r] = t; break; }
    }
    return { ...s, rows };
  });

  // Сохранить задания задачами банка (с фасетами) → по вариантам [запись|null]
  const saveTasks = async () => {
    const tags = await api.getGeometryTags().catch(() => null);
    const byName = new Map();
    for (const kind of ['object', 'method', 'fact']) for (const t of tags?.[kind] || []) byName.set(t.name, t.id);
    const stamp = Date.now().toString(36).toUpperCase().slice(-5);
    let n = 0;
    const ids = [];
    for (const col of sheet.rows) {
      const out = [];
      for (const task of col) {
        if (!task) { out.push(null); continue; }
        n += 1;
        const rec = sectionTaskToRecord(task, { code: `SEC-${stamp}-${n}` });
        const facetNames = [FACETS[task.body], 'Сечение многогранника', ...(task.type === 'area' ? ['Площадь сечения'] : [])];
        rec.tags = facetNames.map((nm) => byName.get(nm)).filter(Boolean);
        const [saved] = await api.createGeneratedGeometryTasks([rec]);
        out.push(saved);
      }
      ids.push(out);
    }
    return ids;
  };

  const toBasket = async () => {
    setSaving(true);
    try {
      const recs = await saveTasks();
      const n = basket.add(recs.flat().filter(Boolean));
      message.success(`Сохранено и добавлено в подборку: ${n}`);
    } catch (e) {
      message.error(`Не удалось сохранить: ${e?.message || 'ошибка'}`);
    } finally {
      setSaving(false);
    }
  };

  const toWork = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const recs = await saveTasks();
      const rec = await api.createGeometryWork({
        title: values.title.trim(),
        class: values.class || null,
        structure: { variants: recs.map((col) => ({ items: col.map((t) => (t ? { task: t.id } : null)) })), layouts: {} },
      });
      message.success('Работа создана');
      navigate(`/app/geometry/works/${rec.id}`);
    } catch (e) {
      message.error(`Не удалось создать работу: ${e?.message || 'ошибка'}`);
    } finally {
      setSaving(false);
    }
  };

  const openWork = () => {
    const b = SECTION_BODIES[sheet.cfg.body];
    form.setFieldsValue({
      title: `${sheet.cfg.type === 'area' ? 'Площадь сечения' : 'Сечения'} · ${b.short} · ${new Date().toLocaleDateString('ru-RU')}`,
      class: null,
    });
    setWorkOpen(true);
  };

  const filled = sheet ? sheet.rows.flat().filter(Boolean).length : 0;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small">
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Space wrap>
            <Text>Тело</Text>
            <Segmented
              value={cfg.body}
              onChange={(v) => set({ body: v })}
              options={BODY_OPTIONS.map((o) => ({ ...o, disabled: cfg.type === 'area' && o.value !== 'cube' }))}
            />
          </Space>
          <Space wrap size={16}>
            <Space><Text>Задание</Text><Segmented value={cfg.type} onChange={(v) => set({ type: v })} options={TYPE_OPTIONS} /></Space>
            <Space><Text>Сложность</Text><Segmented value={cfg.level} onChange={(v) => set({ level: v })} options={LEVEL_OPTIONS} /></Space>
            <Space><Text>Задач</Text><InputNumber min={1} max={10} value={cfg.count} onChange={(v) => set({ count: v || 1 })} style={{ width: 70 }} /></Space>
            <Space><Text>Вариантов</Text><Segmented value={cfg.variants} onChange={(v) => set({ variants: v })} options={[1, 2, 3, 4]} /></Space>
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={run}>Сгенерировать</Button>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {SECTION_LEVELS[cfg.level]}. Чертёж, ответ и решение по шагам строит одна модель — построение
            проверено движком. Задачи одной позиции во всех вариантах — параллельные.
          </Text>
        </Space>
      </Card>

      {!sheet ? (
        <Empty description="Выберите настройки и нажмите «Сгенерировать»" />
      ) : (
        <>
          {filled < sheet.rows.flat().length && (
            <Alert type="warning" showIcon message="Не для всех позиций нашлось задание — нажмите ⟳ у пустой или смените сложность" />
          )}
          <div style={{ overflowX: 'auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${sheet.rows.length}, minmax(280px, 1fr))`,
                gap: 12,
                minWidth: 'max-content',
              }}
            >
              {sheet.rows.map((_, v) => (
                <Text key={`h${v}`} strong>{sheet.rows.length > 1 ? variantLabel(v) : 'Задания'}</Text>
              ))}
              {Array.from({ length: sheet.rows[0].length }, (_, r) => sheet.rows.map((col, v) => (
                <TaskCell
                  key={`${v}-${r}-${col[r]?.seed || 'x'}`}
                  task={col[r]}
                  index={r}
                  onSteps={() => setSteps(col[r])}
                  onReplace={() => replace(v, r)}
                />
              )))}
            </div>
          </div>
          {canEdit && filled > 0 && (
            <div
              style={{
                position: 'sticky', bottom: 0, zIndex: 20, background: '#fff', border: '1px solid #d6e4ff',
                borderRadius: 10, boxShadow: '0 -4px 16px rgba(0,0,0,0.08)', padding: '10px 14px',
                display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
              }}
            >
              <Text>Заданий: <Text strong>{filled}</Text> — сохранятся в банк (область «Генератор») с фасетами</Text>
              <Space style={{ marginLeft: 'auto' }}>
                <Button icon={<PlusOutlined />} loading={saving} onClick={toBasket}>В подборку</Button>
                <Button type="primary" icon={<FileAddOutlined />} loading={saving} onClick={openWork}>Создать работу</Button>
              </Space>
            </div>
          )}
        </>
      )}

      <SectionStepsModal task={steps} open={!!steps} onClose={() => setSteps(null)} />

      <Modal
        title="Новая работа из заданий"
        open={workOpen}
        onCancel={() => setWorkOpen(false)}
        onOk={toWork}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Название" rules={[{ required: true, whitespace: true, message: 'Назовите работу' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="class" label="Класс">
            <InputNumber min={1} max={11} placeholder="—" style={{ width: 90 }} />
          </Form.Item>
          <Text type="secondary">
            {sheet ? `${sheet.rows.length} вар. × ${sheet.rows[0].length} задач` : ''} — варианты сохранятся как есть,
            печать и ключ ответов — в редакторе работы.
          </Text>
        </Form>
      </Modal>
    </Space>
  );
}
