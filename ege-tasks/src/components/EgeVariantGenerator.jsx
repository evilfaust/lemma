import { useState, useRef, useMemo, useEffect } from 'react';
import {
  Card, Button, Space, Alert, Spin, Row, Col, Statistic,
  Table, Select, Tag, Tooltip, Typography, Divider, App, Form, InputNumber,
} from 'antd';
import {
  ThunderboltOutlined,
  InfoCircleOutlined,
  PushpinOutlined,
  PushpinFilled,
  SwapOutlined,
  DeleteOutlined,
  PrinterOutlined,
  SaveOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import {
  useWorksheetGeneration,
  useTaskDragDrop,
  useWorksheetActions,
  useTaskEditing,
} from '../hooks';
import VariantRenderer from './worksheet/VariantRenderer';
import AnswersPage from './worksheet/AnswersPage';
import VariantStats from './worksheet/VariantStats';
import ActionButtons from './worksheet/ActionButtons';
import SaveWorkModal from './worksheet/SaveWorkModal';
import LoadWorkModal from './worksheet/LoadWorkModal';
import SessionPanel from './worksheet/SessionPanel';
import TaskSelectModal from './TaskSelectModal';
import TaskReplaceModal from './TaskReplaceModal';
import TaskEditModal from './TaskEditModal';
import './TaskWorksheet.css';

const { Text } = Typography;
const { Option } = Select;

/**
 * Генератор полных вариантов ЕГЭ базового уровня (21 задание)
 */
const EgeVariantGenerator = () => {
  const { message } = App.useApp();
  const { egeBaseTopics, subtopics, tags } = useReferenceData();
  const printRef = useRef();
  const [form] = Form.useForm();

  // Настройки каждого слота (21 строка)
  // { topicId, pinnedTask, subtopics: [], difficulty: [], tags: [] }
  const [slots, setSlots] = useState([]);

  // Настройки генерации
  const [variantsCount, setVariantsCount] = useState(1);
  const [variantsMode, setVariantsMode] = useState('different');

  // Настройки формата
  const [columns] = useState(1);
  const [fontSize, setFontSize] = useState(13);
  const [solutionSpace, setSolutionSpace] = useState('medium');
  const [compactMode] = useState(false);

  // Модальные окна
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [savedWorks, setSavedWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [currentWork, setCurrentWork] = useState(null);

  // Модальное окно выбора задачи для фиксации
  const [pinModalSlotIndex, setPinModalSlotIndex] = useState(null);

  // Хуки
  const { variants, setVariants, loading, generateFromStructure, reset } = useWorksheetGeneration();
  const dragDropHandlers = useTaskDragDrop(variants, setVariants);
  const {
    saving,
    exporting,
    handlePrint,
    handleExportPDF,
    handleSaveWork,
    handleUpdateWork,
    handleLoadWorks,
    handleLoadWork,
    handleDeleteWork,
    pdfMethod,
    setPdfMethod,
    puppeteerAvailable,
  } = useWorksheetActions();
  const taskEditing = useTaskEditing(variants, setVariants);

  // Инициализируем слоты как только загрузятся egeBaseTopics
  useEffect(() => {
    if (egeBaseTopics.length === 0) return;
    if (slots.length > 0) return; // уже инициализированы
    setSlots(
      egeBaseTopics.map(topic => ({
        topicId: topic.id,
        pinnedTask: null,
        subtopics: [],
        difficulty: [],
        tags: [],
      }))
    );
  }, [egeBaseTopics]); // eslint-disable-line react-hooks/exhaustive-deps

  // Подтемы, сгруппированные по теме
  const subtopicsByTopic = useMemo(() => {
    const map = {};
    subtopics.forEach(s => {
      if (!map[s.topic]) map[s.topic] = [];
      map[s.topic].push(s);
    });
    return map;
  }, [subtopics]);

  // Подсчёт зафиксированных слотов
  const pinnedCount = useMemo(() => slots.filter(s => s.pinnedTask).length, [slots]);

  // Обновить один слот
  const updateSlot = (index, field, value) => {
    setSlots(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Открыть модал выбора задачи для фиксации
  const openPinModal = (slotIndex) => {
    setPinModalSlotIndex(slotIndex);
  };

  // Зафиксировать задачу в слоте
  const handlePinTask = (task) => {
    if (pinModalSlotIndex === null) return;
    updateSlot(pinModalSlotIndex, 'pinnedTask', task);
    setPinModalSlotIndex(null);
    message.success(`Задача ${task.code} зафиксирована в слоте №${egeBaseTopics[pinModalSlotIndex]?.ege_number}`);
  };

  // Снять фиксацию
  const unpinSlot = (index) => {
    updateSlot(index, 'pinnedTask', null);
  };

  // Генерация вариантов
  const handleGenerate = async () => {
    if (slots.length === 0) {
      message.warning('Темы ЕГЭ ещё загружаются...');
      return;
    }

    // Строим структуру блоков: 21 блок, по 1 задаче
    const structure = slots.map(slot => ({
      topic: slot.topicId,
      subtopics: slot.subtopics,
      difficulty: slot.difficulty,
      tags: slot.tags,
      count: 1,
    }));

    await generateFromStructure(structure, {
      variantsMode,
      variantsCount,
      sortType: 'random',
      progressiveDifficulty: false,
    });

    // После генерации применяем зафиксированные задачи
    // (делается через useEffect ниже чтобы иметь доступ к новым variants)
  };

  // Применяем pinnedTask после генерации
  useEffect(() => {
    if (variants.length === 0) return;
    const hasPinned = slots.some(s => s.pinnedTask);
    if (!hasPinned) return;

    setVariants(prev => prev.map(variant => ({
      ...variant,
      tasks: variant.tasks.map((task, idx) => {
        const slot = slots[idx];
        return slot?.pinnedTask ?? task;
      }),
    })));
  }, [variants.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = () => {
    reset();
    setCurrentWork(null);
  };

  const handleSave = async (values) => {
    if (currentWork?.id) {
      await handleUpdateWork(currentWork.id, values, variants);
    } else {
      const work = await handleSaveWork(values, variants);
      if (work) setCurrentWork(work);
    }
    setSaveModalVisible(false);
  };

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
      const { work, variants: loaded } = await handleLoadWork(workId);
      setVariants(loaded);
      setCurrentWork(work);
      setLoadModalVisible(false);
      message.success(`Работа "${work.title}" загружена`);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleDelete = async (workId) => {
    await handleDeleteWork(workId);
    setSavedWorks(prev => prev.filter(w => w.id !== workId));
  };

  // Получить конкретную тему для слота
  const topicForSlot = (slot) =>
    egeBaseTopics.find(t => t.id === slot.topicId);

  // Колонки таблицы структуры
  const tableColumns = [
    {
      title: '№',
      dataIndex: 'num',
      width: 48,
      render: (_, __, index) => {
        const topic = topicForSlot(slots[index]);
        return (
          <Tag color="blue" style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>
            {topic?.ege_number ?? index + 1}
          </Tag>
        );
      },
    },
    {
      title: 'Тема',
      dataIndex: 'topic',
      width: 280,
      render: (_, __, index) => {
        const topic = topicForSlot(slots[index]);
        if (!topic) return null;
        // Убираем префикс "ЕГЭ-База. №N " для компактности
        const shortTitle = topic.title.replace(/^ЕГЭ-База\. №\d+\s+/, '');
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {shortTitle}
          </Text>
        );
      },
    },
    {
      title: 'Подтема',
      dataIndex: 'subtopics',
      width: 200,
      render: (_, __, index) => {
        const slot = slots[index];
        const topic = topicForSlot(slot);
        const topicSubs = topic ? (subtopicsByTopic[topic.id] || []) : [];
        if (topicSubs.length === 0) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
        return (
          <Select
            mode="multiple"
            placeholder="Любая"
            value={slot.subtopics}
            onChange={v => updateSlot(index, 'subtopics', v)}
            size="small"
            style={{ width: '100%' }}
            maxTagCount={1}
          >
            {topicSubs.map(s => (
              <Option key={s.id} value={s.id}>{s.name}</Option>
            ))}
          </Select>
        );
      },
    },
    {
      title: 'Сложность',
      dataIndex: 'difficulty',
      width: 130,
      render: (_, __, index) => {
        const slot = slots[index];
        return (
          <Select
            mode="multiple"
            placeholder="Любая"
            value={slot.difficulty}
            onChange={v => updateSlot(index, 'difficulty', v)}
            size="small"
            style={{ width: '100%' }}
            maxTagCount={1}
          >
            <Option value={1}><Tag color="green">Лёгкая</Tag></Option>
            <Option value={2}><Tag color="orange">Средняя</Tag></Option>
            <Option value={3}><Tag color="red">Сложная</Tag></Option>
          </Select>
        );
      },
    },
    {
      title: 'Зафиксировать',
      dataIndex: 'pin',
      width: 160,
      render: (_, __, index) => {
        const slot = slots[index];
        if (slot.pinnedTask) {
          return (
            <Space size={4}>
              <Tag
                icon={<PushpinFilled />}
                color="gold"
                style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {slot.pinnedTask.code}
              </Tag>
              <Tooltip title="Снять фиксацию">
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => unpinSlot(index)}
                />
              </Tooltip>
            </Space>
          );
        }
        return (
          <Button
            size="small"
            type="dashed"
            icon={<PushpinOutlined />}
            onClick={() => openPinModal(index)}
          >
            Выбрать
          </Button>
        );
      },
    },
  ];

  const tableData = slots.map((slot, index) => ({ key: index }));

  const hasVariants = variants.length > 0;

  return (
    <div className="task-worksheet-container">
      <Alert
        message="Генератор вариантов ЕГЭ (базовый уровень)"
        description={
          <div>
            <div>📋 Полный вариант ЕГЭ — 21 задание с кратким ответом</div>
            <div>🎲 Разные задачи в каждом варианте, без повторений</div>
            <div>📌 Фиксация конкретных задач по любому номеру</div>
            <div>🖨️ Распечатка вариантов для класса + онлайн-выдача</div>
          </div>
        }
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        className="no-print"
        style={{ marginBottom: 16 }}
      />

      {/* Настройки */}
      <Card
        title="Структура варианта ЕГЭ"
        className="no-print"
        extra={
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {pinnedCount > 0 && `📌 Зафиксировано: ${pinnedCount}`}
            </Text>
            <Button
              icon={<FolderOpenOutlined />}
              onClick={handleOpenLoadModal}
              size="small"
            >
              Загрузить
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        {egeBaseTopics.length === 0 ? (
          <Spin tip="Загрузка тем ЕГЭ..." />
        ) : (
          <>
            <Alert
              message="Для каждого номера задания ЕГЭ можно ограничить подтему, сложность или зафиксировать конкретную задачу. Оставьте поля пустыми — задача выберется случайно из всех доступных."
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
            />
            <Table
              dataSource={tableData}
              columns={tableColumns}
              pagination={false}
              size="small"
              bordered
              rowKey="key"
              scroll={{ x: 700 }}
              style={{ marginBottom: 16 }}
            />

            <Row gutter={16} align="middle">
              <Col>
                <Text strong>Вариантов:</Text>{' '}
                <InputNumber
                  min={1}
                  max={30}
                  value={variantsCount}
                  onChange={v => setVariantsCount(v || 1)}
                  style={{ width: 70 }}
                  size="small"
                />
              </Col>
              <Col>
                <Text strong>Режим:</Text>{' '}
                <Select
                  value={variantsMode}
                  onChange={setVariantsMode}
                  size="small"
                  style={{ width: 200 }}
                >
                  <Option value="different">Разные задачи (рекомендовано)</Option>
                  <Option value="shuffled">Одни задачи, разный порядок</Option>
                  <Option value="same">Одинаковые варианты</Option>
                </Select>
              </Col>
              <Col flex="auto" />
              <Col>
                <Space>
                  {hasVariants && (
                    <Button onClick={handleReset} size="small">
                      Сбросить
                    </Button>
                  )}
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    loading={loading}
                    onClick={handleGenerate}
                    size="middle"
                  >
                    {hasVariants ? 'Перегенерировать' : 'Сгенерировать'}
                  </Button>
                </Space>
              </Col>
            </Row>
          </>
        )}
      </Card>

      {/* Результат */}
      {loading && (
        <Card className="no-print">
          <Spin tip={`Подбираем задачи для ${variantsCount} варианта(-ов)...`} size="large">
            <div style={{ padding: 40 }} />
          </Spin>
        </Card>
      )}

      {hasVariants && !loading && (
        <>
          {/* Статистика */}
          <Card className="no-print" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col>
                <Statistic title="Вариантов" value={variants.length} />
              </Col>
              <Col>
                <Statistic title="Заданий в варианте" value={variants[0]?.tasks.length ?? 0} />
              </Col>
              <Col>
                <Statistic
                  title="Всего задач"
                  value={variants.reduce((s, v) => s + v.tasks.length, 0)}
                />
              </Col>
            </Row>
          </Card>

          {/* Кнопки действий */}
          <div className="no-print" style={{ marginBottom: 16 }}>
            <ActionButtons
              variants={variants}
              printRef={printRef}
              onPrint={() => handlePrint(printRef)}
              onExportPDF={() => handleExportPDF(printRef, 'Вариант ЕГЭ базовый уровень')}
              onSave={() => setSaveModalVisible(true)}
              pdfMethod={pdfMethod}
              setPdfMethod={setPdfMethod}
              puppeteerAvailable={puppeteerAvailable}
              saving={saving}
              exporting={exporting}
            />
          </div>

          {/* Варианты для печати */}
          <div ref={printRef}>
            {variants.map((variant, vi) => (
              <div key={variant.number}>
                {/* КИМ-шапка */}
                <div className="no-print" style={{
                  borderBottom: '2px solid #1890ff',
                  marginBottom: 8,
                  paddingBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <Tag color="blue" style={{ fontSize: 14, padding: '2px 10px' }}>
                    Вариант {variant.number}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {variant.tasks.length} заданий
                  </Text>
                </div>

                <VariantRenderer
                  variant={variant}
                  variantIndex={vi}
                  compactMode={compactMode}
                  fontSize={fontSize}
                  columns={columns}
                  showStudentInfo={true}
                  showAnswersInline={false}
                  solutionSpace={solutionSpace}
                  variantLabel="Вариант"
                  hideTaskPrefixes={false}
                  dragDropHandlers={dragDropHandlers}
                  onEditTask={taskEditing.handleEditTask}
                  onReplaceTask={taskEditing.handleReplaceTask}
                />

                {vi < variants.length - 1 && (
                  <div className="page-break" />
                )}
              </div>
            ))}

            {/* Страница ответов */}
            <AnswersPage variants={variants} variantLabel="Вариант" />
          </div>

          {/* Онлайн-выдача (только после сохранения) */}
          {currentWork?.id && (
            <Card
              title="Онлайн-выдача варианта"
              className="no-print"
              style={{ marginTop: 16 }}
            >
              <SessionPanel workId={currentWork.id} />
            </Card>
          )}

          {!currentWork?.id && (
            <Alert
              className="no-print"
              style={{ marginTop: 16 }}
              message="Сохраните работу для онлайн-выдачи ученикам"
              description={
                <Button
                  icon={<SaveOutlined />}
                  type="primary"
                  onClick={() => setSaveModalVisible(true)}
                >
                  Сохранить работу
                </Button>
              }
              type="warning"
              showIcon
            />
          )}
        </>
      )}

      {/* Модалы */}
      <SaveWorkModal
        visible={saveModalVisible}
        onCancel={() => setSaveModalVisible(false)}
        onSave={handleSave}
        saving={saving}
        currentWork={currentWork}
        defaultTitle="Вариант ЕГЭ (база)"
      />

      <LoadWorkModal
        visible={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        onLoad={handleLoad}
        onDelete={handleDelete}
        works={savedWorks}
        loading={loadingWorks}
      />

      {/* Выбор задачи для фиксации */}
      <TaskSelectModal
        visible={pinModalSlotIndex !== null}
        onCancel={() => setPinModalSlotIndex(null)}
        onSelect={handlePinTask}
        topics={egeBaseTopics}
        subtopics={subtopics}
        tags={tags}
        excludeIds={[]}
      />

      {/* Редактирование задачи */}
      {taskEditing.editModalVisible && (
        <TaskEditModal
          visible={taskEditing.editModalVisible}
          task={taskEditing.editingTask}
          onCancel={taskEditing.handleCancelEdit}
          onSave={taskEditing.handleSaveEdit}
        />
      )}

      {/* Замена задачи */}
      {taskEditing.replaceModalVisible && (
        <TaskReplaceModal
          visible={taskEditing.replaceModalVisible}
          task={taskEditing.replacingTask}
          variantTasks={taskEditing.currentVariantTasks}
          onCancel={taskEditing.handleCancelReplace}
          onReplace={taskEditing.handleConfirmReplace}
        />
      )}
    </div>
  );
};

export default EgeVariantGenerator;
