import { useCallback, useEffect, useState } from 'react';
import {
  App,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';

const { Title, Text } = Typography;

function TopicForm({ initial, onSave, onCancel, saving }) {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue(initial || { title: '', order: null });
  }, [form, initial]);

  return (
    <Form form={form} layout="inline" onFinish={onSave} style={{ marginBottom: 12 }}>
      <Form.Item name="title" rules={[{ required: true, message: 'Введите название' }]}>
        <Input placeholder="Название темы" style={{ width: 260 }} maxLength={200} />
      </Form.Item>
      <Form.Item name="order">
        <InputNumber placeholder="Порядок" style={{ width: 100 }} />
      </Form.Item>
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
            {initial ? 'Сохранить' : 'Добавить'}
          </Button>
          {onCancel && <Button onClick={onCancel}>Отмена</Button>}
        </Space>
      </Form.Item>
    </Form>
  );
}

function SubtopicForm({ topics, initial, onSave, onCancel, saving, defaultTopicId }) {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue(initial || { topic: defaultTopicId || null, title: '', order: null });
  }, [form, initial, defaultTopicId]);

  return (
    <Form form={form} layout="inline" onFinish={onSave} style={{ marginBottom: 12 }}>
      <Form.Item name="topic" rules={[{ required: true, message: 'Выберите тему' }]}>
        <Select placeholder="Тема" style={{ width: 200 }} options={topics.map((t) => ({ value: t.id, label: t.title }))} />
      </Form.Item>
      <Form.Item name="title" rules={[{ required: true, message: 'Введите название' }]}>
        <Input placeholder="Название подтемы" style={{ width: 260 }} maxLength={200} />
      </Form.Item>
      <Form.Item name="order">
        <InputNumber placeholder="Порядок" style={{ width: 100 }} />
      </Form.Item>
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
            {initial ? 'Сохранить' : 'Добавить'}
          </Button>
          {onCancel && <Button onClick={onCancel}>Отмена</Button>}
        </Space>
      </Form.Item>
    </Form>
  );
}

export default function GeometryTopicManager() {
  const { message } = App.useApp();
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingTopic, setSavingTopic] = useState(false);
  const [savingSubtopic, setSavingSubtopic] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [editingSubtopic, setEditingSubtopic] = useState(null);
  const [filterTopicId, setFilterTopicId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([
        api.getGeometryTopics(),
        api.getGeometrySubtopics(),
      ]);
      setTopics(t);
      setSubtopics(s);
    } catch {
      message.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  // ── Topics ─────────────────────────────────────────────────────────────────

  const handleSaveTopic = useCallback(async (values) => {
    setSavingTopic(true);
    try {
      if (editingTopic) {
        await api.updateGeometryTopic(editingTopic.id, values);
        message.success('Тема обновлена');
        setEditingTopic(null);
      } else {
        await api.createGeometryTopic(values);
        message.success('Тема создана');
      }
      await load();
    } catch {
      message.error('Ошибка сохранения темы');
    } finally {
      setSavingTopic(false);
    }
  }, [editingTopic, load, message]);

  const handleDeleteTopic = useCallback(async (id) => {
    try {
      await api.deleteGeometryTopic(id);
      message.success('Тема удалена');
      await load();
    } catch {
      message.error('Не удалось удалить — возможно, есть связанные подтемы или задачи');
    }
  }, [load, message]);

  // ── Subtopics ──────────────────────────────────────────────────────────────

  const handleSaveSubtopic = useCallback(async (values) => {
    setSavingSubtopic(true);
    try {
      if (editingSubtopic) {
        await api.updateGeometrySubtopic(editingSubtopic.id, values);
        message.success('Подтема обновлена');
        setEditingSubtopic(null);
      } else {
        await api.createGeometrySubtopic(values);
        message.success('Подтема создана');
      }
      await load();
    } catch {
      message.error('Ошибка сохранения подтемы');
    } finally {
      setSavingSubtopic(false);
    }
  }, [editingSubtopic, load, message]);

  const handleDeleteSubtopic = useCallback(async (id) => {
    try {
      await api.deleteGeometrySubtopic(id);
      message.success('Подтема удалена');
      await load();
    } catch {
      message.error('Не удалось удалить — возможно, есть связанные задачи');
    }
  }, [load, message]);

  // ── Таблица тем ───────────────────────────────────────────────────────────

  const topicColumns = [
    {
      title: '№',
      dataIndex: 'order',
      key: 'order',
      width: 60,
      render: (v) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Название темы',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Подтем',
      key: 'subtopics_count',
      width: 90,
      render: (_, record) => subtopics.filter((s) => s.topic === record.id).length,
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditingTopic(record)} />
          <Popconfirm
            title="Удалить тему?"
            description="Все подтемы этой темы будут удалены каскадно."
            onConfirm={() => handleDeleteTopic(record.id)}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Таблица подтем ────────────────────────────────────────────────────────

  const visibleSubtopics = filterTopicId
    ? subtopics.filter((s) => s.topic === filterTopicId)
    : subtopics;

  const subtopicColumns = [
    {
      title: '№',
      dataIndex: 'order',
      key: 'order',
      width: 60,
      render: (v) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Тема',
      key: 'topic_title',
      width: 200,
      render: (_, record) => {
        const t = topics.find((tp) => tp.id === record.topic);
        return t?.title ?? <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Название подтемы',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditingSubtopic(record)} />
          <Popconfirm
            title="Удалить подтему?"
            onConfirm={() => handleDeleteSubtopic(record.id)}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 40px' }}>
      <Row gutter={40}>
        {/* ── Темы ──────────────────────────────────────────────────────── */}
        <Col span={10}>
          <Title level={5} style={{ marginBottom: 12 }}>Темы</Title>

          {editingTopic ? (
            <TopicForm
              initial={editingTopic}
              onSave={handleSaveTopic}
              onCancel={() => setEditingTopic(null)}
              saving={savingTopic}
            />
          ) : (
            <TopicForm onSave={handleSaveTopic} saving={savingTopic} />
          )}

          <Table
            dataSource={topics}
            columns={topicColumns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={false}
            locale={{ emptyText: 'Нет тем' }}
            onRow={(record) => ({
              style: { cursor: 'pointer' },
              onClick: () => setFilterTopicId(filterTopicId === record.id ? null : record.id),
            })}
            rowClassName={(record) => (record.id === filterTopicId ? 'ant-table-row-selected' : '')}
          />
        </Col>

        {/* ── Подтемы ───────────────────────────────────────────────────── */}
        <Col span={14}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Title level={5} style={{ margin: 0 }}>Подтемы</Title>
            {filterTopicId && (
              <Space>
                <Text type="secondary">
                  фильтр: <strong>{topics.find((t) => t.id === filterTopicId)?.title}</strong>
                </Text>
                <Button size="small" onClick={() => setFilterTopicId(null)}>✕ Сбросить</Button>
              </Space>
            )}
          </div>

          {editingSubtopic ? (
            <SubtopicForm
              topics={topics}
              initial={editingSubtopic}
              onSave={handleSaveSubtopic}
              onCancel={() => setEditingSubtopic(null)}
              saving={savingSubtopic}
            />
          ) : (
            <SubtopicForm
              topics={topics}
              defaultTopicId={filterTopicId}
              onSave={handleSaveSubtopic}
              saving={savingSubtopic}
            />
          )}

          <Table
            dataSource={visibleSubtopics}
            columns={subtopicColumns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={false}
            locale={{ emptyText: filterTopicId ? 'Нет подтем для этой темы' : 'Нет подтем' }}
          />
        </Col>
      </Row>
    </div>
  );
}
