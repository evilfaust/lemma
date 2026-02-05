import { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, message, Button, Space, Popconfirm, Spin } from 'antd';
import { EditOutlined, SaveOutlined, DeleteOutlined, ExclamationCircleOutlined, PlusOutlined } from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import { generateTaskCode } from '../utils/taskCodeGenerator';
import { api } from '../services/pocketbase';

const { Option } = Select;
const { TextArea } = Input;

const TaskEditModal = ({ task, visible, onClose, onSave, onDelete, allTags = [], allSources = [], allYears = [], allSubtopics = [], allTopics = [] }) => {
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
      } else {
        // Режим создания - пустая форма
        form.resetFields();
        setGeneratedCode('');
        setPreviewStatement('');
        setPreviewAnswer('');
        setSelectedTopic(null);
        setFilteredSubtopics([]);
      }
    }
  }, [task, visible, form, allTopics, allSubtopics]);

  const handleTopicChange = (topicId) => {
    const topicData = allTopics.find(t => t.id === topicId);
    setSelectedTopic(topicData);

    // Фильтруем подтемы по выбранной теме
    const subtopicsForTopic = allSubtopics.filter(st => st.topic === topicId);
    setFilteredSubtopics(subtopicsForTopic);

    // Сбрасываем подтему при смене темы
    form.setFieldValue('subtopic', undefined);

    // Генерируем код для новой задачи
    if (isCreateMode) {
      handleGenerateCode(topicId);
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
        image_url: values.image_url || '',
        has_image: !!values.image_url,
      };

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
          >
            {allTopics.map(topic => (
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

        {/* URL изображения */}
        <Form.Item
          name="image_url"
          label="URL изображения (опционально)"
        >
          <Input
            placeholder="https://example.com/image.png"
          />
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
    </Modal>
  );
};

export default TaskEditModal;