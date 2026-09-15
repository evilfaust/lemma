import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button, Space, Spin, message, Tooltip, Popconfirm, Dropdown,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  PrinterOutlined, HolderOutlined, LineOutlined, DownOutlined,
  PlusCircleOutlined, ImportOutlined, FileTextOutlined, CreditCardOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import TDFItemModal from './TDFItemModal';
import TDFPrintView from './TDFPrintView';
import TDFCardsPrint from './TDFCardsPrint';
import TDFRosterPrint from './TDFRosterPrint';
import TDFCopyItemsModal from './TDFCopyItemsModal';
import MathRenderer from '../../shared/components/MathRenderer';
import { WorkspacePageHeader, EmptyState, Chip } from '../workspace/ui';
import { tdfStats, tdfComposition, tdfTypeShort, tdfTypeTone, tdfTypeLabel } from './tdfTypes';
import './tdf.css';

/** Полоса состояния набора: из чего собран и чего в нём не хватает. */
function StatBar({ stats }) {
  const composition = tdfComposition(stats);
  const gaps = [];
  if (stats.noFormulation) gaps.push(`${stats.noFormulation} без формулировки`);
  if (stats.noNotation) gaps.push(`${stats.noNotation} без краткой записи`);
  if (stats.noDrawing) gaps.push(`${stats.noDrawing} без чертежа`);

  return (
    <div className="tdf-statbar">
      <span><b>{stats.total}</b> пунктов</span>
      {stats.sections > 0 && <span><b>{stats.sections}</b> разделов</span>}
      <span><b>{stats.withDrawing}</b> с чертежом</span>
      {gaps.length > 0
        ? <span style={{ color: 'var(--c-amber)' }}>{gaps.join(' · ')}</span>
        : <span style={{ color: 'var(--c-teal)' }}>все пункты заполнены</span>}
      <div className="tdf-statbar__chips">
        {composition.map(t => (
          <Chip key={t.value} tone={t.tone} title={t.label}>
            {t.short}<span className="tdf-chips__count">{t.count}</span>
          </Chip>
        ))}
      </div>
    </div>
  );
}

