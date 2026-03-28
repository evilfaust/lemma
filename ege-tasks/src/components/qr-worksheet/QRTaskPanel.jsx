import { useState } from 'react';
import { Card, Button, Tag, Typography, Tooltip, Empty, InputNumber, Divider } from 'antd';
import { DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import TaskSelectModal from '../TaskSelectModal';

const { Text } = Typography;

/**
 * Панель выбора задач и ввода ответов для QR-листа.
 *
 * Props:
 *   tasks[]              — текущие выбранные задачи
 *   customAnswers        — { taskId: string }
 *   topics, subtopics, tags — из useReferenceData() для TaskSelectModal
 *   onAddTask(task)
 *   onRemoveTask(taskId)
 *   onMoveTask(idx, dir)
 *   onSetCustomAnswer(taskId, value)
 *   getAnswerForTask(task) → string
 */
export default function QRTaskPanel({
  tasks,
  customAnswers,
  topics,
  subtopics,
  tags,
  onAddTask,
  onRemoveTask,
  onMoveTask,
  onSetCustomAnswer,
  getAnswerForTask,
  onEditTask,
}) {
  const [selectModalOpen, setSelectModalOpen] = useState(false);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Button
          icon={<PlusOutlined />}
          onClick={() => setSelectModalOpen(true)}
          block
          type="dashed"
        >
          Добавить задачу
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Выберите 3–6 задач. Числовые ответы станут «правильными» клетками в QR-сетке.
        </Text>
      </div>

      <TaskSelectModal
        visible={selectModalOpen}
        onCancel={() => setSelectModalOpen(false)}
        onSelect={(task) => { onAddTask(task); setSelectModalOpen(false); }}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        excludeIds={tasks.map(t => t.id)}
      />

      {tasks.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Задачи не выбраны"
          style={{ margin: '24px 0' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map((task, idx) => {
            const answer = getAnswerForTask(task);
            const isCustom = customAnswers[task.id] !== undefined;
            const isNumeric = answer !== '' && !isNaN(Number(answer));

            return (
              <Card
                key={task.id}
                size="small"
                style={{ border: isNumeric ? '1px solid #b7eb8f' : '1px solid #ffa39e' }}
                bodyStyle={{ padding: '8px 12px' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {/* Номер + кнопки перемещения */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 28 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>#{idx + 1}</Text>
                    <Button
                      size="small"
                      icon={<ArrowUpOutlined />}
                      onClick={() => onMoveTask(idx, -1)}
                      disabled={idx === 0}
                      type="text"
                    />
                    <Button
                      size="small"
                      icon={<ArrowDownOutlined />}
                      onClick={() => onMoveTask(idx, 1)}
                      disabled={idx === tasks.length - 1}
                      type="text"
                    />
                  </div>

                  {/* Условие задачи */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {task.code && (
                      <Tag style={{ marginBottom: 4, fontSize: 10 }}>{task.code}</Tag>
                    )}
                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                      <MathRenderer content={task.statement_md?.slice(0, 200) || ''} />
                    </div>
                  </div>

                  {/* Ответ */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 100 }}>
                    <Tooltip title={isCustom ? 'Ответ введён вручную' : 'Ответ из базы данных'}>
                      <InputNumber
                        size="small"
                        style={{ width: 90, borderColor: isNumeric ? '#52c41a' : '#ff4d4f' }}
                        placeholder="Ответ"
                        value={answer === '' ? undefined : Number(answer)}
                        onChange={(val) => onSetCustomAnswer(task.id, val !== null && val !== undefined ? String(val) : '')}
                      />
                    </Tooltip>
                    {!isNumeric && (
                      <Text type="danger" style={{ fontSize: 10 }}>нужен числовой ответ</Text>
                    )}
                  </div>

                  {/* Редактировать / Удалить */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Tooltip title="Редактировать задачу">
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => onEditTask?.(task)}
                      />
                    </Tooltip>
                    <Button
                      size="small"
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => onRemoveTask(task.id)}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tasks.length > 0 && (
        <Divider style={{ margin: '12px 0 0' }} />
      )}
    </div>
  );
}
