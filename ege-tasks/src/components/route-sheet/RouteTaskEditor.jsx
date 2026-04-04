import { useState, useMemo, useCallback } from 'react';
import {
  Modal, Form, Input, Select, Button, Tabs, Alert, Space, Tag, Divider, Typography, Tooltip,
} from 'antd';
import { InfoCircleOutlined, EyeOutlined } from '@ant-design/icons';
import MathRenderer from '../../shared/components/MathRenderer';
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import { api } from '../../services/pocketbase';
import { circleNum } from '../../hooks/useRouteSheet';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const DIFFICULTY_OPTIONS = [
  { value: 1, label: '1 — Базовый' },
  { value: 2, label: '2 — Средний' },
  { value: 3, label: '3 — Повышенный' },
];

// Инструкция по составлению задач
function InstructionPanel({ previousTasks }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 16 }}>
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message={
          <span
            style={{ cursor: 'pointer', fontWeight: 500 }}
            onClick={() => setOpen(v => !v)}
          >
            Как составить задачу для маршрутного листа {open ? '▲' : '▼'}
          </span>
        }
        description={open ? (
          <div style={{ marginTop: 8 }}>
            <Paragraph style={{ marginBottom: 8 }}>
              В условии задачи можно сослаться на ответ <b>предыдущей задачи</b> с помощью специального плейсхолдера:
            </Paragraph>
            <div style={{ background: '#fff', border: '1px solid #91d5ff', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontFamily: 'monospace', fontSize: 13 }}>
              Найдите периметр прямоугольника, у которого одна сторона равна <b>[①]</b>, а другая на 3 больше.
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
              <li><b>[①]</b> — будет заменён на ответ первой задачи</li>
              <li><b>[②]</b> — на ответ второй задачи и т.д.</li>
              <li>В <b>бланке ученика</b> плейсхолдеры отображаются как есть — ученик сам переносит ответ</li>
              <li>В <b>ключе учителя</b> плейсхолдеры автоматически заменяются на числа-ответы</li>
            </ul>
            {previousTasks.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Доступные ссылки в этой задаче:</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {previousTasks.map((t, i) => (
                    <Tag key={t.id} color="blue">
                      {circleNum(i)} → {t.answer || '(нет ответа)'}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
        style={{ marginBottom: 0 }}
      />
    </div>
  );
}

// Кнопки быстрой вставки плейсхолдеров
function PlaceholderButtons({ previousTasks, onInsert }) {
  if (previousTasks.length === 0) return null;
  return (
    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Text type="secondary" style={{ fontSize: 12 }}>Вставить ссылку:</Text>
      {previousTasks.map((t, i) => (
        <Tooltip key={t.id} title={`Ответ задачи ${i + 1}: ${t.answer || '—'}`}>
          <Button
            size="small"
            onClick={() => onInsert(`[${circleNum(i)}]`)}
            style={{ fontFamily: 'monospace', padding: '0 8px' }}
          >
            [{circleNum(i)}]
          </Button>
        </Tooltip>
      ))}
    </div>
  );
}

// Превью одной версии (ученик или учитель)
function StatementPreview({ statement, previousTasks, mode }) {
  const rendered = useMemo(() => {
    if (!statement) return '';
    if (mode === 'teacher') {
      let result = statement;
      previousTasks.forEach((t, i) => {
        const ph = `[${circleNum(i)}]`;
        result = result.replaceAll(ph, t.answer || ph);
      });
      return result;
    }
    return statement;
  }, [statement, previousTasks, mode]);

  if (!rendered) {
    return <Text type="secondary" style={{ fontSize: 13 }}>Условие пусто</Text>;
  }

  return (
    <div style={{
      border: '1px solid #e0e0e0',
      borderRadius: 8,
      padding: '12px 16px',
      background: mode === 'teacher' ? '#f6ffed' : '#fafafa',
      minHeight: 80,
    }}>
      {mode === 'teacher' && (
        <div style={{ fontSize: 11, color: '#52c41a', marginBottom: 6 }}>
          ✓ ответы подставлены
        </div>
      )}
      <MathRenderer content={rendered} />
    </div>
  );
}

export default function RouteTaskEditor({ open, onClose, onSaved, previousTasks = [], insertIndex }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [statementValue, setStatementValue] = useState('');

  const { topics, subtopics } = useReferenceData();
  const selectedTopic = Form.useWatch('topic', form);
  const filteredSubtopics = useMemo(
    () => selectedTopic ? subtopics.filter(s => s.topic === selectedTopic) : [],
    [subtopics, selectedTopic]
  );

  // Вставка плейсхолдера в курсор текстовой области
  const handleInsertPlaceholder = useCallback((ph) => {
    const el = document.getElementById('route-task-statement');
    if (!el) {
      setStatementValue(prev => prev + ph);
      form.setFieldValue('statement_md', (form.getFieldValue('statement_md') || '') + ph);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const current = el.value;
    const next = current.slice(0, start) + ph + current.slice(end);
    setStatementValue(next);
    form.setFieldValue('statement_md', next);
    // Восстанавливаем курсор
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ph.length, start + ph.length);
    });
  }, [form]);

  const handleSave = useCallback(async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const payload = {
        statement_md: values.statement_md,
        answer: values.answer || '',
        topic: values.topic || undefined,
        subtopic: values.subtopic ? [values.subtopic] : [],
        difficulty: values.difficulty || 1,
        source: 'route',
        has_image: false,
      };
      const task = await api.createTask(payload);
      form.resetFields();
      setStatementValue('');
      onSaved(task);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, [form, onSaved]);

  const handleClose = useCallback(() => {
    form.resetFields();
    setStatementValue('');
    onClose();
  }, [form, onClose]);

  const taskLabel = insertIndex !== undefined ? `задача №${insertIndex + 1}` : 'новая задача';

  return (
    <Modal
      title={`Редактор задачи для маршрута — ${taskLabel}`}
      open={open}
      onCancel={handleClose}
      width={820}
      footer={[
        <Button key="cancel" onClick={handleClose}>Отмена</Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSave}>
          Сохранить и добавить в маршрут
        </Button>,
      ]}
      destroyOnHidden
      style={{ top: 20 }}
    >
      <InstructionPanel previousTasks={previousTasks} />

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Левая колонка: форма */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Form form={form} layout="vertical">
            <Form.Item name="topic" label="Тема">
              <Select
                placeholder="Выберите тему"
                allowClear
                showSearch
                optionFilterProp="label"
                options={topics.map(t => ({
                  value: t.id,
                  label: t.ege_number ? `№${t.ege_number} — ${t.title}` : t.title,
                }))}
                onChange={() => form.setFieldValue('subtopic', undefined)}
              />
            </Form.Item>

            {filteredSubtopics.length > 0 && (
              <Form.Item name="subtopic" label="Подтема">
                <Select
                  placeholder="Подтема (необязательно)"
                  allowClear
                  options={filteredSubtopics.map(s => ({ value: s.id, label: s.name }))}
                />
              </Form.Item>
            )}

            <Form.Item
              name="difficulty"
              label="Сложность"
              initialValue={1}
            >
              <Select options={DIFFICULTY_OPTIONS} />
            </Form.Item>

            <Form.Item
              name="statement_md"
              label="Условие задачи"
              rules={[{ required: true, message: 'Введите условие' }]}
            >
              <div>
                <PlaceholderButtons
                  previousTasks={previousTasks}
                  onInsert={handleInsertPlaceholder}
                />
                <TextArea
                  id="route-task-statement"
                  rows={6}
                  placeholder={'Например:\nНайдите периметр прямоугольника, у которого одна сторона равна [①], а другая на 3 больше.'}
                  value={statementValue}
                  onChange={e => {
                    setStatementValue(e.target.value);
                    form.setFieldValue('statement_md', e.target.value);
                  }}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
              </div>
            </Form.Item>

            <Form.Item
              name="answer"
              label="Ответ"
              rules={[{ required: true, message: 'Введите ответ' }]}
            >
              <Input placeholder="Числовой ответ" style={{ width: 200 }} />
            </Form.Item>
          </Form>
        </div>

        {/* Правая колонка: превью */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <EyeOutlined /> Предпросмотр
          </div>
          <Tabs
            size="small"
            items={[
              {
                key: 'student',
                label: 'Ученик',
                children: (
                  <div>
                    <StatementPreview
                      statement={statementValue}
                      previousTasks={previousTasks}
                      mode="student"
                    />
                    <div style={{ marginTop: 8, fontSize: 12, color: '#aaa' }}>
                      Ученик видит плейсхолдеры и сам переносит числа из предыдущих ответов.
                    </div>
                  </div>
                ),
              },
              {
                key: 'teacher',
                label: 'Ключ учителя',
                children: (
                  <div>
                    <StatementPreview
                      statement={statementValue}
                      previousTasks={previousTasks}
                      mode="teacher"
                    />
                    <div style={{ marginTop: 8, fontSize: 12, color: '#aaa' }}>
                      Учитель видит задачи с подставленными ответами.
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
    </Modal>
  );
}
