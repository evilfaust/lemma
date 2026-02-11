import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Progress, Space, Button, Tag, Spin, Empty, Collapse, Tooltip, Alert } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';

const KNOWN_DIFFICULTIES = ['1', '2', '3', '4', '5'];
const UNSET_DIFFICULTY = '__unset__';

const TaskStatsDashboard = ({ onOpenTasks, onTagClick }) => {
  const { topics, tags, subtopics, sources, loading: refLoading } = useReferenceData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tasksSnapshot, setTasksSnapshot] = useState([]);

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getTasksStatsSnapshot();
      setTasksSnapshot(data);
    } catch (e) {
      console.error('Error loading stats dashboard:', e);
      setError('Не удалось загрузить статистику. Проверьте соединение с PocketBase.');
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
    const byYear = new Map();

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
      if (task.year) {
        byYear.set(task.year, (byYear.get(task.year) || 0) + 1);
      }
      const diff = task.difficulty === undefined || task.difficulty === null || task.difficulty === ''
        ? UNSET_DIFFICULTY
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
      byYear,
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
        topicId: t.id,
      };
    });
    const topicSet = new Set(topics.map(t => t.id));
    stats.byTopic.forEach((count, id) => {
      if (topicSet.has(id)) return;
      rows.push({
        key: `unknown-topic-${id}`,
        title: `(Удалена) ${id}`,
        ege: '—',
        count,
        topicId: id,
      });
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
        tagId: t.id,
      };
    });
    const tagSet = new Set(tags.map(t => t.id));
    stats.byTag.forEach((count, id) => {
      if (tagSet.has(id)) return;
      rows.push({
        key: `unknown-tag-${id}`,
        title: `(Удален) ${id}`,
        color: 'default',
        count,
        tagId: id,
      });
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
        subtopicId: st.id,
      };
    });
    const subtopicSet = new Set(subtopics.map(st => st.id));
    stats.bySubtopic.forEach((count, id) => {
      if (subtopicSet.has(id)) return;
      rows.push({
        key: `unknown-subtopic-${id}`,
        title: `(Удалена) ${id}`,
        topicTitle: '—',
        count,
        subtopicId: id,
      });
    });
    return rows.sort((a, b) => b.count - a.count);
  }, [subtopics, stats.bySubtopic, topics]);

  const sourceRows = useMemo(() => {
    const merged = new Map();
    sources.forEach(s => merged.set(s, stats.bySource.get(s) || 0));
    stats.bySource.forEach((count, source) => {
      if (!merged.has(source)) merged.set(source, count);
    });
    return Array.from(merged.entries())
      .map(([source, count]) => ({ key: source, source, count }))
      .sort((a, b) => b.count - a.count);
  }, [sources, stats.bySource]);

  const difficultyRows = useMemo(() => {
    const base = KNOWN_DIFFICULTIES.map(d => ({
      key: d,
      difficulty: d,
      count: stats.byDifficulty.get(d) || 0,
      filterDifficulty: d,
    }));
    stats.byDifficulty.forEach((count, difficulty) => {
      if (KNOWN_DIFFICULTIES.includes(difficulty)) return;
      if (difficulty === UNSET_DIFFICULTY) {
        base.push({
          key: UNSET_DIFFICULTY,
          difficulty: 'Не указана',
          count,
          filterDifficulty: null,
        });
        return;
      }
      base.push({
        key: `difficulty-${difficulty}`,
        difficulty: difficulty,
        count,
        filterDifficulty: difficulty,
      });
    });
    return base.sort((a, b) => b.count - a.count);
  }, [stats.byDifficulty]);

  const yearRows = useMemo(() => {
    const years = Array.from(stats.byYear.entries())
      .map(([year, count]) => ({ key: year, year, count }))
      .sort((a, b) => Number(b.year) - Number(a.year));
    return years;
  }, [stats.byYear]);

  const toPercent = (count) => {
    if (!stats.total) return '0%';
    return `${Math.round((count / stats.total) * 100)}%`;
  };

  const openTasks = (filters) => {
    onOpenTasks?.(filters);
  };

  const handleTagOpen = (tagId) => {
    if (onOpenTasks) {
      openTasks({ tags: [tagId] });
      return;
    }
    onTagClick?.(tagId);
  };

  const difficultyLabel = (value) => {
    if (value === UNSET_DIFFICULTY) return 'Не указана';
    return value;
  };

  const emptyTopics = topicRows.filter(t => t.count === 0);
  const emptySubtopics = subtopicRows.filter(t => t.count === 0);
  const coverage = topics.length > 0 ? Math.round(((topics.length - emptyTopics.length) / topics.length) * 100) : 0;

  if (loading || refLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        <Alert type="error" showIcon message={error} />
        <Button icon={<ReloadOutlined />} onClick={loadStats}>Повторить</Button>
      </Space>
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
            <Statistic title="С ответом" value={stats.withAnswer} suffix={toPercent(stats.withAnswer)} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="С решением" value={stats.withSolution} suffix={toPercent(stats.withSolution)} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="С изображением" value={stats.withImage} suffix={toPercent(stats.withImage)} />
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
                      style={{ fontSize, padding: '2px 8px', lineHeight: 1.2, cursor: tag.count > 0 && (onTagClick || onOpenTasks) ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (tag.count > 0) handleTagOpen(tag.tagId);
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
                { title: 'Сложность', dataIndex: 'difficulty', render: difficultyLabel, width: 120 },
                {
                  title: 'Количество',
                  dataIndex: 'count',
                  render: (_, row) => (
                    <Space>
                      <span>{row.count}</span>
                      <Tag>{toPercent(row.count)}</Tag>
                      {onOpenTasks && row.filterDifficulty && (
                        <Button
                          type="link"
                          size="small"
                          onClick={() => openTasks({ difficulty: row.filterDifficulty })}
                        >
                          Открыть
                        </Button>
                      )}
                    </Space>
                  ),
                },
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
              pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
              columns={[
                { title: '№', dataIndex: 'ege', width: 60 },
                { title: 'Тема', dataIndex: 'title' },
                {
                  title: 'Кол-во',
                  dataIndex: 'count',
                  width: 160,
                  render: (_, row) => (
                    <Space>
                      <span>{row.count}</span>
                      <Tag>{toPercent(row.count)}</Tag>
                      {onOpenTasks && (
                        <Button type="link" size="small" onClick={() => openTasks({ topic: row.topicId })}>
                          Открыть
                        </Button>
                      )}
                    </Space>
                  ),
                },
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
                      pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
                      columns={[
                        { title: 'Подтема', dataIndex: 'title' },
                        { title: 'Тема', dataIndex: 'topicTitle' },
                        {
                          title: 'Кол-во',
                          dataIndex: 'count',
                          width: 160,
                          render: (_, row) => (
                            <Space>
                              <span>{row.count}</span>
                              <Tag>{toPercent(row.count)}</Tag>
                              {onOpenTasks && (
                                <Button type="link" size="small" onClick={() => openTasks({ subtopic: row.subtopicId })}>
                                  Открыть
                                </Button>
                              )}
                            </Space>
                          ),
                        },
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
              pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
              columns={[
                { title: 'Источник', dataIndex: 'source' },
                {
                  title: 'Кол-во',
                  dataIndex: 'count',
                  width: 160,
                  render: (_, row) => (
                    <Space>
                      <span>{row.count}</span>
                      <Tag>{toPercent(row.count)}</Tag>
                      {onOpenTasks && (
                        <Button type="link" size="small" onClick={() => openTasks({ source: row.source })}>
                          Открыть
                        </Button>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="Годы">
            <Table
              size="small"
              dataSource={yearRows}
              pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
              columns={[
                { title: 'Год', dataIndex: 'year', width: 90 },
                {
                  title: 'Кол-во',
                  dataIndex: 'count',
                  render: (_, row) => (
                    <Space>
                      <span>{row.count}</span>
                      <Tag>{toPercent(row.count)}</Tag>
                      {onOpenTasks && (
                        <Button type="link" size="small" onClick={() => openTasks({ year: row.year })}>
                          Открыть
                        </Button>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TaskStatsDashboard;
