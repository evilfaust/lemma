import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Progress, Space, Button, Tag, Spin, Empty, Collapse, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { api } from '../services/pocketbase';

const TaskStatsDashboard = ({ topics = [], tags = [], subtopics = [], sources = [], onTagClick }) => {
  const [loading, setLoading] = useState(true);
  const [tasksSnapshot, setTasksSnapshot] = useState([]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.getTasksStatsSnapshot();
      setTasksSnapshot(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const stats = useMemo(() => {
    const total = tasksSnapshot.length;
    const withAnswer = tasksSnapshot.filter(t => (t.answer || '').toString().trim().length > 0).length;
    const withSolution = tasksSnapshot.filter(t => (t.solution_md || '').toString().trim().length > 0).length;
    const withImage = tasksSnapshot.filter(t => !!t.has_image).length;

    const byTopic = new Map();
    const bySubtopic = new Map();
    const byTag = new Map();
    const byDifficulty = new Map();
    const bySource = new Map();

    tasksSnapshot.forEach(task => {
      if (task.topic) {
        byTopic.set(task.topic, (byTopic.get(task.topic) || 0) + 1);
      }
      if (Array.isArray(task.subtopic)) {
        task.subtopic.forEach(stId => {
          if (stId) bySubtopic.set(stId, (bySubtopic.get(stId) || 0) + 1);
        });
      } else if (typeof task.subtopic === 'string' && task.subtopic.length > 0) {
        bySubtopic.set(task.subtopic, (bySubtopic.get(task.subtopic) || 0) + 1);
      }
      if (Array.isArray(task.tags)) {
        task.tags.forEach(tagId => {
          byTag.set(tagId, (byTag.get(tagId) || 0) + 1);
        });
      } else if (typeof task.tags === 'string' && task.tags.length > 0) {
        byTag.set(task.tags, (byTag.get(task.tags) || 0) + 1);
      }
      if (task.source) {
        bySource.set(task.source, (bySource.get(task.source) || 0) + 1);
      }
      const diff = task.difficulty === undefined || task.difficulty === null || task.difficulty === ''
        ? '1'
        : String(task.difficulty);
      byDifficulty.set(diff, (byDifficulty.get(diff) || 0) + 1);
    });

    return {
      total,
      withAnswer,
      withSolution,
      withImage,
      byTopic,
      bySubtopic,
      byTag,
      byDifficulty,
      bySource,
    };
  }, [tasksSnapshot]);

  const topicRows = useMemo(() => {
    const rows = topics.map(t => {
      const count = stats.byTopic.get(t.id) || 0;
      return {
        key: t.id,
        title: t.title,
        ege: t.ege_number,
        count,
      };
    });
    return rows.sort((a, b) => b.count - a.count);
  }, [topics, stats.byTopic]);

  const tagRows = useMemo(() => {
    const rows = tags.map(t => {
      const count = stats.byTag.get(t.id) || 0;
      return {
        key: t.id,
        title: t.title,
        color: t.color,
        count,
      };
    });
    return rows.sort((a, b) => b.count - a.count);
  }, [tags, stats.byTag]);

  const subtopicRows = useMemo(() => {
    const rows = subtopics.map(st => {
      const count = stats.bySubtopic.get(st.id) || 0;
      const topic = topics.find(t => t.id === st.topic);
      return {
        key: st.id,
        title: st.name || st.title,
        topicTitle: topic ? `№${topic.ege_number} ${topic.title}` : '',
        count,
      };
    });
    return rows.sort((a, b) => b.count - a.count);
  }, [subtopics, stats.bySubtopic, topics]);

  const sourceRows = useMemo(() => {
    if (sources.length > 0) {
      return sources.map(s => ({
        key: s,
        source: s,
        count: stats.bySource.get(s) || 0,
      })).sort((a, b) => b.count - a.count);
    }
    return Array.from(stats.bySource.entries())
      .map(([source, count]) => ({ key: source, source, count }))
      .sort((a, b) => b.count - a.count);
  }, [sources, stats.bySource]);

  const difficultyRows = useMemo(() => {
    const diffs = ['1', '2', '3', '4', '5'];
    return diffs.map(d => ({
      key: d,
      difficulty: d,
      count: stats.byDifficulty.get(d) || 0,
    }));
  }, [stats.byDifficulty]);

  const emptyTopics = topicRows.filter(t => t.count === 0);
  const emptySubtopics = subtopicRows.filter(t => t.count === 0);
  const coverage = topics.length > 0 ? Math.round(((topics.length - emptyTopics.length) / topics.length) * 100) : 0;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (tasksSnapshot.length === 0) {
    return <Empty description="Нет данных по задачам" />;
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={loadStats}>Обновить</Button>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Всего задач" value={stats.total} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="С ответом" value={stats.withAnswer} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="С решением" value={stats.withSolution} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="С изображением" value={stats.withImage} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title="Теги (частота использования)">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {tagRows.map(tag => {
                const max = tagRows[0]?.count || 1;
                const min = tagRows[tagRows.length - 1]?.count || 0;
                const scale = max === min ? 1 : (tag.count - min) / (max - min);
                const fontSize = Math.round(12 + scale * 12);
                return (
                  <Tooltip key={tag.key} title={`${tag.title}: ${tag.count}`}>
                    <Tag
                      color={tag.color}
                      style={{ fontSize, padding: '2px 8px', lineHeight: 1.2, cursor: tag.count > 0 && onTagClick ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (tag.count > 0) onTagClick?.(tag.key);
                      }}
                    >
                      {tag.title} <span style={{ opacity: 0.75 }}>({tag.count})</span>
                    </Tag>
                  </Tooltip>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="Покрытие тем">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Progress percent={coverage} status={coverage === 100 ? 'success' : 'active'} />
              <div style={{ color: '#666' }}>
                Тем без задач: {emptyTopics.length} из {topics.length}
              </div>
              {emptyTopics.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {emptyTopics.map(t => (
                    <Tag key={t.key} color="red">№{t.ege} {t.title}</Tag>
                  ))}
                </div>
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Распределение по сложности">
            <Table
              size="small"
              pagination={false}
              dataSource={difficultyRows}
              columns={[
                { title: 'Сложность', dataIndex: 'difficulty', width: 120 },
                { title: 'Количество', dataIndex: 'count' },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="Задачи по темам">
            <Table
              size="small"
              dataSource={topicRows}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '№', dataIndex: 'ege', width: 60 },
                { title: 'Тема', dataIndex: 'title' },
                { title: 'Кол-во', dataIndex: 'count', width: 90 },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Collapse
            items={[
              {
                key: 'subtopics',
                label: 'Подтемы (пустые и заполненные)',
                children: (
                  <>
                    {subtopics.length > 0 && (
                      <div style={{ color: '#666', marginBottom: 8 }}>
                        Подтем без задач: {emptySubtopics.length} из {subtopics.length}
                      </div>
                    )}
                    <Table
                      size="small"
                      dataSource={subtopicRows}
                      pagination={{ pageSize: 10 }}
                      columns={[
                        { title: 'Подтема', dataIndex: 'title' },
                        { title: 'Тема', dataIndex: 'topicTitle' },
                        { title: 'Кол-во', dataIndex: 'count', width: 90 },
                      ]}
                    />
                  </>
                ),
              },
            ]}
            defaultActiveKey={[]}
          />
        </Col>

        <Col xs={24} md={12}>
          <Card title="Источники">
            <Table
              size="small"
              dataSource={sourceRows}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: 'Источник', dataIndex: 'source' },
                { title: 'Кол-во', dataIndex: 'count', width: 90 },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TaskStatsDashboard;
