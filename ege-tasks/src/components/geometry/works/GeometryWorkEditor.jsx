import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, App, Button, Dropdown, Empty, Input, InputNumber, Popconfirm, Segmented, Select, Space, Spin,
  Tag, Tooltip, Typography,
} from 'antd';
import {
  ArrowDownOutlined, ArrowLeftOutlined, ArrowUpOutlined, CloseOutlined, DeleteOutlined, EyeOutlined,
  PlusOutlined, PrinterOutlined, SaveOutlined, SwapOutlined, ThunderboltOutlined, TableOutlined, ShareAltOutlined,
} from '@ant-design/icons';
import { api } from '../../../shared/services/pocketbase';
import { useAuth } from '../../../contexts/AuthContext';
import { useGeometryBasket } from '../../../hooks/useGeometryBasket';
import { useGeometryRefs } from '../../../hooks/useGeometryRefs';
import {
  addTasksAsPositions, addVariant, emptyRows, emptyStructure, moveRow, normalizeStructure, removeRow,
  removeVariant, rowCount, rowReference, setCell, structureTaskIds, variantLabel, variantTasks, withLayouts,
} from '../../../utils/geometryWork';
import GeometryTaskThumb from '../GeometryTaskThumb';
import GeometryTaskDrawer from '../GeometryTaskDrawer';
import GeometryBasketBar from '../GeometryBasketBar';
import GeometryParallelPicker from './GeometryParallelPicker';
import GeometryWorkAnswers from './GeometryWorkAnswers';
import GeometryCards from '../cards/GeometryCards';
import GeometryWorksheetPrint from '../../GeometryWorksheetPrint';
import GeometrySheetPrint from './GeometrySheetPrint';
import SheetToJournalModal from '../../workspace/journal/SheetToJournalModal';
import GeometryTaskEditor from '../../GeometryTaskEditor';
import MathRenderer from '../../MathRenderer';
import GeometryTaskPickerModal from './GeometryTaskPickerModal';
import WorkLessonLinks from '../../worksheet/WorkLessonLinks';
import GeometryWorkShareModal from './GeometryWorkShareModal';
import './geometryWorks.css';

const { Text } = Typography;

// Условие в ячейке: без картинок и блоков-чертежей (чертёж — миниатюра слева)
const cellStatement = (md) => String(md || '')
  .replace(/```(?:stereo|planim|plot|numline)[\s\S]*?```/g, '')
  .replace(/!\[[^\]]*\]\([^)]*\)(?:[ \t]*\{(?:s|m|l|xl)\})?/gi, '')
  .trim();

/**
 * Редактор геометрической работы (GEOMETRY_TASKS_PLAN.md § 4): сетка
 * «позиции × варианты». Задачи приходят из подборки; пустые ячейки других
 * вариантов заполняются параллелями (/geo/similar) — по одной или все сразу.
 * Печать — шаблоны одной работы: карточки A5/A4 (макет хранится в работе),
 * лист задач (движок и «Оформление» Генератора), рабочий лист с клеткой,
 * ключ ответов.
 */
