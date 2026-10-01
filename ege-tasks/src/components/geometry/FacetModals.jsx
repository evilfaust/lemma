import { useEffect, useMemo, useState } from 'react';
import { App, Button, Modal, Progress, Space, Typography } from 'antd';
import { api } from '../../shared/services/pocketbase';
import { FACET_KINDS, joinFacets, splitFacets } from '../../utils/geometryFacets';
import MathRenderer from '../MathRenderer';
import GeometryTaskThumb from './GeometryTaskThumb';
import { FacetSelects, FacetSuggestions, useTagById } from './FacetFields';

const { Text } = Typography;
const EMPTY = { object: [], method: [], fact: [] };
const flat = (v) => FACET_KINDS.flatMap((k) => v[k] || []);

/** Добавить/снять фасеты у выделенных задач разом (остальные фасеты задач не трогаются). */
export function FacetBulkModal({ open, onClose, taskIds = [], geoTags, onDone }) {
  const { message } = App.useApp();
  const [add, setAdd] = useState(EMPTY);
  const [remove, setRemove] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setAdd(EMPTY); setRemove(EMPTY); }
  }, [open]);

  const handleOk = async () => {
    setSaving(true);
    try {
      const r = await api.updateGeometryTasksTags(taskIds, { add: flat(add), remove: flat(remove) });
      if (r.failed) message.warning(`Обновлено: ${r.ok}, с ошибкой: ${r.failed}`);
      else message.success(`Фасеты обновлены у ${r.ok} задач`);
      onDone?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Фасеты у ${taskIds.length} задач`}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Применить"
      cancelText="Отмена"
      okButtonProps={{ disabled: !flat(add).length && !flat(remove).length }}
      confirmLoading={saving}
      width={640}
      destroyOnHidden
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div>
          <Text strong>Добавить</Text>
          <FacetSelects geoTags={geoTags} value={add} onChange={setAdd} />
        </div>
        <div>
          <Text strong>Снять</Text>
          <FacetSelects geoTags={geoTags} value={remove} onChange={setRemove} />
        </div>
        <Text type="secondary">Остальные фасеты каждой задачи сохраняются.</Text>
      </Space>
    </Modal>
  );
}

/**
 * Разметка фасетами по очереди: задача за задачей, с подсказкой по похожим
 * задачам МЦНМО (уверенные можно добавить одной кнопкой).
 * @param {object[]} tasks — очередь (лёгкие записи)
 * @param {function} onSaved — (id, tags) задача сохранена
 */
export function FacetReviewModal({ open, onClose, tasks = [], geoTags, onSaved }) {
  const { message } = App.useApp();
  const tagById = useTagById(geoTags);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  // Очередь — снимок; сохранённое помним здесь, чтобы «Назад» показывал новое
  const [savedTags, setSavedTags] = useState({});
  const task = tasks[index] || null;
  const tagsKey = task ? (savedTags[task.id] ?? task.tags ?? []).join(',') : '';
  const parts = useMemo(
    () => splitFacets(tagsKey ? tagsKey.split(',') : [], tagById),
    [tagsKey, tagById],
  );

  useEffect(() => {
    if (open) { setIndex(0); setSavedCount(0); setSavedTags({}); }
  }, [open]);

  // Новая задача очереди (или новые фасеты справочника) — значения формы заново
  useEffect(() => {
    setValue({ object: parts.object, method: parts.method, fact: parts.fact });
  }, [task?.id, parts]);

  const next = (justSaved = false) => {
    if (index + 1 >= tasks.length) {
      message.success(`Готово: размечено ${savedCount + (justSaved ? 1 : 0)} из ${tasks.length}`);
      onClose();
    } else setIndex(index + 1);
  };

  const saveAndNext = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const tags = joinFacets({ ...value, other: parts.other });
      await api.updateGeometryTask(task.id, { tags });
      onSaved?.(task.id, tags);
      setSavedTags((m) => ({ ...m, [task.id]: tags }));
      setSavedCount((n) => n + 1);
      next(true);
    } catch {
      message.error('Не удалось сохранить фасеты');
    } finally {
      setSaving(false);
    }
  };

  const addFacet = (kind, id) => setValue((v) => (v[kind].includes(id) ? v : { ...v, [kind]: [...v[kind], id] }));

  return (
    <Modal
      title="Разметка фасетами"
      open={open}
      onCancel={onClose}
      width={860}
      destroyOnHidden
      footer={(
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Text type="secondary">Задача {Math.min(index + 1, tasks.length)} из {tasks.length} · сохранено {savedCount}</Text>
          <Space>
            <Button disabled={index === 0} onClick={() => setIndex(index - 1)}>Назад</Button>
            <Button onClick={() => next()}>Пропустить</Button>
            <Button type="primary" loading={saving} onClick={saveAndNext}>Сохранить и дальше</Button>
          </Space>
        </Space>
      )}
    >
      <Progress percent={tasks.length ? Math.round((index / tasks.length) * 100) : 0} showInfo={false} size="small" />
      {task && (
        <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <GeometryTaskThumb task={task} height={150} width={190} />
            <div style={{ minWidth: 0, flex: 1, maxHeight: 170, overflowY: 'auto' }}>
              <Text code>{task.code}</Text>
              <div style={{ fontSize: 14, marginTop: 4 }}>
                {task.statement_md ? <MathRenderer text={task.statement_md} /> : <Text type="secondary">Условие не задано</Text>}
              </div>
              {task.answer && <Text type="secondary">Ответ: <MathRenderer text={String(task.answer)} /></Text>}
            </div>
          </div>
          <FacetSelects geoTags={geoTags} value={value} onChange={setValue} />
          <FacetSuggestions taskId={task.id} tagById={tagById} have={flat(value)} onAdd={addFacet} autoLoad />
        </Space>
      )}
    </Modal>
  );
}
