import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Tabs,
  Table,
  Space,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  Spin,
  message,
  Tooltip,
  Divider,
  Collapse,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  SwapOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';

const { TabPane } = Tabs;

const TaskCatalogManager = ({
  onOpenTasks,
}) => {
  const { topics, subtopics, tags, sources, years, reloadData } = useReferenceData();
  const [loading, setLoading] = useState(true);
  const [tasksSnapshot, setTasksSnapshot] = useState([]);

  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [subtopicModalOpen, setSubtopicModalOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);

  const [editingTopic, setEditingTopic] = useState(null);
  const [editingSubtopic, setEditingSubtopic] = useState(null);
  const [editingTag, setEditingTag] = useState(null);

  const [mergeType, setMergeType] = useState(null); // topic | subtopic | tag | source
  const [mergeFrom, setMergeFrom] = useState(null);
  const [mergeTo, setMergeTo] = useState(null);

  const [sourceRenameModalOpen, setSourceRenameModalOpen] = useState(false);
  const [sourceRenameFrom, setSourceRenameFrom] = useState(null);
  const [sourceRenameTo, setSourceRenameTo] = useState('');

  const [topicForm] = Form.useForm();
  const [subtopicForm] = Form.useForm();
  const [tagForm] = Form.useForm();

  const loadSnapshot = async () => {
    setLoading(true);
    try {
      const data = await api.getTasksStatsSnapshot();
      setTasksSnapshot(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshot();
  }, []);

  const stats = useMemo(() => {
    const byTopic = new Map();
    const bySubtopic = new Map();
    const byTag = new Map();
    const bySource = new Map();
    const byDifficulty = new Map();
    const byYear = new Map();
    const hasAnswer = tasksSnapshot.filter(t => (t.answer || '').toString().trim().length > 0).length;
    const hasSolution = tasksSnapshot.filter(t => (t.solution_md || '').toString().trim().length > 0).length;
    const hasImage = tasksSnapshot.filter(t => !!t.has_image).length;

    tasksSnapshot.forEach(task => {
      if (task.topic) byTopic.set(task.topic, (byTopic.get(task.topic) || 0) + 1);

      if (Array.isArray(task.subtopic)) {
        task.subtopic.forEach(stId => {
          if (stId) bySubtopic.set(stId, (bySubtopic.get(stId) || 0) + 1);
        });
      } else if (typeof task.subtopic === 'string' && task.subtopic.length > 0) {
        bySubtopic.set(task.subtopic, (bySubtopic.get(task.subtopic) || 0) + 1);
      }

      if (Array.isArray(task.tags)) {
        task.tags.forEach(tagId => {
          if (tagId) byTag.set(tagId, (byTag.get(tagId) || 0) + 1);
        });
      } else if (typeof task.tags === 'string' && task.tags.length > 0) {
        byTag.set(task.tags, (byTag.get(task.tags) || 0) + 1);
      }

      if (task.source) bySource.set(task.source, (bySource.get(task.source) || 0) + 1);

      const diff = task.difficulty === undefined || task.difficulty === null || task.difficulty === ''
        ? '1'
        : String(task.difficulty);
      byDifficulty.set(diff, (byDifficulty.get(diff) || 0) + 1);

      if (task.year) byYear.set(task.year, (byYear.get(task.year) || 0) + 1);
    });

    return {
      byTopic,
      bySubtopic,
      byTag,
      bySource,
      byDifficulty,
      byYear,
      hasAnswer,
      hasSolution,
      hasImage,
    };
  }, [tasksSnapshot]);

  const topicRows = useMemo(() => topics.map(t => ({
    key: t.id,
    title: t.title,
    ege: t.ege_number,
    order: t.order,
    count: stats.byTopic.get(t.id) || 0,
    raw: t,
  })).sort((a, b) => b.count - a.count), [topics, stats.byTopic]);

  const subtopicRows = useMemo(() => subtopics.map(st => {
    const topic = topics.find(t => t.id === st.topic);
    return {
      key: st.id,
      title: st.name || st.title,
      topicTitle: topic ? `№${topic.ege_number} ${topic.title}` : '',
      topicId: st.topic,
      order: st.order,
      count: stats.bySubtopic.get(st.id) || 0,
      raw: st,
    };
  }).sort((a, b) => b.count - a.count), [subtopics, topics, stats.bySubtopic]);

  const tagRows = useMemo(() => tags.map(t => ({
    key: t.id,
    title: t.title,
    color: t.color,
    count: stats.byTag.get(t.id) || 0,
    raw: t,
  })).sort((a, b) => b.count - a.count), [tags, stats.byTag]);

  const sourceRows = useMemo(() => {
    const unique = new Map();
    sources.forEach(s => unique.set(s, stats.bySource.get(s) || 0));
    stats.bySource.forEach((count, source) => {
      if (!unique.has(source)) unique.set(source, count);
    });
    return Array.from(unique.entries())
      .map(([source, count]) => ({ key: source, source, count }))
      .sort((a, b) => b.count - a.count);
  }, [sources, stats.bySource]);

  const difficultyRows = useMemo(() => ['1', '2', '3', '4', '5'].map(d => ({
    key: d,
    difficulty: d,
    count: stats.byDifficulty.get(d) || 0,
  })), [stats.byDifficulty]);

  const yearRows = useMemo(() => {
    const yearsList = years.length > 0 ? years : Array.from(stats.byYear.keys()).sort((a, b) => b - a);
    return yearsList.map(y => ({ key: y, year: y, count: stats.byYear.get(y) || 0 }))
      .sort((a, b) => b.count - a.count);
  }, [years, stats.byYear]);

  const normalizeLabel = (value) => {
    if (!value) return '';
    return value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\\s+/g, ' ')
      .replace(/\\s+/g, ' ');
  };

  const normalizeStatementStrict = (value) => {
    if (!value) return '';
    return value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\\s+/g, ' ')
      .replace(/\\s+/g, ' ');
  };

  const normalizeStatementLoose = (value) => {
    if (!value) return '';
    return value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\\s+/g, '')
      .replace(/[\\.,:;!?'"`~()\\[\\]{}<>—–-]/g, '')
      .replace(/\\$/g, '')
      .replace(/\\\\/g, '');
  };

  const duplicateGroups = useMemo(() => {
    const groupBy = (items, getLabel) => {
      const map = new Map();
      items.forEach(item => {
        const key = normalizeLabel(getLabel(item));
        if (!key) return;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
      });
      return Array.from(map.entries())
        .filter(([, list]) => list.length > 1)
        .map(([key, list]) => ({ key, items: list }));
    };

    const topicsDup = groupBy(topics, t => t.title);
    const subtopicsDup = groupBy(subtopics, st => st.name || st.title);
    const tagsDup = groupBy(tags, t => t.title);
    const sourcesDup = groupBy(sourceRows, s => s.source);

    const tasksWithStatement = tasksSnapshot.filter(t => (t.statement_md || '').trim().length > 0);
    const strictMap = new Map();
    const looseMap = new Map();

    tasksWithStatement.forEach(task => {
      const strictKey = normalizeStatementStrict(task.statement_md);
      const looseKey = normalizeStatementLoose(task.statement_md);
      if (strictKey) {
        if (!strictMap.has(strictKey)) strictMap.set(strictKey, []);
        strictMap.get(strictKey).push(task);
      }
      if (looseKey) {
        if (!looseMap.has(looseKey)) looseMap.set(looseKey, []);
        looseMap.get(looseKey).push(task);
      }
    });

    const strictTasks = Array.from(strictMap.entries())
      .filter(([, list]) => list.length > 1)
      .map(([key, list]) => ({ key, items: list }));

    const looseTasks = Array.from(looseMap.entries())
      .filter(([, list]) => list.length > 1)
      .map(([key, list]) => ({ key, items: list }));

    return { topicsDup, subtopicsDup, tagsDup, sourcesDup, strictTasks, looseTasks };
  }, [topics, subtopics, tags, sourceRows, tasksSnapshot]);

  const handleOpenTasks = (filters) => {
    onOpenTasks?.(filters);
  };

  const openTopicModal = (topic = null) => {
    setEditingTopic(topic);
    setTopicModalOpen(true);
    topicForm.setFieldsValue({
      title: topic?.title || '',
      ege_number: topic?.ege_number || null,
      order: topic?.order || null,
      description: topic?.description || '',
    });
  };

  const openSubtopicModal = (subtopic = null) => {
    setEditingSubtopic(subtopic);
    setSubtopicModalOpen(true);
    subtopicForm.setFieldsValue({
      name: subtopic?.name || subtopic?.title || '',
      topic: subtopic?.topic || null,
      order: subtopic?.order || null,
    });
  };

  const openTagModal = (tag = null) => {
    setEditingTag(tag);
    setTagModalOpen(true);
    tagForm.setFieldsValue({
      title: tag?.title || '',
      color: tag?.color || '#1890ff',
    });
  };

  const saveTopic = async (values) => {
    try {
      if (editingTopic) {
        await api.updateTopic(editingTopic.id, values);
        message.success('Тема обновлена');
      } else {
        await api.createTopic(values);
        message.success('Тема создана');
      }
      setTopicModalOpen(false);
      setEditingTopic(null);
      reloadData();
    } catch (error) {
      message.error('Ошибка при сохранении темы');
    }
  };

  const saveSubtopic = async (values) => {
    try {
      if (editingSubtopic) {
        await api.updateSubtopic(editingSubtopic.id, values);
        message.success('Подтема обновлена');
      } else {
        await api.createSubtopic(values);
        message.success('Подтема создана');
      }
      setSubtopicModalOpen(false);
      setEditingSubtopic(null);
      reloadData();
    } catch (error) {
      message.error('Ошибка при сохранении подтемы');
    }
  };

  const saveTag = async (values) => {
    try {
      if (editingTag) {
        await api.updateTag(editingTag.id, values);
        message.success('Тег обновлён');
      } else {
        await api.createTag(values);
        message.success('Тег создан');
      }
      setTagModalOpen(false);
      setEditingTag(null);
      reloadData();
    } catch (error) {
      message.error('Ошибка при сохранении тега');
    }
  };

  const removeTopic = (topic) => {
    Modal.confirm({
      title: 'Удалить тему?',
      content: `Тема "${topic.title}" будет удалена. Связанные задачи останутся, но без темы.`,
      okType: 'danger',
      onOk: async () => {
        try {
          const relatedTasks = tasksSnapshot.filter(t => t.topic === topic.id);
          for (const task of relatedTasks) {
            await api.updateTask(task.id, { topic: null, subtopic: [] });
          }
          await api.deleteTopic(topic.id);
          message.success('Тема удалена');
          reloadData();
          loadSnapshot();
        } catch (error) {
          message.error('Ошибка при удалении темы');
        }
      },
    });
  };

  const removeSubtopic = (subtopic) => {
    Modal.confirm({
      title: 'Удалить подтему?',
      content: `Подтема "${subtopic.name || subtopic.title}" будет удалена. Задачи потеряют эту связь.`,
      okType: 'danger',
      onOk: async () => {
        try {
          const relatedTasks = tasksSnapshot.filter(t => {
            if (Array.isArray(t.subtopic)) return t.subtopic.includes(subtopic.id);
            return t.subtopic === subtopic.id;
          });
          for (const task of relatedTasks) {
            const next = Array.isArray(task.subtopic) ? task.subtopic.filter(id => id !== subtopic.id) : [];
            await api.updateTask(task.id, { subtopic: next });
          }
          await api.deleteSubtopic(subtopic.id);
          message.success('Подтема удалена');
          reloadData();
          loadSnapshot();
        } catch (error) {
          message.error('Ошибка при удалении подтемы');
        }
      },
    });
  };

  const removeTag = (tag) => {
    Modal.confirm({
      title: 'Удалить тег?',
      content: `Тег "${tag.title}" будет удалён. Задачи потеряют этот тег.`,
      okType: 'danger',
      onOk: async () => {
        try {
          const relatedTasks = tasksSnapshot.filter(t => {
            if (Array.isArray(t.tags)) return t.tags.includes(tag.id);
            return t.tags === tag.id;
          });
          for (const task of relatedTasks) {
            const next = Array.isArray(task.tags) ? task.tags.filter(id => id !== tag.id) : [];
            await api.updateTask(task.id, { tags: next });
          }
          await api.deleteTag(tag.id);
          message.success('Тег удалён');
          reloadData();
          loadSnapshot();
        } catch (error) {
          message.error('Ошибка при удалении тега');
        }
      },
    });
  };

  const openMergeModal = (type, from) => {
    setMergeType(type);
    setMergeFrom(from);
    setMergeTo(null);
    setMergeModalOpen(true);
  };

  const handleMerge = async () => {
    if (!mergeType || !mergeFrom || !mergeTo) return;

    try {
      if (mergeType === 'topic') {
        const relatedTasks = tasksSnapshot.filter(t => t.topic === mergeFrom.id);
        for (const task of relatedTasks) {
          await api.updateTask(task.id, { topic: mergeTo, subtopic: [] });
        }
        await api.deleteTopic(mergeFrom.id);
      }

      if (mergeType === 'subtopic') {
        const relatedTasks = tasksSnapshot.filter(t => {
          if (Array.isArray(t.subtopic)) return t.subtopic.includes(mergeFrom.id);
          return t.subtopic === mergeFrom.id;
        });
        for (const task of relatedTasks) {
          const current = Array.isArray(task.subtopic) ? task.subtopic : [];
          const next = Array.from(new Set(current.map(id => (id === mergeFrom.id ? mergeTo : id))));
          await api.updateTask(task.id, { subtopic: next });
        }
        await api.deleteSubtopic(mergeFrom.id);
      }

      if (mergeType === 'tag') {
        const relatedTasks = tasksSnapshot.filter(t => {
          if (Array.isArray(t.tags)) return t.tags.includes(mergeFrom.id);
          return t.tags === mergeFrom.id;
        });
        for (const task of relatedTasks) {
          const current = Array.isArray(task.tags) ? task.tags : [];
          const next = Array.from(new Set(current.map(id => (id === mergeFrom.id ? mergeTo : id))));
          await api.updateTask(task.id, { tags: next });
        }
        await api.deleteTag(mergeFrom.id);
      }

      if (mergeType === 'source') {
        const relatedTasks = tasksSnapshot.filter(t => t.source === mergeFrom);
        for (const task of relatedTasks) {
          await api.updateTask(task.id, { source: mergeTo });
        }
      }

      message.success('Объединение выполнено');
      setMergeModalOpen(false);
      setMergeType(null);
      setMergeFrom(null);
      setMergeTo(null);
      reloadData();
      loadSnapshot();
    } catch (error) {
      message.error('Ошибка при объединении');
    }
  };

  const openSourceRename = (source) => {
    setSourceRenameFrom(source);
    setSourceRenameTo(source || '');
    setSourceRenameModalOpen(true);
  };

  const applySourceRename = async () => {
    if (!sourceRenameFrom || !sourceRenameTo) return;
    try {
      const relatedTasks = tasksSnapshot.filter(t => t.source === sourceRenameFrom);
      for (const task of relatedTasks) {
        await api.updateTask(task.id, { source: sourceRenameTo });
      }
      message.success('Источник обновлён');
      setSourceRenameModalOpen(false);
      setSourceRenameFrom(null);
      setSourceRenameTo('');
      loadSnapshot();
      reloadData();
    } catch (error) {
      message.error('Ошибка при обновлении источника');
    }
  };

  const clearSource = (source) => {
    Modal.confirm({
      title: 'Удалить источник?',
      content: `У источника "${source}" будет очищено поле у связанных задач.`,
      okType: 'danger',
      onOk: async () => {
        try {
          const relatedTasks = tasksSnapshot.filter(t => t.source === source);
          for (const task of relatedTasks) {
            await api.updateTask(task.id, { source: null });
          }
          message.success('Источник удалён');
          loadSnapshot();
          reloadData();
        } catch (error) {
          message.error('Ошибка при удалении источника');
        }
      },
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={loadSnapshot}>Обновить статистику</Button>
        <Button onClick={reloadData}>Обновить справочники</Button>
      </Space>

      <Tabs defaultActiveKey="topics">
        <TabPane tab="Темы" key="topics">
          <Card
            title="Темы"
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openTopicModal()}>Добавить тему</Button>}
          >
            <Table
              size="small"
              dataSource={topicRows}
              pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
              columns={[
                { title: '№', dataIndex: 'ege', width: 60, sorter: (a, b) => (a.ege || 0) - (b.ege || 0) },
                { title: 'Тема', dataIndex: 'title', sorter: (a, b) => (a.title || '').localeCompare(b.title || '') },
                { title: 'Порядок', dataIndex: 'order', width: 90, sorter: (a, b) => (a.order || 0) - (b.order || 0) },
                { title: 'Кол-во', dataIndex: 'count', width: 90, sorter: (a, b) => a.count - b.count },
                {
                  title: 'Действия',
                  width: 260,
                  render: (_, record) => (
                    <Space>
                      <Tooltip title="Открыть задачи">
                        <Button
                          size="small"
                          icon={<FolderOpenOutlined />}
                          onClick={() => handleOpenTasks({ topic: record.key })}
                        />
                      </Tooltip>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openTopicModal(record.raw)} />
                      <Button size="small" icon={<SwapOutlined />} onClick={() => openMergeModal('topic', record.raw)} />
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeTopic(record.raw)} />
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </TabPane>

        <TabPane tab="Подтемы" key="subtopics">
          <Card
            title="Подтемы"
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openSubtopicModal()}>Добавить подтему</Button>}
          >
            <Table
              size="small"
              dataSource={subtopicRows}
              pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
              columns={[
                { title: 'Подтема', dataIndex: 'title', sorter: (a, b) => (a.title || '').localeCompare(b.title || '') },
                { title: 'Тема', dataIndex: 'topicTitle', sorter: (a, b) => (a.topicTitle || '').localeCompare(b.topicTitle || '') },
                { title: 'Порядок', dataIndex: 'order', width: 90, sorter: (a, b) => (a.order || 0) - (b.order || 0) },
                { title: 'Кол-во', dataIndex: 'count', width: 90, sorter: (a, b) => a.count - b.count },
                {
                  title: 'Действия',
                  width: 260,
                  render: (_, record) => (
                    <Space>
                      <Tooltip title="Открыть задачи">
                        <Button
                          size="small"
                          icon={<FolderOpenOutlined />}
                          onClick={() => handleOpenTasks({ subtopic: record.key, topic: record.topicId })}
                        />
                      </Tooltip>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openSubtopicModal(record.raw)} />
                      <Button size="small" icon={<SwapOutlined />} onClick={() => openMergeModal('subtopic', record.raw)} />
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeSubtopic(record.raw)} />
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </TabPane>

        <TabPane tab="Теги" key="tags">
          <Card
            title="Теги"
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openTagModal()}>Добавить тег</Button>}
          >
            <Table
              size="small"
              dataSource={tagRows}
              pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
              columns={[
                {
                  title: 'Тег',
                  dataIndex: 'title',
                  sorter: (a, b) => (a.title || '').localeCompare(b.title || ''),
                  render: (value, record) => <Tag color={record.color}>{value}</Tag>,
                },
                { title: 'Кол-во', dataIndex: 'count', width: 90, sorter: (a, b) => a.count - b.count },
                {
                  title: 'Действия',
                  width: 260,
                  render: (_, record) => (
                    <Space>
                      <Tooltip title="Открыть задачи">
                        <Button
                          size="small"
                          icon={<FolderOpenOutlined />}
                          onClick={() => handleOpenTasks({ tags: [record.key] })}
                        />
                      </Tooltip>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openTagModal(record.raw)} />
                      <Button size="small" icon={<SwapOutlined />} onClick={() => openMergeModal('tag', record.raw)} />
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeTag(record.raw)} />
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </TabPane>

        <TabPane tab="Источники" key="sources">
          <Card title="Источники">
            <Table
              size="small"
              dataSource={sourceRows}
              pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
              columns={[
                { title: 'Источник', dataIndex: 'source', sorter: (a, b) => (a.source || '').localeCompare(b.source || '') },
                { title: 'Кол-во', dataIndex: 'count', width: 90, sorter: (a, b) => a.count - b.count },
                {
                  title: 'Действия',
                  width: 260,
                  render: (_, record) => (
                    <Space>
                      <Tooltip title="Открыть задачи">
                        <Button
                          size="small"
                          icon={<FolderOpenOutlined />}
                          onClick={() => handleOpenTasks({ source: record.source })}
                        />
                      </Tooltip>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openSourceRename(record.source)} />
                      <Button size="small" icon={<SwapOutlined />} onClick={() => openMergeModal('source', record.source)} />
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => clearSource(record.source)} />
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </TabPane>

        <TabPane tab="Прочее" key="other">
          <Card title="Сложность" style={{ marginBottom: 16 }}>
            <Table
              size="small"
              dataSource={difficultyRows}
              pagination={false}
              columns={[
                { title: 'Сложность', dataIndex: 'difficulty', width: 120, sorter: (a, b) => Number(a.difficulty) - Number(b.difficulty) },
                { title: 'Кол-во', dataIndex: 'count', width: 120, sorter: (a, b) => a.count - b.count },
                {
                  title: 'Действия',
                  render: (_, record) => (
                    <Button
                      size="small"
                      icon={<FolderOpenOutlined />}
                      onClick={() => handleOpenTasks({ difficulty: record.difficulty })}
                    />
                  ),
                },
              ]}
            />
          </Card>

          <Card title="Годы" style={{ marginBottom: 16 }}>
            <Table
              size="small"
              dataSource={yearRows}
              pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
              columns={[
                { title: 'Год', dataIndex: 'year', width: 120, sorter: (a, b) => Number(a.year) - Number(b.year) },
                { title: 'Кол-во', dataIndex: 'count', width: 120, sorter: (a, b) => a.count - b.count },
                {
                  title: 'Действия',
                  render: (_, record) => (
                    <Button
                      size="small"
                      icon={<FolderOpenOutlined />}
                      onClick={() => handleOpenTasks({ year: record.year })}
                    />
                  ),
                },
              ]}
            />
          </Card>

          <Card title="Признаки">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Divider style={{ margin: 0 }} />
              <Space>
                <span>С ответом: {stats.hasAnswer}</span>
                <Button size="small" onClick={() => handleOpenTasks({ hasAnswer: true })}>Открыть</Button>
              </Space>
              <Divider style={{ margin: 0 }} />
              <Space>
                <span>С решением: {stats.hasSolution}</span>
                <Button size="small" onClick={() => handleOpenTasks({ hasSolution: true })}>Открыть</Button>
              </Space>
              <Divider style={{ margin: 0 }} />
              <Space>
                <span>С изображением: {stats.hasImage}</span>
                <Button size="small" onClick={() => handleOpenTasks({ hasImage: true })}>Открыть</Button>
              </Space>
            </Space>
          </Card>
        </TabPane>

        <TabPane tab="Дубли" key="duplicates">
          <Card title="Дубли по названиям" style={{ marginBottom: 16 }}>
            <Collapse
              items={[
                {
                  key: 'dup-topics',
                  label: `Темы (${duplicateGroups.topicsDup.length})`,
                  children: duplicateGroups.topicsDup.length === 0 ? (
                    <div style={{ color: '#999' }}>Дубли не найдены</div>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {duplicateGroups.topicsDup.map(group => (
                        <Card key={group.key} size="small" title={`"${group.key}" (${group.items.length})`}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {group.items.map(item => (
                              <Space key={item.id} wrap>
                                <Tag color="blue">{item.title}</Tag>
                                <Button size="small" icon={<FolderOpenOutlined />} onClick={() => handleOpenTasks({ topic: item.id })}>
                                  Открыть
                                </Button>
                                <Button size="small" icon={<SwapOutlined />} onClick={() => openMergeModal('topic', item)}>
                                  Объединить
                                </Button>
                              </Space>
                            ))}
                          </Space>
                        </Card>
                      ))}
                    </Space>
                  ),
                },
                {
                  key: 'dup-subtopics',
                  label: `Подтемы (${duplicateGroups.subtopicsDup.length})`,
                  children: duplicateGroups.subtopicsDup.length === 0 ? (
                    <div style={{ color: '#999' }}>Дубли не найдены</div>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {duplicateGroups.subtopicsDup.map(group => (
                        <Card key={group.key} size="small" title={`"${group.key}" (${group.items.length})`}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {group.items.map(item => (
                              <Space key={item.id} wrap>
                                <Tag color="purple">{item.name || item.title}</Tag>
                                <Button size="small" icon={<FolderOpenOutlined />} onClick={() => handleOpenTasks({ subtopic: item.id, topic: item.topic })}>
                                  Открыть
                                </Button>
                                <Button size="small" icon={<SwapOutlined />} onClick={() => openMergeModal('subtopic', item)}>
                                  Объединить
                                </Button>
                              </Space>
                            ))}
                          </Space>
                        </Card>
                      ))}
                    </Space>
                  ),
                },
                {
                  key: 'dup-tags',
                  label: `Теги (${duplicateGroups.tagsDup.length})`,
                  children: duplicateGroups.tagsDup.length === 0 ? (
                    <div style={{ color: '#999' }}>Дубли не найдены</div>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {duplicateGroups.tagsDup.map(group => (
                        <Card key={group.key} size="small" title={`"${group.key}" (${group.items.length})`}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {group.items.map(item => (
                              <Space key={item.id} wrap>
                                <Tag color={item.color}>{item.title}</Tag>
                                <Button size="small" icon={<FolderOpenOutlined />} onClick={() => handleOpenTasks({ tags: [item.id] })}>
                                  Открыть
                                </Button>
                                <Button size="small" icon={<SwapOutlined />} onClick={() => openMergeModal('tag', item)}>
                                  Объединить
                                </Button>
                              </Space>
                            ))}
                          </Space>
                        </Card>
                      ))}
                    </Space>
                  ),
                },
                {
                  key: 'dup-sources',
                  label: `Источники (${duplicateGroups.sourcesDup.length})`,
                  children: duplicateGroups.sourcesDup.length === 0 ? (
                    <div style={{ color: '#999' }}>Дубли не найдены</div>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {duplicateGroups.sourcesDup.map(group => (
                        <Card key={group.key} size="small" title={`"${group.key}" (${group.items.length})`}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {group.items.map(item => (
                              <Space key={item.key} wrap>
                                <Tag>{item.source}</Tag>
                                <Button size="small" icon={<FolderOpenOutlined />} onClick={() => handleOpenTasks({ source: item.source })}>
                                  Открыть
                                </Button>
                                <Button size="small" icon={<SwapOutlined />} onClick={() => openMergeModal('source', item.source)}>
                                  Объединить
                                </Button>
                              </Space>
                            ))}
                          </Space>
                        </Card>
                      ))}
                    </Space>
                  ),
                },
              ]}
              defaultActiveKey={[]}
            />
          </Card>

          <Card title="Дубли задач" style={{ marginBottom: 16 }}>
            <Collapse
              items={[
                {
                  key: 'dup-tasks-strict',
                  label: `Точные совпадения (${duplicateGroups.strictTasks.length})`,
                  children: duplicateGroups.strictTasks.length === 0 ? (
                    <div style={{ color: '#999' }}>Дубли не найдены</div>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {duplicateGroups.strictTasks.map(group => (
                        <Card key={group.key} size="small" title={`Совпадение (${group.items.length})`}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {group.items.map(task => (
                              <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <span>{task.code}</span>
                                <Button
                                  size="small"
                                  icon={<FolderOpenOutlined />}
                                  onClick={() => handleOpenTasks({ search: (task.statement_md || '').slice(0, 40) })}
                                >
                                  Открыть
                                </Button>
                              </div>
                            ))}
                          </Space>
                        </Card>
                      ))}
                    </Space>
                  ),
                },
                {
                  key: 'dup-tasks-loose',
                  label: `Похожие (агрессивная нормализация) (${duplicateGroups.looseTasks.length})`,
                  children: duplicateGroups.looseTasks.length === 0 ? (
                    <div style={{ color: '#999' }}>Дубли не найдены</div>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {duplicateGroups.looseTasks.map(group => (
                        <Card key={group.key} size="small" title={`Похожие (${group.items.length})`}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {group.items.map(task => (
                              <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <span>{task.code}</span>
                                <Button
                                  size="small"
                                  icon={<FolderOpenOutlined />}
                                  onClick={() => handleOpenTasks({ search: (task.statement_md || '').slice(0, 40) })}
                                >
                                  Открыть
                                </Button>
                              </div>
                            ))}
                          </Space>
                        </Card>
                      ))}
                    </Space>
                  ),
                },
              ]}
              defaultActiveKey={[]}
            />
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title={editingTopic ? 'Редактировать тему' : 'Создать тему'}
        open={topicModalOpen}
        onCancel={() => setTopicModalOpen(false)}
        onOk={() => topicForm.submit()}
      >
        <Form form={topicForm} layout="vertical" onFinish={saveTopic}>
          <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="ege_number" label="Номер ЕГЭ">
            <InputNumber min={1} max={27} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="order" label="Порядок">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingSubtopic ? 'Редактировать подтему' : 'Создать подтему'}
        open={subtopicModalOpen}
        onCancel={() => setSubtopicModalOpen(false)}
        onOk={() => subtopicForm.submit()}
      >
        <Form form={subtopicForm} layout="vertical" onFinish={saveSubtopic}>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="topic" label="Тема" rules={[{ required: true, message: 'Выберите тему' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={topics.map(t => ({
                label: `№${t.ege_number} - ${t.title}`,
                value: t.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="order" label="Порядок">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingTag ? 'Редактировать тег' : 'Создать тег'}
        open={tagModalOpen}
        onCancel={() => setTagModalOpen(false)}
        onOk={() => tagForm.submit()}
      >
        <Form form={tagForm} layout="vertical" onFinish={saveTag}>
          <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="color" label="Цвет">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Объединение"
        open={mergeModalOpen}
        onCancel={() => setMergeModalOpen(false)}
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
            options={(() => {
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
                return sourceRows.filter(s => s.source !== mergeFrom).map(s => ({
                  label: s.source,
                  value: s.source,
                }));
              }
              return [];
            })()}
            showSearch
            optionFilterProp="label"
          />
          <div style={{ color: '#666' }}>
            Действие перенесёт все задачи на выбранную цель и удалит исходную сущность.
          </div>
        </Space>
      </Modal>

      <Modal
        title="Переименовать источник"
        open={sourceRenameModalOpen}
        onCancel={() => setSourceRenameModalOpen(false)}
        onOk={applySourceRename}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>Старое значение: <strong>{sourceRenameFrom}</strong></div>
          <Input value={sourceRenameTo} onChange={(e) => setSourceRenameTo(e.target.value)} />
        </Space>
      </Modal>
    </div>
  );
};

export default TaskCatalogManager;