export default function GeometryWorkEditor() {
  const { workId } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { canEdit } = useAuth();
  const basket = useGeometryBasket();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState('');
  const [klass, setKlass] = useState(null);
  const [structure, setStructure] = useState(() => emptyStructure(1));
  // Ссылка ученику: открыта ли работа и каким классам (сохраняется сразу, мимо «Сохранить»)
  const [sharing, setSharing] = useState({ public: false, groups: [] });
  const [shareOpen, setShareOpen] = useState(false);
  const [byId, setById] = useState(() => new Map());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('edit'); // edit | cards | print | sheet | answers
  const [printVariant, setPrintVariant] = useState('all');
  const [picker, setPicker] = useState(null); // { row, variant }
  const [card, setCard] = useState({ id: null, list: [] });
  const { tags: geoTags } = useGeometryRefs(['tags']);
  const [basketVariant, setBasketVariant] = useState(0);
  const [autofill, setAutofill] = useState(null); // { done, total }
  const [journalOpen, setJournalOpen] = useState(false);
  // Правка/создание задачи прямо из работы: { task } | { create: true, row?, variant }
  const [taskEdit, setTaskEdit] = useState(null);
  // Выбор из банка: { variant } — новыми позициями; { row, variant } — в ячейку
  const [bankPick, setBankPick] = useState(null);

  // Свежее состояние для сохранения из колбэков печати
  const stateRef = useRef({});
  stateRef.current = { title, klass, structure };

  // ── загрузка ────────────────────────────────────────────────────────────
  // Перечитать задачи (после правки в редакторе задачи) — карточки сетки и печать
  const byIdRef = useRef(byId);
  byIdRef.current = byId;
  // Догрузить задачи по id. Реф обновляется сразу — автоподбор читает его
  // в том же цикле, не дожидаясь перерисовки.
  const ensureTasks = useCallback(async (ids) => {
    const missing = ids.filter((id) => id && !byIdRef.current.has(id));
    if (!missing.length) return;
    const recs = await api.getGeometryTasksByIds(missing);
    const next = new Map(byIdRef.current);
    recs.forEach((r) => next.set(r.id, r));
    byIdRef.current = next;
    setById(next);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const rec = await api.getGeometryWork(workId);
        if (!alive) return;
        const s = normalizeStructure(rec.structure);
        setTitle(rec.title || '');
        setKlass(rec.class || null);
        setSharing({ public: !!rec.public, groups: Array.isArray(rec.groups) ? rec.groups : [] });
        setStructure(s);
        const recs = await api.getGeometryTasksByIds(structureTaskIds(s));
        if (!alive) return;
        setById(new Map(recs.map((r) => [r.id, r])));
        setDirty(false);
      } catch (e) {
        if (alive) setError(e?.status === 404 ? 'Работа не найдена или нет доступа' : 'Не удалось загрузить работу');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [workId]);

  // ── правки и сохранение ─────────────────────────────────────────────────
  const update = useCallback((fn) => {
    setStructure((s) => fn(s));
    setDirty(true);
  }, []);

  const save = useCallback(async ({ quiet = false } = {}) => {
    const { title: t, klass: k, structure: s } = stateRef.current;
    if (!String(t || '').trim()) {
      message.error('Назовите работу');
      return false;
    }
    setSaving(true);
    try {
      await api.updateGeometryWork(workId, { title: t.trim(), class: k || null, structure: withLayouts(s) });
      setDirty(false);
      if (!quiet) message.success('Работа сохранена');
      return true;
    } catch (e) {
      message.error(`Не сохранилось: ${e?.message || 'ошибка'}`);
      return false;
    } finally {
      setSaving(false);
    }
  }, [workId, message]);

  // Ctrl+S и предупреждение о несохранённом при закрытии вкладки
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && view === 'edit' && canEdit) {
        e.preventDefault();
        save();
      }
    };
    const onUnload = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [dirty, save, view, canEdit]);

  // Макет печати из «Карточек» — сразу в работу (вместе с прочими правками)
  const saveLayouts = useCallback(async (patch) => {
    const next = withLayouts(stateRef.current.structure, patch);
    setStructure(next);
    stateRef.current = { ...stateRef.current, structure: next };
    const ok = await save({ quiet: true });
    if (!ok) throw new Error('save failed');
  }, [save]);

  // ── задачи из подборки, параллели ───────────────────────────────────────
  const usedIds = useMemo(() => new Set(structureTaskIds(structure)), [structure]);

  const addFromBasket = async () => {
    const ids = basket.items.map((x) => x.id);
    const r = addTasksAsPositions(structure, ids, basketVariant);
    await ensureTasks(r.added);
    update(() => r.structure);
    r.added.forEach((id) => basket.remove(id));
    message.success(r.skipped.length
      ? `Добавлено: ${r.added.length}, уже в работе: ${r.skipped.length}`
      : `Добавлено позиций: ${r.added.length}`);
  };

  const putInCell = (row, variant, task) => {
    if (task?.id && !byIdRef.current.has(task.id)) {
      const next = new Map(byIdRef.current).set(task.id, task);
      byIdRef.current = next;
      setById(next);
    }
    update((s) => setCell(s, row, variant, task?.id || null));
  };

  const refreshTasks = async (ids) => {
    const recs = await api.getGeometryTasksByIds(ids);
    const next = new Map(byIdRef.current);
    recs.forEach((r) => next.set(r.id, r));
    byIdRef.current = next;
    setById(next);
  };

  // Задачи из банка: новыми позициями варианта или в одну ячейку
  const addFromBank = (picked) => {
    const target = bankPick;
    setBankPick(null);
    const next = new Map(byIdRef.current);
    picked.forEach((t) => next.set(t.id, t));
    byIdRef.current = next;
    setById(next);
    if (target?.row != null) {
      update((s) => setCell(s, target.row, target.variant, picked[0].id));
      return;
    }
    const r = addTasksAsPositions(structure, picked.map((t) => t.id), target?.variant || 0);
    update(() => r.structure);
    message.success(r.skipped.length
      ? `Добавлено: ${r.added.length}, уже в работе: ${r.skipped.length}`
      : `Добавлено позиций: ${r.added.length}`);
  };

  // Задача сохранена в редакторе: новая — в работу, правленая — перечитать
  const onTaskSaved = async (saved) => {
    const ctx = taskEdit;
    setTaskEdit(null);
    if (!saved?.id) return;
    await refreshTasks([saved.id]);
    if (ctx?.create) {
      if (ctx.row != null) update((s) => setCell(s, ctx.row, ctx.variant, saved.id));
      else update((s) => addTasksAsPositions(s, [saved.id], ctx.variant || 0).structure);
      message.info('Задача добавлена в работу — не забудьте сохранить работу');
    }
  };

  const openTaskEditor = async (task) => {
    try {
      const full = await api.getGeometryTask(task.id);
      setCard({ id: null, list: [] });
      setTaskEdit({ task: full });
    } catch {
      message.error('Не удалось открыть задачу');
    }
  };

  const putFromBasket = async (row, variant, id) => {
    await ensureTasks([id]);
    update((s) => setCell(s, row, variant, id));
    basket.remove(id);
  };

  const emptyCount = structure.variants.reduce((n, _, vi) => n + emptyRows(structure, vi).length, 0);

  // Все пустые ячейки — лучшими параллелями того же раздела
  const autofillEmpty = async () => {
    const jobs = [];
    structure.variants.forEach((_, vi) => emptyRows(structure, vi).forEach((r) => {
      const ref = rowReference(structure, r);
      if (ref) jobs.push({ r, vi, ref });
    }));
    if (!jobs.length) return;
    setAutofill({ done: 0, total: jobs.length });
    const used = new Set(usedIds);
    const cache = new Map();
    let s = structure;
    let filled = 0;
    let failed = null;
    for (const [i, job] of jobs.entries()) {
      try {
        if (!cache.has(job.ref)) cache.set(job.ref, await api.getSimilarGeometryTasks(job.ref, { limit: 20 }));
        const candIds = cache.get(job.ref).map((x) => x.task_id).filter((id) => !used.has(id));
        await ensureTasks([job.ref, ...candIds.slice(0, 8)]);
        const refSection = byIdRef.current.get(job.ref)?.section;
        const pick = candIds.find((id) => {
          const t = byIdRef.current.get(id);
          return t && (!refSection || !t.section || t.section === refSection);
        });
        if (pick) {
          used.add(pick);
          s = setCell(s, job.r, job.vi, pick);
          filled += 1;
        }
      } catch (e) {
        failed = e.message;
        break;
      }
      setAutofill({ done: i + 1, total: jobs.length });
    }
    update(() => s);
    setAutofill(null);
    if (failed) message.warning(`Заполнено: ${filled}. Дальше не получилось: ${failed}`);
    else message.success(`Заполнено ячеек: ${filled}${filled < jobs.length ? ` из ${jobs.length}` : ''} — проверьте глазами`);
  };

  // ── печать ──────────────────────────────────────────────────────────────
  // sections пересчитываются только при смене состава, а не макетов — иначе
  // «Карточки» сбрасывали бы правку макета после каждого автосохранения.
  const variantsKey = JSON.stringify(structure.variants);
  const sections = useMemo(() => {
    const all = structure.variants.map((_, vi) => ({ label: variantLabel(vi), tasks: variantTasks(structure, vi, byId) }));
    const picked = printVariant === 'all' ? all : [all[printVariant]].filter(Boolean);
    return structure.variants.length > 1 ? picked : picked.map((p) => ({ ...p, label: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantsKey, byId, printVariant]);

  const goBack = () => {
    if (!dirty) { navigate('/app/geometry/works'); return; }
    // eslint-disable-next-line no-alert
    if (window.confirm('Есть несохранённые изменения. Уйти без сохранения?')) navigate('/app/geometry/works');
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>;
  if (error) return <Alert type="error" showIcon message={error} action={<Button onClick={() => navigate('/app/geometry/works')}>К работам</Button>} />;

  const variantPicker = structure.variants.length > 1 && (
    <Segmented
      value={printVariant}
      onChange={setPrintVariant}
      options={[
        ...(view === 'sheet' ? [] : [{ value: 'all', label: 'Все варианты' }]),
        ...structure.variants.map((_, i) => ({ value: i, label: variantLabel(i) })),
      ]}
    />
  );

  if (taskEdit) {
    const sec = (() => {
      // раздел новой задачи — как у большинства задач работы
      const counts = {};
      for (const id of usedIds) { const s = byId.get(id)?.section; if (s) counts[s] = (counts[s] || 0) + 1; }
      return Object.entries(counts).sort((x, y) => y[1] - x[1])[0]?.[0] || null;
    })();
    return (
      <GeometryTaskEditor
        task={taskEdit.task || null}
        backLabel="Назад к работе"
        defaults={sec ? { section: sec } : null}
        onSaved={onTaskSaved}
        onCancel={() => setTaskEdit(null)}
      />
    );
  }

  if (view === 'cards') {
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {variantPicker}
        <GeometryCards
          sections={sections}
          layoutSnapshot={structure.layouts}
          onLayoutsSave={canEdit ? saveLayouts : null}
          initialHeader={title}
          onBack={() => setView('edit')}
        />
      </Space>
    );
  }
  if (view === 'print') {
    const picked = printVariant === 'all'
      ? structure.variants.map((_, vi) => vi)
      : [printVariant];
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div className="no-print">{variantPicker}</div>
        <GeometrySheetPrint
          variants={picked.map((vi) => ({ number: vi + 1, tasks: variantTasks(structure, vi, byId) }))}
          title={title}
          classLabel={klass ? `${klass} класс` : ''}
          onBack={() => setView('edit')}
          onEditTask={openTaskEditor}
        />
      </Space>
    );
  }
  if (view === 'sheet') {
    const v = printVariant === 'all' ? 0 : printVariant;
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {variantPicker}
        <GeometryWorksheetPrint
          key={v}
          tasks={variantTasks(structure, v, byId)}
          onBack={() => setView('edit')}
          initialTopicLabel={title}
          initialVariantLabel={structure.variants.length > 1 ? variantLabel(v) : ''}
        />
      </Space>
    );
  }
  if (view === 'answers') {
    return <GeometryWorkAnswers structure={structure} byId={byId} title={title} onBack={() => setView('edit')} />;
  }

  // ── сетка ───────────────────────────────────────────────────────────────
  const rows = rowCount(structure);
  const nVar = structure.variants.length;
  const cols = `56px repeat(${nVar}, minmax(240px, 1fr))${canEdit ? ' 36px' : ''}`;
  // Минимум сетки — сумма минимальных колонок и зазоров (8 px): шире — по экрану
  const gridMinWidth = 56 + nVar * 240 + (canEdit ? 36 : 0) + 8 * (nVar + (canEdit ? 1 : 0));
  const pickerRef = picker ? byId.get(rowReference(structure, picker.row)) : null;

  const renderCell = (row, vi) => {
    const id = structure.variants[vi].items[row]?.task;
    const task = id ? byId.get(id) : null;
    if (id) {
      return (
        <div className="gw-cell" key={`${row}-${vi}`}>
          <GeometryTaskThumb task={task} height={64} width={84} />
          <div
            className="gw-cell-body"
            onClick={() => setCard({ id, list: variantTasks(structure, vi, byId).map((t) => t.id) })}
          >
            <Space size={4} wrap>
              <Text code style={{ fontSize: 11 }}>{task?.code || '…'}</Text>
              {task?.origin === 'mccme' && <Tag color="geekblue" style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>МЦНМО</Tag>}
              {task?.answer && (
                <Text type="secondary" style={{ fontSize: 11 }}>отв.&nbsp;<MathRenderer text={String(task.answer)} /></Text>
              )}
            </Space>
            <div className="gw-cell-text">
              {task
                ? (task.statement_md ? <MathRenderer text={cellStatement(task.statement_md)} /> : '—')
                : 'задача удалена или недоступна'}
            </div>
          </div>
          {canEdit && (
            <div className="gw-cell-actions">
              <Tooltip title="Заменить: подобрать похожую">
                <Button size="small" type="text" icon={<SwapOutlined />} onClick={() => setPicker({ row, variant: vi })} />
              </Tooltip>
              <Tooltip title="Убрать из варианта">
                <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => update((s) => setCell(s, row, vi, null))} />
              </Tooltip>
            </div>
          )}
        </div>
      );
    }
    const ref = rowReference(structure, row);
    return (
      <div className="gw-cell gw-cell--empty" key={`${row}-${vi}`}>
        {canEdit ? (
          <Space wrap size={4}>
            {ref && (
              <Button size="small" icon={<SwapOutlined />} onClick={() => setPicker({ row, variant: vi })}>
                Подобрать
              </Button>
            )}
            {basket.items.length > 0 && (
              <Dropdown
                menu={{
                  items: basket.items.map((x) => ({ key: x.id, label: x.code || x.id })),
                  onClick: ({ key }) => putFromBasket(row, vi, key),
                }}
              >
                <Button size="small" icon={<PlusOutlined />}>Из подборки</Button>
              </Dropdown>
            )}
            <Dropdown
              menu={{
                items: [
                  { key: 'bank', label: 'Из банка…' },
                  { key: 'new', label: 'Новая задача' },
                ],
                onClick: ({ key }) => (key === 'bank'
                  ? setBankPick({ row, variant: vi })
                  : setTaskEdit({ create: true, row, variant: vi })),
              }}
            >
              <Button size="small" type="dashed">ещё…</Button>
            </Dropdown>
          </Space>
        ) : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>}
      </div>
    );
  };

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {/* ── шапка ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={goBack}>Работы</Button>
        <Input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          placeholder="Название работы"
          style={{ flex: '1 1 280px', fontWeight: 600 }}
          maxLength={200}
          disabled={!canEdit}
        />
        <InputNumber
          value={klass}
          onChange={(v) => { setKlass(v); setDirty(true); }}
          min={1}
          max={11}
          placeholder="класс"
          style={{ width: 90 }}
          disabled={!canEdit}
        />
        {canEdit && (
          <Button type="primary" icon={<SaveOutlined />} onClick={() => save()} loading={saving} disabled={!dirty}>
            {dirty ? 'Сохранить' : 'Сохранено'}
          </Button>
        )}
        <Dropdown
          disabled={!rows}
          menu={{
            items: [
              { key: 'print', label: 'Лист задач (оформление Генератора)' },
              { key: 'cards', label: 'Карточки A5 / A4' },
              { key: 'sheet', label: 'Рабочий лист с клеткой' },
              { key: 'answers', label: 'Ключ ответов' },
            ],
            onClick: ({ key }) => {
              setPrintVariant(key === 'sheet' ? 0 : 'all');
              setView(key);
            },
          }}
        >
          <Button icon={<PrinterOutlined />}>Печать</Button>
        </Dropdown>
        {canEdit && (
          <Tooltip title="Ссылка для учеников без входа: условия и чертежи, без ответов; классам — в личный кабинет">
            <Button icon={<ShareAltOutlined />} onClick={() => setShareOpen(true)} disabled={!rows}>
              Ученикам{sharing.public && <Tag color="green" style={{ marginLeft: 6, marginRight: 0 }}>открыта</Tag>}
            </Button>
          </Tooltip>
        )}
        {canEdit && (
          <Tooltip title="Колонка в журнале класса по этой работе — сразу ввод отметок">
            <Button icon={<TableOutlined />} onClick={() => setJournalOpen(true)} disabled={!rows}>В журнал</Button>
          </Tooltip>
        )}
      </div>

      <WorkLessonLinks workId={workId} workTitle={title} materialType="geometry_work" />

      {/* ── действия над сеткой ── */}
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Dropdown
            menu={{
              items: [
                { key: 'bank', label: 'Из банка задач…' },
                { key: 'new', label: 'Новая задача' },
              ],
              onClick: ({ key }) => (key === 'bank'
                ? setBankPick({ variant: basketVariant })
                : setTaskEdit({ create: true, variant: basketVariant })),
            }}
          >
            <Button type="primary" icon={<PlusOutlined />}>Добавить задачи</Button>
          </Dropdown>
          <Button icon={<PlusOutlined />} onClick={() => update(addVariant)} disabled={nVar >= 6}>
            Вариант
          </Button>
          {nVar > 1 && emptyCount > 0 && rows > 0 && (
            <Tooltip title="Каждая пустая ячейка — самой похожей задачей того же раздела (векторный поиск). Проверьте результат глазами">
              <Button icon={<ThunderboltOutlined />} onClick={autofillEmpty} loading={!!autofill}>
                {autofill ? `Подбираю ${autofill.done}/${autofill.total}` : `Заполнить пустые (${emptyCount})`}
              </Button>
            </Tooltip>
          )}
          {nVar > 1 && (
            <Tooltip title="Куда добавлять новые позиции">
              <Select
                value={basketVariant}
                onChange={setBasketVariant}
                style={{ width: 130 }}
                options={structure.variants.map((_, i) => ({ value: i, label: `в ${variantLabel(i).toLowerCase()}` }))}
              />
            </Tooltip>
          )}
          {basket.items.length > 0 && (
            <Button icon={<PlusOutlined />} type="dashed" onClick={addFromBasket}>
              Позиции из подборки ({basket.items.length})
            </Button>
          )}
          <Text type="secondary" style={{ marginLeft: 'auto' }}>
            Позиций: {rows} · вариантов: {nVar}
          </Text>
        </div>
      )}

      {/* ── сетка «позиции × варианты» ── */}
      {rows === 0 ? (
        <Empty
          description={(
            <span>
              В работе пока нет задач. «Добавить задачи» — из банка или новую; либо соберите подборку в{' '}
              <a onClick={() => navigate('/app/geometry/tasks')}>банке задач</a>{' '}
              («В подборку» у строки или в карточке) — и сюда «Позиции из подборки».
            </span>
          )}
        />
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div className="gw-grid" style={{ gridTemplateColumns: cols, minWidth: gridMinWidth }}>
            <div />
            {structure.variants.map((v, vi) => (
              <div className="gw-head" key={`h${vi}`}>
                <span>
                  {variantLabel(vi)}{' '}
                  <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>
                    {rows - emptyRows(structure, vi).length}/{rows}
                  </Text>
                </span>
                {canEdit && nVar > 1 && (
                  <Popconfirm
                    title={`Удалить ${variantLabel(vi).toLowerCase()}?`}
                    okText="Удалить"
                    cancelText="Нет"
                    onConfirm={() => update((s) => removeVariant(s, vi))}
                  >
                    <Button size="small" type="text" icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </div>
            ))}
            {canEdit && <div />}

            {Array.from({ length: rows }, (_, r) => [
              <div className="gw-rownum" key={`n${r}`}>
                {canEdit && (
                  <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={r === 0}
                    onClick={() => update((s) => moveRow(s, r, r - 1))} />
                )}
                <span>{r + 1}</span>
                {canEdit && (
                  <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={r === rows - 1}
                    onClick={() => update((s) => moveRow(s, r, r + 1))} />
                )}
              </div>,
              ...structure.variants.map((_, vi) => renderCell(r, vi)),
              canEdit && (
                <div key={`d${r}`} style={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title="Удалить позицию во всех вариантах">
                    <Button size="small" type="text" danger icon={<DeleteOutlined />}
                      onClick={() => update((s) => removeRow(s, r))} />
                  </Tooltip>
                </div>
              ),
            ])}
          </div>
        </div>
      )}

      {canEdit && <GeometryBasketBar onOpenTask={(id) => setCard({ id, list: [] })} />}

      <GeometryWorkShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        workId={workId}
        variants={structure.variants.length}
        sharing={sharing}
        onChange={setSharing}
        dirty={dirty}
      />

      <SheetToJournalModal
        open={journalOpen}
        kind="geometry_work"
        sheet={{ id: workId, title, questions_count: rows }}
        onClose={() => setJournalOpen(false)}
      />

      <GeometryParallelPicker
        open={!!picker}
        title={picker ? `Позиция ${picker.row + 1} · ${variantLabel(picker.variant)}` : ''}
        reference={pickerRef}
        excludeIds={usedIds}
        onClose={() => setPicker(null)}
        onPick={(task) => { putInCell(picker.row, picker.variant, task); setPicker(null); }}
        onOpenTask={(id) => setCard({ id, list: [] })}
      />

      <GeometryTaskPickerModal
        open={!!bankPick}
        onClose={() => setBankPick(null)}
        usedIds={usedIds}
        onAdd={addFromBank}
        onOpenTask={(id) => setCard({ id, list: [] })}
        variantOptions={bankPick?.row == null ? structure.variants.map((_, i) => ({ value: i, label: variantLabel(i) })) : null}
        variant={bankPick?.variant || 0}
        onVariantChange={(v) => setBankPick((b) => ({ ...b, variant: v }))}
      />

      <GeometryTaskDrawer
        onEdit={canEdit ? openTaskEditor : undefined}
        taskId={card.id}
        listIds={card.list}
        geoTags={geoTags}
        onOpen={(id, list) => setCard((c) => ({ id, list: list || c.list }))}
        onClose={() => setCard({ id: null, list: [] })}
        canEdit={canEdit}
      />
    </Space>
  );
}
