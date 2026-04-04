import { useRef, useState, useCallback } from 'react';
import {
  App, Button, Divider, Input, List, Modal, Popconfirm, Select,
  Space, Switch, Tag, Tooltip, Typography,
} from 'antd';
import {
  ArrowDownOutlined, DeleteOutlined, PlusOutlined, PrinterOutlined,
  SaveOutlined, UpOutlined, DownOutlined, ReloadOutlined, FolderOpenOutlined,
} from '@ant-design/icons';
import useRouteSheet, { circleNum } from '../hooks/useRouteSheet';
import RouteSheetPrintLayout from './route-sheet/RouteSheetPrintLayout';
import './route-sheet/RouteSheetPrintLayout.css';
import TaskSelectModal from './TaskSelectModal';
import MathRenderer from '../shared/components/MathRenderer';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';

const { Title, Text } = Typography;

// Компонент одной задачи в списке
function TaskRow({ task, index, total, onRemove, onMoveUp, onMoveDown }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: '10px 12px',
      border: '1px solid #e8e8e8',
      borderRadius: 8,
      background: '#fafafa',
    }}>
      {/* Номер кружком */}
      <span style={{
        fontSize: 20, fontWeight: 'bold', color: '#1890ff',
        flexShrink: 0, lineHeight: '1.2',
        minWidth: 28, textAlign: 'center',
      }}>
        {circleNum(index)}
      </span>

      {/* Условие */}
      <div style={{ flex: 1, overflow: 'hidden', fontSize: 13 }}>
        <div style={{ color: '#666', fontSize: 11, marginBottom: 2 }}>
          {task.code || task.id}
        </div>
        <div style={{ lineHeight: 1.5 }}>
          <MathRenderer content={(task.statement_md || '').slice(0, 150)} />
        </div>
        {task.answer && (
          <div style={{ marginTop: 4, fontSize: 12 }}>
            <Text type="secondary">Ответ: </Text>
            <Text strong style={{ color: '#389e0d' }}>{task.answer}</Text>
          </div>
        )}
      </div>

      {/* Кнопки */}
      <Space size={4} style={{ flexShrink: 0 }}>
        <Tooltip title="Вверх">
          <Button
            size="small"
            icon={<UpOutlined />}
            disabled={index === 0}
            onClick={() => onMoveUp(index)}
          />
        </Tooltip>
        <Tooltip title="Вниз">
          <Button
            size="small"
            icon={<DownOutlined />}
            disabled={index === total - 1}
            onClick={() => onMoveDown(index)}
          />
        </Tooltip>
        <Popconfirm
          title="Убрать задачу из листа?"
          onConfirm={() => onRemove(task.id)}
          okText="Да"
          cancelText="Нет"
          okButtonProps={{ danger: true }}
        >
          <Button size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
      </Space>
    </div>
  );
}

// Превью соединительной стрелки
function ChainConnector({ fromIndex }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 36,
      color: '#888',
      fontSize: 12,
      gap: 4,
      margin: '2px 0',
    }}>
      <ArrowDownOutlined style={{ color: '#aaa' }} />
      <span style={{ fontStyle: 'italic' }}>ответ {circleNum(fromIndex)} → следующая задача</span>
    </div>
  );
}

