import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Badge, Button, Collapse, Divider, Drawer, Space, Spin, Tag, Tooltip, Typography,
} from 'antd';
import {
  CheckOutlined, CopyOutlined, EditOutlined, ImportOutlined, LeftOutlined, PaperClipOutlined,
  PlusOutlined, RightOutlined, UndoOutlined,
} from '@ant-design/icons';
import { useGeometryBasket } from '../../hooks/useGeometryBasket';
import { api } from '../../shared/services/pocketbase';
import { sanitizeSvg } from '../../utils/sanitizeSvg';
import { stereoSpecFromSvg, parseStereoBlock } from '../../utils/stereo/dsl';
import { evaluateScene } from '../../utils/stereo/scene';
import { SECTION_LABELS } from '../../utils/geometrySection';
import MathRenderer from '../MathRenderer';
import StereoCanvas from '../stereo/StereoCanvas';
import SimilarGeometryPanel from './SimilarGeometryPanel';
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from './GeometryTaskColumns';

const { Text } = Typography;

const FACET_KINDS = [
  { kind: 'object', label: 'Объект', color: 'blue' },
  { kind: 'method', label: 'Метод', color: 'purple' },
  { kind: 'fact', label: 'Факт', color: 'cyan' },
];

const parseJsonArray = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; }
  }
  return [];
};

/** Стереочертёж из редактора — живой: его можно покрутить. */
function LiveStereo({ spec }) {
  const parsed = useMemo(() => {
    try {
      const p = parseStereoBlock(spec);
      return { model: evaluateScene(p.scene), camera: p.camera };
    } catch {
      return null;
    }
  }, [spec]);
  const [camera, setCamera] = useState(parsed?.camera);
  useEffect(() => { setCamera(parsed?.camera); }, [parsed]);
  if (!parsed?.model) return null;
  const turned = camera && parsed.camera && (
    camera.yaw !== parsed.camera.yaw || camera.pitch !== parsed.camera.pitch || camera.zoom !== parsed.camera.zoom
  );
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ height: 340 }}>
        <StereoCanvas
          model={parsed.model}
          camera={camera}
          onCameraChange={setCamera}
          style={{ width: '100%', height: '100%' }}
          ariaLabel="Чертёж задачи — его можно поворачивать"
        />
      </div>
      <div style={{ position: 'absolute', left: 8, bottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>Потяните — чертёж повернётся</Text>
        {turned && (
          <Button size="small" type="text" icon={<UndoOutlined />} onClick={() => setCamera(parsed.camera)}>
            как в задаче
          </Button>
        )}
      </div>
    </div>
  );
}

/** Чертёж условия: стерео — живой, SVG — как есть, иначе PNG (если он не к решению). */
function ConditionDrawing({ task }) {
  const svg = task.drawing_view === 'svg' ? task.drawing_svg : '';
  const stereoSpec = svg ? stereoSpecFromSvg(svg) : null;
  const imageUrl = api.getGeometryImageUrl(task);
  const box = {
    border: '1px solid #f0f0f0', borderRadius: 8, background: '#fff', padding: 8, marginBottom: 12,
  };
  if (stereoSpec) return <div style={box}><LiveStereo spec={stereoSpec} /></div>;
  if (svg) {
    return (
      <div style={{ ...box, display: 'flex', justifyContent: 'center' }}>
        <div
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
          style={{ width: '100%', maxWidth: 520, maxHeight: 380, overflow: 'hidden' }}
        />
      </div>
    );
  }
  if (imageUrl && task.image_role !== 'solution') {
    return (
      <div style={{ ...box, display: 'flex', justifyContent: 'center' }}>
        <img src={imageUrl} alt={`Чертёж ${task.code || ''}`} style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain' }} />
      </div>
    );
  }
  return null;
}

function Section({ title, children, extra }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>{title}</Text>
        {extra}
      </div>
      {children}
    </div>
  );
}

/**
 * Карточка геометрической задачи — одна на весь раздел (GEOMETRY_TASKS_PLAN.md § 2).
 * Её открывают таблица, карточки, «Поиск по смыслу», «Похожие» и дубли.
 *
 * @param {string|null} taskId — какая задача открыта (null — закрыто)
 * @param {string[]} listIds — текущий список для ← / → (может не содержать taskId:
 *   тогда стрелок нет — например, задача пришла из «Похожих»)
 * @param {object} geoTags — фасеты по видам { object: [...], method: [...], fact: [...] }
 * @param {function} onOpen — (id, listIds?) переход к другой задаче
 * @param {function} onFacet — (kind, tagId) отфильтровать банк по фасету
 * @param {function} [onEdit|onDuplicate|onTakeToMine] — кнопки действий; не передан
 *   обработчик — нет и кнопки (в редакторе работы карточка только смотрит)
 * @param {ReactNode} [extra] — свои кнопки в подвал (например, «Поставить в ячейку»)
 */
