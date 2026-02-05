import { useState, useRef, useEffect } from 'react';
import {
  Card,
  Form,
  Select,
  Space,
  Row,
  Col,
  Switch,
  Radio,
  InputNumber,
  Input,
  message,
  Spin,
  Tag,
  Divider,
  Collapse,
  Badge,
  Alert,
} from 'antd';
import {
  FilterOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import PrintableWorksheet from './PrintableWorksheet';
import TaskReplaceModal from './TaskReplaceModal';
import TaskEditModal from './TaskEditModal';
import SaveWorkModal from './worksheet/SaveWorkModal';
import LoadWorkModal from './worksheet/LoadWorkModal';
import VariantRenderer from './worksheet/VariantRenderer';
import AnswersPage from './worksheet/AnswersPage';
import VariantStats from './worksheet/VariantStats';
import ActionButtons from './worksheet/ActionButtons';
import DistributionPanel from './worksheet/DistributionPanel';
import { api } from '../services/pocketbase';
import {
  useTaskDragDrop,
  useTaskEditing,
  useWorksheetActions,
  useDistribution,
} from '../hooks';
import './TaskWorksheet.css';

const { Option } = Select;
const { Panel } = Collapse;

const TaskSheetGenerator = ({ topics, tags, years = [], sources = [], subtopics = [] }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [allTasks, setAllTasks] = useState([]);
  const [variants, setVariants] = useState([]);
  const [columns, setColumns] = useState(1);
  const [fontSize, setFontSize] = useState(12);
  const [showAnswersInline, setShowAnswersInline] = useState(false);
  const [showAnswersPage, setShowAnswersPage] = useState(true);
  const [showStudentInfo, setShowStudentInfo] = useState(true);
  const [variantLabel, setVariantLabel] = useState('Вариант');
  const [solutionSpace, setSolutionSpace] = useState('medium');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  const [compactMode, setCompactMode] = useState(false);
  const [hideTaskPrefixes, setHideTaskPrefixes] = useState(false);
  const [outputMode, setOutputMode] = useState('sheet'); // 'sheet' | 'cards'
  const [cardFormat, setCardFormat] = useState('А6');
  const [showCardAnswers, setShowCardAnswers] = useState(false);
  const [showCardSolutions, setShowCardSolutions] = useState(false);
  const [showCardStudentInfo, setShowCardStudentInfo] = useState(true);
  const printRef = useRef();

  // Хуки
  const worksheetActions = useWorksheetActions();
  const dragDropHandlers = useTaskDragDrop(variants, setVariants);
  const taskEditing = useTaskEditing(variants, setVariants);

  const syncTotal = (total) => form.setFieldValue('tasksPerVariant', total);
  const tagDistribution = useDistribution('tag', {
    onTotalChange: syncTotal,
    itemLabel: 'тег',
  });
  const difficultyDistribution = useDistribution('difficulty', {
    onTotalChange: syncTotal,
    itemLabel: 'уровень сложности',
  });

  // Состояния для тегов
  const [availableTags, setAvailableTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Модальные окна сохранения/загрузки
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [savedWorks, setSavedWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);

  // Счётчик доступных задач
  const [availableTasksCount, setAvailableTasksCount] = useState(0);
  const [loadingTasksCount, setLoadingTasksCount] = useState(false);

  // Загружаем доступные теги и счётчик задач при изменении темы/подтем
  useEffect(() => {
    loadAvailableTags();
  }, [selectedTopic, selectedSubtopic]);

  const loadAvailableTags = async () => {
    setLoadingTags(true);
    setLoadingTasksCount(true);
    try {
      const filters = {};
      if (selectedTopic) {
        filters.topic = selectedTopic;
      }

      if (selectedSubtopic) {
        filters.subtopic = selectedSubtopic;
      }

      // Получаем задачи для текущих фильтров (или все если фильтров нет)
      const tasks = await api.getTasks(Object.keys(filters).length > 0 ? filters : {});

      // Сохраняем количество доступных задач
      setAvailableTasksCount(tasks.length);

      // Собираем уникальные теги
      const tagSet = new Set();
      tasks.forEach(task => {
        if (task.tags) {
          if (Array.isArray(task.tags)) {
            task.tags.forEach(tagId => {
              if (tagId) tagSet.add(tagId);
            });
          } else if (typeof task.tags === 'string' && task.tags.length > 0) {
            tagSet.add(task.tags);
          }
        }
      });

      // Фильтруем доступные теги
      const filteredTags = tags.filter(tag => tagSet.has(tag.id));
      setAvailableTags(filteredTags);

    } catch (error) {
      console.error('Error loading available tags:', error);
    } finally {
      setLoadingTags(false);
      setLoadingTasksCount(false);
    }
  };

  // Опции сложности для DistributionPanel
  const difficultyOptions = [
    { value: '1', label: '1 - Базовый', color: '#52c41a' },
    { value: '2', label: '2 - Средний', color: '#faad14' },
    { value: '3', label: '3 - Повышенный', color: '#ff4d4f' },
    { value: '4', label: '4 - Высокий', color: '#722ed1' },
    { value: '5', label: '5 - Олимпиадный', color: '#13c2c2' },
  ];

  const handleGenerate = async (values) => {
    setLoading(true);
    try {
      const variantsCount = values.variantsCount || 1;
      const tasksPerVariant = values.tasksPerVariant || 20;
      const variantsMode = values.variantsMode || 'different';

      const generatedVariants = [];

      // Базовые фильтры из формы (включая теги-фильтры)
      const baseFilterTags = values.filterTags && values.filterTags.length > 0 ? values.filterTags : null;

      // Вспомогательная функция для добавления общих фильтров
      const applyCommonFilters = (filters) => {
        if (values.topic) filters.topic = values.topic;
        if (values.subtopic) filters.subtopic = values.subtopic;
        if (values.difficulty) filters.difficulty = values.difficulty;
        if (values.source) filters.source = values.source;
        if (values.year) filters.year = values.year;
        if (baseFilterTags) filters.tags = baseFilterTags;
        if (values.hasAnswer !== undefined) filters.hasAnswer = values.hasAnswer === 'yes';
        if (values.hasSolution !== undefined) filters.hasSolution = values.hasSolution === 'yes';
        return filters;
      };

      // Если теги настроены, используем их
      if (tagDistribution.items.length > 0) {
        // Валидация
        if (!tagDistribution.validate(tasksPerVariant)) {
          setLoading(false);
          return;
        }

        // Вспомогательная: фильтры для конкретного тега распределения
        const makeTagFilters = (tagId) => {
          const combinedTags = baseFilterTags
            ? [...new Set([tagId, ...baseFilterTags])]
            : [tagId];
          return applyCommonFilters({ tags: combinedTags });
        };

        // Собираем все доступные задачи по тегам для проверки
        const allAvailableTasks = {};
        for (const tagCount of tagDistribution.items) {
          const tasks = await api.getTasks(makeTagFilters(tagCount.tag));
          allAvailableTasks[tagCount.tag] = tasks;
        }

        // Для режима "Разные задачи" генерируем каждый вариант отдельно
        if (variantsMode === 'different') {
          // Отслеживаем использованные задачи, чтобы не повторяться между вариантами
          const usedTaskIds = new Set();

          for (let i = 0; i < variantsCount; i++) {
            const variantTasks = [];

            for (const tagCount of tagDistribution.items) {
              // Получаем задачи для этого тега, исключая уже использованные
              const availableTasks = allAvailableTasks[tagCount.tag].filter(
                t => !usedTaskIds.has(t.id)
              );

              // Перемешиваем и берём нужное количество
              const shuffled = [...availableTasks].sort(() => Math.random() - 0.5);
              const selected = shuffled.slice(0, tagCount.count);

              if (selected.length < tagCount.count) {
                const tagName = availableTags.find(t => t.id === tagCount.tag)?.title || 'неизвестный';
                message.warning(`Вариант ${i + 1}: для тега "${tagName}" найдено только ${selected.length} задач из ${tagCount.count} (не хватает уникальных задач)`);
              }

              // Добавляем в использованные
              selected.forEach(t => usedTaskIds.add(t.id));
              variantTasks.push(...selected);
            }

            // Перемешиваем задачи внутри варианта если нужно
            if (values.sortType === 'random') {
              variantTasks.sort(() => Math.random() - 0.5);
            }

            generatedVariants.push({
              number: i + 1,
              tasks: variantTasks,
            });
          }
        } else {
          // Для режимов "shuffled" и "same" - собираем один набор задач
          const baseTasks = [];
          for (const tagCount of tagDistribution.items) {
            const tasks = await api.getRandomTasks(tagCount.count, makeTagFilters(tagCount.tag));

            if (tasks.length < tagCount.count) {
              const tagName = availableTags.find(t => t.id === tagCount.tag)?.title || 'неизвестный';
              message.warning(`Для тега "${tagName}" найдено только ${tasks.length} задач из ${tagCount.count} запрошенных`);
            }

            baseTasks.push(...tasks);
          }

          // Перемешиваем базовый набор если нужно
          if (values.sortType === 'random') {
            baseTasks.sort(() => Math.random() - 0.5);
          }

          if (variantsMode === 'shuffled') {
            // Одинаковые задачи, разный порядок
            for (let i = 0; i < variantsCount; i++) {
              const shuffled = [...baseTasks].sort(() => Math.random() - 0.5);
              generatedVariants.push({
                number: i + 1,
                tasks: shuffled,
              });
            }
          } else {
            // Одинаковые задачи, одинаковый порядок
            for (let i = 0; i < variantsCount; i++) {
              generatedVariants.push({
                number: i + 1,
                tasks: [...baseTasks],
              });
            }
          }
        }

        setAllTasks(generatedVariants.flatMap(v => v.tasks));

      } else if (difficultyDistribution.items.length > 0) {
        // Генерация с распределением по сложности
        if (!difficultyDistribution.validate()) {
          setLoading(false);
          return;
        }

        // Сортируем по возрастанию сложности — лёгкие задачи вначале
        const sortedDifficultyCounts = [...difficultyDistribution.items].sort(
          (a, b) => (a.difficulty || '0').localeCompare(b.difficulty || '0')
        );

        // Собираем задачи по уровням сложности
        const allAvailableTasks = {};
        for (const dc of sortedDifficultyCounts) {
          const filters = applyCommonFilters({ difficulty: dc.difficulty });
          const tasks = await api.getTasks(filters);
          allAvailableTasks[dc.difficulty] = tasks;
        }

        if (variantsMode === 'different') {
          const usedTaskIds = new Set();

          for (let i = 0; i < variantsCount; i++) {
            const variantTasks = [];

            // Добавляем задачи группами по возрастанию сложности
            for (const dc of sortedDifficultyCounts) {
              const availableTasks = allAvailableTasks[dc.difficulty].filter(
                t => !usedTaskIds.has(t.id)
              );

              const shuffled = [...availableTasks].sort(() => Math.random() - 0.5);
              const selected = shuffled.slice(0, dc.count);

              if (selected.length < dc.count) {
                const label = difficultyOptions.find(o => o.value === dc.difficulty)?.label || dc.difficulty;
                message.warning(`Вариант ${i + 1}: для сложности "${label}" найдено только ${selected.length} задач из ${dc.count}`);
              }

              selected.forEach(t => usedTaskIds.add(t.id));
              variantTasks.push(...selected);
            }

            // Не перемешиваем — порядок по возрастанию сложности сохраняется

            generatedVariants.push({
              number: i + 1,
              tasks: variantTasks,
            });
          }
        } else {
          const baseTasks = [];
          // Добавляем задачи группами по возрастанию сложности
          for (const dc of sortedDifficultyCounts) {
            const filters = applyCommonFilters({ difficulty: dc.difficulty });
            const tasks = await api.getRandomTasks(dc.count, filters);

            if (tasks.length < dc.count) {
              const label = difficultyOptions.find(o => o.value === dc.difficulty)?.label || dc.difficulty;
              message.warning(`Для сложности "${label}" найдено только ${tasks.length} задач из ${dc.count}`);
            }

            baseTasks.push(...tasks);
          }

          // Не перемешиваем — порядок по возрастанию сложности сохраняется

          if (variantsMode === 'shuffled') {
            // В режиме "перемешанные" — перемешиваем только внутри каждого уровня сложности,
            // но общий порядок (от лёгких к сложным) сохраняется
            for (let i = 0; i < variantsCount; i++) {
              generatedVariants.push({ number: i + 1, tasks: [...baseTasks] });
            }
          } else {
            for (let i = 0; i < variantsCount; i++) {
              generatedVariants.push({ number: i + 1, tasks: [...baseTasks] });
            }
          }
        }

        setAllTasks(generatedVariants.flatMap(v => v.tasks));

      } else {
        // Стандартная генерация без тегов и без распределения по сложности
        const filters = applyCommonFilters({});

        const hasServerFilters = Object.keys(filters).length > 0;
        const tasksData = await api.getTasks(hasServerFilters ? filters : {});

        let filteredTasks = tasksData;

        // Клиентский поиск
        if (values.search) {
          const searchLower = values.search.toLowerCase();
          filteredTasks = filteredTasks.filter(task =>
            task.code?.toLowerCase().includes(searchLower) ||
            task.statement_md?.toLowerCase().includes(searchLower)
          );
        }

        if (filteredTasks.length === 0) {
          message.warning('Задачи не найдены по заданным фильтрам');
          setAllTasks([]);
          setVariants([]);
          setLoading(false);
          return;
        }

        // Сортировка
        let sortedTasks = [...filteredTasks];
        const sortType = values.sortType || 'code';

        if (sortType === 'code') {
          sortedTasks.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        } else if (sortType === 'difficulty') {
          sortedTasks.sort((a, b) => (a.difficulty || '1').localeCompare(b.difficulty || '1'));
        } else if (sortType === 'random') {
          sortedTasks = sortedTasks.sort(() => Math.random() - 0.5);
        }

        setAllTasks(sortedTasks);

        if (variantsMode === 'different') {
          // Разные задачи в каждом варианте
          for (let i = 0; i < variantsCount; i++) {
            const startIdx = i * tasksPerVariant;
            const endIdx = Math.min(startIdx + tasksPerVariant, sortedTasks.length);
            generatedVariants.push({
              number: i + 1,
              tasks: sortedTasks.slice(startIdx, endIdx),
            });
          }
        } else if (variantsMode === 'shuffled') {
          // Одинаковые задачи, разный порядок
          const baseTasks = sortedTasks.slice(0, tasksPerVariant);
          for (let i = 0; i < variantsCount; i++) {
            const shuffled = [...baseTasks].sort(() => Math.random() - 0.5);
            generatedVariants.push({
              number: i + 1,
              tasks: shuffled,
            });
          }
        } else {
          // Одинаковые задачи, одинаковый порядок
          const baseTasks = sortedTasks.slice(0, tasksPerVariant);
          for (let i = 0; i < variantsCount; i++) {
            generatedVariants.push({
              number: i + 1,
              tasks: [...baseTasks],
            });
          }
        }
      }

      setVariants(generatedVariants);

      const totalTasks = generatedVariants.reduce((sum, v) => sum + v.tasks.length, 0);
      message.success(`Сгенерировано ${variantsCount} вариант(ов), всего ${totalTasks} задач`);
    } catch (error) {
      console.error('Error loading tasks:', error);
      message.error('Ошибка при загрузке задач');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setAllTasks([]);
    setVariants([]);
    setSelectedTopic(null);
    setSelectedSubtopic(null);
    tagDistribution.reset();
    difficultyDistribution.reset();
    form.resetFields();
  };

  const handleFormValuesChange = (changedValues) => {
    if ('topic' in changedValues) {
      setSelectedTopic(changedValues.topic || null);
      setSelectedSubtopic(null);
      form.setFieldValue('subtopic', undefined);
      form.setFieldValue('filterTags', []);
      tagDistribution.reset();
      difficultyDistribution.reset();
    }
  };

  // Обработчики сохранения/загрузки через useWorksheetActions
  const handleSaveWork = async (values) => {
    await worksheetActions.handleSaveWork(values, variants);
    setSaveModalVisible(false);
  };

  const handleOpenLoadModal = async () => {
    setLoadModalVisible(true);
    setLoadingWorks(true);
    try {
      const works = await worksheetActions.handleLoadWorks();
      setSavedWorks(works);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleLoadWork = async (workId) => {
    setLoadingWorks(true);
    try {
      const { work, variants: loadedVariants } = await worksheetActions.handleLoadWork(workId);
      setVariants(loadedVariants);
      form.setFieldsValue({ workTitle: work.title, topic: work.topic });
      setLoadModalVisible(false);
      message.success(`Работа "${work.title}" успешно загружена`);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleDeleteWork = async (workId, workTitle) => {
    await worksheetActions.handleDeleteWork(workId);
    setSavedWorks(savedWorks.filter(w => w.id !== workId));
  };

  /**
   * Рендеринг варианта через переиспользуемый компонент
   */
  const renderVariant = (variant, workTitle, variantIndex) => (
    <VariantRenderer
      key={variant.number}
      variant={variant}
      variantIndex={variantIndex}
      compactMode={compactMode}
      fontSize={fontSize}
      columns={columns}
      showStudentInfo={showStudentInfo}
      showAnswersInline={showAnswersInline}
      solutionSpace={solutionSpace}
      variantLabel={variantLabel}
      hideTaskPrefixes={hideTaskPrefixes}
      dragDropHandlers={dragDropHandlers}
      onEditTask={taskEditing.handleEditTask}
      onReplaceTask={taskEditing.handleReplaceTask}
    />
  );

  return (
    <div className="task-worksheet-container">
      <Card
        title={
          <Space>
            <FilterOutlined />
            Листы задач - настройки
          </Space>
        }
        className="no-print"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleGenerate}
          onValuesChange={handleFormValuesChange}
          initialValues={{
            columns: 1,
            fontSize: 12,
            sortType: 'random',
            variantsCount: 1,
            variantsMode: 'different',
            tasksPerVariant: 20,
          }}
        >
          <Collapse defaultActiveKey={['filters', 'tags', 'variants', 'format']}>
            {/* Фильтры */}
            <Panel
              header={
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span>📋 Фильтры задач</span>
                  <Badge
                    count={loadingTasksCount ? '...' : availableTasksCount}
                    overflowCount={9999}
                    style={{ backgroundColor: availableTasksCount > 0 ? '#52c41a' : '#ff4d4f' }}
                    showZero
                  />
                </span>
              }
              key="filters"
            >
              <Row gutter={16}>
                <Col xs={24}>
                  <Form.Item name="search" label="Поиск по коду или тексту">
                    <Input
                      placeholder="Введите код задачи или текст..."
                      prefix={<SearchOutlined />}
                      allowClear
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="topic"
                    label="Тема"
                  >
                    <Select
                      placeholder="Все темы"
                      showSearch
                      optionFilterProp="children"
                      allowClear
                    >
                      {topics.map(topic => (
                        <Option key={topic.id} value={topic.id}>
                          №{topic.ege_number} - {topic.title}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="subtopic" label="Подтема">
                    <Select
                      placeholder={selectedTopic ? "Выберите подтему" : "Сначала выберите тему"}
                      showSearch
                      optionFilterProp="children"
                      allowClear
                      disabled={!selectedTopic}
                      onChange={(value) => setSelectedSubtopic(value || null)}
                    >
                      {subtopics
                        .filter(subtopic => !selectedTopic || subtopic.topic === selectedTopic)
                        .map(subtopic => (
                          <Option key={subtopic.id} value={subtopic.id}>
                            {subtopic.name}
                          </Option>
                        ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
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
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="filterTags" label="Теги">
                    <Select
                      mode="multiple"
                      placeholder="Фильтр по тегам"
                      allowClear
                      showSearch
                      optionFilterProp="children"
                      loading={loadingTags}
                    >
                      {availableTags.map(tag => (
                        <Option key={tag.id} value={tag.id}>
                          <Tag color={tag.color} style={{ marginRight: 4 }}>{tag.title}</Tag>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="source" label="Источник">
                    <Select placeholder="Любой" allowClear showSearch>
                      {sources.map(s => (
                        <Option key={s} value={s}>{s}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="year" label="Год">
                    <Select placeholder="Любой" allowClear showSearch>
                      {years.map(y => (
                        <Option key={y} value={y}>{y}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="sortType" label="Сортировка">
                    <Select>
                      <Option value="code">По коду</Option>
                      <Option value="difficulty">По сложности</Option>
                      <Option value="random">Случайная</Option>
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="hasAnswer" label="Наличие ответа">
                    <Radio.Group>
                      <Radio.Button value={undefined}>Все</Radio.Button>
                      <Radio.Button value="yes">С ответом</Radio.Button>
                      <Radio.Button value="no">Без ответа</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="hasSolution" label="Наличие решения">
                    <Radio.Group>
                      <Radio.Button value={undefined}>Все</Radio.Button>
                      <Radio.Button value="yes">С решением</Radio.Button>
                      <Radio.Button value="no">Без решения</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>
            </Panel>

            {/* Теги */}
            <Panel header="🏷️ Распределение по тегам (опционально)" key="tags">
              {!selectedTopic && (
                <Alert
                  message="Выберите тему, чтобы настроить распределение по тегам"
                  type="warning"
                  style={{ marginBottom: 16 }}
                />
              )}

              {selectedTopic && loadingTags && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <Spin tip="Загрузка доступных тегов..." />
                </div>
              )}

              {selectedTopic && !loadingTags && availableTags.length === 0 && (
                <Alert
                  message="В выбранной теме нет задач с тегами"
                  type="info"
                  style={{ marginBottom: 16 }}
                />
              )}

              {selectedTopic && !loadingTags && availableTags.length > 0 && (
                <>
                  <Alert
                    message={`Найдено ${availableTags.length} тег(ов) в задачах этой темы. Настройте количество задач для каждого тега. Общее количество задач будет автоматически рассчитано.`}
                    type="info"
                    style={{ marginBottom: 16 }}
                  />

                  <DistributionPanel
                    items={tagDistribution.items}
                    options={availableTags.map(tag => ({ value: tag.id, label: tag.title }))}
                    keyField="tag"
                    onAdd={tagDistribution.addItem}
                    onRemove={tagDistribution.removeItem}
                    onChange={tagDistribution.updateItem}
                    total={tagDistribution.getTotal()}
                    expectedTotal={form.getFieldValue('tasksPerVariant') || 0}
                    addButtonText="Добавить тег"
                    selectPlaceholder="Выберите тег"
                  />
                </>
              )}
            </Panel>

            {/* Сложность */}
            <Panel header="📊 Распределение по сложности (опционально)" key="difficulty">
              {!selectedTopic && (
                <Alert
                  message="Выберите тему, чтобы настроить распределение по сложности"
                  type="warning"
                  style={{ marginBottom: 16 }}
                />
              )}

              {selectedTopic && tagDistribution.items.length > 0 && (
                <Alert
                  message="Распределение по сложности нельзя использовать одновременно с распределением по тегам"
                  type="warning"
                  style={{ marginBottom: 16 }}
                />
              )}

              {selectedTopic && tagDistribution.items.length === 0 && (
                <DistributionPanel
                  items={difficultyDistribution.items}
                  options={difficultyOptions}
                  keyField="difficulty"
                  onAdd={difficultyDistribution.addItem}
                  onRemove={difficultyDistribution.removeItem}
                  onChange={difficultyDistribution.updateItem}
                  total={difficultyDistribution.getTotal()}
                  expectedTotal={form.getFieldValue('tasksPerVariant') || 0}
                  addButtonText="Добавить уровень сложности"
                  selectPlaceholder="Выберите уровень сложности"
                  showColorTags
                />
              )}
            </Panel>

            {/* Варианты */}
            <Panel header="🎲 Генерация вариантов" key="variants">
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="variantsCount" label="Количество вариантов">
                    <InputNumber min={1} max={10} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    name="tasksPerVariant"
                    label="Задач в варианте"
                    tooltip={tagDistribution.items.length > 0 || difficultyDistribution.items.length > 0 ? "Автоматически рассчитывается из распределения" : ""}
                  >
                    <InputNumber
                      min={1}
                      max={100}
                      style={{ width: '100%' }}
                      disabled={tagDistribution.items.length > 0 || difficultyDistribution.items.length > 0}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="variantsMode" label="Режим вариантов">
                    <Select>
                      <Option value="different">Разные задачи</Option>
                      <Option value="shuffled">Одинаковые, разный порядок</Option>
                      <Option value="same">Одинаковые задачи</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Panel>

            {/* Формат */}
            <Panel header="🎨 Формат печати" key="format">
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={24}>
                  <Form.Item label="Режим вывода" style={{ marginBottom: 0 }}>
                    <Radio.Group
                      value={outputMode}
                      onChange={(e) => setOutputMode(e.target.value)}
                      buttonStyle="solid"
                      size="large"
                    >
                      <Radio.Button value="sheet">Лист задач</Radio.Button>
                      <Radio.Button value="cards">Карточки</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '8px 0 16px' }} />

              {outputMode === 'sheet' && (
                <>
                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Колонки"
                        tooltip={compactMode ? "В компактном режиме - количество вариантов в ряд" : "Колонки для задач в варианте"}
                      >
                        <Radio.Group
                          value={columns}
                          onChange={(e) => setColumns(e.target.value)}
                          buttonStyle="solid"
                        >
                          <Radio.Button value={1}>1</Radio.Button>
                          <Radio.Button value={2}>2</Radio.Button>
                          <Radio.Button value={3}>3</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={8}>
                      <Form.Item label="Размер шрифта">
                        <Radio.Group
                          value={fontSize}
                          onChange={(e) => setFontSize(e.target.value)}
                          buttonStyle="solid"
                        >
                          <Radio.Button value={10}>10pt</Radio.Button>
                          <Radio.Button value={12}>12pt</Radio.Button>
                          <Radio.Button value={14}>14pt</Radio.Button>
                          <Radio.Button value={16}>16pt</Radio.Button>
                          <Radio.Button value={20}>20pt</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Место для решения">
                        <Radio.Group
                          value={solutionSpace}
                          onChange={(e) => setSolutionSpace(e.target.value)}
                          buttonStyle="solid"
                        >
                          <Radio.Button value="none">Нет</Radio.Button>
                          <Radio.Button value="small">Мало</Radio.Button>
                          <Radio.Button value="medium">Средне</Radio.Button>
                          <Radio.Button value="large">Много</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item label="Компактный режим">
                        <Switch checked={compactMode} onChange={setCompactMode} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Скрыть «Вычислите:» и т.п."
                        tooltip="Убирает типовые фразы из начала условия задач"
                      >
                        <Switch checked={hideTaskPrefixes} onChange={setHideTaskPrefixes} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Поля для ФИО">
                        <Switch
                          checked={showStudentInfo}
                          onChange={setShowStudentInfo}
                          disabled={compactMode}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Ответы в тексте">
                        <Switch
                          checked={showAnswersInline}
                          onChange={setShowAnswersInline}
                          disabled={compactMode}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item label="Лист с ответами">
                        <Switch checked={showAnswersPage} onChange={setShowAnswersPage} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item label="Название варианта">
                        <Input
                          value={variantLabel}
                          onChange={(e) => setVariantLabel(e.target.value)}
                          placeholder="Вариант"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )}

              {outputMode === 'cards' && (
                <>
                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Form.Item label="Формат карточки">
                        <Select value={cardFormat} onChange={setCardFormat}>
                          <Option value="А6">А6 (4 на листе A4)</Option>
                          <Option value="А5">А5 (2 на листе A4)</Option>
                          <Option value="А4">А4 (1 на листе)</Option>
                        </Select>
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={8}>
                      <Form.Item label="Размер шрифта">
                        <Radio.Group
                          value={fontSize}
                          onChange={(e) => setFontSize(e.target.value)}
                          buttonStyle="solid"
                        >
                          <Radio.Button value={10}>10pt</Radio.Button>
                          <Radio.Button value={12}>12pt</Radio.Button>
                          <Radio.Button value={14}>14pt</Radio.Button>
                          <Radio.Button value={16}>16pt</Radio.Button>
                          <Radio.Button value={20}>20pt</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item label="Поля для ФИ">
                        <Switch checked={showCardStudentInfo} onChange={setShowCardStudentInfo} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Ответы в карточках">
                        <Switch checked={showCardAnswers} onChange={setShowCardAnswers} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Решения в карточках">
                        <Switch checked={showCardSolutions} onChange={setShowCardSolutions} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Скрыть «Вычислите:» и т.п."
                        tooltip="Убирает типовые фразы из начала условия задач"
                      >
                        <Switch checked={hideTaskPrefixes} onChange={setHideTaskPrefixes} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item label="Название карточки">
                        <Input
                          value={variantLabel}
                          onChange={(e) => setVariantLabel(e.target.value)}
                          placeholder="Проверочная работа"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )}
            </Panel>
          </Collapse>

          <Form.Item style={{ marginTop: 16 }}>
            <ActionButtons
              hasVariants={variants.length > 0}
              loading={loading}
              onGenerate
              onOpenLoad={handleOpenLoadModal}
              onSave={() => setSaveModalVisible(true)}
              onPrint={worksheetActions.handlePrint}
              onExportPDF={() => worksheetActions.handleExportPDF(printRef, form.getFieldValue('workTitle') || 'Лист задач')}
              onReset={handleReset}
              pdfMethod={worksheetActions.pdfMethod}
              setPdfMethod={worksheetActions.setPdfMethod}
              puppeteerAvailable={worksheetActions.puppeteerAvailable}
              exporting={worksheetActions.exporting}
              saving={worksheetActions.saving}
              generateLabel="Сформировать лист"
            />
          </Form.Item>
        </Form>

        {/* Превью информация */}
        <VariantStats variants={variants} showAnswersPage={showAnswersPage} />
      </Card>

      {/* Печатный лист */}
      {variants.length > 0 && outputMode === 'sheet' && (
        <div ref={printRef} className="printable-worksheet">
          {compactMode && columns > 1 ? (
            // Группируем варианты по страницам (по columns штук на страницу)
            (() => {
              const pages = [];
              for (let i = 0; i < variants.length; i += columns) {
                const pageVariants = variants.slice(i, i + columns);
                pages.push(
                  <div key={i} className="variants-page">
                    <div
                      className="compact-variants-grid"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${columns}, 1fr)`,
                        columnGap: '10px',
                      }}
                    >
                      {pageVariants.map((variant, idx) => renderVariant(variant, form.getFieldValue('workTitle'), i + idx))}
                    </div>
                  </div>
                );
              }
              return pages;
            })()
          ) : (
            variants.map((variant, index) => renderVariant(variant, form.getFieldValue('workTitle'), index))
          )}
          {<AnswersPage variants={variants} variantLabel={variantLabel} show={showAnswersPage} />}
        </div>
      )}

      {/* Режим карточек */}
      {variants.length > 0 && outputMode === 'cards' && (
        <PrintableWorksheet
          ref={printRef}
          key={variants.map(v => v.tasks.map(t => t.id).join(',')).join('|')}
          cards={variants.map(v => v.tasks)}
          title={variantLabel || 'Проверочная работа'}
          showAnswers={showCardAnswers}
          showSolutions={showCardSolutions}
          format={cardFormat}
          cardsCount={variants.length}
          tasksPerCard={variants[0]?.tasks.length || 0}
          topicName=""
          variantLabel={variantLabel || 'Проверочная работа'}
          topics={topics}
          tags={tags}
          subtopics={subtopics}
          hideTaskPrefixes={hideTaskPrefixes}
          fontSize={fontSize}
          showStudentInfo={showCardStudentInfo}
          onEditTask={taskEditing.handleEditTask}
          onCardsChange={(newCards) => {
            // Синхронизируем обратно в variants
            const newVariants = variants.map((v, i) => ({
              ...v,
              tasks: newCards[i] || v.tasks,
            }));
            setVariants(newVariants);
          }}
        />
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" tip="Генерируем варианты..." />
        </div>
      )}

      {/* Модальные окна */}
      <TaskReplaceModal
        visible={taskEditing.replaceModalVisible}
        taskToReplace={taskEditing.taskToReplace}
        onConfirm={taskEditing.handleConfirmReplace}
        onCancel={taskEditing.handleCancelReplace}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        currentVariantTasks={taskEditing.taskToReplace ? variants[taskEditing.taskToReplace.variantIndex]?.tasks || [] : []}
      />

      {taskEditing.taskToEdit && (
        <TaskEditModal
          task={taskEditing.taskToEdit}
          visible={taskEditing.editModalVisible}
          onClose={taskEditing.handleCancelEdit}
          onSave={taskEditing.handleSaveEdit}
          onDelete={taskEditing.handleDeleteEdit}
          allTags={tags || []}
          allSources={sources || []}
          allYears={years || []}
          allSubtopics={subtopics || []}
          allTopics={topics || []}
        />
      )}

      <SaveWorkModal
        visible={saveModalVisible}
        onCancel={() => setSaveModalVisible(false)}
        onSave={handleSaveWork}
        saving={worksheetActions.saving}
        variantsCount={variants.length}
        tasksCount={variants.reduce((sum, v) => sum + v.tasks.length, 0)}
        initialTitle="Лист задач"
      />

      <LoadWorkModal
        visible={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        works={savedWorks}
        loading={loadingWorks}
        onLoad={handleLoadWork}
        onDelete={handleDeleteWork}
      />
    </div>
  );
};

export default TaskSheetGenerator;
