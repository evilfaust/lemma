import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Modal, Select, Space, Spin, Typography, message } from 'antd';
import { api } from '../../services/pocketbase';
import { Chip } from '../workspace/ui';
import { tdfTypeShort, tdfTypeTone, tdfTypeLabel } from './tdfTypes';

const { Text } = Typography;

/**
 * Перенос пунктов из другого набора — копией.
 *
 * Пункт привязан к набору relation'ом с cascadeDelete, «переиспользовать» его
 * в двух наборах нельзя. Поэтому итоговый опросник за год собирается копиями:
 * правка копии оригинал не трогает, и об этом окно говорит прямо.
 */
export default function TDFCopyItemsModal({ open, targetSetId, targetTitle, onClose, onCopied }) {
  const [sets, setSets] = useState([]);
  const [sourceId, setSourceId] = useState(null);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSourceId(null);
    setItems([]);
    setSelected([]);
    setLoadingSets(true);
    api.getTdfSets()
      .then(all => setSets(all.filter(s => s.id !== targetSetId)))
      .finally(() => setLoadingSets(false));
  }, [open, targetSetId]);

  useEffect(() => {
    if (!sourceId) { setItems([]); setSelected([]); return; }
    setLoadingItems(true);
    api.getTdfItems(sourceId)
      .then(list => { setItems(list); setSelected([]); })
      .finally(() => setLoadingItems(false));
  }, [sourceId]);

  const realItems = useMemo(() => items.filter(i => !i.is_section_header), [items]);

  const toggle = useCallback((id) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }, []);

  /** Раздел целиком: заголовок + всё до следующего заголовка. */
  const sectionIds = useCallback((headerIdx) => {
    const ids = [items[headerIdx].id];
    for (let i = headerIdx + 1; i < items.length && !items[i].is_section_header; i++) {
      ids.push(items[i].id);
    }
    return ids;
  }, [items]);

  const handleCopy = async () => {
    if (!selected.length) return;
    setCopying(true);
    try {
      // Порядок копий — порядок в исходном наборе, а не порядок кликов.
      const ordered = items.filter(i => selected.includes(i.id)).map(i => i.id);
      const { copied, failed } = await api.copyTdfItemsToSet(ordered, targetSetId);
      if (copied) message.success(`Скопировано пунктов: ${copied}`);
      if (failed) message.warning(`Не удалось скопировать: ${failed}`);
      onCopied?.();
      onClose();
    } catch {
      message.error('Ошибка копирования');
    } finally {
      setCopying(false);
    }
  };

  return (
    <Modal
      title="Скопировать пункты из другого набора"
      open={open}
      onCancel={onClose}
      width={720}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      footer={[
        <Button key="cancel" onClick={onClose}>Отмена</Button>,
        <Button
          key="ok"
          type="primary"
          loading={copying}
          disabled={selected.length === 0}
          onClick={handleCopy}
        >
          Скопировать{selected.length ? ` (${selected.length})` : ''}
        </Button>,
      ]}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 14 }}
        message={`Копии встанут в конец набора «${targetTitle || 'текущего'}»`}
        description="Чертежи и состояние GeoGebra копируются вместе с пунктом. Дальше копия живёт своей жизнью: правка копии оригинал не меняет."
      />

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Select
          placeholder="Выберите набор-источник"
          loading={loadingSets}
          value={sourceId}
          onChange={setSourceId}
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          options={sets.map(s => ({
            value: s.id,
            label: s.class_number ? `${s.title} · ${s.class_number} кл.` : s.title,
          }))}
        />

        {loadingItems && <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>}

        {!loadingItems && sourceId && items.length === 0 && (
          <Text type="secondary">В этом наборе пока нет пунктов.</Text>
        )}

        {!loadingItems && items.length > 0 && (
          <>
            <Space size={8} wrap>
              <Button size="small" onClick={() => setSelected(realItems.map(i => i.id))}>
                Выбрать все пункты ({realItems.length})
              </Button>
              <Button size="small" onClick={() => setSelected([])} disabled={!selected.length}>
                Снять выбор
              </Button>
            </Space>

            <div style={{ border: '1px solid var(--rule)', borderRadius: 8, padding: 8 }}>
              {items.map((item, idx) => {
                const checked = selected.includes(item.id);
                if (item.is_section_header) {
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 8px', marginTop: idx ? 6 : 0, borderRadius: 6,
                        background: 'var(--bg-sunken)',
                      }}
                    >
                      <Checkbox checked={checked} onChange={() => toggle(item.id)} />
                      <span style={{
                        fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                        textTransform: 'uppercase', color: 'var(--ink-2)', flex: 1,
                      }}>
                        {item.section_title || 'Раздел'}
                      </span>
                      <Button
                        size="small"
                        type="link"
                        onClick={() => setSelected(prev => [...new Set([...prev, ...sectionIds(idx)])])}
                      >
                        весь раздел
                      </Button>
                    </div>
                  );
                }
                return (
                  <div
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
                      background: checked ? 'var(--accent-soft)' : 'transparent',
                    }}
                  >
                    <Checkbox checked={checked} onChange={() => toggle(item.id)} onClick={e => e.stopPropagation()} />
                    {item.type && (
                      <Chip tone={tdfTypeTone(item.type)} title={tdfTypeLabel(item.type)}>
                        {tdfTypeShort(item.type)}
                      </Chip>
                    )}
                    <span style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{item.name || '— без названия'}</span>
                    {item.drawing_image && <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>чертёж</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Space>
    </Modal>
  );
}
