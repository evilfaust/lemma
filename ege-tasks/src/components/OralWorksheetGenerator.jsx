import { useState, useRef, useEffect } from 'react';
import { Card, Form, Select, Space, Row, Col, Switch, Radio, InputNumber, Input, Spin, Tag, Divider, Collapse, Badge, Alert, App } from 'antd';
import {
  FilterOutlined,
  SearchOutlined,
  TagsOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import PrintableWorksheet from './PrintableWorksheet';
import WorksheetGridPrint from './worksheet/WorksheetGridPrint';
import TaskReplaceModal from './TaskReplaceModal';
import TaskEditModal from './TaskEditModal';
import SaveWorkModal from './worksheet/SaveWorkModal';
import LoadWorkModal from './worksheet/LoadWorkModal';
import VariantRenderer from './worksheet/VariantRenderer';
import AnswersPage from './worksheet/AnswersPage';
import VariantStats from './worksheet/VariantStats';
import ActionButtons from './worksheet/ActionButtons';
import DistributionPanel from './worksheet/DistributionPanel';
import FormatSettings from './worksheet/FormatSettings';
import {
  useWorksheetGeneration,
  useTaskDragDrop,
  useTaskEditing,
  useWorksheetActions,
  useDistribution,
  useAvailableTags,
  useTaskCounter,
} from '../hooks';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import './TaskWorksheet.css';

const { Option } = Select;

const TaskSheetGenerator = () => {
  const { message } = App.useApp();
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
  const [cryptogramEnabled, setCryptogramEnabled] = useState(false);
  const [cryptogramPhrase, setCryptogramPhrase] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  const [compactMode, setCompactMode] = useState(false);
  const [hideTaskPrefixes, setHideTaskPrefixes] = useState(false);
  const [outputMode, setOutputMode] = useState('sheet'); // 'sheet' | 'cards'
  const [sheetFormat, setSheetFormat] = useState('A4'); // 'A4' | 'A5'
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

  // Доступные теги (по выбранной теме/подтеме)
  const { availableTags, loadingTags } = useAvailableTags(selectedTopic, selectedSubtopic, tags);

  // Модальные окна сохранения/загрузки
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [savedWorks, setSavedWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [currentWork, setCurrentWork] = useState(null);
  const [progressiveDifficulty, setProgressiveDifficulty] = useState(false);

  // Счётчик доступных задач (дебаунс 500мс)
  const watchedValues = Form.useWatch([], form);
  const tasksPerVariantValue = Form.useWatch('tasksPerVariant', form) || 0;
  const { availableTasksCount, loadingTasksCount } = useTaskCounter(watchedValues);

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
      if (!difficultyDistribution.validate(tasksPerVariant)) return;
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

  const handleExportMD = () => {
    const title = form.getFieldValue('workTitle') || 'Лист задач';
    let md = `# ${title}\n\n`;
    variants.forEach(variant => {
      md += `## ${variantLabel} ${variant.number}\n\n`;
      (variant.tasks || []).forEach((task, idx) => {
        md += `**${idx + 1}.** \`${task.code}\`\n\n${task.statement_md}\n\n`;
        if (task.answer) md += `> **Ответ:** ${task.answer}\n\n`;
        md += `---\n\n`;
      });
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.md`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
    message.success('Markdown успешно сохранён');
  };

  /**
   * Рендеринг варианта через переиспользуемый компонент
   */
  const handleSheetPrint = () => {
    const styleId = 'sheet-print-page-style';
    document.getElementById(styleId)?.remove();
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `@media print { @page { size: ${sheetFormat} portrait; margin: 8mm 5mm; } }`;
    document.head.appendChild(style);
    const cleanup = () => {
      document.getElementById(styleId)?.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

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
      cryptogramEnabled={cryptogramEnabled}
      cryptogramPhrase={cryptogramPhrase}
    />
  );

  useEffect(() => {
    if (!cryptogramEnabled) return;
    setCompactMode(false);
    setShowAnswersInline(false);
  }, [cryptogramEnabled]);

  const collapseItems = [
    {
      key: 'filters',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FilterOutlined />
          <span>Фильтры задач</span>
          {selectedTopic ? (
            <Badge
              count={loadingTasksCount ? '...' : availableTasksCount}
              overflowCount={9999}
              style={{ backgroundColor: availableTasksCount > 0 ? '#52c41a' : '#ff4d4f' }}
              showZero
            />
          ) : (
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>все темы</span>
          )}
        </span>
      ),
      children: (
        <>
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
                      {topic.ege_number ? `№${topic.ege_number} — ` : ""}{topic.title}
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
        </>
      ),
    },
    {
      key: 'tags',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TagsOutlined />
          <span>Распределение по тегам</span>
          <span style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400 }}>опционально</span>
        </span>
      ),
      children: (
        <>
          {!selectedTopic && (
            <Alert
              message="Выберите тему, чтобы настроить распределение по тегам"
              type="warning"
              style={{ marginBottom: 16 }}
            />
          )}

          {selectedTopic && loadingTags && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Spin />
              <div style={{ marginTop: 8, color: '#666' }}>Загрузка доступных тегов...</div>
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
        </>
      ),
    },
    {
      key: 'difficulty',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChartOutlined />
          <span>Распределение по сложности</span>
          <span style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400 }}>опционально</span>
        </span>
      ),
      children: (
        <>
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
        </>
      ),
    },
    {
      key: 'variants',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThunderboltOutlined />
          <span>Генерация вариантов</span>
        </span>
      ),
      children: (
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
      ),
    },
    {
      key: 'format',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PrinterOutlined />
          <span>Формат печати</span>
        </span>
      ),
      children: (
        <>
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
              <FormatSettings
                columns={columns}
                setColumns={setColumns}
                fontSize={fontSize}
                setFontSize={setFontSize}
                solutionSpace={solutionSpace}
                setSolutionSpace={setSolutionSpace}
                compactMode={compactMode}
                setCompactMode={setCompactMode}
                hideTaskPrefixes={hideTaskPrefixes}
                setHideTaskPrefixes={setHideTaskPrefixes}
                showStudentInfo={showStudentInfo}
                setShowStudentInfo={setShowStudentInfo}
                showAnswersInline={showAnswersInline}
                setShowAnswersInline={setShowAnswersInline}
                showAnswersPage={showAnswersPage}
                setShowAnswersPage={setShowAnswersPage}
                variantLabel={variantLabel}
                setVariantLabel={setVariantLabel}
                cryptogramEnabled={cryptogramEnabled}
                setCryptogramEnabled={setCryptogramEnabled}
                cryptogramPhrase={cryptogramPhrase}
                setCryptogramPhrase={setCryptogramPhrase}
                tasksCount={tasksPerVariantValue}
              />

              <Row gutter={16}>
                <Col xs={24} md={6}>
                  <Form.Item label="Формат листа">
                    <Radio.Group
                      value={sheetFormat}
                      onChange={(e) => setSheetFormat(e.target.value)}
                      buttonStyle="solid"
                    >
                      <Radio.Button value="A4">A4</Radio.Button>
                      <Radio.Button value="A5">A5</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {outputMode === 'cards' && (
            <>
              <Row gutter={16}>
                <Col xs={24} md={6}>
                  <Form.Item label="Формат карточек">
                    <Select value={cardFormat} onChange={setCardFormat}>
                      <Option value="А6">A6</Option>
                      <Option value="А5">A5</Option>
                      <Option value="А4">A4</Option>
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item label="Показывать ответы">
                    <Switch checked={showCardAnswers} onChange={setShowCardAnswers} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item label="Показывать решения">
                    <Switch checked={showCardSolutions} onChange={setShowCardSolutions} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item label="Поля для ФИО">
                    <Switch checked={showCardStudentInfo} onChange={setShowCardStudentInfo} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
        </>
      ),
    },
  ];

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
          <Collapse defaultActiveKey={['filters', 'tags', 'variants', 'format']} items={collapseItems} />

          <Form.Item style={{ marginTop: 16 }}>
            <ActionButtons
              hasVariants={variants.length > 0}
              loading={loading}
              onGenerate
              onOpenLoad={handleOpenLoadModal}
              onSave={() => setSaveModalVisible(true)}
              onPrint={outputMode === 'sheet' ? handleSheetPrint : worksheetActions.handlePrint}
              onExportPDF={() => worksheetActions.handleExportPDF(
                printRef,
                form.getFieldValue('workTitle') || 'Лист задач',
                outputMode === 'sheet'
                  ? {
                      format: sheetFormat,
                      marginTop: '5mm', marginBottom: '5mm', marginLeft: '5mm', marginRight: '5mm',
                      extraCSS: '.sheet-pages-preview { display: block !important; padding: 0 !important; background: none !important; } .sheet-page { box-shadow: none !important; break-after: avoid !important; page-break-after: avoid !important; border-bottom: 0.3mm solid #ccc; padding-bottom: 3mm !important; margin-bottom: 3mm !important; } .sheet-page:last-child { border-bottom: none !important; } .sheet-page-a4, .sheet-page-a5 { min-height: 0 !important; width: 100% !important; padding: 0 !important; } .sheet-page-label { display: none !important; } .sheet-page .variant-container { padding-top: 0 !important; } .variant-header { padding: 3px 5px !important; } .task-item { margin-bottom: 4px !important; }',
                    }
                  : {
                      marginTop: '5mm', marginBottom: '5mm', marginLeft: '5mm', marginRight: '5mm',
                      extraCSS: `
                        .printable-worksheet { min-height: 0 !important; padding: 0 !important; }
                        .title-page { min-height: 0 !important; }
                        .variant-container { padding-top: 0 !important; margin-bottom: 6px !important; }
                        .variant-header { padding: 4px 8px !important; margin-bottom: 4px !important; }
                        .tasks-content { margin-top: 6px !important; }
                        .task-item { margin-bottom: 8px !important; padding-bottom: 6px !important; }
                        .answers-page { padding: 8px !important; }
                        .variant-answers { margin-bottom: 12px !important; }
                      `,
                    }
              )}
              onExportMD={handleExportMD}
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

      {/* Рабочий лист с клеткой — только в режиме «Лист задач» */}
      {variants.length > 0 && outputMode === 'sheet' && (
        <WorksheetGridPrint
          pages={variants.map(v => ({
            title: form.getFieldValue('workTitle') || 'Лист задач',
            label: `${variantLabel} ${v.number}`,
            tasks: v.tasks,
          }))}
          hideTaskPrefixes={hideTaskPrefixes}
        />
      )}

      {/* Лист задач — постраничный предпросмотр */}
      {variants.length > 0 && outputMode === 'sheet' && (() => {
        const workTitle = form.getFieldValue('workTitle');
        const pageClass = `sheet-page sheet-page-${sheetFormat.toLowerCase()}`;
        const pageContents = [];

        if (compactMode && columns > 1) {
          for (let i = 0; i < variants.length; i += columns) {
            const pageVariants = variants.slice(i, i + columns);
            pageContents.push({
              key: `page-${i}`,
              content: (
                <div
                  className="compact-variants-grid"
                  style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, columnGap: '10px' }}
                >
                  {pageVariants.map((variant, idx) => renderVariant(variant, workTitle, i + idx))}
                </div>
              ),
            });
          }
        } else {
          variants.forEach((variant, index) => {
            pageContents.push({
              key: `variant-${variant.number}`,
              content: renderVariant(variant, workTitle, index),
            });
          });
        }

        if (showAnswersPage) {
          pageContents.push({
            key: 'answers',
            content: (
              <AnswersPage
                variants={variants}
                variantLabel={variantLabel}
                show={true}
                cryptogramEnabled={cryptogramEnabled}
                cryptogramPhrase={cryptogramPhrase}
              />
            ),
          });
        }

        const total = pageContents.length;
        return (
          <div ref={printRef} className="sheet-pages-preview">
            {pageContents.map(({ key, content }, pageIdx) => (
              <div key={key} className={pageClass}>
                {content}
                <div className="sheet-page-label no-print">{pageIdx + 1} / {total}</div>
              </div>
            ))}
          </div>
        );
      })()}

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