export default function RouteSheetGenerator() {
  const { message } = App.useApp();
  const { topics, subtopics, tags } = useReferenceData();
  const {
    title, setTitle,
    tasks,
    effectiveLinks,
    savedId,
    showTeacherKey, setShowTeacherKey,
    addTask, removeTask, moveTask,
    reset, loadFromSaved,
    save, update,
  } = useRouteSheet();

  const [selectModalOpen, setSelectModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [savedSheets, setSavedSheets] = useState([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [saving, setSaving] = useState(false);

  const studentPrintRef = useRef(null);
  const teacherPrintRef = useRef(null);

  const handleAddTask = useCallback((task) => {
    addTask(task);
    setSelectModalOpen(false);
  }, [addTask]);

  // Печать
  const handlePrint = useCallback((mode) => {
    const styleEl = document.createElement('style');
    styleEl.id = 'route-sheet-page-style';
    styleEl.textContent = `@page { size: A4 portrait; margin: 0; }`;
    document.head.appendChild(styleEl);
    window.print();
    setTimeout(() => {
      const el = document.getElementById('route-sheet-page-style');
      if (el) el.remove();
    }, 1500);
  }, []);

  // Сохранение
  const handleSave = useCallback(async () => {
    if (!tasks.length) { message.warning('Добавьте хотя бы одну задачу'); return; }
    setSaving(true);
    try {
      if (savedId) {
        await update();
        message.success('Маршрутный лист обновлён');
      } else {
        await save();
        message.success('Маршрутный лист сохранён');
      }
    } catch {
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }, [tasks, savedId, save, update, message]);

  // Загрузка
  const handleOpenLoad = useCallback(async () => {
    setLoadingSheets(true);
    setLoadModalOpen(true);
    try {
      const data = await api.getRouteSheets();
      setSavedSheets(data);
    } finally {
      setLoadingSheets(false);
    }
  }, []);

  const handleLoad = useCallback((sheet) => {
    loadFromSaved(sheet);
    setLoadModalOpen(false);
    message.success(`Загружен: ${sheet.title}`);
  }, [loadFromSaved, message]);

  const handleDelete = useCallback(async (id) => {
    await api.deleteRouteSheet(id);
    setSavedSheets(prev => prev.filter(s => s.id !== id));
    message.success('Удалён');
  }, [message]);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      {/* Шапка */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Маршрутный лист</Title>
        <Space>
          <Button icon={<FolderOpenOutlined />} onClick={handleOpenLoad}>Загрузить</Button>
          <Button icon={<ReloadOutlined />} onClick={reset}>Очистить</Button>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!tasks.length}
          >
            {savedId ? 'Обновить' : 'Сохранить'}
          </Button>
        </Space>
      </div>

      {/* Настройки */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Название листа</label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Маршрутный лист"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Switch checked={showTeacherKey} onChange={setShowTeacherKey} size="small" />
          <Text style={{ fontSize: 13 }}>Ключ учителя при печати</Text>
        </div>
      </div>

      <Divider />

      {/* Список задач */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text strong>Задачи цепочки ({tasks.length})</Text>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setSelectModalOpen(true)}
          >
            Добавить задачу
          </Button>
        </div>

        {tasks.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 0',
            border: '2px dashed #d9d9d9', borderRadius: 8,
            color: '#bbb',
          }}>
            Цепочка пуста. Добавьте задачи.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {tasks.map((task, idx) => (
              <div key={task.id}>
                {idx > 0 && <ChainConnector fromIndex={idx - 1} />}
                <TaskRow
                  task={task}
                  index={idx}
                  total={tasks.length}
                  onRemove={removeTask}
                  onMoveUp={(i) => moveTask(i, i - 1)}
                  onMoveDown={(i) => moveTask(i, i + 1)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Кнопки печати */}
      {tasks.length > 0 && (
        <>
          <Divider />
          <Space>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={() => handlePrint('student')}
            >
              Печать (бланк ученика)
            </Button>
            {showTeacherKey && (
              <Button
                icon={<PrinterOutlined />}
                onClick={() => handlePrint('teacher')}
                style={{ borderColor: '#52c41a', color: '#52c41a' }}
              >
                Печать (ключ учителя)
              </Button>
            )}
          </Space>
        </>
      )}

      {/* Печатные макеты (скрыты на экране, показываются при печати) */}
      {tasks.length > 0 && (
        <>
          <RouteSheetPrintLayout
            ref={studentPrintRef}
            title={title}
            tasks={tasks}
            effectiveLinks={effectiveLinks}
            mode="student"
          />
          {showTeacherKey && (
            <RouteSheetPrintLayout
              ref={teacherPrintRef}
              title={`${title} — КЛЮЧ`}
              tasks={tasks}
              effectiveLinks={effectiveLinks}
              mode="teacher"
            />
          )}
        </>
      )}

      {/* Модал выбора задачи */}
      <TaskSelectModal
        visible={selectModalOpen}
        onCancel={() => setSelectModalOpen(false)}
        onSelect={handleAddTask}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        excludeIds={tasks.map(t => t.id)}
      />

      {/* Модал загрузки */}
      <Modal
        title="Загрузить маршрутный лист"
        open={loadModalOpen}
        onCancel={() => setLoadModalOpen(false)}
        footer={null}
        width={500}
      >
        <List
          loading={loadingSheets}
          dataSource={savedSheets}
          locale={{ emptyText: 'Нет сохранённых листов' }}
          renderItem={(sheet) => (
            <List.Item
              actions={[
                <Button
                  key="load"
                  type="link"
                  onClick={() => handleLoad(sheet)}
                >
                  Загрузить
                </Button>,
                <Popconfirm
                  key="del"
                  title="Удалить?"
                  onConfirm={() => handleDelete(sheet.id)}
                  okText="Да"
                  cancelText="Нет"
                  okButtonProps={{ danger: true }}
                >
                  <Button type="link" danger>Удалить</Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={sheet.title}
                description={`${sheet.expand?.tasks?.length ?? 0} задач`}
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
}
