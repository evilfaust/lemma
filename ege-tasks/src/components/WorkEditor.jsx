import { useEffect, useMemo, useState } from 'react';
import { Card, Tabs, Form, Input, InputNumber, Select, Button, Space, Typography, Tooltip, Alert, Empty, Tag, Popconfirm } from 'antd';
import { SaveOutlined, CopyOutlined, EditOutlined, SwapOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import TaskReplaceModal from './TaskReplaceModal';
import TaskEditModal from './TaskEditModal';
import TaskSelectModal from './TaskSelectModal';
import SessionPanel from './worksheet/SessionPanel';
import TeacherResultsDashboard from './worksheet/TeacherResultsDashboard';
import { useTaskDragDrop, useTaskEditing } from '../hooks';
import './TaskWorksheet.css';

const PB_URL = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';

const { Text } = Typography;
const { Option } = Select;

const WorkEditor = ({
  work,
  variants,
  setVariants,
  onSave,
  onSaveAsNew,
  hasAttempts,
  attemptCount = 0,
  sessionId = null,
  topics = [],
  tags = [],
  subtopics = [],
  years = [],
  sources = [],
}) => {
  const [form] = Form.useForm();
  const [activeVariantKey, setActiveVariantKey] = useState(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addTargetVariant, setAddTargetVariant] = useState(null);

  const dragDropHandlers = useTaskDragDrop(variants, setVariants);
  const taskEditing = useTaskEditing(variants, setVariants);

  useEffect(() => {
    if (!work) return;
    form.setFieldsValue({
      title: work.title || 'Контрольная работа',
      topic: work.topic || null,
      timeLimit: work.time_limit || null,
    });
  }, [work, form]);

  useEffect(() => {
    if (variants.length === 0) {
      setActiveVariantKey(null);
      return;
    }
    const key = String(variants[0].number || 1);
    setActiveVariantKey(prev => prev || key);
  }, [variants]);

  const activeVariantIndex = useMemo(() => {
    if (!activeVariantKey) return 0;
    const idx = variants.findIndex(v => String(v.number) === String(activeVariantKey));
    return idx === -1 ? 0 : idx;
  }, [variants, activeVariantKey]);

  const activeVariant = variants[activeVariantIndex];

  const totalTasksCount = useMemo(() => {
    return variants.reduce((sum, v) => sum + (v.tasks?.length || 0), 0);
  }, [variants]);

  const handleRemoveTask = (variantIndex, taskIndex) => {
    const next = [...variants];
    next[variantIndex].tasks.splice(taskIndex, 1);
    setVariants(next);
  };

  const openAddTaskModal = (variantIndex) => {
    setAddTargetVariant(variantIndex);
    setAddModalVisible(true);
  };

  const handleAddTask = (task) => {
    if (addTargetVariant === null || addTargetVariant === undefined) return;
    const next = [...variants];
    next[addTargetVariant].tasks.push(task);
    setVariants(next);
    setAddModalVisible(false);
    setAddTargetVariant(null);
  };

  const handleAddVariant = () => {
    const maxNumber = variants.reduce((max, v) => Math.max(max, v.number || 0), 0);
    const nextNumber = maxNumber + 1;
    const next = [...variants, { number: nextNumber, tasks: [] }];
    setVariants(next);
    setActiveVariantKey(String(nextNumber));
  };

  const handleRemoveVariant = (variantIndex) => {
    const next = variants.filter((_, idx) => idx !== variantIndex);
    setVariants(next);
    const newActive = next[0]?.number ? String(next[0].number) : null;
    setActiveVariantKey(newActive);
  };

  const handleSaveClick = async () => {
    const values = await form.validateFields();
    if (hasAttempts) {
      await onSaveAsNew(values);
    } else {
      await onSave(values);
    }
  };

  const handleSaveAsNewClick = async () => {
    const values = await form.validateFields();
    await onSaveAsNew(values);
  };

  if (!work) {
    return (
      <Card>
        <Empty description="Выберите работу слева, чтобы редактировать" />
      </Card>
    );
  }

  return (
    <Card
      title={work.title || 'Работа без названия'}
      extra={
        <Space wrap>
          {hasAttempts ? (
            <Tooltip title="У работы есть попытки. Можно только сохранить как новую.">
              <Button type="primary" icon={<CopyOutlined />} onClick={handleSaveAsNewClick}>
                Сохранить как новую
              </Button>
            </Tooltip>
          ) : (
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveClick}>
              Сохранить
            </Button>
          )}
          <Button icon={<CopyOutlined />} onClick={handleSaveAsNewClick}>
            Копия
          </Button>
        </Space>
      }
      styles={{ body: { paddingTop: 12 } }}
    >
      {hasAttempts && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="У этой работы есть попытки. Изменения можно сохранить только как новую работу."
          description={`Попыток: ${attemptCount}. История останется неизменной.`}
        />
      )}

      <Tabs
        items={[
          {
            key: 'structure',
            label: 'Состав',
            children: (
              <div>
                {variants.length === 0 ? (
                  <Empty description="В работе нет вариантов" />
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <Text type="secondary">Вариантов: {variants.length} • Задач: {totalTasksCount}</Text>
                      <Space wrap>
                        <Button
                          icon={<PlusOutlined />}
                          onClick={handleAddVariant}
                        >
                          Добавить вариант
                        </Button>
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() => openAddTaskModal(activeVariantIndex)}
                          disabled={!activeVariant}
                        >
                          Добавить задачу
                        </Button>
                        <Popconfirm
                          title="Удалить вариант?"
                          description="Задачи из варианта будут удалены только из этой работы."
                          okText="Удалить"
                          cancelText="Отмена"
                          onConfirm={() => handleRemoveVariant(activeVariantIndex)}
                          disabled={!activeVariant || variants.length <= 1}
                        >
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            disabled={!activeVariant || variants.length <= 1}
                          >
                            Удалить вариант
                          </Button>
                        </Popconfirm>
                      </Space>
                    </div>

                    <Tabs
                      type="card"
                      activeKey={activeVariantKey || undefined}
                      onChange={setActiveVariantKey}
                      items={variants.map((variant, idx) => ({
                        key: String(variant.number || idx + 1),
                        label: `Вариант ${variant.number || idx + 1}`,
                        children: (
                          <div>
                            {(variant.tasks || []).map((task, taskIndex) => {
                              const isDragging = dragDropHandlers?.isDragging(idx, taskIndex);
                              const isDragOver = dragDropHandlers?.isDragOver(idx, taskIndex);

                              return (
                                <div
                                  key={task.id}
                                  className={`task-item ${isDragging ? 'dragging' : ''} ${
                                    isDragOver ? 'drag-over' : ''
                                  }`}
                                  draggable
                                  onDragStart={e => dragDropHandlers?.handleDragStart(e, idx, taskIndex)}
                                  onDragOver={e => dragDropHandlers?.handleDragOver(e, idx, taskIndex)}
                                  onDragLeave={dragDropHandlers?.handleDragLeave}
                                  onDrop={e => dragDropHandlers?.handleDrop(e, idx, taskIndex)}
                                  onDragEnd={dragDropHandlers?.handleDragEnd}
                                  style={{ marginBottom: 12 }}
                                >
                                  <div className="task-header" style={{ alignItems: 'center' }}>
                                    <span className="task-number">{taskIndex + 1}.</span>
                                    {task.code && <Tag style={{ marginLeft: 8 }}>{task.code}</Tag>}
                                    {task.difficulty && (
                                      <Tag color="blue">Сложность: {task.difficulty}</Tag>
                                    )}
                                    <div className="no-print" style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                      <Tooltip title="Редактировать задачу">
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<EditOutlined />}
                                          onClick={() => taskEditing.handleEditTask(task)}
                                        />
                                      </Tooltip>
                                      <Tooltip title="Заменить задачу">
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<SwapOutlined />}
                                          onClick={() => taskEditing.handleReplaceTask(idx, taskIndex, task)}
                                        />
                                      </Tooltip>
                                      <Tooltip title="Удалить из варианта">
                                        <Button
                                          type="text"
                                          size="small"
                                          danger
                                          icon={<DeleteOutlined />}
                                          onClick={() => handleRemoveTask(idx, taskIndex)}
                                        />
                                      </Tooltip>
                                    </div>
                                  </div>
                                  <div className="task-content">
                                    <MathRenderer text={task.statement_md} />
                                    {(task.image_url || task.image) && (
                                      <div className="task-image">
                                        <img
                                          src={task.image_url || `${PB_URL}/api/files/tasks/${task.id}/${task.image}`}
                                          alt=""
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ),
                      }))}
                    />
                  </>
                )}
              </div>
            ),
          },
          {
            key: 'params',
            label: 'Параметры',
            children: (
              <Form form={form} layout="vertical">
                <Form.Item
                  name="title"
                  label="Название работы"
                  rules={[{ required: true, message: 'Введите название работы' }]}
                >
                  <Input placeholder="Например: Контрольная — тригонометрия" />
                </Form.Item>

                <Form.Item name="topic" label="Основная тема">
                  <Select allowClear placeholder="Не выбрано" showSearch optionFilterProp="children">
                    {topics.map(topic => (
                      <Option key={topic.id} value={topic.id}>
                        №{topic.ege_number} - {topic.title}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item name="timeLimit" label="Время на выполнение (мин)">
                  <InputNumber min={1} max={300} style={{ width: '100%' }} />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'results',
            label: 'Результаты',
            children: (
              <div>
                <Card size="small" title="Выдача" style={{ marginBottom: 12 }}>
                  <SessionPanel workId={work.id} />
                </Card>
                <Card size="small" title="Результаты">
                  {sessionId ? (
                    <TeacherResultsDashboard sessionId={sessionId} />
                  ) : (
                    <Empty description="Нет активной сессии" />
                  )}
                </Card>
              </div>
            ),
          },
        ]}
      />

      <TaskReplaceModal
        visible={taskEditing.replaceModalVisible}
        taskToReplace={taskEditing.taskToReplace}
        onConfirm={taskEditing.handleConfirmReplace}
        onCancel={taskEditing.handleCancelReplace}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        currentVariantTasks={
          taskEditing.taskToReplace
            ? variants[taskEditing.taskToReplace.variantIndex]?.tasks || []
            : []
        }
      />

      <TaskEditModal
        visible={taskEditing.editModalVisible}
        task={taskEditing.taskToEdit}
        onClose={taskEditing.handleCancelEdit}
        onSave={taskEditing.handleSaveEdit}
        onDelete={taskEditing.handleDeleteEdit}
        allTags={tags}
        allSources={sources}
        allYears={years}
        allSubtopics={subtopics}
        allTopics={topics}
      />

      <TaskSelectModal
        visible={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          setAddTargetVariant(null);
        }}
        onSelect={handleAddTask}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        excludeIds={(activeVariant?.tasks || []).map(t => t.id)}
      />
    </Card>
  );
};

export default WorkEditor;
