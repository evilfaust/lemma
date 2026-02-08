import { useState, useEffect } from 'react';
import { Card, Row, Col, Input, Select, Button, Tag, Empty, Spin, Space, Popconfirm, message, Typography } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  PrinterOutlined, SearchOutlined, BookOutlined
} from '@ant-design/icons';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';

const { Paragraph } = Typography;

export default function TheoryBrowser({ onEditArticle, onViewArticle, onCreateArticle }) {
  const { theoryCategories: categories } = useReferenceData();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadArticles();
  }, [selectedCategory]);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (selectedCategory) filters.category = selectedCategory;
      const data = await api.getTheoryArticles(filters);
      setArticles(data);
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteTheoryArticle(id);
      message.success('Статья удалена');
      loadArticles();
    } catch (error) {
      message.error('Ошибка при удалении');
    }
  };

  // Client-side search filter
  const filteredArticles = articles.filter(a => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      a.title?.toLowerCase().includes(search) ||
      a.summary?.toLowerCase().includes(search) ||
      (a.tags || []).some(t => t.toLowerCase().includes(search))
    );
  });

  const getCategoryInfo = (categoryId) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) {
      // Try expanded data
      return null;
    }
    return cat;
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreateArticle}>
          Новая статья
        </Button>

        <Select
          placeholder="Все категории"
          allowClear
          value={selectedCategory}
          onChange={setSelectedCategory}
          style={{ width: 200 }}
          options={[
            ...categories.map(c => ({
              label: <Tag color={c.color}>{c.title}</Tag>,
              value: c.id,
            })),
          ]}
        />

        <Input
          placeholder="Поиск по названию..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 250 }}
          allowClear
        />

        <span style={{ color: '#888', fontSize: 13 }}>
          Всего: {filteredArticles.length}
        </span>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Tag
            color={!selectedCategory ? '#1890ff' : undefined}
            style={{ cursor: 'pointer', marginBottom: 4 }}
            onClick={() => setSelectedCategory(null)}
          >
            Все
          </Tag>
          {categories.map(cat => (
            <Tag
              key={cat.id}
              color={selectedCategory === cat.id ? cat.color : undefined}
              style={{
                cursor: 'pointer',
                marginBottom: 4,
                opacity: selectedCategory && selectedCategory !== cat.id ? 0.5 : 1,
              }}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            >
              {cat.title}
            </Tag>
          ))}
        </div>
      )}

      {/* Articles grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : filteredArticles.length === 0 ? (
        <Empty
          image={<BookOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
          description={articles.length === 0 ? 'Нет статей. Создайте первую!' : 'Ничего не найдено'}
        >
          {articles.length === 0 && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreateArticle}>
              Создать статью
            </Button>
          )}
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredArticles.map(article => {
            const cat = getCategoryInfo(article.category) || article.expand?.category;
            return (
              <Col key={article.id} xs={24} sm={24} md={12} lg={8} xl={6}>
                <Card
                  hoverable
                  size="small"
                  title={
                    <span style={{ fontSize: 14 }}>
                      {article.title}
                    </span>
                  }
                  extra={
                    cat && <Tag color={cat.color} style={{ fontSize: 11 }}>{cat.title}</Tag>
                  }
                  actions={[
                    <EyeOutlined key="view" onClick={() => onViewArticle?.(article.id)} />,
                    <EditOutlined key="edit" onClick={() => onEditArticle?.(article.id)} />,
                    <Popconfirm
                      key="delete"
                      title="Удалить статью?"
                      onConfirm={() => handleDelete(article.id)}
                      okText="Да"
                      cancelText="Нет"
                    >
                      <DeleteOutlined />
                    </Popconfirm>,
                  ]}
                >
                  {article.summary && (
                    <Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                      {article.summary}
                    </Paragraph>
                  )}

                  <div>
                    {(article.tags || []).slice(0, 4).map(tag => (
                      <Tag key={tag} style={{ fontSize: 11, marginBottom: 2 }}>{tag}</Tag>
                    ))}
                  </div>

                  <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
                    {article.updated ? new Date(article.updated).toLocaleDateString('ru-RU') : ''}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
