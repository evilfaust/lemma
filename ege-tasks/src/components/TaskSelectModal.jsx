import { useEffect, useMemo, useState } from 'react';
import { Modal, Card, Button, Spin, Empty, Form, Select, Row, Col, Input, Space, Tag } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import { api } from '../services/pocketbase';

const { Option } = Select;

const TaskSelectModal = ({
  visible,
  onCancel,
  onSelect,
  topics = [],
  subtopics = [],
  tags = [],
  excludeIds = [],
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    loadTasks();
  }, [visible, filters]);

  const loadTasks = async () => {
    const hasFilters = !!(filters.topic || filters.subtopic || (filters.tags && filters.tags.length) || filters.difficulty);
    if (!hasFilters) {
      setTasks([]);
      return;
    }

    setLoading(true);
    try {
      const filterObj = {};
      if (filters.topic) filterObj.topic = filters.topic;
      if (filters.subtopic) filterObj.subtopic = filters.subtopic;
      if (filters.tags && filters.tags.length > 0) filterObj.tags = filters.tags;
      if (filters.difficulty) filterObj.difficulty = filters.difficulty;

      const allTasks = await api.getTasks(filterObj);
      const excluded = new Set(excludeIds);
      const filtered = allTasks.filter(t => !excluded.has(t.id));
      setTasks(filtered);
    } catch (error) {
      console.error('Error loading tasks for selection:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubtopics = filters.topic
    ? subtopics.filter(st => st.topic === filters.topic)
    : [];

  const visibleTasks = useMemo(() => {
    if (!search) return tasks;
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(t => {
      const code = (t.code || '').toLowerCase();
      const statement = (t.statement_md || '').toLowerCase();
      return code.includes(q) || statement.includes(q);
    });
  }, [tasks, search]);

  const handleReset = () => {
    form.resetFields();
    setFilters({});
    setSearch('');
  };

  const handleClose = () => {
    handleReset();
    onCancel();
  };

  return (
    <Modal
      title={
        <Space>
          <PlusOutlined />
          <span>Добавить задачу</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={920}
      style={{ top: 20 }}
    >
      <Card size="small" style={{ marginBottom: 16 }} title="Фильтры">
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changed, values) => {
            const next = { ...values };
            if (Object.prototype.hasOwnProperty.call(changed, 'topic')) {
              next.subtopic = undefined;
              form.setFieldsValue({ subtopic: undefined });
            }
            setFilters(next);
          }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="topic" label="Тема">
                <Select
                  placeholder="Выберите тему"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  {topics.map(topic => (
                    <Option key={topic.id} value={topic.id}>
                      {topic.ege_number ? `№${topic.ege_number} — ` : ""}{topic.title}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={8}>
              <Form.Item name="subtopic" label="Подтема">
                <Select
                  placeholder="Выберите подтему"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  disabled={!filters.topic}
                >
                  {filteredSubtopics.map(subtopic => (
                    <Option key={subtopic.id} value={subtopic.id}>
                      {subtopic.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={8}>
              <Form.Item name="difficulty" label="Сложность">
                <Select placeholder="Любая" allowClear>
                  <Option value="1">1 - Базовый</Option>
                  <Option value="2">2 - Средний</Option>
                  <Option value="3">3 - Повышенный</Option>
                  <Option value="4">4 - Высокий</Option>
                  <Option value="5">5 - Олимпиадный</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="tags" label="Теги">
                <Select
                  mode="multiple"
                  placeholder="Выберите теги"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  {tags.map(tag => (
                    <Option key={tag.id} value={tag.id}>
                      {tag.title}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Space>
            <Button onClick={handleReset} size="small">
              Сбросить
            </Button>
            <Input
              allowClear
              placeholder="Поиск по коду или условию"
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 280 }}
            />
          </Space>
        </Form>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : tasks.length === 0 ? (
        <Empty description="Выберите фильтры, чтобы загрузить задачи" />
      ) : visibleTasks.length === 0 ? (
        <Empty description="Нет задач по заданным условиям" />
      ) : (
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {visibleTasks.map(task => (
            <Card key={task.id} size="small" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    {task.code || 'Без кода'}
                  </div>
                  <MathRenderer text={task.statement_md} />
                  {task.answer && (
                    <div style={{ marginTop: 6 }}>
                      <Tag color="green">Ответ: {task.answer}</Tag>
                    </div>
                  )}
                </div>
                <div>
                  <Button type="primary" onClick={() => onSelect(task)}>
                    Добавить
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default TaskSelectModal;
