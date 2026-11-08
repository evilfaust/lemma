import { useState } from 'react';
import { Button, Radio, Segmented, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { BookOutlined, DeleteOutlined, PushpinFilled, PushpinOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { generatorsForTopic } from '../../utils/egeBaseGeneratedTasks';
import { TOPIC_SELECT } from '../shared/topicSelect';
import SuccessRateCell from './SuccessRateCell';
import './egeBaseStructure.css';

const { Text } = Typography;

/** Список можно фильтровать, но действия всегда адресованы исходному слоту. */
export default function EgeBaseStructureTable({ slots, topics, subtopics, canGenerate, loading, onUpdateSlot, onSetSlots, onPin, onUnpin, statsByTopic, prior }) {
  const [filter, setFilter] = useState('all');
  const rows = slots.map((slot, index) => {
    const topic = topics.find(t => t.id === slot.topicId);
    const allGenerators = generatorsForTopic(topic, subtopics);
    return {
      slot, index, topic, allGenerators,
      available: generatorsForTopic(topic, subtopics, slot.subtopics),
      topicSubs: subtopics.filter(s => s.topic === slot.topicId),
    };
  });
  const supportedCount = rows.filter(r => r.allGenerators.length).length;
  const generatedCount = slots.filter(s => s.source === 'generated' && !s.pinnedTask).length;
  const pinnedCount = slots.filter(s => s.pinnedTask).length;
  const bulkSource = source => onSetSlots(prev => prev.map(slot => {
    if (slot.pinnedTask) return slot;
    if (source === 'bank') return { ...slot, source, generatorId: null };
    const available = generatorsForTopic(topics.find(t => t.id === slot.topicId), subtopics, slot.subtopics);
    if (!available.length) return slot;
    return { ...slot, source, generatorId: available.find(g => g.id === slot.generatorId)?.id || available[0].id };
  }));
  const columns = [
    {
      title: 'Задание', key: 'topic', width: 285,
      render: (_, row) => (
        <div className="ege-base-topic">
          <span className="ege-base-topic-number">{row.topic?.ege_number ?? row.index + 1}</span>
          <div className="ege-base-topic-details">
            <Text strong>{row.topic?.title.replace(/^ЕГЭ[-\s]База[.\s]*№\d+\s*/, '') || 'Тема загружается'}</Text>
            {row.allGenerators.length > 0 && (
              <Tooltip title={`Доступно типов: ${row.allGenerators.length}. Генераторы покрывают часть прототипов темы. Поддерживаемые подтемы отмечены молнией.`}>
                <Tag color="cyan" icon={<ThunderboltOutlined />} className="ege-base-capability">Есть генератор</Tag>
              </Tooltip>
            )}
            <div className="ege-base-success"><span>Успеваемость</span><SuccessRateCell st={statsByTopic?.[row.slot.topicId]} prior={prior} /></div>
          </div>
        </div>
      ),
    },
    {
      title: 'Откуда взять задачу', key: 'source', width: 275,
      render: (_, row) => {
        const { slot, available, allGenerators, index } = row;
        if (slot.pinnedTask) return <Text type="secondary"><PushpinFilled /> Используется выбранная задача</Text>;
        if (!allGenerators.length) return <Text type="secondary"><BookOutlined /> Из банка задач</Text>;
        return (
          <div className="ege-base-source">
            <Radio.Group aria-label={`Источник №${row.topic.ege_number}`} size="small" value={slot.source || 'bank'} disabled={loading}
              onChange={e => onUpdateSlot(index, 'generatorId', e.target.value === 'bank' ? null : available[0]?.id)}>
              <Radio.Button value="bank">Из банка</Radio.Button>
              <Radio.Button value="generated" disabled={!canGenerate || !available.length}><ThunderboltOutlined /> Новая задача</Radio.Button>
            </Radio.Group>
            {slot.source === 'generated' ? (
              <Select
                aria-label={`Тип генерации №${row.topic.ege_number}`} value={slot.generatorId} disabled={loading || !canGenerate}
                showSearch optionFilterProp="label" size="small" style={{ width: '100%' }} popupMatchSelectWidth={420}
                onChange={value => onUpdateSlot(index, 'generatorId', value)}
                options={[...new Set(available.map(g => g.subtopic))].map(name => ({
                  label: name, options: available.filter(g => g.subtopic === name).map(g => ({ value: g.id, label: g.label })),
                }))}
              />
            ) : <Text type="secondary" className="ege-base-row-hint">Подбор по вашим фильтрам</Text>}
            {!available.length && <Text type="secondary" className="ege-base-row-hint">Для выбранных подтем — только банк</Text>}
            {!canGenerate && <Text type="secondary" className="ege-base-row-hint">Создание задач доступно редактору</Text>}
          </div>
        );
      },
    },
    {
      title: 'Подтема', key: 'subtopics', width: 220,
      render: (_, row) => row.topicSubs.length ? (
        <Select
          {...TOPIC_SELECT} aria-label={`Подтемы №${row.topic?.ege_number}`} mode="multiple" placeholder="Все подтемы"
          value={row.slot.subtopics} disabled={loading || !!row.slot.pinnedTask} size="small" style={{ width: '100%' }} maxTagCount={1}
          onChange={value => onUpdateSlot(row.index, 'subtopics', value)}
          options={row.topicSubs.map(s => ({ value: s.id, label: `${row.allGenerators.some(g => g.subtopicId === s.id) ? '⚡ ' : ''}${s.name}` }))}
        />
      ) : <Text type="secondary">Без подтем</Text>,
    },
    {
      title: 'Сложность', key: 'difficulty', width: 140,
      render: (_, row) => row.slot.source === 'generated' && !row.slot.pinnedTask
        ? <Tag color="blue">Как на экзамене</Tag>
        : <Select aria-label={`Сложность №${row.topic?.ege_number}`} mode="multiple" placeholder="Любая" value={row.slot.difficulty}
          disabled={loading || !!row.slot.pinnedTask} size="small" style={{ width: '100%' }} maxTagCount={1}
          onChange={value => onUpdateSlot(row.index, 'difficulty', value)}
          options={[{ value: 1, label: 'Лёгкая' }, { value: 2, label: 'Средняя' }, { value: 3, label: 'Сложная' }]} />,
    },
    {
      title: 'Конкретная задача', key: 'pin', width: 155,
      render: (_, row) => row.slot.pinnedTask ? (
        <Space size={2}>
          <Tag icon={<PushpinFilled />} color="gold">{row.slot.pinnedTask.code}</Tag>
          <Tooltip title="Вернуть подбор задачи"><Button aria-label={`Снять фиксацию №${row.topic?.ege_number}`} size="small" type="text" icon={<DeleteOutlined />}
            disabled={loading} onClick={() => onUnpin(row.index)} /></Tooltip>
        </Space>
      ) : <Button aria-label={`Выбрать задачу №${row.topic?.ege_number}`} size="small" icon={<PushpinOutlined />} disabled={loading} onClick={() => onPin(row.index)}>Выбрать</Button>,
    },
  ];
  return (
    <div className="ege-base-structure">
      <div className="ege-base-structure-toolbar">
        <Segmented aria-label="Показать задания" value={filter} disabled={loading} onChange={setFilter} options={[
          { value: 'all', label: `Все задания · ${slots.length}` },
          { value: 'generators', label: `С генерацией · ${supportedCount}`, icon: <ThunderboltOutlined /> },
        ]} />
        {canGenerate && <Space wrap>
          <Tooltip title="Включить создание новых задач в поддерживаемых подтемах. Зафиксированные задачи сохранятся.">
            <Button aria-label="Генерация где доступна" size="small" icon={<ThunderboltOutlined />} disabled={loading || !rows.some(r => !r.slot.pinnedTask && r.available.length)} onClick={() => bulkSource('generated')}>Генерация где доступна</Button>
          </Tooltip>
          <Button size="small" disabled={loading || !generatedCount} onClick={() => bulkSource('bank')}>Всё из банка</Button>
        </Space>}
      </div>
      <div className="ege-base-structure-summary" aria-live="polite">
        <span><BookOutlined /> Из банка: <strong>{slots.length - generatedCount - pinnedCount}</strong></span>
        <span><ThunderboltOutlined /> Новых задач: <strong>{generatedCount}</strong></span>
        <span><PushpinOutlined /> Зафиксировано: <strong>{pinnedCount}</strong></span>
        <Text type="secondary">в каждом варианте</Text>
      </div>
      <Table dataSource={filter === 'generators' ? rows.filter(r => r.allGenerators.length) : rows} columns={columns} loading={loading}
        pagination={false} size="middle" rowKey={row => row.slot.topicId} scroll={{ x: 1075 }}
        rowClassName={row => row.slot.pinnedTask ? 'ege-base-row-pinned' : row.slot.source === 'generated' ? 'ege-base-row-generated' : ''}
        locale={{ emptyText: filter === 'generators' ? 'Для этих тем пока нет генераторов' : 'Темы ещё загружаются' }} />
      <p className="ege-base-structure-note"><ThunderboltOutlined /> Метка показывает доступность генерации, а не выбранный источник. Новые задачи сохранятся в банк при сборке варианта.</p>
    </div>
  );
}
