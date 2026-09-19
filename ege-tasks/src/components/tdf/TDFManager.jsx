import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button, Space, Modal, Form, Input, InputNumber, Popconfirm, Spin,
  message, Tooltip, Select, Dropdown,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, FileTextOutlined,
  UnorderedListOutlined, CreditCardOutlined, FormOutlined, SearchOutlined,
  CopyOutlined, MoreOutlined,
} from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { WorkspacePageHeader, EmptyState, Chip } from '../workspace/ui';
import { tdfStats, tdfComposition } from './tdfTypes';
import './tdf.css';

const plural = (n, forms) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
};

const ITEMS = ['пункт', 'пункта', 'пунктов'];
const SECTIONS = ['раздел', 'раздела', 'разделов'];
const VARIANTS = ['вариант', 'варианта', 'вариантов'];
const SETS = ['набор', 'набора', 'наборов'];

/** Что в наборе недоделано. Учитель видит это, не открывая конспект. */
function readiness(stats) {
  if (stats.total === 0) return { ok: false, text: 'пунктов ещё нет' };
  const gaps = [];
  if (stats.noFormulation) gaps.push(`${stats.noFormulation} без формулировки`);
  if (stats.noNotation) gaps.push(`${stats.noNotation} без краткой записи`);
  if (stats.noDrawing) gaps.push(`${stats.noDrawing} без чертежа`);
  return gaps.length
    ? { ok: false, text: gaps.join(' · ') }
    : { ok: true, text: 'всё заполнено' };
}

function SetRow({ set, stats, variants, canEdit, canDelete, onOpenEditor, onOpenVariants, onOpenFlashcards, onEdit, onDuplicate, onDelete }) {
  const composition = tdfComposition(stats);
  const status = readiness(stats);
  const stop = (e) => e.stopPropagation();
  const primary = () => (canEdit ? onOpenEditor(set.id) : onOpenFlashcards?.(set.id));

  const menu = {
    items: [
      { key: 'edit', label: 'Переименовать', icon: <EditOutlined /> },
      { key: 'duplicate', label: 'Дублировать набор', icon: <CopyOutlined /> },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent?.stopPropagation?.();
      if (key === 'edit') onEdit(set);
      else onDuplicate(set);
    },
  };

  return (
    <div className="tdf-item" onClick={primary}>
      <span className={`tdf-item__cls${set.class_number ? '' : ' tdf-item__cls--empty'}`}>
        {set.class_number ? `${set.class_number} кл` : '—'}
      </span>

      <div className="tdf-item__main">
        <div className="tdf-item__name">{set.title}</div>
        {set.description && <div className="tdf-item__desc">{set.description}</div>}
        <div className="tdf-item__meta">
          <span><b>{stats.total}</b> {plural(stats.total, ITEMS)}</span>
          {stats.sections > 0 && (
            <>
              <span className="tdf-item__sep">·</span>
              <span><b>{stats.sections}</b> {plural(stats.sections, SECTIONS)}</span>
            </>
          )}
          <span className="tdf-item__sep">·</span>
          <span>
            {variants.length
              ? <><b>{variants.length}</b> {plural(variants.length, VARIANTS)} опроса</>
              : 'вариантов опроса нет'}
          </span>
          <span className="tdf-item__sep">·</span>
          <span className={status.ok ? 'tdf-gaps tdf-gaps--ok' : 'tdf-gaps'}>{status.text}</span>
        </div>
      </div>

      {composition.length > 0 && (
        <div className="tdf-item__chips">
          {composition.map(t => (
            <Chip key={t.value} tone={t.tone} title={t.label}>
              {t.short}<span className="tdf-chips__count">{t.count}</span>
            </Chip>
          ))}
        </div>
      )}

      <div className="tdf-item__actions" onClick={stop}>
        {canEdit && (
          <Button size="small" icon={<FileTextOutlined />} onClick={() => onOpenEditor(set.id)}>
            Конспект
          </Button>
        )}
        {canEdit && (
          <Tooltip title="Бланки опроса: выбрать пункты и распечатать по вариантам">
            <Button size="small" icon={<UnorderedListOutlined />} onClick={() => onOpenVariants(set.id)}>
              Варианты
            </Button>
          </Tooltip>
        )}
        <Tooltip title="Карточки-флипы для самопроверки">
          <Button size="small" icon={<CreditCardOutlined />} onClick={() => onOpenFlashcards?.(set.id)}>
            Карточки
          </Button>
        </Tooltip>
        {canEdit && (
          <Dropdown menu={menu} trigger={['click']}>
            <Button size="small" type="text" icon={<MoreOutlined />} />
          </Dropdown>
        )}
        {canDelete && (
          <Popconfirm
            title="Удалить этот набор?"
            description="Пункты и варианты будут удалены вместе с ним."
            onConfirm={() => onDelete(set.id)}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        )}
      </div>
    </div>
  );
}

