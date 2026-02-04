import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, ColorPicker, Space, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../services/pocketbase';

const DEFAULT_CATEGORIES = [
  { title: 'Алгебра', color: '#1890ff', order: 1 },
  { title: 'Геометрия', color: '#52c41a', order: 2 },
  { title: 'Тригонометрия', color: '#722ed1', order: 3 },
  { title: 'Теория вероятностей', color: '#fa8c16', order: 4 },
  { title: 'Математический анализ', color: '#eb2f96', order: 5 },
  { title: 'Комбинаторика', color: '#13c2c2', order: 6 },
];

export default function TheoryCategoryManager() {
  const [categories, setCategories] = useState([]);
  const [articleCounts, setArticleCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, counts] = await Promise.all([
        api.getTheoryCategories(),
        api.getTheoryArticleCountByCategory(),
      ]);
      setCategories(cats);
      setArticleCounts(counts);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingCategory(null);
    form.resetFields();
    form.setFieldsValue({ color: '#1890ff', order: categories.length + 1 });
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingCategory(record);
    form.setFieldsValue({
      title: record.title,
      description: record.description || '',
      color: record.color || '#1890ff',
      order: record.order || 0,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    const count = articleCounts[id] || 0;
    if (count > 0) {
      message.error(`Нельзя удалить категорию — в ней ${count} статей`);
      return;
    }
    try {
      await api.deleteTheoryCategory(id);
      message.success('Категория удалена');
      loadData();
    } catch (error) {
      message.error('Ошибка при удалении');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const color = typeof values.color === 'string' ? values.color : values.color?.toHexString?.() || '#1890ff';
      const data = {
        title: values.title,
        description: values.description || '',
        color,
        order: values.order || 0,
      };

      if (editingCategory) {
        await api.updateTheoryCategory(editingCategory.id, data);
        message.success('Категория обновлена');
      } else {
        await api.createTheoryCategory(data);
        message.success('Категория создана');
      }
      setModalOpen(false);
      loadData();
    } catch (error) {
      if (error.errorFields) return; // validation error
      message.error('Ошибка при сохранении');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      for (const cat of DEFAULT_CATEGORIES) {
        const exists = categories.find(c => c.title === cat.title);
        if (!exists) {
          await api.createTheoryCategory(cat);
        }
      }
      message.success('Категории по умолчанию созданы');
      loadData();
    } catch (error) {
      message.error('Ошибка при создании категорий');
    }
  };

  const columns = [
    {
      title: 'Цвет',
      dataIndex: 'color',
      key: 'color',
      width: 60,
      render: (color) => (
        <div style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          background: color || '#1890ff',
          border: '1px solid #d9d9d9',
        }} />
      ),
    },
    {
      title: 'Название',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <Tag color={record.color || '#1890ff'}>{title}</Tag>
      ),
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Порядок',
      dataIndex: 'order',
      key: 'order',
      width: 80,
    },
    {
      title: 'Статей',
      key: 'articles',
      width: 80,
      render: (_, record) => articleCounts[record.id] || 0,
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Удалить категорию?"
            description={articleCounts[record.id] > 0
              ? `В этой категории ${articleCounts[record.id]} статей. Сначала переместите их.`
              : 'Это действие нельзя отменить.'
            }
            onConfirm={() => handleDelete(record.id)}
            okText="Да"
            cancelText="Нет"
            disabled={articleCounts[record.id] > 0}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={articleCounts[record.id] > 0}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Добавить категорию
        </Button>
        {categories.length === 0 && (
          <Button onClick={handleSeedDefaults}>
            Создать категории по умолчанию
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={categories}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="middle"
      />

      <Modal
        title={editingCategory ? 'Редактировать категорию' : 'Новая категория'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="Название"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Например: Алгебра" />
          </Form.Item>

          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} placeholder="Краткое описание категории" />
          </Form.Item>

          <Form.Item name="color" label="Цвет">
            <ColorPicker />
          </Form.Item>

          <Form.Item name="order" label="Порядок">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
