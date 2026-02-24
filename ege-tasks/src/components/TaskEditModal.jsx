import { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, InputNumber, Button, Slider, Space, Popconfirm, Spin, Divider, Alert, Segmented, Upload, App } from 'antd';
import { EditOutlined, SaveOutlined, DeleteOutlined, ExclamationCircleOutlined, PlusOutlined, LinkOutlined, HighlightOutlined, UploadOutlined, ScissorOutlined } from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import GeoGebraDrawingPanel from './GeoGebraDrawingPanel';
import { generateTaskCode } from '../utils/taskCodeGenerator';
import { dataUrlToFile, normalizeCrop, cropPngByMargins } from '../utils/cropImage';
import { api } from '../services/pocketbase';

const { Option } = Select;
const { TextArea } = Input;

const TaskEditModal = ({ task, visible, onClose, onSave, onDelete, allTags = [], allSources = [], allYears = [], allSubtopics = [], allTopics = [] }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewStatement, setPreviewStatement] = useState('');
  const [previewAnswer, setPreviewAnswer] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [filteredSubtopics, setFilteredSubtopics] = useState([]);
  const [generatedCode, setGeneratedCode] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);
  const [tags, setTags] = useState([]);
  const [creatingTag, setCreatingTag] = useState(false);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [creatingSubtopic, setCreatingSubtopic] = useState(false);
  const [newTopicNumber, setNewTopicNumber] = useState(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [imageSource, setImageSource] = useState('url'); // 'url' | 'drawing' | 'upload'
  const [drawingImageDataUrl, setDrawingImageDataUrl] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);       // File object
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState(''); // data URL для превью
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropMargins, setCropMargins] = useState({ left: 0, right: 0, top: 0, bottom: 0 });
  const [croppingImage, setCroppingImage] = useState(false);
  const [newSubtopicName, setNewSubtopicName] = useState('');

  // Определяем режим работы: создание или редактирование
  const isCreateMode = !task;

  // Функция генерации кода задачи
  const handleGenerateCode = async (topicId) => {
    if (!topicId) {
      console.warn('[TaskEditModal] topicId не указан');
      return;
    }

    setGeneratingCode(true);
    try {
      // Ищем тему в allTopics (может быть undefined если темы не загружены)
      const topic = Array.isArray(allTopics) ? allTopics.find(t => t.id === topicId) : null;

      if (!topic) {
        console.warn('[TaskEditModal] Тема не найдена в allTopics, будет загружена из API');
      }

      // generateTaskCode автоматически загрузит тему если она не передана
      const code = await generateTaskCode(topicId, topic);
      setGeneratedCode(code);

      console.log('[TaskEditModal] Код успешно сгенерирован:', code);
    } catch (error) {
      console.error('[TaskEditModal] Error generating code:', error);
      message.error(`Ошибка при генерации кода: ${error.message}`);
    } finally {
      setGeneratingCode(false);
    }
  };

  // Синхронизация списка тегов с props
  useEffect(() => {
    setTags(allTags);
  }, [allTags]);

  // Синхронизация списка тем и подтем с props
  useEffect(() => {
    setTopics(allTopics);
  }, [allTopics]);

  useEffect(() => {
    setSubtopics(allSubtopics);
  }, [allSubtopics]);

  const normalizeTitle = (value) => (value || '').trim().toLowerCase();

  // Функция создания нового тега
  const handleCreateTag = async (newTagTitle) => {
    if (!newTagTitle || !newTagTitle.trim()) {
      return;
    }

    const trimmedTitle = newTagTitle.trim();

    // Проверяем, не существует ли уже такой тег
    const existingTag = tags.find(t => t.title.toLowerCase() === trimmedTitle.toLowerCase());
    if (existingTag) {
      message.warning(`Тег "${trimmedTitle}" уже существует`);
      return existingTag.id;
    }

    setCreatingTag(true);
    try {
      // Создаём тег с случайным цветом
      const colors = ['#f50', '#2db7f5', '#87d068', '#108ee9', '#faad14', '#722ed1', '#eb2f96', '#52c41a'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newTag = await api.createTag({
        title: trimmedTitle,
        color: randomColor
      });

      // Добавляем новый тег в локальный список
      setTags([...tags, newTag]);
      message.success(`Тег "${trimmedTitle}" создан`);

      return newTag.id;
    } catch (error) {
      console.error('Error creating tag:', error);
      message.error('Ошибка при создании тега');
      return null;
    } finally {
      setCreatingTag(false);
    }
  };

  useEffect(() => {
    if (visible) {
      if (task) {
        // Режим редактирования - заполняем форму данными задачи
        const topicData = allTopics.find(t => t.id === task.topic);
        setSelectedTopic(topicData);

        // Фильтруем подтемы по выбранной теме
        if (task.topic) {
          const subtopicsForTopic = allSubtopics.filter(st => st.topic === task.topic);
          setFilteredSubtopics(subtopicsForTopic);
        }

        form.setFieldsValue({
          topic: task.topic || undefined,
          subtopic: task.subtopic || undefined,
          difficulty: task.difficulty,
          answer: task.answer || '',
          statement_md: task.statement_md || '',
          solution_md: task.solution_md || '',
          source: task.source || '',
          year: task.year || undefined,
          tags: task.tags || [],
          image_url: task.image_url || '',
        });
        setPreviewStatement(task.statement_md || '');
        setPreviewAnswer(task.answer || '');
        // Если у задачи есть файл-изображение (image), показать режим загрузки
        if (task.image && !task.image_url) {
          setImageSource('upload');
        } else {
          setImageSource('url');
        }
        setDrawingImageDataUrl(null);
        setUploadedFile(null);
        setUploadPreviewUrl('');
      } else {
        // Режим создания - пустая форма
        form.resetFields();
        setGeneratedCode('');
        setPreviewStatement('');
        setPreviewAnswer('');
        setSelectedTopic(null);
        setFilteredSubtopics([]);
        setImageSource('url');
        setDrawingImageDataUrl(null);
        setUploadedFile(null);
        setUploadPreviewUrl('');
      }
    }
  }, [task, visible, form, allTopics, allSubtopics]);

  const handleTopicChange = (topicId) => {
    const topicData = topics.find(t => t.id === topicId);
    setSelectedTopic(topicData);

    // Фильтруем подтемы по выбранной теме
    const subtopicsForTopic = subtopics.filter(st => st.topic === topicId);
    setFilteredSubtopics(subtopicsForTopic);

    // Сбрасываем подтему при смене темы
    form.setFieldValue('subtopic', undefined);

    // Генерируем код для новой задачи
    if (isCreateMode) {
      handleGenerateCode(topicId);
    }
  };

  const handleCreateTopic = async () => {
    const trimmedTitle = (newTopicTitle || '').trim();
    if (!trimmedTitle) {
      message.warning('Введите название темы');
      return;
    }
    if (newTopicNumber === null || newTopicNumber === undefined || newTopicNumber === '') {
      message.warning('Укажите номер ЕГЭ');
      return;
    }

    const existingByNumber = topics.find(t => String(t.ege_number) === String(newTopicNumber));
    if (existingByNumber) {
      message.warning(`Тема с номером ${newTopicNumber} уже существует`);
      form.setFieldValue('topic', existingByNumber.id);
      handleTopicChange(existingByNumber.id);
      return;
    }

    const existingByTitle = topics.find(t => normalizeTitle(t.title) === normalizeTitle(trimmedTitle));
    if (existingByTitle) {
      message.warning(`Тема "${trimmedTitle}" уже существует`);
      form.setFieldValue('topic', existingByTitle.id);
      handleTopicChange(existingByTitle.id);
      return;
    }

    setCreatingTopic(true);
    try {
      const newTopic = await api.createTopic({
        title: trimmedTitle,
        ege_number: Number(newTopicNumber),
        order: Number(newTopicNumber),
      });
      const updated = [...topics, newTopic];
      setTopics(updated);
      message.success(`Тема "${trimmedTitle}" создана`);
      setNewTopicTitle('');
      setNewTopicNumber(null);
      form.setFieldValue('topic', newTopic.id);
      handleTopicChange(newTopic.id);
    } catch (error) {
      console.error('Error creating topic:', error);
      message.error('Ошибка при создании темы');
    } finally {
      setCreatingTopic(false);
    }
  };

  const handleCreateSubtopic = async () => {
    const topicId = form.getFieldValue('topic');
    if (!topicId) {
      message.warning('Сначала выберите тему');
      return;
    }
    const trimmedName = (newSubtopicName || '').trim();
    if (!trimmedName) {
      message.warning('Введите название подтемы');
      return;
    }

    const existing = subtopics.find(st => st.topic === topicId && normalizeTitle(st.name) === normalizeTitle(trimmedName));
    if (existing) {
      message.warning(`Подтема "${trimmedName}" уже существует`);
      form.setFieldValue('subtopic', existing.id);
      return;
    }

    setCreatingSubtopic(true);
    try {
      const newSubtopic = await api.createSubtopic({
        name: trimmedName,
        topic: topicId,
      });
      const updated = [...subtopics, newSubtopic];
      setSubtopics(updated);
      const subtopicsForTopic = updated.filter(st => st.topic === topicId);
      setFilteredSubtopics(subtopicsForTopic);
      message.success(`Подтема "${trimmedName}" создана`);
      setNewSubtopicName('');
      form.setFieldValue('subtopic', newSubtopic.id);
    } catch (error) {
      console.error('Error creating subtopic:', error);
      message.error('Ошибка при создании подтемы');
    } finally {
      setCreatingSubtopic(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Данные для сохранения задачи
      const taskData = {
        topic: values.topic,
        subtopic: values.subtopic || null,
        difficulty: values.difficulty,
        answer: values.answer || '',
        statement_md: values.statement_md || '',
        solution_md: values.solution_md || '',
        source: values.source || '',
        year: values.year || null,
        tags: values.tags || [],
      };

      // Изображение: GeoGebra-чертёж, загруженный файл или URL
      if (imageSource === 'drawing' && drawingImageDataUrl) {
        taskData.image = dataUrlToFile(drawingImageDataUrl);
        taskData.image_url = '';
        taskData.has_image = true;
      } else if (imageSource === 'upload' && uploadedFile) {
        taskData.image = uploadedFile;
        taskData.image_url = '';
        taskData.has_image = true;
      } else if (imageSource === 'url') {
        taskData.image_url = values.image_url || '';
        taskData.has_image = !!values.image_url;
      } else {
        // Режим upload/drawing без нового файла — сохраняем текущее состояние
        taskData.image_url = '';
        taskData.has_image = !!(task?.image);
      }

      // В режиме создания добавляем код
      if (isCreateMode) {
        if (!generatedCode) {
          message.error('Код задачи не сгенерирован. Выберите тему.');
          setLoading(false);
          return;
        }
        taskData.code = generatedCode;
      }

      // Вызываем onSave с taskId (null для создания)
      await onSave(isCreateMode ? null : task.id, taskData);

      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    try {
      setDeleting(true);
      await onDelete(task.id);
      message.success('Задача удалена');
      onClose();
    } catch (error) {
      console.error('Error deleting task:', error);
      message.error('Ошибка при удалении задачи');
    } finally {
      setDeleting(false);
    }
  };

  const handleStatementChange = (e) => {
    setPreviewStatement(e.target.value);
  };

  const handleAnswerChange = (e) => {
    setPreviewAnswer(e.target.value);
  };

  return (
    <Modal
      title={
        <Space>
          {isCreateMode ? <PlusOutlined /> : <EditOutlined />}
          <span>
            {isCreateMode
              ? `Создание новой задачи${generatedCode ? ` - ${generatedCode}` : ''}`
              : `Редактирование задачи ${task?.code}`
            }
          </span>
          {isCreateMode && generatingCode && <Spin size="small" />}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {!isCreateMode ? (
            <Popconfirm
              title="Удаление задачи"
              description={`Вы уверены, что хотите удалить задачу ${task?.code}?`}
              onConfirm={handleDelete}
              okText="Удалить"
              cancelText="Отмена"
              okButtonProps={{ danger: true }}
              icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={deleting}
              >
                Удалить
              </Button>
            </Popconfirm>
          ) : <div />}
          <Space>
            <Button onClick={onClose}>
              Отмена
            </Button>
            <Button
              type="primary"
              icon={isCreateMode ? <PlusOutlined /> : <SaveOutlined />}
              loading={loading}
              onClick={handleSave}
            >
              {isCreateMode ? 'Создать' : 'Сохранить'}
            </Button>
          </Space>
        </div>
      }
    >
      {!isCreateMode && (
        <Alert
          type="warning"
          showIcon
          message="Изменения будут применены ко всем работам, где используется эта задача."
          style={{ marginBottom: 16 }}
        />
      )}
      <Form
        form={form}
        layout="vertical"
      >
        {/* Уровень сложности */}
        <Form.Item
          name="difficulty"
          label="Уровень сложности"
          rules={[{ required: true, message: 'Выберите уровень сложности' }]}
        >
          <Select>
            <Option value="1">1 - Базовый</Option>
            <Option value="2">2 - Средний</Option>
            <Option value="3">3 - Повышенный</Option>
            <Option value="4">4 - Высокий</Option>
            <Option value="5">5 - Олимпиадный</Option>
          </Select>
        </Form.Item>

        {/* Тема */}
        <Form.Item
          name="topic"
          label="Тема"
          rules={[{ required: true, message: 'Выберите тему' }]}
        >
          <Select
            placeholder="Выберите тему"
            showSearch
            optionFilterProp="children"
            onChange={handleTopicChange}
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ padding: '0 8px 8px' }}>
                  <Space style={{ display: 'flex' }}>
                    <InputNumber
                      placeholder="№ ЕГЭ"
                      min={0}
                      style={{ width: 100 }}
                      value={newTopicNumber}
                      onChange={setNewTopicNumber}
                    />
                    <Input
                      placeholder="Новая тема"
                      value={newTopicTitle}
                      onChange={(e) => setNewTopicTitle(e.target.value)}
                    />
                    <Button
                      type="text"
                      icon={<PlusOutlined />}
                      loading={creatingTopic}
                      onClick={handleCreateTopic}
                    >
                      Добавить
                    </Button>
                  </Space>
                </div>
              </>
            )}
          >
            {topics.map(topic => (
              <Option key={topic.id} value={topic.id}>
                №{topic.ege_number} - {topic.title}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Подтема */}
        <Form.Item
          name="subtopic"
          label="Подтема"
        >
          <Select
            placeholder="Выберите подтему"
            allowClear
            showSearch
            optionFilterProp="children"
            disabled={!form.getFieldValue('topic')}
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ padding: '0 8px 8px' }}>
                  <Space style={{ display: 'flex' }}>
                    <Input
                      placeholder="Новая подтема"
                      value={newSubtopicName}
                      onChange={(e) => setNewSubtopicName(e.target.value)}
                    />
                    <Button
                      type="text"
                      icon={<PlusOutlined />}
                      loading={creatingSubtopic}
                      onClick={handleCreateSubtopic}
                      disabled={!form.getFieldValue('topic')}
                    >
                      Добавить
                    </Button>
                  </Space>
                </div>
              </>
            )}
          >
            {filteredSubtopics.map(st => (
              <Option key={st.id} value={st.id}>{st.name}</Option>
            ))}
          </Select>
        </Form.Item>

        {/* Источник */}
        <Form.Item
          name="source"
          label="Источник"
        >
          <Select
            placeholder="Выберите или введите источник"
            allowClear
            showSearch
            mode="tags"
            maxTagCount={1}
          >
            {allSources.map(s => (
              <Option key={s} value={s}>{s}</Option>
            ))}
          </Select>
        </Form.Item>

        {/* Год */}
        <Form.Item
          name="year"
          label="Год"
        >
          <Select
            placeholder="Выберите год"
            allowClear
            showSearch
          >
            {allYears.map(y => (
              <Option key={y} value={y}>{y}</Option>
            ))}
          </Select>
        </Form.Item>

        {/* Теги */}
        <Form.Item
          name="tags"
          label="Теги"
          help="Введите название нового тега и нажмите Enter для создания"
        >
          <Select
            mode="tags"
            placeholder="Выберите или создайте теги"
            allowClear
            showSearch
            loading={creatingTag}
            optionFilterProp="children"
            onSelect={async (value) => {
              // Если выбрано значение, которого нет в списке ID - это новый тег
              const isExistingTag = tags.some(t => t.id === value);
              if (!isExistingTag) {
                // Создаём новый тег
                const newTagId = await handleCreateTag(value);
                if (newTagId) {
                  // Заменяем временное значение на ID
                  const currentTags = form.getFieldValue('tags') || [];
                  const updatedTags = currentTags.map(t => t === value ? newTagId : t);
                  form.setFieldValue('tags', updatedTags);
                } else {
                  // Если создание не удалось - убираем временное значение
                  const currentTags = form.getFieldValue('tags') || [];
                  form.setFieldValue('tags', currentTags.filter(t => t !== value));
                }
              }
            }}
          >
            {tags.map(tag => (
              <Option key={tag.id} value={tag.id}>
                {tag.title}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Изображение */}
        <Form.Item label="Изображение (опционально)">
          <Segmented
            value={imageSource}
            onChange={(val) => setImageSource(val)}
            options={[
              { value: 'url', label: 'По ссылке', icon: <LinkOutlined /> },
              { value: 'upload', label: 'Загрузить', icon: <UploadOutlined /> },
              { value: 'drawing', label: 'Нарисовать', icon: <HighlightOutlined /> },
            ]}
            style={{ marginBottom: 12 }}
          />

          {imageSource === 'url' && (
            <Form.Item name="image_url" noStyle>
              <Input placeholder="https://example.com/image.png" />
            </Form.Item>
          )}

          {imageSource === 'upload' && (
            <div>
              {/* Превью существующего или только что загруженного */}
              {(uploadPreviewUrl || (task?.image && !uploadedFile)) && (
                <div style={{ marginBottom: 12, border: '1px solid #e8e8e8', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                  <img
                    src={uploadPreviewUrl || api.getTaskImageUrl(task)}
                    alt="Изображение"
                    style={{ maxWidth: '100%', maxHeight: 200, display: 'block', margin: '0 auto' }}
                  />
                </div>
              )}
              <Space wrap>
                <Upload
                  accept="image/*"
                  maxCount={1}
                  showUploadList={false}
                  beforeUpload={(file) => {
                    setUploadedFile(file);
                    const reader = new FileReader();
                    reader.onload = (e) => setUploadPreviewUrl(e.target.result);
                    reader.readAsDataURL(file);
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />}>Выбрать файл</Button>
                </Upload>
                <Button
                  icon={<ScissorOutlined />}
                  disabled={!uploadPreviewUrl}
                  onClick={() => {
                    setCropMargins({ left: 0, right: 0, top: 0, bottom: 0 });
                    setCropModalOpen(true);
                  }}
                >
                  Обрезать
                </Button>
              </Space>
              {uploadedFile && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>{uploadedFile.name}</div>
              )}
            </div>
          )}

          {imageSource === 'drawing' && (
            <>
              {task?.image && !drawingImageDataUrl && (
                <div style={{ marginBottom: 12, border: '1px solid #e8e8e8', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Текущий чертёж:</div>
                  <img
                    src={api.getTaskImageUrl(task)}
                    alt="Текущий чертёж"
                    style={{ maxWidth: '100%', maxHeight: 150, display: 'block', margin: '0 auto' }}
                  />
                </div>
              )}
              <GeoGebraDrawingPanel
                imageDataUrl={drawingImageDataUrl}
                onImageChange={setDrawingImageDataUrl}
              />
            </>
          )}
        </Form.Item>

        {/* Текст задания */}
        <Form.Item
          name="statement_md"
          label="Текст задания (поддерживает LaTeX: $x^2$)"
          rules={[{
            required: isCreateMode,
            message: 'Введите текст задания'
          }]}
        >
          <TextArea
            rows={4}
            placeholder="Введите текст задания..."
            onChange={handleStatementChange}
          />
        </Form.Item>

        {/* Предпросмотр задания */}
        {previewStatement && (
          <div style={{ 
            marginBottom: 16, 
            padding: 12, 
            background: '#f5f5f5',
            borderRadius: 4,
            border: '1px solid #d9d9d9'
          }}>
            <div style={{ 
              fontSize: 12, 
              color: '#666', 
              marginBottom: 8,
              fontWeight: 'bold'
            }}>
              Предпросмотр задания:
            </div>
            <MathRenderer text={previewStatement} />
          </div>
        )}

        {/* Ответ */}
        <Form.Item
          name="answer"
          label="Ответ (поддерживает LaTeX)"
        >
          <Input 
            placeholder="Введите ответ..."
            onChange={handleAnswerChange}
          />
        </Form.Item>

        {/* Предпросмотр ответа */}
        {previewAnswer && (
          <div style={{ 
            marginBottom: 16, 
            padding: 12, 
            background: '#e6f7ff',
            borderRadius: 4,
            border: '1px solid #91d5ff'
          }}>
            <div style={{ 
              fontSize: 12, 
              color: '#666', 
              marginBottom: 8,
              fontWeight: 'bold'
            }}>
              Предпросмотр ответа:
            </div>
            <MathRenderer text={previewAnswer} />
          </div>
        )}

        {/* Решение */}
        <Form.Item
          name="solution_md"
          label="Решение (опционально, поддерживает LaTeX)"
        >
          <TextArea 
            rows={4}
            placeholder="Введите решение задачи..."
          />
        </Form.Item>

        {/* Подсказка по LaTeX */}
        <div style={{ 
          fontSize: 12, 
          color: '#666',
          background: '#fff7e6',
          padding: 8,
          borderRadius: 4,
          border: '1px solid #ffd591'
        }}>
          <strong>Примеры LaTeX:</strong><br />
          • Степени: <code>x^2</code>, <code>a^{10}</code><br />
          • Дроби: <code>\frac{'{'}a{'}'}{'{'} b{'}'}</code><br />
          • Корни: <code>\sqrt{'{'}x{'}'}</code>, <code>\sqrt[3]{'{'}x{'}'}</code><br />
          • Знаки: <code>\cdot</code> (умножение), <code>\leq</code>, <code>\geq</code><br />
          • Скобки: <code>\left( ... \right)</code>
        </div>
      </Form>

      {/* Crop модал для загруженных изображений */}
      <Modal
        title="Обрезка изображения"
        open={cropModalOpen}
        onCancel={() => setCropModalOpen(false)}
        onOk={async () => {
          if (!uploadPreviewUrl) return;
          setCroppingImage(true);
          try {
            const cropped = await cropPngByMargins(uploadPreviewUrl, cropMargins);
            setUploadPreviewUrl(cropped);
            setUploadedFile(dataUrlToFile(cropped, uploadedFile?.name || 'image.png'));
            setCropModalOpen(false);
            message.success('Изображение обрезано');
          } catch (err) {
            message.error(`Ошибка обрезки: ${err?.message}`);
          } finally {
            setCroppingImage(false);
          }
        }}
        okText="Применить"
        cancelText="Отмена"
        confirmLoading={croppingImage}
        width={820}
      >
        {uploadPreviewUrl && (() => {
          const nc = normalizeCrop(cropMargins);
          return (
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <div style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0, maxWidth: '100%' }}>
                  <img src={uploadPreviewUrl} alt="Предпросмотр" style={{ maxWidth: '100%', maxHeight: 360, display: 'block' }} />
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${nc.top}%`, background: 'rgba(0,0,0,0.28)' }} />
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${nc.bottom}%`, background: 'rgba(0,0,0,0.28)' }} />
                    <div style={{ position: 'absolute', left: 0, top: `${nc.top}%`, bottom: `${nc.bottom}%`, width: `${nc.left}%`, background: 'rgba(0,0,0,0.28)' }} />
                    <div style={{ position: 'absolute', right: 0, top: `${nc.top}%`, bottom: `${nc.bottom}%`, width: `${nc.right}%`, background: 'rgba(0,0,0,0.28)' }} />
                    <div style={{ position: 'absolute', left: `${nc.left}%`, right: `${nc.right}%`, top: `${nc.top}%`, bottom: `${nc.bottom}%`, border: '2px solid #ff4d4f', boxShadow: '0 0 0 1px rgba(255,255,255,0.95) inset' }} />
                  </div>
                </div>
              </div>
              {[['left', 'Слева'], ['right', 'Справа'], ['top', 'Сверху'], ['bottom', 'Снизу']].map(([edge, label]) => (
                <div key={edge} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px', gap: 10, alignItems: 'center' }}>
                  <span>{label}</span>
                  <Slider min={0} max={45} step={1} value={nc[edge]} onChange={(v) => setCropMargins((prev) => normalizeCrop({ ...prev, [edge]: v }))} />
                  <InputNumber min={0} max={45} value={nc[edge]} onChange={(v) => setCropMargins((prev) => normalizeCrop({ ...prev, [edge]: v ?? 0 }))} addonAfter="%" style={{ width: '100%' }} />
                </div>
              ))}
            </Space>
          );
        })()}
      </Modal>
    </Modal>
  );
};

export default TaskEditModal;