export default function TDFManager({ onOpenEditor, onOpenVariants, onOpenFlashcards }) {
  const { canEdit, canDelete } = useAuth();
  const [overview, setOverview] = useState({ sets: [], itemsBySet: {}, variantsBySet: {} });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadSets = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await api.getTdfOverview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSets(); }, [loadSets]);

  const { sets, itemsBySet, variantsBySet } = overview;

  // Сводка по всем наборам — подпись в шапке раздела.
  const totals = useMemo(() => {
    let items = 0;
    let variants = 0;
    for (const s of sets) {
      items += tdfStats(itemsBySet[s.id] || []).total;
      variants += (variantsBySet[s.id] || []).length;
    }
    return { sets: sets.length, items, variants };
  }, [sets, itemsBySet, variantsBySet]);

  const classOptions = useMemo(() => {
    const classes = [...new Set(sets.map(s => s.class_number).filter(Boolean))].sort((a, b) => a - b);
    return [
      { value: 'all', label: 'Все классы' },
      ...classes.map(c => ({ value: String(c), label: `${c} класс` })),
    ];
  }, [sets]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sets.filter(s => {
      if (classFilter !== 'all' && String(s.class_number || '') !== classFilter) return false;
      if (!q) return true;
      return `${s.title} ${s.description || ''}`.toLowerCase().includes(q);
    });
  }, [sets, query, classFilter]);

  const grouped = useMemo(() => {
    const byClass = new Map();
    for (const set of visible) {
      const key = set.class_number || 0;
      if (!byClass.has(key)) byClass.set(key, []);
      byClass.get(key).push(set);
    }
    return [...byClass.entries()]
      .sort(([a], [b]) => (a === 0 ? 1 : b === 0 ? -1 : a - b))
      .map(([key, sets]) => ({
        key: String(key),
        label: key ? `${key} класс` : 'Без класса',
        sets,
      }));
  }, [visible]);

  const openCreate = () => {
    setEditingSet(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditingSet(record);
    form.setFieldsValue({
      title: record.title,
      class_number: record.class_number || undefined,
      description: record.description || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editingSet) {
        await api.updateTdfSet(editingSet.id, values);
        message.success('Набор обновлён');
      } else {
        await api.createTdfSet({ ...values, order: sets.length });
        message.success('Набор создан');
      }
      setModalOpen(false);
      loadSets();
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (set) => {
    const hide = message.loading('Копируем набор с пунктами и чертежами…', 0);
    try {
      await api.duplicateTdfSet(set.id);
      message.success('Копия набора создана');
      loadSets();
    } catch {
      message.error('Не удалось скопировать набор');
    } finally {
      hide();
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteTdfSet(id);
      message.success('Набор удалён');
      loadSets();
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const subtitle = loading
    ? 'Загружаем наборы…'
    : `${totals.sets} ${plural(totals.sets, SETS)} · ${totals.items} ${plural(totals.items, ITEMS)} · ${totals.variants} ${plural(totals.variants, VARIANTS)} опроса`;

  return (
    <div style={{ padding: 24 }}>
      <WorkspacePageHeader
        icon={<FormOutlined />}
        accent="violet"
        title="ТДФ — теоремы, определения, формулы"
        subtitle={subtitle}
        extra={canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Новый набор
          </Button>
        )}
      />

      {sets.length > 0 && (
        <div className="tdf-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: 'var(--ink-4)' }} />}
            placeholder="Поиск по названию"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ width: 260 }}
          />
          <Select
            value={classFilter}
            onChange={setClassFilter}
            options={classOptions}
            style={{ width: 150 }}
          />
          <div className="tdf-toolbar__spacer" />
          {visible.length !== sets.length && (
            <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
              Показано {visible.length} из {sets.length}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      ) : sets.length === 0 ? (
        <EmptyState
          title="Наборов ТДФ пока нет"
          description="Набор — это конспект по теме: теоремы, определения и формулы с чертежами. Из него собираются бланки устного опроса и карточки для самопроверки."
          cta={canEdit ? 'Создать первый набор' : undefined}
          ctaIcon={<PlusOutlined />}
          onCta={openCreate}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Ничего не нашлось"
          description="Попробуйте другой запрос или снимите фильтр по классу."
          cta="Сбросить фильтры"
          ctaType="default"
          onCta={() => { setQuery(''); setClassFilter('all'); }}
        />
      ) : (
        grouped.map(group => (
          <div key={group.key}>
            <div className="tdf-group">
              {group.label}
              <span className="tdf-group__count">{group.sets.length}</span>
            </div>
            <div className="tdf-list">
              {group.sets.map(set => (
                <SetRow
                  key={set.id}
                  set={set}
                  stats={tdfStats(itemsBySet[set.id] || [])}
                  variants={variantsBySet[set.id] || []}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onOpenEditor={onOpenEditor}
                  onOpenVariants={onOpenVariants}
                  onOpenFlashcards={onOpenFlashcards}
                  onEdit={openEdit}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <Modal
        title={editingSet ? 'Набор ТДФ' : 'Новый набор ТДФ'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input placeholder="Например: Параллельные прямые" />
          </Form.Item>
          <Form.Item name="class_number" label="Класс">
            <InputNumber min={1} max={12} style={{ width: '100%' }} placeholder="7" />
          </Form.Item>
          <Form.Item name="description" label="Описание" extra="Видно на карточке набора — чем этот конспект отличается от соседнего.">
            <Input.TextArea rows={2} placeholder="Необязательно" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
