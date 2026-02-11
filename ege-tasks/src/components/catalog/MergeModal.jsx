import { useState } from 'react';
import { Modal, Select, Space, App } from 'antd';
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import { api } from '../../services/pocketbase';

export default function MergeModal({ open, mergeType, mergeFrom, sourceRows, tasksSnapshot, onClose, onReload }) {
  const { topics, subtopics, tags, reloadData } = useReferenceData();
  const { message } = App.useApp();
  const [mergeTo, setMergeTo] = useState(null);

  const handleMerge = async () => {
    if (!mergeType || !mergeFrom || !mergeTo) return;

    try {
      if (mergeType === 'topic') {
        const related = tasksSnapshot.filter(t => t.topic === mergeFrom.id);
        for (const task of related) {
          await api.updateTask(task.id, { topic: mergeTo, subtopic: [] });
        }
        await api.deleteTopic(mergeFrom.id);
      }

      if (mergeType === 'subtopic') {
        const related = tasksSnapshot.filter(t => {
          if (Array.isArray(t.subtopic)) return t.subtopic.includes(mergeFrom.id);
          return t.subtopic === mergeFrom.id;
        });
        for (const task of related) {
          const current = Array.isArray(task.subtopic) ? task.subtopic : [];
          const next = Array.from(new Set(current.map(id => (id === mergeFrom.id ? mergeTo : id))));
          await api.updateTask(task.id, { subtopic: next });
        }
        await api.deleteSubtopic(mergeFrom.id);
      }

      if (mergeType === 'tag') {
        const related = tasksSnapshot.filter(t => {
          if (Array.isArray(t.tags)) return t.tags.includes(mergeFrom.id);
          return t.tags === mergeFrom.id;
        });
        for (const task of related) {
          const current = Array.isArray(task.tags) ? task.tags : [];
          const next = Array.from(new Set(current.map(id => (id === mergeFrom.id ? mergeTo : id))));
          await api.updateTask(task.id, { tags: next });
        }
        await api.deleteTag(mergeFrom.id);
      }

      if (mergeType === 'source') {
        const related = tasksSnapshot.filter(t => t.source === mergeFrom);
        for (const task of related) {
          await api.updateTask(task.id, { source: mergeTo });
        }
      }

      message.success('Объединение выполнено');
      setMergeTo(null);
      onClose();
      reloadData();
      onReload();
    } catch (error) {
      message.error('Ошибка при объединении');
    }
  };

  const getOptions = () => {
    if (mergeType === 'topic') {
      return topics.filter(t => t.id !== mergeFrom?.id).map(t => ({
        label: `№${t.ege_number} - ${t.title}`,
        value: t.id,
      }));
    }
    if (mergeType === 'subtopic') {
      return subtopics.filter(st => st.id !== mergeFrom?.id).map(st => ({
        label: st.name || st.title,
        value: st.id,
      }));
    }
    if (mergeType === 'tag') {
      return tags.filter(t => t.id !== mergeFrom?.id).map(t => ({
        label: t.title,
        value: t.id,
      }));
    }
    if (mergeType === 'source') {
      return (sourceRows || []).filter(s => s.source !== mergeFrom).map(s => ({
        label: s.source,
        value: s.source,
      }));
    }
    return [];
  };

  return (
    <Modal
      title="Объединение"
      open={open}
      onCancel={() => { setMergeTo(null); onClose(); }}
      onOk={handleMerge}
      okButtonProps={{ disabled: !mergeTo }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          Источник: <strong>{mergeFrom?.title || mergeFrom?.name || mergeFrom?.source || mergeFrom}</strong>
        </div>
        <Select
          placeholder="Выберите цель объединения"
          value={mergeTo}
          onChange={setMergeTo}
          options={getOptions()}
          showSearch
          optionFilterProp="label"
        />
        <div style={{ color: '#666' }}>
          Действие перенесёт все задачи на выбранную цель и удалит исходную сущность.
        </div>
      </Space>
    </Modal>
  );
}
