import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, List, Button, Space, Input, Select, Tag, Typography, Spin, Row, Col, Empty, message } from 'antd';
import { ReloadOutlined, FolderOpenOutlined, InboxOutlined } from '@ant-design/icons';
import WorkEditor from './WorkEditor';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';

const { Text } = Typography;
const { Option } = Select;

const WorkEditorPage = () => {
  const { topics, tags, subtopics, years, sources } = useReferenceData();
  const [works, setWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(true);
  const [selectedWorkId, setSelectedWorkId] = useState(null);
  const [workLoading, setWorkLoading] = useState(false);
  const [currentWork, setCurrentWork] = useState(null);
  const [variants, setVariants] = useState([]);
  const [attemptCount, setAttemptCount] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [workStats, setWorkStats] = useState({});
  const [filters, setFilters] = useState({
    status: 'active',
    search: '',
    topic: null,
  });

  const loadWorks = useCallback(async () => {
    setLoadingWorks(true);
    try {
      const archived = filters.status === 'archived';
      const data = await api.getWorks({
        archived,
        search: filters.search,
        topic: filters.topic,
      });
      setWorks(data);
      await loadStats(data);
    } catch (error) {
      console.error('Error loading works:', error);
      message.error('Ошибка загрузки работ');
    } finally {
      setLoadingWorks(false);
    }
  }, [filters]);

  const loadStats = useCallback(async (workList) => {
    const ids = workList.map(w => w.id);
    if (!ids.length) {
      setWorkStats({});
      return;
    }

    try {
      const sessions = await api.getSessionsByWorks(ids);
      const sessionIds = sessions.map(s => s.id);
      const attempts = await api.getAttemptsBySessions(sessionIds);

      const stats = {};
      ids.forEach(id => {
        stats[id] = { sessions: 0, attempts: 0, avgScore: null };
      });

      sessions.forEach(s => {
        if (!stats[s.work]) stats[s.work] = { sessions: 0, attempts: 0, avgScore: null };
        stats[s.work].sessions += 1;
      });

      const attemptSumByWork = {};
      const totalSumByWork = {};

      const sessionToWork = new Map(sessions.map(s => [s.id, s.work]));

      attempts.forEach(a => {
        const workId = sessionToWork.get(a.session);
        if (!workId) return;
        if (!stats[workId]) stats[workId] = { sessions: 0, attempts: 0, avgScore: null };
        stats[workId].attempts += 1;
        attemptSumByWork[workId] = (attemptSumByWork[workId] || 0) + (a.score || 0);
        totalSumByWork[workId] = (totalSumByWork[workId] || 0) + (a.total || 0);
      });

      Object.keys(stats).forEach(workId => {
        const total = totalSumByWork[workId] || 0;
        const score = attemptSumByWork[workId] || 0;
        stats[workId].avgScore = total > 0 ? Math.round((score / total) * 100) : null;
      });

      setWorkStats(stats);
    } catch (error) {
      console.error('Error loading work stats:', error);
      setWorkStats({});
    }
  }, []);

  useEffect(() => {
    loadWorks();
  }, [loadWorks]);

  const loadWorkDetails = useCallback(async (workId) => {
    if (!workId) return;
    setWorkLoading(true);
    try {
      const work = await api.getWork(workId);
      const variantsData = await api.getVariantsByWork(workId);

      const normalizedVariants = await Promise.all(variantsData.map(async (variant) => {
        let tasks = variant.expand?.tasks || [];
        if (tasks.length === 0 && Array.isArray(variant.tasks) && variant.tasks.length > 0) {
          const loaded = await Promise.all(variant.tasks.map(id => api.getTask(id)));
          tasks = loaded.filter(Boolean);
        }

        if (Array.isArray(variant.order) && variant.order.length > 0) {
          const positionById = new Map(variant.order.map(o => [o.taskId, o.position]));
          tasks.sort((a, b) => (positionById.get(a.id) ?? 999) - (positionById.get(b.id) ?? 999));
        }

        return {
          number: variant.number,
          tasks,
        };
      }));

      const attempts = await api.getAttemptsCountByWork(workId);
      const session = await api.getSessionByWork(workId);

      setCurrentWork(work);
      setVariants(normalizedVariants);
      setAttemptCount(attempts);
      setSessionId(session?.id || null);
    } catch (error) {
      console.error('Error loading work details:', error);
      message.error('Ошибка загрузки работы');
    } finally {
      setWorkLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedWorkId) {
      loadWorkDetails(selectedWorkId);
    } else {
      setCurrentWork(null);
      setVariants([]);
      setAttemptCount(0);
      setSessionId(null);
    }
  }, [selectedWorkId, loadWorkDetails]);

  const handleArchiveToggle = async (work) => {
    try {
      if (work.archived) {
        await api.unarchiveWork(work.id);
        message.success('Работа возвращена из архива');
      } else {
        await api.archiveWork(work.id);
        message.success('Работа перемещена в архив');
      }
      await loadWorks();
      if (selectedWorkId === work.id) {
        setSelectedWorkId(null);
      }
    } catch (error) {
      message.error('Ошибка при архивировании');
    }
  };

  const handleSave = async (values) => {
    if (!currentWork) return;
    try {
      await api.updateWork(currentWork.id, {
        title: values.title,
        topic: values.topic || null,
        time_limit: values.timeLimit ? parseInt(values.timeLimit, 10) : null,
      });

      const existingVariants = await api.getVariantsByWork(currentWork.id);
      const existingByNumber = new Map(existingVariants.map(v => [v.number, v]));
      const incomingNumbers = new Set();

      for (const variant of variants) {
        const taskIds = variant.tasks.map(t => t.id);
        const order = variant.tasks.map((t, idx) => ({ taskId: t.id, position: idx }));
        const payload = {
          work: currentWork.id,
          number: variant.number,
          tasks: taskIds,
          order,
        };

        incomingNumbers.add(variant.number);
        const existing = existingByNumber.get(variant.number);
        if (existing) {
          await api.updateVariant(existing.id, payload);
        } else {
          await api.createVariant(payload);
        }
      }

      for (const variant of existingVariants) {
        if (!incomingNumbers.has(variant.number)) {
          await api.deleteVariant(variant.id);
        }
      }

      message.success('Работа сохранена');
      await loadWorks();
      await loadWorkDetails(currentWork.id);
    } catch (error) {
      console.error('Error saving work:', error);
      message.error('Ошибка при сохранении работы');
    }
  };

  const handleSaveAsNew = async (values) => {
    if (!currentWork) return;
    try {
      const newWork = await api.createWork({
        title: values.title || currentWork.title || 'Контрольная работа',
        topic: values.topic || currentWork.topic || null,
        time_limit: values.timeLimit ? parseInt(values.timeLimit, 10) : currentWork.time_limit || null,
        archived: false,
      });

      for (const variant of variants) {
        const taskIds = variant.tasks.map(t => t.id);
        const order = variant.tasks.map((t, idx) => ({ taskId: t.id, position: idx }));
        await api.createVariant({
          work: newWork.id,
          number: variant.number,
          tasks: taskIds,
          order,
        });
      }

      message.success('Работа сохранена как новая');
      await loadWorks();
      setSelectedWorkId(newWork.id);
    } catch (error) {
      console.error('Error saving work as new:', error);
      message.error('Ошибка при сохранении работы');
    }
  };

  const leftList = (
    <Card
      title="Работы"
      extra={
        <Button icon={<ReloadOutlined />} onClick={loadWorks} />
      }
      styles={{ body: { padding: 12 } }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Input.Search
          placeholder="Поиск по названию"
          allowClear
          onSearch={(value) => setFilters(prev => ({ ...prev, search: value }))}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
        />
        <Select
          value={filters.status}
          onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
        >
          <Option value="active">Активные</Option>
          <Option value="archived">Архив</Option>
        </Select>
        <Select
          allowClear
          placeholder="Фильтр по теме"
          value={filters.topic}
          onChange={(value) => setFilters(prev => ({ ...prev, topic: value || null }))}
          showSearch
          optionFilterProp="children"
        >
          {topics.map(topic => (
            <Option key={topic.id} value={topic.id}>
              №{topic.ege_number} - {topic.title}
            </Option>
          ))}
        </Select>
      </Space>

      {loadingWorks ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
      ) : works.length === 0 ? (
        <Empty description="Работ нет" style={{ padding: 24 }} />
      ) : (
        <List
          style={{ marginTop: 12 }}
          dataSource={works}
          renderItem={work => (
            <List.Item
              style={{
                padding: '10px 4px',
                background: selectedWorkId === work.id ? '#f5f5f5' : 'transparent',
                borderRadius: 6,
                cursor: 'pointer',
              }}
              onClick={() => setSelectedWorkId(work.id)}
            >
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 600 }}>{work.title || 'Без названия'}</div>
                    {work.archived && <Tag color="default">Архив</Tag>}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(work.created).toLocaleDateString('ru-RU')}
                  </Text>
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
                    <Text type="secondary">
                      Сессий: {workStats[work.id]?.sessions || 0}
                    </Text>
                    <Text type="secondary">
                      Попыток: {workStats[work.id]?.attempts || 0}
                    </Text>
                    {workStats[work.id]?.avgScore !== null && (
                      <Text type="secondary">
                        Средний результат: {workStats[work.id]?.avgScore}%
                      </Text>
                    )}
                  </div>
                  {work.expand?.topic && (
                    <div style={{ marginTop: 4 }}>
                      <Tag color="purple">
                        №{work.expand.topic.ege_number} — {work.expand.topic.title}
                      </Tag>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    icon={<FolderOpenOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedWorkId(work.id);
                    }}
                  >
                    Открыть
                  </Button>
                  <Button
                    size="small"
                    icon={<InboxOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArchiveToggle(work);
                    }}
                  >
                    {work.archived ? 'Вернуть' : 'Архив'}
                  </Button>
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </Card>
  );

  return (
    <Row gutter={16}>
      <Col xs={24} lg={8}>
        {leftList}
      </Col>
      <Col xs={24} lg={16}>
        {workLoading ? (
          <Card>
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" />
            </div>
          </Card>
        ) : (
          <WorkEditor
            work={currentWork}
            variants={variants}
            setVariants={setVariants}
            onSave={handleSave}
            onSaveAsNew={handleSaveAsNew}
            hasAttempts={attemptCount > 0}
            attemptCount={attemptCount}
            sessionId={sessionId}
            topics={topics}
            tags={tags}
            subtopics={subtopics}
            years={years}
            sources={sources}
          />
        )}
      </Col>
    </Row>
  );
};

export default WorkEditorPage;