export default function TDFEditor({ setId, onBack }) {
  const [tdfSet, setTdfSet] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [insertAfterIndex, setInsertAfterIndex] = useState(null);
  const [printMode, setPrintMode] = useState(null); // null | 'etalon' | 'cards' | 'roster'
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [set, its] = await Promise.all([
        api.getTdfSet(setId),
        api.getTdfItems(setId),
      ]);
      setTdfSet(set);
      setItems(its);
    } catch {
      message.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = useMemo(() => tdfStats(items), [items]);

  const openCreate = (afterIndex = null) => {
    setEditingItem(null);
    setInsertAfterIndex(afterIndex);
    setItemModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setInsertAfterIndex(null);
    setItemModalOpen(true);
  };

  const handleItemSaved = async (savedItem, isNew) => {
    if (isNew && insertAfterIndex !== null) {
      const newItems = [...items];
      newItems.splice(insertAfterIndex + 1, 0, savedItem);
      await reorderItems(newItems);
    } else {
      await loadData();
    }
    setItemModalOpen(false);
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteTdfItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      message.success('Пункт удалён');
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const addSectionHeader = async (afterIndex = null) => {
    const pos = afterIndex !== null ? afterIndex + 1 : items.length;
    try {
      const created = await api.createTdfItem({
        tdf_set: setId,
        is_section_header: true,
        section_title: 'Новый раздел',
        order: pos,
      });
      const newItems = [...items];
      newItems.splice(pos, 0, created);
      await reorderItems(newItems);
    } catch {
      message.error('Ошибка добавления раздела');
    }
  };

  /**
   * Порядок сохраняется ТОЛЬКО для сдвинувшихся пунктов: раньше перетаскивание
   * одной строки переписывало весь набор (21 PATCH на наборе из 21 пункта).
   */
  const reorderItems = async (newItems) => {
    const prevOrders = Object.fromEntries(items.map((it, idx) => [it.id, idx]));
    const ordered = newItems.map((item, idx) => ({ ...item, order: idx }));
    setItems(ordered);
    try {
      await api.reorderTdfItems(ordered, prevOrders);
    } catch {
      message.error('Порядок не сохранился');
      loadData();
    }
  };

  // Drag & Drop
  const onDragStart = (idx) => setDragIdx(idx);
  const onDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const onDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };
  const onDrop = async (idx) => {
    if (dragIdx === null || dragIdx === idx) { onDragEnd(); return; }
    const newItems = [...items];
    const [moved] = newItems.splice(dragIdx, 1);
    newItems.splice(idx, 0, moved);
    onDragEnd();
    await reorderItems(newItems);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;

  if (printMode === 'etalon') {
    return (
      <TDFPrintView
        tdfSet={tdfSet}
        items={items}
        mode="etalon"
        onBack={() => setPrintMode(null)}
      />
    );
  }

  if (printMode === 'cards') {
    return <TDFCardsPrint tdfSet={tdfSet} items={items} onBack={() => setPrintMode(null)} />;
  }

  if (printMode === 'roster') {
    return <TDFRosterPrint tdfSet={tdfSet} items={items} onBack={() => setPrintMode(null)} />;
  }

  // Три печатные формы одного набора: конспект (учителю и на стенд), карточки
  // (раздать ученикам) и ведомость (отмечать ответы на уроке).
  const printMenu = {
    items: [
      { key: 'etalon', label: 'Конспект — таблица A4', icon: <FileTextOutlined /> },
      { key: 'cards', label: 'Карточки — раздать ученикам', icon: <CreditCardOutlined /> },
      { key: 'roster', label: 'Ведомость опроса — «ученик × пункт»', icon: <TableOutlined /> },
    ],
    onClick: ({ key }) => setPrintMode(key),
  };

  const addMenu = (afterIndex) => ({
    items: [
      { key: 'item', label: 'Пункт ТДФ', icon: <PlusCircleOutlined /> },
      { key: 'section', label: 'Заголовок раздела', icon: <LineOutlined /> },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent?.stopPropagation?.();
      if (key === 'item') openCreate(afterIndex);
      else addSectionHeader(afterIndex);
    },
  });

  const dragProps = (idx) => ({
    draggable: true,
    onDragStart: () => onDragStart(idx),
    onDragOver: (e) => onDragOver(e, idx),
    onDragEnd,
    onDrop: () => onDrop(idx),
  });

  let num = 0;

  return (
    <div style={{ padding: 24, maxWidth: 1440, margin: '0 auto' }}>
      <WorkspacePageHeader
        icon={<FileTextOutlined />}
        accent="violet"
        title={tdfSet?.title || 'Конспект'}
        subtitle={`Эталонный конспект${tdfSet?.class_number ? ` · ${tdfSet.class_number} класс` : ''}`}
        extra={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>К наборам</Button>
            <Button icon={<ImportOutlined />} onClick={() => setCopyModalOpen(true)}>
              Скопировать пункты
            </Button>
            <Dropdown menu={printMenu} trigger={['click']} disabled={items.length === 0}>
              <Button icon={<PrinterOutlined />}>
                Печать <DownOutlined />
              </Button>
            </Dropdown>
            <Dropdown menu={addMenu(items.length - 1)} trigger={['click']}>
              <Button type="primary" icon={<PlusOutlined />}>
                Добавить <DownOutlined />
              </Button>
            </Dropdown>
          </Space>
        }
      />

      {items.length > 0 && <StatBar stats={stats} />}

      {items.length === 0 ? (
        <EmptyState
          title="Конспект пока пустой"
          description="Пункт ТДФ — это формулировка теоремы (определения, формулы) с чертежом и краткой записью. Из пунктов собираются бланки опроса и карточки."
          cta="Добавить первый пункт"
          ctaIcon={<PlusOutlined />}
          onCta={() => openCreate(null)}
        >
          <Button type="link" onClick={() => setCopyModalOpen(true)}>
            …или скопировать из другого набора
          </Button>
        </EmptyState>
      ) : (
        <div className="tdf-rows">
          {items.map((item, idx) => {
            const over = dragOverIdx === idx;
            const dragging = dragIdx === idx;

            if (item.is_section_header) {
              return (
                <div
                  key={item.id}
                  className={`tdf-section${over ? ' tdf-section--over' : ''}${dragging ? ' tdf-row--dragging' : ''}`}
                  {...dragProps(idx)}
                >
                  <HolderOutlined style={{ color: 'var(--ink-4)' }} />
                  <span className="tdf-section__title">{item.section_title || 'Без названия'}</span>
                  <Space size={2}>
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(item)} />
                    <Popconfirm
                      title="Удалить заголовок раздела?"
                      onConfirm={() => handleDelete(item.id)}
                      okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }}
                    >
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                    <Dropdown menu={addMenu(idx)} trigger={['click']}>
                      <Button size="small" type="text" icon={<PlusOutlined />} />
                    </Dropdown>
                  </Space>
                </div>
              );
            }

            num++;
            return (
              <div
                key={item.id}
                className={`tdf-row${over ? ' tdf-row--over' : ''}${dragging ? ' tdf-row--dragging' : ''}`}
                {...dragProps(idx)}
              >
                <div className="tdf-row__handle">
                  <HolderOutlined />
                  <span className="tdf-row__num">{num}</span>
                </div>

                <div className="tdf-row__main">
                  {item.type && (
                    <Chip tone={tdfTypeTone(item.type)} title={tdfTypeLabel(item.type)} style={{ marginBottom: 6 }}>
                      {tdfTypeLabel(item.type)}
                    </Chip>
                  )}
                  <div className="tdf-row__name">{item.name || '— без названия'}</div>
                </div>

                <div className="tdf-row__center">
                  {item.formulation_md
                    ? <div className="tdf-row__body"><MathRenderer content={item.formulation_md} /></div>
                    : <span className="tdf-row__missing">формулировки нет</span>}
                </div>

                <div className="tdf-row__aside">
                  {item.drawing_image
                    ? <img src={api.getTdfItemDrawingUrl(item)} alt="чертёж" className="tdf-row__thumb" />
                    : <span className="tdf-row__missing">без чертежа</span>}
                  {item.short_notation_md
                    ? <div className="tdf-row__notation"><MathRenderer content={item.short_notation_md} /></div>
                    : <span className="tdf-row__missing">без краткой записи</span>}
                </div>

                <div className="tdf-row__actions">
                  <Tooltip title="Редактировать пункт">
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(item)} />
                  </Tooltip>
                  <Popconfirm
                    title="Удалить пункт?"
                    onConfirm={() => handleDelete(item.id)}
                    okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }}
                  >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                  <Tooltip title="Добавить после этого пункта">
                    <Dropdown menu={addMenu(idx)} trigger={['click']}>
                      <Button size="small" type="text" icon={<PlusOutlined />} />
                    </Dropdown>
                  </Tooltip>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <Dropdown menu={addMenu(items.length - 1)} trigger={['click']}>
              <Button icon={<PlusOutlined />}>Добавить в конец <DownOutlined /></Button>
            </Dropdown>
          </div>
        </div>
      )}

      <TDFItemModal
        open={itemModalOpen}
        item={editingItem}
        setId={setId}
        onClose={() => setItemModalOpen(false)}
        onSaved={handleItemSaved}
        nextOrder={insertAfterIndex !== null ? insertAfterIndex + 1 : items.length}
      />

      <TDFCopyItemsModal
        open={copyModalOpen}
        targetSetId={setId}
        targetTitle={tdfSet?.title}
        onClose={() => setCopyModalOpen(false)}
        onCopied={loadData}
      />
    </div>
  );
}
