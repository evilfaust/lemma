import { useState, useEffect, useRef } from 'react';
import { Row, Col, Spin, Empty, Pagination, Skeleton, Card, Space, Button, Select, Checkbox, Modal, App } from 'antd';
import TaskFilters from './TaskFilters';
import TaskCard from './TaskCard';
import TaskEditModal from './TaskEditModal';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';

const TaskList = ({
  initialFilters = null,
  initialFiltersToken = 0,
}) => {
  const { topics, tags, years, sources, subtopics, loading: initialLoading } = useReferenceData();
  const { message } = App.useApp();
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [bulkTags, setBulkTags] = useState([]);
  const [bulkTagMode, setBulkTagMode] = useState('add'); // add | replace
  const [bulkDifficulty, setBulkDifficulty] = useState(null);
  const [bulkSource, setBulkSource] = useState(null);
  const [bulkSubtopics, setBulkSubtopics] = useState([]);
  const [bulkTopic, setBulkTopic] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const filtersRef = useRef({}); // Сохраняем фильтры в ref, чтобы они не терялись

  useEffect(() => {
    if (!initialFiltersToken) {
      loadTasks();
    }
  }, [initialFiltersToken]);

  // Применяем клиентский поиск и сортировку
  // (фильтрация по остальным параметрам происходит на сервере)
  useEffect(() => {
    let result = [...tasks];

    // Применяем поиск
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(task => {
        return (
          task.code?.toLowerCase().includes(searchLower) ||
          task.statement_md?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Применяем сортировку
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'code':
          result.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
          break;
        case 'difficulty':
          result.sort((a, b) => {
            const diffA = parseInt(a.difficulty || '1');
            const diffB = parseInt(b.difficulty || '1');
            return diffA - diffB;
          });
          break;
        case 'created':
          result.sort((a, b) => new Date(b.created) - new Date(a.created));
          break;
        case 'updated':
          result.sort((a, b) => new Date(b.updated) - new Date(a.updated));
          break;
        default:
          result.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
      }
    } else {
      // Сортировка по умолчанию - по коду
      result.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    }

    setFilteredTasks(result);

    // Сбрасываем на первую страницу при изменении поиска
    if (filters.search) {
      setCurrentPage(1);
    }
  }, [filters.search, filters.sortBy, tasks]);

  // Если после фильтрации/удаления текущая страница вышла за пределы,
  // возвращаем пользователя на последнюю доступную страницу.
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredTasks.length, pageSize, currentPage]);

  const loadTasks = async (newFilters = {}, resetPage = false) => {
    setLoading(true);
    try {
      const data = await api.getTasks(newFilters);
      setTasks(data);
      setFilteredTasks(data);
      setSelectedTaskIds(new Set());
      setBulkTags([]);
      setBulkTagMode('add');
      setBulkDifficulty(null);
      setBulkSource(null);
      setBulkSubtopics([]);
      setBulkTopic(null);
      if (resetPage) {
        setCurrentPage(1);
      }
      // Сохраняем фильтры в ref
      filtersRef.current = newFilters;
    } catch (error) {
      console.error('Error loading tasks:', error);
      message.error('Ошибка при загрузке задач');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);

    // Разделяем поиск от остальных фильтров
    const { search, ...serverFilters } = newFilters;

    // Загружаем задачи с серверными фильтрами и сбрасываем страницу
    loadTasks(serverFilters, true);
  };

  const handlePageChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  const handleTaskUpdate = () => {
    // Перезагружаем задачи с СОХРАНЁННЫМИ фильтрами из ref
    // Фильтры и страница НЕ сбрасываются!
    loadTasksWithoutReset(filtersRef.current);
  };

  const handleCreateTask = () => {
    setCreateModalVisible(true);
  };

  const handleTaskSave = async (taskId, taskData) => {
    try {
      if (taskId === null) {
        // Создание новой задачи
        await api.createTask(taskData);
        message.success('Задача успешно создана');
      } else {
        // Обновление существующей задачи
        await api.updateTask(taskId, taskData);
        message.success('Задача успешно обновлена');
      }

      // Перезагружаем список
      handleTaskUpdate();
    } catch (error) {
      console.error('Error saving task:', error);
      message.error('Ошибка при сохранении задачи');
      throw error;
    }
  };

  const loadTasksWithoutReset = async (currentFilters = {}) => {
    setLoading(true);
    try {
      const data = await api.getTasks(currentFilters);
      setTasks(data);
      setSelectedTaskIds(new Set());
      setBulkTags([]);
      setBulkTagMode('add');
      setBulkDifficulty(null);
      setBulkSource(null);
      setBulkSubtopics([]);
      setBulkTopic(null);
      // filteredTasks обновится через useEffect с клиентским поиском
      // НЕ сбрасываем currentPage и фильтры!
      filtersRef.current = currentFilters; // Обновляем ref
    } catch (error) {
      console.error('Error loading tasks:', error);
      message.error('Ошибка при загрузке задач');
    } finally {
      setLoading(false);
    }
  };

  // Пагинация
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);
  const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.id));
  const pageAllSelected = paginatedTasks.length > 0 && paginatedTasks.every(t => selectedTaskIds.has(t.id));
  const pageSomeSelected = paginatedTasks.some(t => selectedTaskIds.has(t.id));

  const handleSelectTask = (taskId, checked) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  };

  const handleSelectPage = (checked) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (checked) {
        paginatedTasks.forEach(t => next.add(t.id));
      } else {
        paginatedTasks.forEach(t => next.delete(t.id));
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  const applyBulkTags = async () => {
    if (selectedTaskIds.size === 0) {
      message.warning('Выберите задачи');
      return;
    }
    if (bulkTags.length === 0) {
      message.warning('Выберите теги');
      return;
    }
    setBulkLoading(true);
    message.loading({ content: 'Применяем теги...', key: 'bulk', duration: 0 });
    try {
      for (const task of selectedTasks) {
        const existing = task.tags || [];
        const nextTags = bulkTagMode === 'replace'
          ? [...bulkTags]
          : Array.from(new Set([...existing, ...bulkTags]));
        await api.updateTask(task.id, { tags: nextTags });
      }
      message.success({
        content: bulkTagMode === 'replace'
          ? `Теги заменены у ${selectedTaskIds.size} задач`
          : `Теги добавлены к ${selectedTaskIds.size} задачам`,
        key: 'bulk',
        duration: 2,
      });
      setSelectedTaskIds(new Set());
      setBulkTags([]);
      setBulkTagMode('add');
      await loadTasksWithoutReset(filtersRef.current);
    } catch (error) {
      console.error('Error bulk tag update:', error);
      message.error({ content: 'Ошибка при массовом обновлении тегов', key: 'bulk', duration: 2 });
    } finally {
      setBulkLoading(false);
    }
  };

  const applyBulkDifficulty = async () => {
    if (selectedTaskIds.size === 0) {
      message.warning('Выберите задачи');
      return;
    }
    if (!bulkDifficulty) {
      message.warning('Выберите сложность');
      return;
    }
    setBulkLoading(true);
    message.loading({ content: 'Обновляем сложность...', key: 'bulk', duration: 0 });
    try {
      for (const task of selectedTasks) {
        await api.updateTask(task.id, { difficulty: bulkDifficulty });
      }
      message.success({ content: `Сложность обновлена у ${selectedTaskIds.size} задач`, key: 'bulk', duration: 2 });
      setSelectedTaskIds(new Set());
      setBulkDifficulty(null);
      await loadTasksWithoutReset(filtersRef.current);
    } catch (error) {
      console.error('Error bulk difficulty update:', error);
      message.error({ content: 'Ошибка при массовом обновлении сложности', key: 'bulk', duration: 2 });
    } finally {
      setBulkLoading(false);
    }
  };

  const applyBulkSource = async () => {
    if (selectedTaskIds.size === 0) {
      message.warning('Выберите задачи');
      return;
    }
    if (!bulkSource) {
      message.warning('Выберите источник');
      return;
    }
    setBulkLoading(true);
    message.loading({ content: 'Обновляем источник...', key: 'bulk', duration: 0 });
    try {
      for (const task of selectedTasks) {
        await api.updateTask(task.id, { source: bulkSource });
      }
      message.success({ content: `Источник обновлён у ${selectedTaskIds.size} задач`, key: 'bulk', duration: 2 });
      setSelectedTaskIds(new Set());
      setBulkSource(null);
      await loadTasksWithoutReset(filtersRef.current);
    } catch (error) {
      console.error('Error bulk source update:', error);
      message.error({ content: 'Ошибка при массовом обновлении источника', key: 'bulk', duration: 2 });
    } finally {
      setBulkLoading(false);
    }
  };

  const applyBulkSubtopics = async () => {
    if (selectedTaskIds.size === 0) {
      message.warning('Выберите задачи');
      return;
    }
    if (bulkSubtopics.length === 0) {
      message.warning('Выберите подтемы');
      return;
    }
    setBulkLoading(true);
    message.loading({ content: 'Обновляем подтемы...', key: 'bulk', duration: 0 });
    try {
      for (const task of selectedTasks) {
        await api.updateTask(task.id, { subtopic: bulkSubtopics });
      }
      message.success({ content: `Подтемы обновлены у ${selectedTaskIds.size} задач`, key: 'bulk', duration: 2 });
      setSelectedTaskIds(new Set());
      setBulkSubtopics([]);
      await loadTasksWithoutReset(filtersRef.current);
    } catch (error) {
      console.error('Error bulk subtopic update:', error);
      message.error({ content: 'Ошибка при массовом обновлении подтем', key: 'bulk', duration: 2 });
    } finally {
      setBulkLoading(false);
    }
  };

  const applyBulkTopic = async () => {
    if (selectedTaskIds.size === 0) {
      message.warning('Выберите задачи');
      return;
    }
    if (!bulkTopic) {
      message.warning('Выберите тему');
      return;
    }
    setBulkLoading(true);
    message.loading({ content: 'Обновляем тему...', key: 'bulk', duration: 0 });
    try {
      for (const task of selectedTasks) {
        await api.updateTask(task.id, { topic: bulkTopic, subtopic: [] });
      }
      message.success({ content: `Тема обновлена у ${selectedTaskIds.size} задач`, key: 'bulk', duration: 2 });
      setSelectedTaskIds(new Set());
      setBulkTopic(null);
      setBulkSubtopics([]);
      await loadTasksWithoutReset(filtersRef.current);
    } catch (error) {
      console.error('Error bulk topic update:', error);
      message.error({ content: 'Ошибка при массовом обновлении темы', key: 'bulk', duration: 2 });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.size === 0) {
      message.warning('Выберите задачи');
      return;
    }

    Modal.confirm({
      title: 'Удалить выбранные задачи?',
      content: `Вы уверены, что хотите удалить ${selectedTaskIds.size} задач(и)? Это действие нельзя отменить.`,
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        setBulkLoading(true);
        message.loading({ content: 'Удаляем задачи...', key: 'bulk', duration: 0 });
        try {
          for (const taskId of selectedTaskIds) {
            await api.deleteTask(taskId);
          }
          message.success({ content: `Удалено задач: ${selectedTaskIds.size}`, key: 'bulk', duration: 2 });
          setSelectedTaskIds(new Set());
          await loadTasksWithoutReset(filtersRef.current);
        } catch (error) {
          console.error('Error bulk delete:', error);
          message.error({ content: 'Ошибка при массовом удалении', key: 'bulk', duration: 2 });
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  if (initialLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <TaskFilters
        topics={topics}
        tags={tags}
        years={years}
        sources={sources}
        subtopics={subtopics}
        onFilterChange={handleFilterChange}
        totalCount={filteredTasks.length}
        onCreateTask={handleCreateTask}
        initialFilters={initialFilters}
        initialFiltersToken={initialFiltersToken}
      />

      <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
        <Space wrap>
          <strong>Выбрано: {selectedTaskIds.size}</strong>
          {selectedTaskIds.size === 0 && (
            <span style={{ color: '#999' }}>Выберите задачи, чтобы применить массовые действия</span>
          )}
            <Checkbox
              checked={pageAllSelected}
              indeterminate={pageSomeSelected && !pageAllSelected}
              onChange={(e) => handleSelectPage(e.target.checked)}
              disabled={paginatedTasks.length === 0}
            >
              Выделить все на странице
            </Checkbox>
            <Button onClick={handleClearSelection}>Снять выделение</Button>
            <Select
              mode="multiple"
              placeholder="Теги"
              value={bulkTags}
              onChange={setBulkTags}
              style={{ minWidth: 220 }}
              options={(tags || []).map(t => ({ label: t.title, value: t.id }))}
              disabled={bulkLoading || selectedTaskIds.size === 0}
            />
            <Select
              value={bulkTagMode}
              onChange={setBulkTagMode}
              style={{ width: 180 }}
              options={[
                { label: 'Добавить теги', value: 'add' },
                { label: 'Заменить теги', value: 'replace' },
              ]}
              disabled={bulkLoading || selectedTaskIds.size === 0}
            />
            <Button type="primary" onClick={applyBulkTags} loading={bulkLoading} disabled={selectedTaskIds.size === 0}>
              {bulkTagMode === 'replace' ? 'Заменить теги' : 'Добавить теги'}
            </Button>
            <Select
              placeholder="Сложность"
              value={bulkDifficulty}
              onChange={setBulkDifficulty}
              style={{ width: 160 }}
              options={[
                { label: '1 - Базовый', value: '1' },
                { label: '2 - Средний', value: '2' },
                { label: '3 - Повышенный', value: '3' },
                { label: '4 - Высокий', value: '4' },
                { label: '5 - Олимпиадный', value: '5' },
              ]}
              disabled={bulkLoading || selectedTaskIds.size === 0}
            />
            <Button onClick={applyBulkDifficulty} loading={bulkLoading} disabled={selectedTaskIds.size === 0}>
              Сменить сложность
            </Button>
            <Select
              placeholder="Источник"
              value={bulkSource}
              onChange={setBulkSource}
              style={{ minWidth: 220 }}
              options={(sources || []).map(s => ({ label: s, value: s }))}
              disabled={bulkLoading || selectedTaskIds.size === 0}
              showSearch
            />
            <Button onClick={applyBulkSource} loading={bulkLoading} disabled={selectedTaskIds.size === 0}>
              Сменить источник
            </Button>
            <Select
              placeholder="Тема"
              value={bulkTopic}
              onChange={setBulkTopic}
              style={{ minWidth: 220 }}
              options={(topics || []).map(t => ({
                label: `№${t.ege_number} - ${t.title}`,
                value: t.id,
              }))}
              disabled={bulkLoading || selectedTaskIds.size === 0}
              showSearch
              optionFilterProp="label"
            />
            <Button onClick={applyBulkTopic} loading={bulkLoading} disabled={selectedTaskIds.size === 0}>
              Сменить тему
            </Button>
            <Select
              mode="multiple"
              placeholder="Подтемы"
              value={bulkSubtopics}
              onChange={setBulkSubtopics}
              style={{ minWidth: 240 }}
              options={(subtopics || [])
                .filter(st => !bulkTopic || st.topic === bulkTopic)
                .map(st => ({
                  label: st.name || st.title,
                  value: st.id,
                }))}
              disabled={bulkLoading || selectedTaskIds.size === 0}
              showSearch
            />
            <Button onClick={applyBulkSubtopics} loading={bulkLoading} disabled={selectedTaskIds.size === 0}>
              Сменить подтемы
            </Button>
            <Button danger onClick={handleBulkDelete} loading={bulkLoading} disabled={selectedTaskIds.size === 0}>
              Удалить
            </Button>
        </Space>
      </Card>

      {loading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Col xs={24} sm={24} md={12} lg={8} key={i}>
              <Card>
                <Skeleton active paragraph={{ rows: 4 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : filteredTasks.length === 0 ? (
        <Empty 
          description="Задачи не найдены"
          style={{ marginTop: 50 }}
        />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {paginatedTasks.map((task) => (
              <Col xs={24} sm={24} md={12} lg={8} key={task.id}>
                <TaskCard
                  task={task}
                  allTags={tags}
                  allSources={sources}
                  allYears={years}
                  allSubtopics={subtopics}
                  allTopics={topics}
                  onUpdate={handleTaskUpdate}
                  selected={selectedTaskIds.has(task.id)}
                  onSelect={handleSelectTask}
                />
              </Col>
            ))}
          </Row>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredTasks.length}
              onChange={handlePageChange}
              showSizeChanger
              showTotal={(total) => `Всего задач: ${total}`}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </div>
        </>
      )}

      {/* Модальное окно создания задачи */}
      <TaskEditModal
        task={null}
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSave={handleTaskSave}
        onDelete={null}
        allTags={tags || []}
        allSources={sources || []}
        allYears={years || []}
        allSubtopics={subtopics || []}
        allTopics={topics || []}
      />
    </div>
  );
};

export default TaskList;
