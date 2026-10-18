import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, App, Button, Card, Empty, Form, Input, InputNumber, Modal, Segmented, Select, Space, Tag, Tooltip, Typography,
} from 'antd';
import {
  CheckOutlined, EyeOutlined, FileAddOutlined, PlusOutlined, ReloadOutlined, StarOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { api } from '../../../shared/services/pocketbase';
import { useAuth } from '../../../contexts/AuthContext';
import { useGeometryBasket } from '../../../hooks/useGeometryBasket';
import { sanitizeSvg } from '../../../utils/sanitizeSvg';
import {
  GEN_TYPES, GEN_TYPE_GROUPS, GEN_LEVELS, familyOf, generateGenTask, genTaskToRecord, genCodePrefix, slotPlan,
  GEN_BODIES, genBodyDef, EXAM_TYPES, EXAM_SECTIONS,
} from '../../../utils/stereo/genTasks';
import { stereoDrawingSvg } from '../../../utils/stereo/dsl';
import { DEFAULT_CAMERA } from '../../../utils/stereo/camera';
import { variantLabel } from '../../../utils/geometryWork';
import MathRenderer from '../../MathRenderer';
import SectionStepsModal from './SectionStepsModal';
import ToMineModal from '../ToMineModal';
import { cellKey } from '../../../utils/geometryAdopt';

const { Text } = Typography;

const BODY_OPTIONS = Object.entries(GEN_BODIES).map(([value, b]) => ({ value, label: b.label }));
// Первая часть ЕГЭ: каталог по номерам экзамена, тело выбирает сам тип
const EXAM_OPTIONS = EXAM_SECTIONS.map((sec) => ({
  label: sec.title,
  title: sec.title,
  options: Object.entries(sec.types).map(([value, t]) => ({ value, label: `${sec.short} · ${t.group}: ${t.label}` })),
}));
const MODE_PART1 = 'part1';
const TYPE_OPTIONS = GEN_TYPE_GROUPS.map((group) => ({
  label: group,
  title: group,
  options: Object.entries(GEN_TYPES).filter(([, t]) => t.group === group).map(([value, t]) => ({ value, label: t.label })),
}));
const LEVEL_NAMES = ['Простое', 'Среднее', 'Сложное'];

const newSeed = () => Math.floor(Math.random() * 900000) + 100000;

/** Сетка «позиции × варианты»: одна позиция во всех вариантах — параллельные задания. */
function generateSheet(cfg, base) {
  const seen = new Set();
  return Array.from({ length: cfg.variants }, (_, v) => Array.from({ length: cfg.count }, (__, r) => {
    const plan = slotPlan(cfg.types, cfg.bodies, r);
    let seed = base + v * 1009 + r * 37;
    for (let k = 0; k < 12; k += 1, seed += 7919) {
      const t = generateGenTask({ ...plan, level: cfg.level, seed });
      if (t && !seen.has(t.statement)) { seen.add(t.statement); return t; }
    }
    return null;
  }));
}

function TaskCell({
  task, onSteps, onReplace, index, showBody, mine, onMine,
}) {
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
      title={(
        <Space size={6} wrap>
          <Text strong>№{index + 1}</Text>
          <Tag style={{ margin: 0 }}>{task.tag}</Tag>
          {showBody && task.family !== 'exam' && <Tag color="blue" style={{ margin: 0 }}>{genBodyDef(task.body)?.short}</Tag>}
        </Space>
      )}
      extra={(
        <Space size={2}>
          {mine ? (
            <Tooltip title="Сохранена в «Мои задачи»">
              <Tag color="green" icon={<CheckOutlined />} style={{ margin: 0 }}>{mine.code}</Tag>
            </Tooltip>
          ) : onMine && (
            <Tooltip title="Удачная задача — сохранить в «Мои задачи», чтобы брать в другие работы">
              <Button size="small" type="text" icon={<StarOutlined />} onClick={onMine}>В мои</Button>
            </Tooltip>
          )}
          <Tooltip title="Решение по шагам"><Button size="small" type="text" icon={<EyeOutlined />} onClick={onSteps} /></Tooltip>
          {!mine && <Tooltip title="Другое задание на это место"><Button size="small" type="text" icon={<ReloadOutlined />} onClick={onReplace} /></Tooltip>}
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

/** Название работы по составу листа. */
function workTitle(cfg) {
  if (cfg.mode === MODE_PART1) {
    const exams = [...new Set(cfg.types.map((t) => EXAM_TYPES[t]?.short).filter(Boolean))].join(', ');
    return `Стереометрия, первая часть (${exams}) · ${new Date().toLocaleDateString('ru-RU')}`;
  }
  const one = GEN_TYPES[cfg.types[0]];
  const kind = cfg.types.length === 1 ? one.short || one.label : 'Стереометрия';
  const body = cfg.bodies.length === 1 ? ` · ${genBodyDef(cfg.bodies[0]).short}` : '';
  return `${kind}${body} · ${new Date().toLocaleDateString('ru-RU')}`;
}

/**
 * Генератор задач по стереометрии (GEOMETRY_TASKS_PLAN.md § 5): сечения,
 * углы, расстояния, объём пирамиды. Несколько типов и тел — по позициям
 * листа (типы по кругу, тела — после каждого круга типов). Сетка заданий
 * «позиции × варианты» → работа или подборка. Задания сохраняются задачами
 * банка с origin = 'gen' (область «Генератор» в банке).
 */
export default function SectionGenerator() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { canEdit } = useAuth();
  const basket = useGeometryBasket();
  const [cfg, setCfg] = useState({
    mode: 'part2', bodies: ['cube'], types: ['build'], level: 2, count: 4, variants: 2,
    examTypes: Object.keys(EXAM_SECTIONS.find((sec) => sec.key === 'b13').types),
  });
  const [sheet, setSheet] = useState(null);
  const [steps, setSteps] = useState(null);
  const [saving, setSaving] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  // «В мои»: какие ячейки сохранить (ключи cellKey) — окно выбора темы
  const [toMine, setToMine] = useState(null);
  const [form] = Form.useForm();

  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const part1 = cfg.mode === MODE_PART1;
  // В первой части позиции — типы каталога, тело выбирает тип
  const effective = part1 ? { ...cfg, types: cfg.examTypes, bodies: ['exam'] } : cfg;
  const families = [...new Set(effective.types.map(familyOf))];
  const ready = effective.types.length > 0 && effective.bodies.length > 0;

  // mine — ячейки, уже сохранённые в «Мои» (cellKey → запись банка)
  const run = () => setSheet({ cfg: effective, rows: generateSheet(effective, newSeed()), mine: {} });

  const replace = (v, r) => setSheet((s) => {
    const rows = s.rows.map((col) => [...col]);
    const taken = new Set(rows.flat().filter(Boolean).map((t) => t.statement));
    const plan = slotPlan(s.cfg.types, s.cfg.bodies, r);
    for (let k = 0; k < 20; k += 1) {
      const t = generateGenTask({ ...plan, level: s.cfg.level, seed: newSeed() });
      if (t && !taken.has(t.statement)) { rows[v][r] = t; break; }
    }
    const mine = { ...s.mine };
    delete mine[cellKey(v, r)];
    return { ...s, rows, mine };
  });

  // Фасеты задания: имена справочника МЦНМО → id
  const facetIds = async () => {
    const tags = await api.getGeometryTags().catch(() => null);
    const byName = new Map();
    for (const kind of ['object', 'method', 'fact']) for (const t of tags?.[kind] || []) byName.set(t.name, t.id);
    return (task) => [...new Set((task.facets || []).map((nm) => byName.get(nm)).filter(Boolean))];
  };

  // Сохранить задания задачами банка (с фасетами) → по вариантам [запись|null].
  // Уже сохранённые в «Мои» идут как есть — второй копии не будет.
  const saveTasks = async () => {
    const tagsOf = await facetIds();
    const stamp = Date.now().toString(36).toUpperCase().slice(-5);
    let n = 0;
    const ids = [];
    for (const [v, col] of sheet.rows.entries()) {
      const out = [];
      for (const [r, task] of col.entries()) {
        if (!task) { out.push(null); continue; }
        const mine = sheet.mine?.[cellKey(v, r)];
        if (mine) { out.push(mine); continue; }
        n += 1;
        const rec = genTaskToRecord(task, { code: `${genCodePrefix(task.type)}-${stamp}-${n}` });
        rec.tags = tagsOf(task);
        const [saved] = await api.createGeneratedGeometryTasks([rec]);
        out.push(saved);
      }
      ids.push(out);
    }
    return ids;
  };

  // Ячейки, ещё не сохранённые в «Мои»
  const unsavedKeys = sheet
    ? sheet.rows.flatMap((col, v) => col.map((t, r) => (t && !sheet.mine?.[cellKey(v, r)] ? cellKey(v, r) : null))).filter(Boolean)
    : [];

  const saveToMine = async ({ topic, subtopic }) => {
    const keys = toMine?.keys || [];
    try {
      const tagsOf = await facetIds();
      const tasks = keys.map((k) => { const [v, r] = k.split(':').map(Number); return sheet.rows[v][r]; });
      const recs = tasks.map((task) => ({ ...genTaskToRecord(task, { code: '' }), tags: tagsOf(task) }));
      const saved = await api.createMineGeometryTasks(recs, { topic, subtopic });
      setSheet((s) => {
        const mine = { ...s.mine };
        keys.forEach((k, i) => { if (saved[i]) mine[k] = saved[i]; });
        return { ...s, mine };
      });
      message.success(saved.length === 1
        ? `Задача сохранена в «Мои» как ${saved[0].code}`
        : `В «Мои» сохранено задач: ${saved.length} (${saved[0].code}…${saved[saved.length - 1].code})`);
      setToMine(null);
    } catch (e) {
      message.error(`Не удалось сохранить: ${e?.message || 'ошибка'}`);
    }
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
    form.setFieldsValue({ title: workTitle(sheet.cfg), class: null });
    setWorkOpen(true);
  };

  const filled = sheet ? sheet.rows.flat().filter(Boolean).length : 0;
  const levelHint = families.map((f) => GEN_LEVELS[f][cfg.level]).filter(Boolean).join('; ');

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small">
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Segmented
            value={cfg.mode}
            onChange={(v) => set({ mode: v })}
            options={[
              { value: 'part2', label: 'Сечения, углы, расстояния' },
              { value: MODE_PART1, label: 'Первая часть ЕГЭ (база №11, №13, профиль №3)' },
            ]}
          />
          {part1 ? (
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <Space wrap>
                <Text>Типы заданий как на экзамене</Text>
                {EXAM_SECTIONS.map((sec) => (
                  <Button
                    key={sec.key}
                    size="small"
                    onClick={() => set({ examTypes: Object.keys(sec.types) })}
                    title={sec.title}
                  >
                    Весь {sec.short.replace('Б', 'база №').replace('П', 'профиль №')}
                  </Button>
                ))}
              </Space>
              <Select
                mode="multiple"
                value={cfg.examTypes}
                onChange={(v) => set({ examTypes: v })}
                options={EXAM_OPTIONS}
                placeholder="Выберите типы заданий"
                style={{ width: '100%', maxWidth: 900 }}
                maxTagCount="responsive"
                listHeight={420}
                aria-label="Типы заданий первой части"
              />
            </Space>
          ) : (
            <Space wrap align="start" size={16}>
              <Space direction="vertical" size={4}>
                <Text>Задания</Text>
                <Select
                  mode="multiple"
                  value={cfg.types}
                  onChange={(v) => set({ types: v })}
                  options={TYPE_OPTIONS}
                  placeholder="Что решать"
                  style={{ minWidth: 360, maxWidth: 560 }}
                  maxTagCount="responsive"
                  aria-label="Типы заданий"
                />
              </Space>
              <Space direction="vertical" size={4}>
                <Text>Тела</Text>
                <Select
                  mode="multiple"
                  value={cfg.bodies}
                  onChange={(v) => set({ bodies: v })}
                  options={BODY_OPTIONS}
                  placeholder="Многогранники"
                  style={{ minWidth: 320, maxWidth: 560 }}
                  maxTagCount="responsive"
                  aria-label="Тела"
                />
              </Space>
            </Space>
          )}
          <Space wrap size={16}>
            {!part1 && (
              <Space>
                <Text>Сложность</Text>
                <Segmented
                  value={cfg.level}
                  onChange={(v) => set({ level: v })}
                  options={[1, 2, 3].map((v) => ({
                    value: v,
                    label: <Tooltip title={families.map((f) => GEN_LEVELS[f][v]).join('; ')}>{LEVEL_NAMES[v - 1]}</Tooltip>,
                  }))}
                />
              </Space>
            )}
            <Space><Text>Задач</Text><InputNumber min={1} max={12} value={cfg.count} onChange={(v) => set({ count: v || 1 })} style={{ width: 70 }} /></Space>
            <Space><Text>Вариантов</Text><Segmented value={cfg.variants} onChange={(v) => set({ variants: v })} options={[1, 2, 3, 4]} /></Space>
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={run} disabled={!ready}>Сгенерировать</Button>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {part1
              ? 'Каждый тип — сюжет из банка экзамена со своим телом и числами; ответ — число для бланка. Типы чередуются по позициям; задачи одной позиции во всех вариантах — параллельные. Подписи длин на чертеже сверены с самим телом.'
              : `${levelHint}. Несколько типов и тел чередуются по позициям; задачи одной позиции во всех вариантах — параллельные. Чертёж, ответ и решение даёт одна модель: ответ точный и сверен с чертежом движка.`}
          </Text>
        </Space>
      </Card>

      {!sheet ? (
        <Empty description={part1 ? 'Выберите типы заданий и нажмите «Сгенерировать»' : 'Выберите задания, тела и нажмите «Сгенерировать»'} />
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
                // Не 'max-content': он брал ширину условия, набранного в одну
                // строку, и карточка растягивалась до 1700 px. Минимум — 280 px
                // на вариант, дальше колонки делят ширину экрана.
                minWidth: sheet.rows.length * 280 + (sheet.rows.length - 1) * 12,
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
                  showBody={sheet.cfg.bodies.length > 1}
                  onSteps={() => setSteps(col[r])}
                  onReplace={() => replace(v, r)}
                  mine={sheet.mine?.[cellKey(v, r)]}
                  onMine={canEdit ? () => setToMine({ keys: [cellKey(v, r)] }) : undefined}
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
              <Text>
                Заданий: <Text strong>{filled}</Text> — сохранятся в банк (область «Генератор») с фасетами
                {filled > unsavedKeys.length && <>; в «Мои» уже: <Text strong>{filled - unsavedKeys.length}</Text></>}
              </Text>
              <Space style={{ marginLeft: 'auto' }}>
                {unsavedKeys.length > 0 && (
                  <Tooltip title="Сохранить задачи листа в «Мои задачи» — с кодом GEO-… и темой">
                    <Button icon={<StarOutlined />} onClick={() => setToMine({ keys: unsavedKeys })}>
                      Все в мои ({unsavedKeys.length})
                    </Button>
                  </Tooltip>
                )}
                <Button icon={<PlusOutlined />} loading={saving} onClick={toBasket}>В подборку</Button>
                <Button type="primary" icon={<FileAddOutlined />} loading={saving} onClick={openWork}>Создать работу</Button>
              </Space>
            </div>
          )}
        </>
      )}

      <SectionStepsModal task={steps} open={!!steps} onClose={() => setSteps(null)} />

      <ToMineModal
        open={!!toMine}
        count={toMine?.keys.length || 0}
        onCancel={() => setToMine(null)}
        onConfirm={saveToMine}
      />

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
