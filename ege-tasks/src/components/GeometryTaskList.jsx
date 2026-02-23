import { useCallback, useEffect, useRef, useState } from 'react';
import {
  App,
  Badge,
  Button,
  Card,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { api } from '../shared/services/pocketbase';
import GeometryTaskEditor from './GeometryTaskEditor';
import GeometryTaskPreview, { GeometryPreviewCard, normalizeLayout, PRINT_CELL_ASPECT_RATIO, safeParseLayout } from './GeometryTaskPreview';
import LoadGeometryPrintModal from './geometry/LoadGeometryPrintModal';
import './GeometryTaskPreview.css';

const { Text } = Typography;

const DIFFICULTY_COLORS = { 1: '#52c41a', 2: '#faad14', 3: '#ff4d4f' };
const DIFFICULTY_LABELS = { 1: 'Базовый', 2: 'Средний', 3: 'Сложный' };

export default function GeometryTaskList() {
  const { message } = App.useApp();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [geoTopics, setGeoTopics] = useState([]);
  const [geoSubtopics, setGeoSubtopics] = useState([]);

  // Редактор: null = скрыт, объект = редактирование, 'new' = создание
  const [editingTask, setEditingTask] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorLoadingId, setEditorLoadingId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTasks, setPreviewTasks] = useState([]);
  const [previewPrintTest, setPreviewPrintTest] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [savedSheetsOpen, setSavedSheetsOpen] = useState(false);
  const [savedSheetsLoading, setSavedSheetsLoading] = useState(false);
  const [savedSheets, setSavedSheets] = useState([]);
  const [quickPreviewOpen, setQuickPreviewOpen] = useState(false);
  const [quickPreviewTask, setQuickPreviewTask] = useState(null);
  const [quickPreviewLoadingId, setQuickPreviewLoadingId] = useState(null);
  const [quickPreviewLayout, setQuickPreviewLayout] = useState(() => normalizeLayout(null, 'print'));
  const [quickPreviewShowAnswers, setQuickPreviewShowAnswers] = useState(false);
  const [quickPreviewEditMode, setQuickPreviewEditMode] = useState(true);
  // null | 'saving' | 'saved' | 'error'
  const [autosaveStatus, setAutosaveStatus] = useState(null);
  // Реф нужен чтобы не ловить stale closure в setTimeout — quickPreviewTask может меняться
  const quickPreviewTaskRef = useRef(null);
  const autosaveTimerRef = useRef(null);

  // Синхронизируем реф с актуальным quickPreviewTask чтобы автосохранение всегда видело свежий объект
  useEffect(() => {
    quickPreviewTaskRef.current = quickPreviewTask;
  }, [quickPreviewTask]);

  // Загружаем справочники один раз
  useEffect(() => {
    Promise.all([api.getGeometryTopics(), api.getGeometrySubtopics()])
      .then(([topics, subtopics]) => {
        setGeoTopics(topics);
        setGeoSubtopics(subtopics);
      })
      .catch(() => {});
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getGeometryTasks(filters);
      setTasks(data);
    } catch {
      message.error('Ошибка загрузки задач');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleDelete = async (id) => {
    try {
      await api.deleteGeometryTask(id);
      message.success('Задача удалена');
      loadTasks();
    } catch {
      message.error('Ошибка при удалении задачи');
    }
  };

  const openCreate = () => {
    setEditingTask(null);
    setEditorOpen(true);
  };

  const openEdit = async (task) => {
    // Загружаем полную запись: LIGHT_FIELDS не включает geogebra_base64 и solution_md,
    // поэтому редактор должен получить задачу через getGeometryTask().
    setEditorLoadingId(task.id);
    try {
      const fullTask = await api.getGeometryTask(task.id);
      setEditingTask(fullTask);
      setEditorOpen(true);
    } catch {
      message.error('Не удалось загрузить задачу для редактирования');
    } finally {
      setEditorLoadingId(null);
    }
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditingTask(null);
  };

  const handleEditorSaved = () => {
    handleEditorClose();
    loadTasks();
  };

  const openPreview = (singleTask = null) => {
    const selectedTasks = singleTask
      ? [singleTask]
      : (selectedRowKeys.length > 0
          ? tasks.filter((t) => selectedRowKeys.includes(t.id))
          : tasks);

    if (selectedTasks.length === 0) {
      message.warning('Нет задач для просмотра');
      return;
    }

    setPreviewTasks(selectedTasks);
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewTasks([]);
    setPreviewPrintTest(null);
  };

  const openQuickPreview = async (task) => {
    if (!task) return;
    setQuickPreviewLoadingId(task.id);
    try {
      // Если у задачи нет drawing_image (файлового поля) — нужна полная запись,
      // т.к. легаси PNG хранится в geogebra_base64, которого нет в LIGHT_FIELDS
      const fullTask = task.drawing_image
        ? task
        : await api.getGeometryTask(task.id);
      const parsedLayout = safeParseLayout(fullTask.preview_layout);
      setQuickPreviewTask(fullTask);
      setQuickPreviewLayout(normalizeLayout(parsedLayout?.print ?? null, 'print'));
      setQuickPreviewEditMode(false);
      setQuickPreviewOpen(true);
    } catch {
      message.error('Не удалось загрузить задачу для просмотра');
    } finally {
      setQuickPreviewLoadingId(null);
    }
  };

  const closeQuickPreview = () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setQuickPreviewOpen(false);
    setQuickPreviewTask(null);
    setAutosaveStatus(null);
  };

  // Автосохраняет макет в БД через 800ms после последнего изменения.
  // Принимает готовый nextLayout чтобы не зависеть от stale state.
  const scheduleAutosave = useCallback((nextLayout) => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setAutosaveStatus('saving');
    autosaveTimerRef.current = setTimeout(async () => {
      const task = quickPreviewTaskRef.current;
      if (!task?.id) { setAutosaveStatus(null); return; }
      try {
        const existing = safeParseLayout(task.preview_layout) || {};
        const nextPreviewLayout = { ...existing, print: nextLayout };
        await api.updateGeometryTask(task.id, { preview_layout: nextPreviewLayout });
        // Обновляем список задач и сам объект предпросмотра с новым layout
        setTasks((prev) => prev.map((t) => (
          t.id === task.id ? { ...t, preview_layout: nextPreviewLayout } : t
        )));
        setQuickPreviewTask((prev) => prev ? { ...prev, preview_layout: nextPreviewLayout } : prev);
        setAutosaveStatus('saved');
        // Гасим статус через 2.5с
        setTimeout(() => setAutosaveStatus((s) => (s === 'saved' ? null : s)), 2500);
      } catch {
        setAutosaveStatus('error');
      }
    }, 800);
  }, []);

  const handleQuickLayoutChange = useCallback((layerName, patch) => {
    setQuickPreviewLayout((prev) => {
      const next = normalizeLayout(
        { ...prev, [layerName]: { ...prev[layerName], ...patch } },
        'print',
      );
      scheduleAutosave(next);
      return next;
    });
  }, [scheduleAutosave]);

  const openSavedSheets = async () => {
    setSavedSheetsOpen(true);
    setSavedSheetsLoading(true);
    try {
      const tests = await api.getGeometryPrintTests();
      setSavedSheets(tests);
    } catch {
      message.error('Ошибка загрузки сохранённых листов');
    } finally {
      setSavedSheetsLoading(false);
    }
  };

  const handleOpenSavedSheet = async (testId) => {
    setSavedSheetsLoading(true);
    try {
      const test = await api.getGeometryPrintTest(testId);
      const expandedTasks = Array.isArray(test?.expand?.tasks) ? test.expand.tasks : [];
      const byId = new Map(expandedTasks.map((task) => [task.id, task]));
      const orderedIds = Array.isArray(test?.task_order) && test.task_order.length > 0
        ? test.task_order
        : (Array.isArray(test?.tasks) ? test.tasks : []);
      const orderedTasks = orderedIds.map((id) => byId.get(id)).filter(Boolean);

      if (orderedTasks.length === 0) {
        message.error('В сохранённом листе не удалось восстановить задачи');
        return;
      }

      setPreviewTasks(orderedTasks);
      setPreviewPrintTest(test);
      setPreviewOpen(true);
      setSavedSheetsOpen(false);
      message.success(`Лист "${test.title || 'без названия'}" открыт`);
    } catch {
      message.error('Ошибка открытия листа');
    } finally {
      setSavedSheetsLoading(false);
    }
  };

  const handleDeleteSavedSheet = (testId, title) => {
    Modal.confirm({
      title: 'Удалить лист?',
      content: `Вы уверены, что хотите удалить лист "${title || 'без названия'}"?`,
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.deleteGeometryPrintTest(testId);
          setSavedSheets((prev) => prev.filter((sheet) => sheet.id !== testId));
          message.success('Лист удалён');
        } catch {
          message.error('Ошибка удаления листа');
        }
      },
    });
  };

  // ── Если редактор открыт — показываем его вместо списка ──────────────────
  if (editorOpen) {
    return (
      <GeometryTaskEditor
        task={editingTask}
        onSaved={handleEditorSaved}
        onCancel={handleEditorClose}
        totalTasks={tasks.length}
      />
    );
  }

  if (previewOpen) {
    return (
      <GeometryTaskPreview
        tasks={previewTasks}
        onBack={closePreview}
        initialPrintTest={previewPrintTest}
      />
    );
  }

  // ── Колонки таблицы ───────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Код',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      sorter: (a, b) => a.code.localeCompare(b.code),
      render: (code) => <Text code style={{ fontSize: 13 }}>{code}</Text>,
    },
    {
      title: 'Тема / Подтема',
      key: 'topic_subtopic',
      ellipsis: true,
      render: (_, record) => {
        const topic = record.expand?.topic?.title;
        const subtopic = record.expand?.subtopic?.title;
        if (!topic && !subtopic) return <Text type="secondary">—</Text>;
        return (
          <Space direction="vertical" size={0}>
            {topic && <Text style={{ fontSize: 12 }}>{topic}</Text>}
            {subtopic && <Text type="secondary" style={{ fontSize: 11 }}>{subtopic}</Text>}
          </Space>
        );
      },
    },
    {
      title: 'Сл.',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 60,
      align: 'center',
      sorter: (a, b) => (a.difficulty || 0) - (b.difficulty || 0),
      render: (d) =>
        d ? (
          <Tooltip title={DIFFICULTY_LABELS[d]}>
            <Badge
              count={d}
              style={{ backgroundColor: DIFFICULTY_COLORS[d] }}
            />
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Ответ',
      dataIndex: 'answer',
      key: 'answer',
      width: 120,
      render: (v) =>
        v ? (
          <Text style={{ fontFamily: 'monospace' }}>{v}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Чертёж',
      key: 'has_drawing',
      width: 80,
      align: 'center',
      render: (_, record) => {
        const appLabels = { geometry: 'Геом.', graphing: 'Граф.', classic: 'Класс.', '3d': '3D' };
        // PNG хранится как файл drawing_image (после миграции)
        const hasImage = Boolean(record.drawing_image || record.geogebra_image_base64);
        // GGB-состояние: drawing_view='geogebra' означает, что GeoGebra-объект используется как основной
        // (geogebra_base64 нет в LIGHT_FIELDS, но drawing_view — надёжный индикатор)
        const hasGgb = record.drawing_view === 'geogebra';

        if (!hasImage && !hasGgb) return <Text type="secondary">—</Text>;

        return (
          <Space size={4}>
            {hasImage && (
              <Tooltip title="PNG-картинка сохранена">
                <Tag color="gold" style={{ margin: 0 }}>IMG</Tag>
              </Tooltip>
            )}
            {hasGgb && (
              <Tooltip title={`${appLabels[record.geogebra_appname] || 'GeoGebra'} — объект показывается`}>
                <Tag color="blue" style={{ margin: 0 }}>GGB</Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Подсказки',
      dataIndex: 'hints',
      key: 'hints',
      width: 90,
      align: 'center',
      render: (hints) => {
        const count = Array.isArray(hints) ? hints.length : 0;
        return count > 0 ? (
          <Tag>{count} шт.</Tag>
        ) : (
          <Text type="secondary">—</Text>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Редактировать">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              loading={editorLoadingId === record.id}
              disabled={editorLoadingId !== null && editorLoadingId !== record.id}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Просмотр">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              loading={quickPreviewLoadingId === record.id}
              onClick={() => openQuickPreview(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Удалить задачу?"
            description="Это действие необратимо."
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Tooltip title="Удалить">
              <Button
                type="text"
                icon={<DeleteOutlined />}
                size="small"
                danger
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* ── Панель фильтров ────────────────────────────────────────────── */}
      <Card size="small">
        <Space wrap>
          <Select
            placeholder="Тема"
            allowClear
            style={{ width: 200 }}
            value={filters.topic}
            onChange={(v) => setFilters((f) => ({ ...f, topic: v, subtopic: undefined }))}
            options={geoTopics.map((t) => ({ value: t.id, label: t.title }))}
          />
          <Select
            placeholder="Подтема"
            allowClear
            style={{ width: 220 }}
            value={filters.subtopic}
            onChange={(v) => setFilters((f) => ({ ...f, subtopic: v }))}
            options={(filters.topic
              ? geoSubtopics.filter((s) => s.topic === filters.topic)
              : geoSubtopics
            ).map((s) => ({ value: s.id, label: s.title }))}
          />
          <Select
            placeholder="Сложность"
            allowClear
            style={{ width: 130 }}
            value={filters.difficulty}
            onChange={(v) => setFilters((f) => ({ ...f, difficulty: v }))}
            options={[
              { value: '1', label: '1 — Базовый' },
              { value: '2', label: '2 — Средний' },
              { value: '3', label: '3 — Сложный' },
            ]}
          />
          <Button
            onClick={() => setFilters({})}
            disabled={!Object.keys(filters).some((k) => filters[k])}
          >
            Сбросить
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadTasks} loading={loading}>
            Обновить
          </Button>
        </Space>
      </Card>

      {/* ── Заголовок + кнопка создания ───────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary">
          Всего задач: <strong>{tasks.length}</strong>
        </Text>
        <Space>
          <Button icon={<FolderOpenOutlined />} onClick={openSavedSheets}>
            Листы A5
          </Button>
          <Button icon={<EyeOutlined />} onClick={() => openPreview()}>
            Просмотр ({selectedRowKeys.length > 0 ? `выбрано ${selectedRowKeys.length}` : `все ${tasks.length}`})
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Создать задачу
          </Button>
        </Space>
      </div>

      {/* ── Таблица ───────────────────────────────────────────────────── */}
      <Table
        dataSource={tasks}
        columns={columns}
        rowKey="id"
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          preserveSelectedRowKeys: true,
        }}
        loading={loading}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
        onRow={(record) => ({
          onDoubleClick: () => openEdit(record),
          style: { cursor: 'pointer' },
        })}
        locale={{ emptyText: 'Нет задач. Создайте первую!' }}
      />

      <LoadGeometryPrintModal
        visible={savedSheetsOpen}
        onCancel={() => setSavedSheetsOpen(false)}
        tests={savedSheets}
        loading={savedSheetsLoading}
        onLoad={handleOpenSavedSheet}
        onDelete={handleDeleteSavedSheet}
      />

      <Modal
        title={quickPreviewTask ? `Быстрый просмотр: ${quickPreviewTask.code}` : 'Быстрый просмотр'}
        open={quickPreviewOpen}
        onCancel={closeQuickPreview}
        width={760}
        footer={[
          <Button key="close" onClick={closeQuickPreview}>Закрыть</Button>,
        ]}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <Space wrap>
              <Space size={8}>
                <Switch checked={quickPreviewEditMode} onChange={setQuickPreviewEditMode} />
                <Text>Редактировать макет</Text>
              </Space>
              <Space size={8}>
                <Switch checked={quickPreviewShowAnswers} onChange={setQuickPreviewShowAnswers} />
                <Text>Показывать ответ</Text>
              </Space>
              <Tag>Карточка A5</Tag>
            </Space>
            {/* Индикатор автосохранения */}
            <span style={{ fontSize: 12, minWidth: 110, textAlign: 'right' }}>
              {autosaveStatus === 'saving' && (
                <Text type="secondary"><LoadingOutlined style={{ marginRight: 4 }} />Сохраняется…</Text>
              )}
              {autosaveStatus === 'saved' && (
                <Text style={{ color: '#52c41a' }}><CheckCircleOutlined style={{ marginRight: 4 }} />Сохранено</Text>
              )}
              {autosaveStatus === 'error' && (
                <Text type="danger"><WarningOutlined style={{ marginRight: 4 }} />Ошибка сохранения</Text>
              )}
            </span>
          </div>

          <div style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
            <div
              className="geometry-preview-grid a5"
              style={{
                gridTemplateColumns: '1fr',
                gridTemplateRows: '1fr',
                aspectRatio: String(PRINT_CELL_ASPECT_RATIO),
                border: '1.5px solid #c0c0c0',
                background: '#fff',
              }}
            >
              {quickPreviewTask && (
                <GeometryPreviewCard
                  task={quickPreviewTask}
                  index={0}
                  showAnswers={quickPreviewShowAnswers}
                  mode="student"
                  drawingMode="task"
                  editable={quickPreviewEditMode}
                  layout={quickPreviewLayout}
                  onLayoutChange={handleQuickLayoutChange}
                />
              )}
            </div>
          </div>
        </Space>
      </Modal>
    </Space>
  );
}
