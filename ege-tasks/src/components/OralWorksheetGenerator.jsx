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
  useWorksheetGeneration,
  useTaskDragDrop,
  useTaskEditing,
  useWorksheetActions,
  useDistribution,
} from '../hooks';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import './TaskWorksheet.css';

const { Option } = Select;
const { Panel } = Collapse;

const TaskSheetGenerator = () => {
  const { topics, tags, years, sources, subtopics } = useReferenceData();
  const [form] = Form.useForm();
  const worksheetGen = useWorksheetGeneration();
  const { variants, setVariants, loading, generateFromFilters } = worksheetGen;
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
  const [currentWork, setCurrentWork] = useState(null);
  const [progressiveDifficulty, setProgressiveDifficulty] = useState(false);

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
    const tasksPerVariant = values.tasksPerVariant || 20;

    // Валидация распределений
    if (values.progressiveDifficulty && (tagDistribution.items.length > 0 || difficultyDistribution.items.length > 0)) {
      message.warning('Автопрогрессия несовместима с ручным распределением по тегам/сложности');
      return;
    }
    if (tagDistribution.items.length > 0) {
      if (!tagDistribution.validate(tasksPerVariant)) return;
    }
    if (difficultyDistribution.items.length > 0) {
      if (!difficultyDistribution.validate()) return;
    }

    // Базовые фильтры
    const filters = {};
    if (values.topic) filters.topic = values.topic;
    if (values.subtopic) filters.subtopic = values.subtopic;
    if (values.difficulty) filters.difficulty = values.difficulty;
    if (values.source) filters.source = values.source;
    if (values.year) filters.year = values.year;
    if (values.filterTags && values.filterTags.length > 0) filters.tags = values.filterTags;
    if (values.hasAnswer !== undefined) filters.hasAnswer = values.hasAnswer === 'yes';
    if (values.hasSolution !== undefined) filters.hasSolution = values.hasSolution === 'yes';
    if (values.search) filters.search = values.search;

    await generateFromFilters(filters, {
      variantsMode: values.variantsMode || 'different',
      variantsCount: values.variantsCount || 1,
      tasksPerVariant,
      sortType: values.sortType || 'random',
      tagDistribution: tagDistribution.items.length > 0 ? tagDistribution.items : undefined,
      difficultyDistribution: difficultyDistribution.items.length > 0 ? difficultyDistribution.items : undefined,
      progressiveDifficulty: values.progressiveDifficulty || false,
      getLabelForTag: (tagId) => availableTags.find(t => t.id === tagId)?.title || tagId,
      getLabelForDifficulty: (val) => difficultyOptions.find(o => o.value === val)?.label || val,
    });
  };

  const handleReset = () => {
    worksheetGen.reset();
    setSelectedTopic(null);
    setSelectedSubtopic(null);
    tagDistribution.reset();
    difficultyDistribution.reset();
    form.resetFields();
    setCurrentWork(null);
    setProgressiveDifficulty(false);
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
    const topic = form.getFieldValue('topic') || null;
    if (currentWork?.id) {
      await worksheetActions.handleUpdateWork(currentWork.id, { ...values, topic }, variants);
    } else {
      await worksheetActions.handleSaveWork({ ...values, topic }, variants);
    }
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
      setCurrentWork(work);
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
            workTitle: 'Лист задач',
            progressiveDifficulty: false,
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

              <Form.Item name="progressiveDifficulty" valuePropName="checked">
                <Space>
                  <Switch
                    checked={progressiveDifficulty}
                    onChange={(checked) => {
                      setProgressiveDifficulty(checked);
                      if (checked) {
                        difficultyDistribution.reset();
                      }
                    }}
                  />
                  <span>Автопрогрессия сложности</span>
                </Space>
              </Form.Item>

              {selectedTopic && tagDistribution.items.length === 0 && !progressiveDifficulty && (
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
                          <Option value="А4-2V">А4 (2 вертикальные карточки)</Option>
                          <Option value="А4-3V">А4 (3 вертикальные карточки)</Option>
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
        initialTitle={currentWork?.title || 'Лист задач'}
        initialTimeLimit={currentWork?.time_limit ?? null}
        isEdit={!!currentWork?.id}
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
