import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Select, Spin, Empty, App } from 'antd';
import { ReloadOutlined, InboxOutlined } from '@ant-design/icons';
import WorkEditor from './WorkEditor';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { SplitLayout, StatMini, Chip, topicTint } from '../ui';

const { Option } = Select;

const WorkEditorPage = ({ initialWorkId = null }) => {
  const { message } = App.useApp();
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

  useEffect(() => {
    if (!initialWorkId) return;
    setSelectedWorkId(initialWorkId);
  }, [initialWorkId]);

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

  // ---- Левая панель: список работ ----
  const leftPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)' }}>
          Работы{' '}
          <span style={{ color: 'var(--ink-4)', fontWeight: 400, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            · {works.length}
          </span>
        </h2>
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          onClick={loadWorks}
          loading={loadingWorks}
        />
      </div>

      {/* Фильтры */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Input.Search
          placeholder="Поиск по названию"
          allowClear
          onSearch={(value) => setFilters(prev => ({ ...prev, search: value }))}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <Select
          value={filters.status}
          onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          style={{ flex: 1 }}
        >
          <Option value="active">Активные</Option>
          <Option value="archived">Архив</Option>
        </Select>
        <Select
          allowClear
          placeholder="Все темы"
          value={filters.topic}
          onChange={(value) => setFilters(prev => ({ ...prev, topic: value || null }))}
          showSearch
          optionFilterProp="children"
          style={{ flex: 1 }}
        >
          {topics.map(topic => (
            <Option key={topic.id} value={topic.id}>
              {topic.ege_number ? `№${topic.ege_number} — ` : ''}{topic.title}
            </Option>
          ))}
        </Select>
      </div>

      {/* Список работ */}
      <div style={{ flex: 1, overflow: 'auto', margin: '0 -4px', padding: '0 4px 12px' }}>
        {loadingWorks ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : works.length === 0 ? (
          <Empty description="Работ нет" style={{ padding: 24 }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {works.map(work => {
              const isSelected = selectedWorkId === work.id;
              const stats = workStats[work.id] || {};
              const avg = stats.avgScore;
              const topic = work.expand?.topic;
              const kind = topic?.title || '';
              const tint = topicTint(kind);

              return (
                <div
                  key={work.id}
                  onClick={() => setSelectedWorkId(work.id)}
                  style={{
                    padding: 12,
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--rule)'}`,
                    borderRadius: 'var(--radius)',
                    background: isSelected ? 'var(--accent-soft)' : 'var(--bg-raised)',
                    cursor: 'pointer',
                    transition: 'border-color .12s, background .12s',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.borderColor = 'var(--ink-3)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.borderColor = 'var(--rule)';
                  }}
                >
                  {/* Заголовок + chip */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: 13.5,
                        color: 'var(--ink)',
                        lineHeight: 1.3,
                        marginBottom: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {work.title || 'Без названия'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(work.created).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                    {kind && <Chip tint={tint}>{kind}</Chip>}
                    {work.archived && <Chip tint="rose">архив</Chip>}
                  </div>

                  {/* Мини-статистика */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 6,
                    paddingTop: 8,
                    borderTop: `1px solid ${isSelected ? 'var(--accent)' : 'var(--rule-soft)'}`,
                  }}>
                    <StatMini label="сессий" value={stats.sessions ?? 0} />
                    <StatMini label="попыток" value={stats.attempts ?? 0} />
                    <StatMini
                      label="средний"
                      value={avg != null ? `${avg}%` : '—'}
                      good={avg != null && avg >= 80}
                      warn={avg != null && avg < 70 && avg >= 40}
                      danger={avg != null && avg < 40}
                    />
                  </div>

                  {/* Кнопки действий */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    <Button
                      size="small"
                      style={{ flex: 1 }}
                      onClick={(e) => { e.stopPropagation(); setSelectedWorkId(work.id); }}
                    >
                      Открыть
                    </Button>
                    <Button
                      size="small"
                      icon={<InboxOutlined />}
                      onClick={(e) => { e.stopPropagation(); handleArchiveToggle(work); }}
                    >
                      {work.archived ? 'Вернуть' : 'Архив'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ---- Правая панель: редактор ----
  const rightPanel = workLoading ? (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <Spin size="large" />
    </div>
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
  );

  return (
    <SplitLayout
      left={leftPanel}
      right={rightPanel}
      leftWidth={320}
      gap={20}
    />
  );
};

export default WorkEditorPage;
