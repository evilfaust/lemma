import { useState, useRef } from 'react';
import {
  Card,
  Form,
  Button,
  Space,
  Alert,
  Collapse,
  Spin,
  Modal,
  Input,
  InputNumber,
  List,
  Empty,
  Row,
  Col,
  Statistic,
  Timeline,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  PrinterOutlined,
  FilePdfOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  EditOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { v4 as uuid } from 'uuid';
import FilterBlock from './worksheet/FilterBlock';
import VariantSettings from './worksheet/VariantSettings';
import FormatSettings from './worksheet/FormatSettings';
import TaskReplaceModal from './TaskReplaceModal';
import TaskEditModal from './TaskEditModal';
import {
  useWorksheetGeneration,
  useTaskDragDrop,
  useWorksheetActions,
} from '../hooks';
import { api } from '../services/pocketbase';
import { filterTaskText } from '../utils/filterTaskText';
import MathRenderer from './MathRenderer';
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
  } = useWorksheetActions();

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

  // Модальные окна
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [taskToReplace, setTaskToReplace] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
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
   * Замена задачи
   */
  const handleReplaceTask = (variantIndex, taskIndex, task) => {
    setTaskToReplace({ variantIndex, taskIndex, task });
    setReplaceModalVisible(true);
  };

  const handleConfirmReplace = (newTask) => {
    const { variantIndex, taskIndex } = taskToReplace;
    const newVariants = [...variants];
    newVariants[variantIndex].tasks[taskIndex] = newTask;
    setVariants(newVariants);
    setReplaceModalVisible(false);
    message.success('Задача успешно заменена');
  };

  /**
   * Редактирование задачи
   */
  const handleEditTask = (task) => {
    setTaskToEdit(task);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async (taskId, values) => {
    try {
      await api.updateTask(taskId, values);
      const newVariants = variants.map(variant => ({
        ...variant,
        tasks: variant.tasks.map(t => (t.id === taskId ? { ...t, ...values } : t)),
      }));
      setVariants(newVariants);
      setEditModalVisible(false);
      setTaskToEdit(null);
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteEdit = async (taskId) => {
    await api.deleteTask(taskId);
    const newVariants = variants.map(variant => ({
      ...variant,
      tasks: variant.tasks.filter(t => t.id !== taskId),
    }));
    setVariants(newVariants);
    setEditModalVisible(false);
    setTaskToEdit(null);
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
   * Применение фильтра текста
   */
  const applyTaskTextFilter = (text) => {
    if (!hideTaskPrefixes) return text;
    return filterTaskText(text);
  };

  /**
   * Рендеринг варианта
   */
  const renderVariant = (variant, variantIndex) => {
    if (compactMode) {
      return (
        <div key={variant.number} className="variant-container compact-mode">
          <div className="variant-header-compact">
            <h2>
              {variantLabel} {variant.number}
            </h2>
          </div>

          <div className="tasks-content-compact" style={{ fontSize: `${fontSize}pt` }}>
            {variant.tasks.map((task, taskIndex) => {
              const isDragging = dragDropHandlers.isDragging(variantIndex, taskIndex);
              const isDragOver = dragDropHandlers.isDragOver(variantIndex, taskIndex);

              return (
                <div
                  key={task.id}
                  className={`task-item-compact ${isDragging ? 'dragging' : ''} ${
                    isDragOver ? 'drag-over' : ''
                  }`}
                  draggable
                  onDragStart={e => dragDropHandlers.handleDragStart(e, variantIndex, taskIndex)}
                  onDragOver={e => dragDropHandlers.handleDragOver(e, variantIndex, taskIndex)}
                  onDragLeave={dragDropHandlers.handleDragLeave}
                  onDrop={e => dragDropHandlers.handleDrop(e, variantIndex, taskIndex)}
                  onDragEnd={dragDropHandlers.handleDragEnd}
                >
                  <div className="compact-answer-box"></div>
                  <div className="compact-task-content">
                    <span className="compact-task-number">{taskIndex + 1}.</span>
                    <MathRenderer text={applyTaskTextFilter(task.statement_md)} />
                  </div>
                  {/* Кнопки управления (только на экране) */}
                  <div className="no-print compact-controls">
                    <Tooltip title="Редактировать задачу">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEditTask(task)}
                      />
                    </Tooltip>
                    <Tooltip title="Заменить задачу">
                      <Button
                        type="text"
                        size="small"
                        icon={<SwapOutlined />}
                        onClick={() => handleReplaceTask(variantIndex, taskIndex, task)}
                      />
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="page-break"></div>
        </div>
      );
    }

    // Обычный режим
    return (
      <div key={variant.number} className="variant-container">
        <div className="variant-header">
          <h2>
            {variantLabel} {variant.number}
          </h2>
          {showStudentInfo && (
            <div className="student-info">
              <div className="student-info-field">
                <span className="student-info-label">Фамилия:</span>
                <div className="student-info-line"></div>
              </div>
              <div className="student-info-field">
                <span className="student-info-label">Имя:</span>
                <div className="student-info-line"></div>
              </div>
            </div>
          )}
        </div>

        <div
          className="tasks-content"
          style={{
            fontSize: `${fontSize}pt`,
            columnCount: columns,
            columnGap: '20px',
            columnRule: columns > 1 ? '1px solid #ddd' : 'none',
          }}
        >
          {variant.tasks.map((task, taskIndex) => {
            const isDragging = dragDropHandlers.isDragging(variantIndex, taskIndex);
            const isDragOver = dragDropHandlers.isDragOver(variantIndex, taskIndex);

            return (
              <div
                key={task.id}
                className={`task-item ${isDragging ? 'dragging' : ''} ${
                  isDragOver ? 'drag-over' : ''
                }`}
                draggable
                onDragStart={e => dragDropHandlers.handleDragStart(e, variantIndex, taskIndex)}
                onDragOver={e => dragDropHandlers.handleDragOver(e, variantIndex, taskIndex)}
                onDragLeave={dragDropHandlers.handleDragLeave}
                onDrop={e => dragDropHandlers.handleDrop(e, variantIndex, taskIndex)}
                onDragEnd={dragDropHandlers.handleDragEnd}
              >
                <div className="task-header">
                  <span className="task-number">{taskIndex + 1}.</span>
                  <span className="task-code">{task.code}</span>
                  <div className="no-print" style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                    <Tooltip title="Редактировать задачу">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEditTask(task)}
                      />
                    </Tooltip>
                    <Tooltip title="Заменить задачу">
                      <Button
                        type="text"
                        size="small"
                        icon={<SwapOutlined />}
                        onClick={() => handleReplaceTask(variantIndex, taskIndex, task)}
                      />
                    </Tooltip>
                  </div>
                  <div className="answer-box"></div>
                </div>

                <div className="task-content">
                  <MathRenderer text={applyTaskTextFilter(task.statement_md)} />

                  {task.has_image && task.image_url && (
                    <div className="task-image">
                      <img src={task.image_url} alt="" />
                    </div>
                  )}
                </div>

                {showAnswersInline && task.answer && (
                  <div className="task-answer">
                    <strong>Ответ:</strong> <MathRenderer text={task.answer} />
                  </div>
                )}

                {!showAnswersInline && (
                  <div className={`answer-space answer-space-${solutionSpace}`}>
                    {solutionSpace !== 'none' && 'Решение:'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="page-break"></div>
      </div>
    );
  };

  /**
   * Рендеринг листа с ответами
   */
  const renderAnswersPage = () => {
    if (!showAnswersPage || variants.length === 0) return null;

    return (
      <div className="answers-page">
        <h2>Ответы</h2>
        {variants.map(variant => (
          <div key={variant.number} className="variant-answers">
            <h3>
              {variantLabel} {variant.number}
            </h3>
            <div className="answers-grid">
              {variant.tasks.map((task, index) => (
                <div key={task.id} className="answer-item">
                  <span className="answer-number">{index + 1}.</span>
                  <span className="answer-value">
                    {task.answer ? <MathRenderer text={task.answer} /> : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

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
        <Form form={form} layout="vertical" onFinish={handleGenerate}>
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
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<ReloadOutlined />}
                loading={loading}
                size="large"
                disabled={workBlocks.length === 0}
              >
                Сформировать работу
              </Button>
              <Button
                type="button"
                icon={<FolderOpenOutlined />}
                onClick={handleOpenLoadModal}
                size="large"
              >
                Открыть сохранённую
              </Button>
              {variants.length > 0 && (
                <>
                  <Button
                    type="button"
                    icon={<SaveOutlined />}
                    onClick={() => setSaveModalVisible(true)}
                    loading={saving}
                    size="large"
                  >
                    Сохранить работу
                  </Button>
                  <Button
                    type="button"
                    icon={<PrinterOutlined />}
                    onClick={handlePrint}
                    size="large"
                  >
                    Печать
                  </Button>
                  <Button
                    type="button"
                    icon={<FilePdfOutlined />}
                    onClick={() => handleExportPDF(printRef, form.getFieldValue('workTitle'))}
                    loading={exporting}
                    size="large"
                  >
                    Сохранить PDF
                  </Button>
                  <Button type="button" onClick={handleReset} size="large">
                    Сбросить
                  </Button>
                </>
              )}
            </Space>
          </Form.Item>
        </Form>

        {/* Превью */}
        {variants.length > 0 && (
          <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
            <Row gutter={16}>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                    {variants.length}
                  </div>
                  <div style={{ color: '#666' }}>Вариант(ов)</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                    {variants[0]?.tasks.length || 0}
                  </div>
                  <div style={{ color: '#666' }}>Задач в варианте</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fa8c16' }}>
                    {variants.reduce((sum, v) => sum + v.tasks.length, 0)}
                  </div>
                  <div style={{ color: '#666' }}>Всего задач</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 'bold',
                      color: showAnswersPage ? '#52c41a' : '#ff4d4f',
                    }}
                  >
                    {showAnswersPage ? '✓' : '✗'}
                  </div>
                  <div style={{ color: '#666' }}>Лист ответов</div>
                </div>
              </Col>
            </Row>
          </div>
        )}
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
          {renderAnswersPage()}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" tip="Генерируем варианты..." />
        </div>
      )}

      {/* Модальные окна */}
      <TaskReplaceModal
        visible={replaceModalVisible}
        taskToReplace={taskToReplace}
        onConfirm={handleConfirmReplace}
        onCancel={() => setReplaceModalVisible(false)}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        currentVariantTasks={taskToReplace ? variants[taskToReplace.variantIndex]?.tasks || [] : []}
      />

      {taskToEdit && (
        <TaskEditModal
          task={taskToEdit}
          visible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
          onSave={handleSaveEdit}
          onDelete={handleDeleteEdit}
          allTags={tags || []}
          allSources={sources || []}
          allYears={years || []}
          allSubtopics={subtopics || []}
          allTopics={topics || []}
        />
      )}

      {/* Модальное окно сохранения */}
      <Modal
        title={
          <Space>
            <SaveOutlined />
            <span>Сохранить работу</span>
          </Space>
        }
        open={saveModalVisible}
        onCancel={() => setSaveModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            title: 'Контрольная работа',
            timeLimit: null,
          }}
        >
          <Alert
            message="Информация"
            description={`Будет сохранено ${variants.length} вариант(ов) с общим количеством ${variants.reduce(
              (sum, v) => sum + v.tasks.length,
              0
            )} задач.`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="title"
            label="Название работы"
            rules={[{ required: true, message: 'Введите название работы' }]}
          >
            <Input placeholder="Например: Контрольная - логарифмы и степени" />
          </Form.Item>

          <Form.Item name="timeLimit" label="Время на выполнение (минут)">
            <InputNumber
              min={1}
              max={300}
              style={{ width: '100%' }}
              placeholder="Например: 45"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                Сохранить
              </Button>
              <Button onClick={() => setSaveModalVisible(false)}>Отмена</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно загрузки */}
      <Modal
        title={
          <Space>
            <FolderOpenOutlined />
            <span>Сохранённые работы</span>
          </Space>
        }
        open={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        footer={null}
        width={800}
      >
        {loadingWorks ? (
          <div style={{ textAlign: 'center', padding: 30 }}>
            <Spin tip="Загружаем работы..." />
          </div>
        ) : savedWorks.length === 0 ? (
          <Empty description="Нет сохранённых работ" style={{ padding: 30 }} />
        ) : (
          <List
            dataSource={savedWorks}
            renderItem={work => (
              <List.Item
                actions={[
                  <Button
                    type="primary"
                    size="small"
                    icon={<FolderOpenOutlined />}
                    onClick={() => handleLoad(work.id)}
                  >
                    Открыть
                  </Button>,
                  <Button
                    danger
                    size="small"
                    onClick={() => {
                      Modal.confirm({
                        title: 'Удалить работу?',
                        content: `Вы уверены, что хотите удалить работу "${work.title}"?`,
                        okText: 'Удалить',
                        okType: 'danger',
                        cancelText: 'Отмена',
                        onOk: () => handleDelete(work.id, work.title),
                      });
                    }}
                  >
                    Удалить
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span style={{ fontWeight: 600, fontSize: 16 }}>{work.title}</span>
                      {work.time_limit && <Tag color="green">{work.time_limit} мин</Tag>}
                      {work.expand?.topic && (
                        <Tag color="purple">
                          №{work.expand.topic.ege_number} - {work.expand.topic.title}
                        </Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space style={{ color: '#666', fontSize: 12 }}>
                      <span>
                        Создана: {new Date(work.created).toLocaleDateString('ru-RU')}
                      </span>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  );
};

export default TestWorkGenerator;
