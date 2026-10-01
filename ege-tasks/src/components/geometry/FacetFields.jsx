import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Select, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { BulbOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import { FACET_KINDS, FACET_LABELS, suggestFacets } from '../../utils/geometryFacets';

const { Text } = Typography;

const PLACEHOLDERS = { object: 'Объект (фигура)', method: 'Метод (приём)', fact: 'Факт (теорема)' };
export const FACET_COLORS = { object: 'blue', method: 'purple', fact: 'cyan' };

/** Справочник фасетов id → { id, kind, name } из сгруппированного getGeometryTags(). */
export function useTagById(geoTags) {
  return useMemo(() => {
    const m = new Map();
    for (const [kind, arr] of Object.entries(geoTags || {})) for (const t of arr || []) m.set(t.id, { ...t, kind });
    return m;
  }, [geoTags]);
}

/**
 * Три мультиселекта фасетов. value/onChange — { object: [id], method: [id], fact: [id] }
 * (без формы) или по отдельности через Form.Item name="facetsObject" и т.п.
 */
export function FacetSelect({ kind, geoTags, value, onChange, size, placeholder }) {
  return (
    <Select
      mode="multiple"
      size={size}
      allowClear
      showSearch
      maxTagCount="responsive"
      optionFilterProp="label"
      placeholder={placeholder || PLACEHOLDERS[kind]}
      style={{ width: '100%' }}
      value={value || []}
      onChange={onChange}
      options={(geoTags?.[kind] || []).map((t) => ({ value: t.id, label: t.name, title: t.name }))}
    />
  );
}

export function FacetSelects({ geoTags, value, onChange, size }) {
  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      {FACET_KINDS.map((kind) => (
        <FacetSelect
          key={kind}
          kind={kind}
          size={size}
          geoTags={geoTags}
          value={value?.[kind]}
          onChange={(v) => onChange({ ...value, [kind]: v })}
        />
      ))}
    </Space>
  );
}

/**
 * Подсказка фасетов по похожим задачам МЦНМО. Клик по чипу — добавить фасет
 * (onAdd(kind, id)); «Добавить отмеченные» — все уверенные разом.
 * @param {string} taskId — задача в векторном индексе
 * @param {string[]} have — фасеты, которые уже стоят
 * @param {boolean} [autoLoad] — грузить сразу (иначе по кнопке)
 */
export function FacetSuggestions({ taskId, tagById, have = [], onAdd, autoLoad = false }) {
  const [state, setState] = useState({ loading: false, error: null, neighbors: null });

  const load = async () => {
    setState({ loading: true, error: null, neighbors: null });
    try {
      const neighbors = await api.getGeometryFacetNeighbors(taskId);
      setState({ loading: false, error: null, neighbors });
    } catch (e) {
      setState({ loading: false, error: e.name === 'TimeoutError' ? 'Сервис поиска не ответил' : e.message, neighbors: null });
    }
  };

  useEffect(() => {
    setState({ loading: false, error: null, neighbors: null });
    if (autoLoad && taskId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, autoLoad]);

  const haveKey = have.join(',');
  const suggestions = useMemo(
    () => (state.neighbors ? suggestFacets(state.neighbors, tagById, { have }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.neighbors, tagById, haveKey],
  );

  if (!taskId) {
    return <Text type="secondary" style={{ fontSize: 12 }}>Подсказка появится после сохранения задачи (и переиндексации).</Text>;
  }
  if (!suggestions && !state.loading && !state.error) {
    return (
      <Button size="small" icon={<BulbOutlined />} onClick={load}>
        Подсказать по похожим задачам МЦНМО
      </Button>
    );
  }
  if (state.loading) return <Spin size="small" />;
  if (state.error) {
    return (
      <Alert
        type="warning"
        showIcon
        message={state.error}
        action={<Button size="small" icon={<ReloadOutlined />} onClick={load}>ещё раз</Button>}
      />
    );
  }

  const confident = FACET_KINDS.flatMap((k) => suggestions[k].filter((x) => x.preselect));
  const empty = FACET_KINDS.every((k) => !suggestions[k].length);

  return (
    <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 12 }}>
          <BulbOutlined /> По {state.neighbors.length} похожим задачам МЦНМО
          {empty ? ' — новых фасетов не нашлось' : ' (клик — добавить):'}
        </Text>
        {confident.length > 0 && (
          <Button size="small" type="primary" ghost onClick={() => confident.forEach((x) => onAdd(x.kind, x.id))}>
            Добавить уверенные ({confident.length})
          </Button>
        )}
      </div>
      {FACET_KINDS.map((kind) => (suggestions[kind].length ? (
        <div key={kind} style={{ display: 'flex', gap: 4, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12, width: 56, flexShrink: 0 }}>{FACET_LABELS[kind]}</Text>
          {suggestions[kind].map((x) => (
            <Tooltip key={x.id} title={`у ${x.votes} из ${state.neighbors.length} похожих`}>
              <Tag
                color={x.preselect ? FACET_COLORS[kind] : undefined}
                style={{ cursor: 'pointer', margin: 0, whiteSpace: 'normal' }}
                onClick={() => onAdd(kind, x.id)}
              >
                + {x.name} <Text type="secondary" style={{ fontSize: 10 }}>{x.votes}</Text>
              </Tag>
            </Tooltip>
          ))}
        </div>
      ) : null))}
    </div>
  );
}