export default function GeometryTaskDrawer({
  taskId, listIds = [], geoTags, onOpen, onClose, onFacet,
  canEdit, onEdit, onDuplicate, onTakeToMine, busy = null, extra = null,
}) {
  const basket = useGeometryBasket();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cacheRef = useRef(new Map());

  useEffect(() => {
    if (!taskId) return undefined;
    let alive = true;
    const cached = cacheRef.current.get(taskId);
    if (cached) { setTask(cached); setError(null); return undefined; }
    setLoading(true);
    setError(null);
    api.getGeometryTask(taskId)
      .then((t) => {
        if (!alive) return;
        cacheRef.current.set(taskId, t);
        setTask(t);
      })
      .catch(() => alive && setError('Не удалось загрузить задачу'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [taskId]);

  // После правки/копии задача могла измениться — кэш сбрасываем при закрытии.
  useEffect(() => { if (!taskId) cacheRef.current.clear(); }, [taskId]);

  const index = taskId ? listIds.indexOf(taskId) : -1;
  const prevId = index > 0 ? listIds[index - 1] : null;
  const nextId = index >= 0 && index < listIds.length - 1 ? listIds[index + 1] : null;

  // ← / → листают список, если фокус не в поле ввода
  useEffect(() => {
    if (!taskId) return undefined;
    const onKey = (e) => {
      const el = document.activeElement;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === 'ArrowLeft' && prevId) onOpen(prevId, listIds);
      if (e.key === 'ArrowRight' && nextId) onOpen(nextId, listIds);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [taskId, prevId, nextId, listIds, onOpen]);

  const tagById = useMemo(() => {
    const m = new Map();
    for (const [kind, arr] of Object.entries(geoTags || {})) for (const t of arr || []) m.set(t.id, { ...t, kind });
    return m;
  }, [geoTags]);

  const shown = task && task.id === taskId ? task : null;
  const isBank = shown?.origin === 'mccme';
  const hints = parseJsonArray(shown?.hints).filter((h) => h?.text_md);
  const files = parseJsonArray(shown?.solution_files);
  const solutionImage = shown?.image_role === 'solution' ? api.getGeometryImageUrl(shown) : '';
  const facets = (shown?.tags || []).map((id) => tagById.get(id)).filter(Boolean);
  const meta = [
    shown?.expand?.topic?.title,
    shown?.expand?.subtopic?.title,
    [shown?.source, shown?.year].filter(Boolean).join(', '),
  ].filter(Boolean);

  const title = shown ? (
    <Space size={6} wrap>
      <Text code style={{ fontSize: 14 }}>{shown.code}</Text>
      <Tag color={isBank ? 'geekblue' : shown.origin === 'gen' ? 'purple' : 'green'} style={{ margin: 0 }}>
        {isBank ? 'МЦНМО' : shown.origin === 'gen' ? 'Генератор' : 'Моя'}
      </Tag>
      {shown.section && <Tag style={{ margin: 0 }}>{SECTION_LABELS[shown.section]}</Tag>}
      {shown.difficulty ? (
        <Tooltip title={DIFFICULTY_LABELS[shown.difficulty]}>
          <Badge count={shown.difficulty} style={{ backgroundColor: DIFFICULTY_COLORS[shown.difficulty] }} />
        </Tooltip>
      ) : null}
      {shown.task_type === 'ready' && <Tag color="gold" style={{ margin: 0 }}>на готовом чертеже</Tag>}
    </Space>
  ) : 'Задача';

  const nav = index >= 0 && listIds.length > 1 ? (
    <Space size={4}>
      <Tooltip title="Предыдущая (←)">
        <Button size="small" icon={<LeftOutlined />} disabled={!prevId} onClick={() => onOpen(prevId, listIds)} />
      </Tooltip>
      <Text type="secondary" style={{ fontSize: 12, minWidth: 64, textAlign: 'center', display: 'inline-block' }}>
        {index + 1} из {listIds.length}
      </Text>
      <Tooltip title="Следующая (→)">
        <Button size="small" icon={<RightOutlined />} disabled={!nextId} onClick={() => onOpen(nextId, listIds)} />
      </Tooltip>
    </Space>
  ) : null;

  const inBasket = shown ? basket.items.some((x) => x.id === shown.id) : false;
  const footer = shown && canEdit ? (
    <Space wrap>
      <Tooltip title="Подборка — задачи для новой работы (плашка внизу страницы)">
        <Button
          type={inBasket ? 'default' : 'primary'}
          icon={inBasket ? <CheckOutlined /> : <PlusOutlined />}
          onClick={() => basket.toggle(shown)}
        >
          {inBasket ? 'В подборке' : 'В подборку'}
        </Button>
      </Tooltip>
      {extra}
      {onEdit && (
        <Button icon={<EditOutlined />} loading={busy === 'edit'} onClick={() => onEdit(shown)}>
          Редактировать
        </Button>
      )}
      {isBank && onTakeToMine && (
        <Tooltip title="Своя копия задачи: её можно править, не трогая банк. Фасеты и решение сохранятся">
          <Button icon={<ImportOutlined />} loading={busy === 'take'} onClick={() => onTakeToMine(shown)}>
            Взять к себе
          </Button>
        </Tooltip>
      )}
      {!isBank && onDuplicate && (
        <Button icon={<CopyOutlined />} loading={busy === 'copy'} onClick={() => onDuplicate(shown)}>
          Дублировать
        </Button>
      )}
    </Space>
  ) : null;

  return (
    <Drawer
      open={!!taskId}
      onClose={onClose}
      width={720}
      zIndex={1100}
      title={title}
      extra={nav}
      footer={footer}
      styles={{ body: { paddingTop: 12 } }}
    >
      {loading && !shown && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}
      {error && <Alert type="error" showIcon message={error} />}

      {shown && (
        <>
          {shown.title && <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{shown.title}</div>}

          <ConditionDrawing task={shown} />

          <Section title="Условие">
            {shown.statement_md
              ? <div style={{ fontSize: 15, lineHeight: 1.55 }}><MathRenderer text={shown.statement_md} /></div>
              : <Text type="secondary">Условие не задано</Text>}
          </Section>

          <Section title="Ответ">
            {shown.answer
              ? <div style={{ fontSize: 15 }}><MathRenderer text={String(shown.answer)} /></div>
              : <Text type="secondary">—</Text>}
          </Section>

          {(hints.length > 0 || shown.solution_md || solutionImage || files.length > 0) && (
            <Collapse
              size="small"
              style={{ marginBottom: 14 }}
              items={[
                ...(hints.length ? [{
                  key: 'hints',
                  label: `Указания (${hints.length})`,
                  children: (
                    <ol style={{ margin: 0, paddingLeft: 20 }}>
                      {hints.map((h, i) => <li key={i}><MathRenderer text={h.text_md} /></li>)}
                    </ol>
                  ),
                }] : []),
                ...((shown.solution_md || solutionImage || files.length) ? [{
                  key: 'solution',
                  label: 'Решение',
                  children: (
                    <>
                      {solutionImage && (
                        <div style={{ textAlign: 'center', marginBottom: 8 }}>
                          <img src={solutionImage} alt="Чертёж к решению" style={{ maxWidth: '100%', maxHeight: 340, objectFit: 'contain' }} />
                        </div>
                      )}
                      {shown.solution_md && <MathRenderer text={shown.solution_md} />}
                      {files.length > 0 && (
                        <Space direction="vertical" size={2} style={{ marginTop: 8 }}>
                          {files.map((f) => (
                            <a key={f.id || f.url} href={f.url} target="_blank" rel="noreferrer">
                              <PaperClipOutlined /> {f.title || 'Файл решения'}
                            </a>
                          ))}
                        </Space>
                      )}
                    </>
                  ),
                }] : []),
              ]}
            />
          )}

          {facets.length > 0 && (
            <Section title="Фасеты">
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {FACET_KINDS.map(({ kind, label, color }) => {
                  const list = facets.filter((f) => f.kind === kind);
                  if (!list.length) return null;
                  return (
                    <div key={kind} style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <Text type="secondary" style={{ fontSize: 12, width: 56, flexShrink: 0 }}>{label}</Text>
                      {list.map((f) => (
                        <Tooltip key={f.id} title="Показать все задачи с этим фасетом">
                          <Tag
                            color={color}
                            style={{ cursor: onFacet ? 'pointer' : 'default', margin: 0, whiteSpace: 'normal' }}
                            onClick={onFacet ? () => onFacet(kind, f.id) : undefined}
                          >
                            <MathRenderer text={f.name} inline />
                          </Tag>
                        </Tooltip>
                      ))}
                    </div>
                  );
                })}
              </Space>
            </Section>
          )}

          {meta.length > 0 && (
            <Section title="Откуда">
              <Text style={{ fontSize: 13 }}>{meta.join(' · ')}</Text>
            </Section>
          )}

          <Divider style={{ margin: '8px 0 12px' }} />
          <Collapse
            size="small"
            destroyInactivePanel
            items={[{
              key: 'similar',
              label: '🔎 Похожие задачи',
              children: <SimilarGeometryPanel taskId={shown.id} onOpenTask={(id) => onOpen(id)} />,
            }]}
          />
        </>
      )}
    </Drawer>
  );
}
