import { useState, useRef } from 'react';
import {
  Card,
  Form,
  Button,
  Space,
  Alert,
  Collapse,
  Spin,
  Row,
  Col,
  Statistic,
  Timeline,
  Tag,
  message,
} from 'antd';
import {
  PlusOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { v4 as uuid } from 'uuid';
import FilterBlock from './worksheet/FilterBlock';
import VariantSettings from './worksheet/VariantSettings';
import FormatSettings from './worksheet/FormatSettings';
import SaveWorkModal from './worksheet/SaveWorkModal';
import LoadWorkModal from './worksheet/LoadWorkModal';
import VariantRenderer from './worksheet/VariantRenderer';
import AnswersPage from './worksheet/AnswersPage';
import VariantStats from './worksheet/VariantStats';
import ActionButtons from './worksheet/ActionButtons';
import TaskReplaceModal from './TaskReplaceModal';
import TaskEditModal from './TaskEditModal';
import {
  useWorksheetGeneration,
  useTaskDragDrop,
  useWorksheetActions,
  useTaskEditing,
} from '../hooks';
import './TaskWorksheet.css';

const { Panel } = Collapse;

/**
 * Генератор контрольных работ с задачами из разных тем
 */
const TestWorkGenerator = ({ topics, tags, subtopics, years = [], sources = [] }) => {
  const [form] = Form.useForm();
  const printRef = useRef();

  // Блоки фильтров для структуры работы
  const [workBlocks, setWorkBlocks] = useState([]);

  // Хуки
  const { variants, setVariants, loading, generateFromStructure, reset } = useWorksheetGeneration();
  const dragDropHandlers = useTaskDragDrop(variants, setVariants);
  const {
    saving,
    exporting,
    handlePrint,
    handleExportPDF,
    handleSaveWork,
    handleLoadWorks,
    handleLoadWork,
    handleDeleteWork,
    pdfMethod,
    setPdfMethod,
    puppeteerAvailable,
  } = useWorksheetActions();
  const taskEditing = useTaskEditing(variants, setVariants);

  // Настройки вариантов
  const [variantsCount, setVariantsCount] = useState(1);
  const [variantsMode, setVariantsMode] = useState('different');
  const [sortType, setSortType] = useState('random');

  // Настройки формата
  const [columns, setColumns] = useState(1);
  const [fontSize, setFontSize] = useState(12);
  const [solutionSpace, setSolutionSpace] = useState('medium');
  const [compactMode, setCompactMode] = useState(false);
  const [hideTaskPrefixes, setHideTaskPrefixes] = useState(false);
  const [showStudentInfo, setShowStudentInfo] = useState(true);
  const [showAnswersInline, setShowAnswersInline] = useState(false);
  const [showAnswersPage, setShowAnswersPage] = useState(true);
  const [variantLabel, setVariantLabel] = useState('Вариант');

  // Модальные окна сохранения/загрузки
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [savedWorks, setSavedWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);

  /**
   * Добавление нового блока фильтров
   */
  const addBlock = () => {
    setWorkBlocks([
      ...workBlocks,
      {
        id: uuid(),
        topic: null,
        subtopics: [],
        difficulty: [],
        tags: [],
        source: null,
        year: null,
        count: 1,
      },
    ]);
  };

  /**
   * Обновление блока
   */
  const updateBlock = (index, field, value) => {
    const newBlocks = [...workBlocks];
    newBlocks[index][field] = value;

    // Сбрасываем подтемы при смене темы
    if (field === 'topic') {
      newBlocks[index].subtopics = [];
    }

    setWorkBlocks(newBlocks);
  };

  /**
   * Удаление блока
   */
  const removeBlock = (index) => {
    setWorkBlocks(workBlocks.filter((_, i) => i !== index));
  };

  /**
   * Получение общего количества задач
   */
  const getTotalTaskCount = () => {
    return workBlocks.reduce((sum, block) => sum + (block.count || 0), 0);
  };

  /**
   * Получение количества уникальных тем
   */
  const getUniqueTopicsCount = () => {
    const uniqueTopics = new Set(workBlocks.map(b => b.topic).filter(Boolean));
    return uniqueTopics.size;
  };

  /**
   * Получение названия темы
   */
  const getTopicTitle = (topicId) => {
    const topic = topics.find(t => t.id === topicId);
    return topic ? `№${topic.ege_number} - ${topic.title}` : 'Не выбрана';
  };

  /**
   * Генерация работы
   */
  const handleGenerate = async () => {
    if (workBlocks.length === 0) {
      message.warning('Добавьте хотя бы один блок задач');
      return;
    }

    // Проверка, что все блоки заполнены
    for (let i = 0; i < workBlocks.length; i++) {
      if (!workBlocks[i].topic) {
        message.error(`Блок ${i + 1}: выберите тему`);
        return;
      }
      if (!workBlocks[i].count || workBlocks[i].count < 1) {
        message.error(`Блок ${i + 1}: укажите количество задач`);
        return;
      }
    }

    await generateFromStructure(workBlocks, {
      variantsMode,
      variantsCount,
      sortType,
    });
  };

  /**
   * Сброс формы
   */
  const handleReset = () => {
    reset();
    setWorkBlocks([]);
    form.resetFields();
  };

  /**
   * Сохранение работы
   */
  const handleSave = async (values) => {
    await handleSaveWork(values, variants);
    setSaveModalVisible(false);
  };

  /**
   * Загрузка работы
   */
  const handleOpenLoadModal = async () => {
    setLoadModalVisible(true);
    setLoadingWorks(true);
    try {
      const works = await handleLoadWorks();
      setSavedWorks(works);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleLoad = async (workId) => {
    setLoadingWorks(true);
    try {
      const { work, variants: loadedVariants } = await handleLoadWork(workId);
      setVariants(loadedVariants);
      form.setFieldsValue({
        workTitle: work.title,
      });
      setLoadModalVisible(false);
      message.success(`Работа "${work.title}" успешно загружена`);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleDelete = async (workId, workTitle) => {
    await handleDeleteWork(workId);
    setSavedWorks(savedWorks.filter(w => w.id !== workId));
  };

  /**
   * Рендеринг варианта через переиспользуемый компонент
   */
  const renderVariant = (variant, variantIndex) => (
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
      <Alert
        message="Генератор контрольных работ"
        description={
          <div>
            <div>📚 Задачи из разных тем в одной работе</div>
            <div>🎯 Настройка количества задач по каждой теме</div>
            <div>🎲 Разные стратегии генерации вариантов</div>
            <div>✏️ Редактирование и замена задач</div>
            <div>💾 Сохранение работ в базу данных</div>
          </div>
        }
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        className="no-print"
        style={{ marginBottom: 16 }}
      />

      <Card title="Настройки контрольной работы" className="no-print">
        <Form form={form} layout="vertical" onFinish={handleGenerate} initialValues={{ workTitle: 'Контрольная работа' }}>
          <Collapse defaultActiveKey={['structure', 'variants', 'format']}>
            {/* Структура работы */}
            <Panel header="📚 Структура контрольной работы" key="structure">
              {workBlocks.length === 0 && (
                <Alert
                  message="Добавьте блоки задач для составления контрольной работы"
                  description="Каждый блок позволяет настроить количество и фильтры для задач из определённой темы"
                  type="info"
                  style={{ marginBottom: 16 }}
                />
              )}

              {workBlocks.map((block, index) => (
                <FilterBlock
                  key={block.id}
                  block={block}
                  index={index}
                  topics={topics}
                  subtopics={subtopics}
                  tags={tags}
                  sources={sources}
                  years={years}
                  onChange={updateBlock}
                  onRemove={removeBlock}
                />
              ))}

              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                onClick={addBlock}
                style={{ marginBottom: 16 }}
              >
                Добавить блок задач
              </Button>

              {/* Статистика структуры */}
              {workBlocks.length > 0 && (
                <Card size="small" title="📊 Предпросмотр структуры">
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <Statistic title="Блоков" value={workBlocks.length} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Тем" value={getUniqueTopicsCount()} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Задач" value={getTotalTaskCount()} />
                    </Col>
                  </Row>

                  <Timeline mode="left">
                    {workBlocks.map((block, idx) => (
                      <Timeline.Item key={block.id}>
                        <div style={{ fontWeight: 600 }}>{getTopicTitle(block.topic)}</div>
                        <div style={{ color: '#666', fontSize: 12 }}>
                          Задач: {block.count}
                          {block.difficulty.length > 0 && ` • Сложность: ${block.difficulty.join(', ')}`}
                          {block.subtopics.length > 0 && ` • Подтем: ${block.subtopics.length}`}
                        </div>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </Card>
              )}
            </Panel>

            {/* Настройки вариантов */}
            <Panel header="🎲 Генерация вариантов" key="variants">
              <VariantSettings
                variantsCount={variantsCount}
                setVariantsCount={setVariantsCount}
                variantsMode={variantsMode}
                setVariantsMode={setVariantsMode}
                sortType={sortType}
                setSortType={setSortType}
                showTasksCount={true}
                tasksPerVariant={getTotalTaskCount()}
              />
            </Panel>

            {/* Формат печати */}
            <Panel header="🎨 Формат печати" key="format">
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
              />
            </Panel>
          </Collapse>

          <Form.Item style={{ marginTop: 16 }}>
            <ActionButtons
              hasVariants={variants.length > 0}
              loading={loading}
              onGenerate
              onOpenLoad={handleOpenLoadModal}
              onSave={() => setSaveModalVisible(true)}
              onPrint={handlePrint}
              onExportPDF={() => handleExportPDF(printRef, form.getFieldValue('workTitle'))}
              onReset={handleReset}
              pdfMethod={pdfMethod}
              setPdfMethod={setPdfMethod}
              puppeteerAvailable={puppeteerAvailable}
              exporting={exporting}
              saving={saving}
              generateLabel="Сформировать работу"
              generateDisabled={workBlocks.length === 0}
            />
          </Form.Item>
        </Form>

        {/* Превью */}
        <VariantStats variants={variants} showAnswersPage={showAnswersPage} />
      </Card>

      {/* Печатный лист */}
      {variants.length > 0 && (
        <div ref={printRef} className="printable-worksheet">
          {compactMode && columns > 1 ? (
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
                      {pageVariants.map((variant, idx) => renderVariant(variant, i + idx))}
                    </div>
                  </div>
                );
              }
              return pages;
            })()
          ) : (
            variants.map((variant, index) => renderVariant(variant, index))
          )}
          <AnswersPage variants={variants} variantLabel={variantLabel} show={showAnswersPage} />
        </div>
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
        onSave={handleSave}
        saving={saving}
        variantsCount={variants.length}
        tasksCount={variants.reduce((sum, v) => sum + v.tasks.length, 0)}
      />

      <LoadWorkModal
        visible={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        works={savedWorks}
        loading={loadingWorks}
        onLoad={handleLoad}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default TestWorkGenerator;
