import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Segmented,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HolderOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { api } from '../shared/services/pocketbase';
import { sanitizeSvg } from '../utils/sanitizeSvg';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { useAuth } from '../contexts/AuthContext';
import GeometryTaskEditor from './GeometryTaskEditor';
import GeometryTaskPreview from './GeometryTaskPreview';
import GeometryWorksheetPrint from './GeometryWorksheetPrint';
import LoadGeometryPrintModal from './geometry/LoadGeometryPrintModal';
import MathRenderer from './MathRenderer';
import { buildGeometryColumns, DIFFICULTY_COLORS, DIFFICULTY_LABELS } from './geometry/GeometryTaskColumns';
import GeometryTagsModal from './geometry/GeometryTagsModal';
import GeometryTaskDrawer from './geometry/GeometryTaskDrawer';
import { GEOMETRY_SECTIONS } from '../utils/geometrySection';
import { MIN_SEARCH_LENGTH } from '../shared/utils/searchVariants';
import GeometryBankDuplicatesModal from './geometry/GeometryBankDuplicatesModal';
import GeometrySemanticSearchModal from './geometry/GeometrySemanticSearchModal';
import './GeometryTaskPreview.css';

const { Text } = Typography;

// Условие для превью карточки: убираем картинки (чертёж показываем отдельно),
// чтобы внутри сниппета не дублировался рисунок и не распухал текст.
const stripStatementImages = (md = '') => String(md).replace(/!\[[^\]]*\]\([^)]*\)(?:[ \t]*\{(?:s|m|l|xl)\})?/gi, '').trim();

const SCOPE_OPTIONS = [
  { value: 'manual', label: 'Мои' },
  { value: 'mccme', label: 'МЦНМО' },
  { value: 'all', label: 'Все' },
];

const hasValue = (v) => (Array.isArray(v) ? v.length > 0 : !!v);

const SECTION_OPTIONS = [{ value: '', label: 'Все разделы' }, ...GEOMETRY_SECTIONS];

// Банк МЦНМО — 17,6 тыс. задач: в областях «МЦНМО» и «Все» без сужения его не
// грузим. Сужают фасет, поиск, сложность, тема/подтема/источник или раздел
// «Стереометрия» (≈4 тыс.); одна «Планиметрия» — 13,5 тыс., это не сужение.
function needsNarrowing(f) {
  if ((f.origin || 'manual') === 'manual') return false;
  return !(f.tagsObject?.length || f.tagsMethod?.length || f.tagsFact?.length
    || String(f.search || '').length >= MIN_SEARCH_LENGTH
    || f.difficulty || f.topic || f.subtopic || f.source || f.section === 'stereo');
}

export default function GeometryTaskList() {
  const { message } = App.useApp();
  const { topics: regularTopics, subtopics: regularSubtopics } = useReferenceData();
  const { canEdit, canDelete } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ origin: 'manual' });
  const [searchInput, setSearchInput] = useState('');
  const [geoTopics, setGeoTopics] = useState([]);
  const [geoSubtopics, setGeoSubtopics] = useState([]);
  const [geoSources, setGeoSources] = useState([]);
  const [geoTags, setGeoTags] = useState({ object: [], method: [], fact: [] });
  const [bankLoadAll, setBankLoadAll] = useState(false); // явная загрузка всего банка МЦНМО
  const [tagsModalOpen, setTagsModalOpen] = useState(false);
  const [bankDupOpen, setBankDupOpen] = useState(false); // дубли «мои ↔ банк МЦНМО»
  const [semanticOpen, setSemanticOpen] = useState(false); // поиск по смыслу (NL)

  const reloadGeoTags = () => api.getGeometryTags().then(setGeoTags).catch(() => {});

  // Редактор: null = скрыт, объект = редактирование, 'new' = создание
  const [editingTask, setEditingTask] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorLoadingId, setEditorLoadingId] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTasks, setPreviewTasks] = useState([]);
  const [previewPrintTest, setPreviewPrintTest] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [savedSheetsOpen, setSavedSheetsOpen] = useState(false);
  const [savedSheetsLoading, setSavedSheetsLoading] = useState(false);
  const [savedSheets, setSavedSheets] = useState([]);
  // Карточка задачи: какая открыта и по какому списку листать ← / →
  const [card, setCard] = useState({ id: null, list: [] });
  const [cardBusy, setCardBusy] = useState(null); // 'edit' | 'copy' | 'take'
  const [worksheetOpen, setWorksheetOpen] = useState(false);
  const [worksheetTasks, setWorksheetTasks] = useState([]);
  const [worksheetTopicLabel, setWorksheetTopicLabel] = useState('');
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dropTargetTaskId, setDropTargetTaskId] = useState(null);
  const [viewMode, setViewMode] = useState('table');
  const [cardsPage, setCardsPage] = useState(1);
  const [cardsPageSize, setCardsPageSize] = useState(20);

  // Импорт в обычные задачи
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importTopicId, setImportTopicId] = useState(null);
  const [importSubtopicId, setImportSubtopicId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);

  // Загружаем справочники один раз
  useEffect(() => {
    Promise.all([api.getGeometryTopics(), api.getGeometrySubtopics(), api.getGeometrySources(), api.getGeometryTags()])
      .then(([topics, subtopics, sources, tags]) => {
        setGeoTopics(topics);
        setGeoSubtopics(subtopics);
        setGeoSources(sources);
        setGeoTags(tags);
      })
      .catch(() => {});
  }, []);

  // Debounce поля поиска → filters.search (API ищет по code/title/условию/ответу/источнику)
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => {
        const next = searchInput.trim();
        if ((f.search || '') === next) return f;
        return { ...f, search: next || undefined };
      });
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadTasks = useCallback(async () => {
    // Три фасетных селектора (объект/метод/факт) объединяем в один массив tags (AND в API)
    const tags = [
      ...(filters.tagsObject || []),
      ...(filters.tagsMethod || []),
      ...(filters.tagsFact || []),
    ];
    // Банк МЦНМО (17к+ задач): НЕ грузим всё подряд — ждём выбора фасета/поиска,
    // либо явного «Загрузить все» (bankLoadAll). Иначе пустой список + подсказка.
    if (needsNarrowing(filters) && !bankLoadAll) {
      setTasks([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getGeometryTasks({ ...filters, tags });
      setTasks(data);
    } catch {
      message.error('Ошибка загрузки задач');
    } finally {
      setLoading(false);
    }
  }, [filters, bankLoadAll]);

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

  const handleDuplicate = async (id) => {
    setDuplicatingId(id);
    try {
      await api.duplicateGeometryTask(id);
      message.success('Задача продублирована');
      loadTasks();
    } catch {
      message.error('Не удалось дублировать задачу');
    } finally {
      setDuplicatingId(null);
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

  const openWorksheet = () => {
    const selected = selectedRowKeys.length > 0
      ? tasks.filter((t) => selectedRowKeys.includes(t.id))
      : tasks;

    if (selected.length === 0) {
      message.warning('Нет задач для рабочего листа');
      return;
    }

    // Автоматически подставляем тему из первой задачи
    const firstTask = selected[0];
    const topicTitle = firstTask?.expand?.topic?.title || '';
    const subtopicTitle = firstTask?.expand?.subtopic?.title || '';
    const autoLabel = subtopicTitle ? `${topicTitle} — ${subtopicTitle}` : topicTitle;

    setWorksheetTasks(selected);
    setWorksheetTopicLabel(autoLabel);
    setWorksheetOpen(true);
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

  const openCard = useCallback((id, list) => {
    if (!id) return;
    setCard((c) => ({ id, list: list || c.list }));
  }, []);

  const closeCard = useCallback(() => setCard({ id: null, list: [] }), []);

  // Задача из «Поиска по смыслу»/дублей/похожих — листать по её списку нельзя
  const openCardSingle = useCallback((id) => setCard({ id, list: [] }), []);

  const handleCardEdit = async (task) => {
    setCardBusy('edit');
    try {
      closeCard();
      await openEdit(task);
    } finally {
      setCardBusy(null);
    }
  };

  const handleCardDuplicate = async (task) => {
    setCardBusy('copy');
    try {
      const rec = await api.duplicateGeometryTask(task.id);
      message.success(`Создана копия ${rec.code}`);
      loadTasks();
      openCardSingle(rec.id);
    } catch {
      message.error('Не удалось дублировать задачу');
    } finally {
      setCardBusy(null);
    }
  };

  const handleTakeToMine = async (task) => {
    setCardBusy('take');
    try {
      const rec = await api.takeGeometryTaskToMine(task.id);
      message.success(`Задача добавлена в «Мои» как ${rec.code}`);
      loadTasks();
      openCardSingle(rec.id);
    } catch {
      message.error('Не удалось взять задачу к себе');
    } finally {
      setCardBusy(null);
    }
  };

  // Клик по фасету в карточке — показать в банке все задачи с ним
  const handleFacet = (kind, tagId) => {
    const key = { object: 'tagsObject', method: 'tagsMethod', fact: 'tagsFact' }[kind];
    if (!key) return;
    closeCard();
    setSearchInput('');
    setFilters((f) => ({ origin: f.origin === 'manual' ? 'all' : f.origin, section: f.section, [key]: [tagId] }));
  };

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

  const moveTaskBefore = useCallback((fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;

    setTasks((prev) => {
      const fromIndex = prev.findIndex((t) => t.id === fromId);
      const toIndex = prev.findIndex((t) => t.id === toId);
      if (fromIndex < 0 || toIndex < 0) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const pagedCardTasks = useMemo(() => {
    const start = (cardsPage - 1) * cardsPageSize;
    return tasks.slice(start, start + cardsPageSize);
  }, [cardsPage, cardsPageSize, tasks]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(tasks.length / cardsPageSize));
    if (cardsPage > maxPage) setCardsPage(maxPage);
  }, [cardsPage, cardsPageSize, tasks.length]);

  const toggleTaskSelection = useCallback((taskId, checked) => {
    setSelectedRowKeys((prev) => {
      if (checked) {
        if (prev.includes(taskId)) return prev;
        return [...prev, taskId];
      }
      return prev.filter((id) => id !== taskId);
    });
  }, []);

  // ── Если редактор открыт — показываем его вместо списка ──────────────────
  if (editorOpen) {
    return (
      <GeometryTaskEditor
        task={editingTask}
        onSaved={handleEditorSaved}
        onCancel={handleEditorClose}
      />
    );
  }

  if (worksheetOpen) {
    return (
      <GeometryWorksheetPrint
        tasks={worksheetTasks}
        onBack={() => setWorksheetOpen(false)}
        initialTopicLabel={worksheetTopicLabel}
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
  const columns = buildGeometryColumns({
    setDraggingTaskId, setDropTargetTaskId,
    canEdit, canDelete,
    editorLoadingId, duplicatingId,
    openEdit, openCard: (task) => openCard(task.id, tasks.map((t) => t.id)), handleDuplicate, handleDelete,
  });

  const importFilteredSubtopics = importTopicId
    ? regularSubtopics.filter((s) => s.topic === importTopicId)
    : [];

  const handleImportToRegular = async () => {
    if (!importTopicId) {
      message.warning('Выберите тему');
      return;
    }
    setImporting(true);
    setImportResults(null);
    try {
      const results = await api.importGeometryTasksToRegular(selectedRowKeys, {
        topicId: importTopicId,
        subtopicId: importSubtopicId || undefined,
      });
      setImportResults(results);
      if (results.added > 0) {
        message.success(`Импортировано задач: ${results.added}`);
      }
    } catch {
      message.error('Ошибка при импорте');
    } finally {
      setImporting(false);
    }
  };

  const handleImportModalClose = () => {
    setImportModalOpen(false);
    setImportTopicId(null);
    setImportSubtopicId(null);
    setImportResults(null);
  };

  // В области с банком МЦНМО без сужения и без явной «Загрузить все» — режим подсказки
  const bankIdle = needsNarrowing(filters) && !bankLoadAll;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* ── Панель фильтров ────────────────────────────────────────────── */}
      <Card size="small">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input
            allowClear
            size="large"
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Поиск по коду, названию, условию, ответу или источнику…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {/* Область (свои / банк МЦНМО / все) и раздел — фильтры одного банка */}
          <Space wrap size={12}>
            <Segmented
              value={filters.origin || 'manual'}
              onChange={(v) => {
                setBankLoadAll(false); // при смене области не тянем весь банк
                // тема/подтема/источник есть только у своих задач
                setFilters((f) => (v === 'mccme'
                  ? { ...f, origin: v, topic: undefined, subtopic: undefined, source: undefined }
                  : { ...f, origin: v }));
              }}
              options={SCOPE_OPTIONS}
            />
            <Segmented
              value={filters.section || ''}
              onChange={(v) => {
                setBankLoadAll(false);
                setFilters((f) => ({ ...f, section: v || undefined }));
              }}
              options={SECTION_OPTIONS}
            />
          </Space>
          {/* Слева — фасеты (общие для своих задач и банка), посередине — дерево
              тем своих задач, справа — сложность и кнопки. */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Space direction="vertical" size={8} style={{ flex: '2 1 320px', minWidth: 0 }}>
              <Select
                mode="multiple"
                placeholder="Объект (фигура)"
                allowClear showSearch
                maxTagCount="responsive"
                optionFilterProp="label"
                style={{ width: '100%' }}
                value={filters.tagsObject || []}
                onChange={(v) => setFilters((f) => ({ ...f, tagsObject: v }))}
                options={geoTags.object.map((t) => ({ value: t.id, label: t.name, title: t.name }))}
              />
              <Select
                mode="multiple"
                placeholder="Метод (приём)"
                allowClear showSearch
                maxTagCount="responsive"
                optionFilterProp="label"
                style={{ width: '100%' }}
                value={filters.tagsMethod || []}
                onChange={(v) => setFilters((f) => ({ ...f, tagsMethod: v }))}
                options={geoTags.method.map((t) => ({ value: t.id, label: t.name, title: t.name }))}
              />
              <Select
                mode="multiple"
                placeholder="Факт (теорема)"
                allowClear showSearch
                maxTagCount="responsive"
                optionFilterProp="label"
                style={{ width: '100%' }}
                value={filters.tagsFact || []}
                onChange={(v) => setFilters((f) => ({ ...f, tagsFact: v }))}
                options={geoTags.fact.map((t) => ({ value: t.id, label: t.name, title: t.name }))}
              />
            </Space>

            {filters.origin !== 'mccme' && (
              <Space direction="vertical" size={8} style={{ flex: '1 1 220px', minWidth: 0 }}>
                <Select
                  placeholder="Тема (мои задачи)"
                  allowClear showSearch
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  value={filters.topic}
                  onChange={(v) => setFilters((f) => ({ ...f, topic: v, subtopic: undefined }))}
                  options={geoTopics.map((t) => ({ value: t.id, label: t.title, title: t.title }))}
                />
                <Select
                  placeholder="Подтема"
                  allowClear showSearch
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  value={filters.subtopic}
                  onChange={(v) => setFilters((f) => ({ ...f, subtopic: v }))}
                  options={(filters.topic
                    ? geoSubtopics.filter((s) => s.topic === filters.topic)
                    : geoSubtopics
                  ).map((s) => ({ value: s.id, label: s.title, title: s.title }))}
                />
                <Select
                  placeholder="Источник"
                  allowClear showSearch
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  value={filters.source}
                  onChange={(v) => setFilters((f) => ({ ...f, source: v }))}
                  options={geoSources.map((s) => ({ value: s, label: s, title: s }))}
                  notFoundContent="Источники не заданы"
                />
              </Space>
            )}

            <Space direction="vertical" size={8} style={{ width: 240, flexShrink: 0 }}>
              <Select
                placeholder="Сложность"
                allowClear
                style={{ width: '100%' }}
                value={filters.difficulty}
                onChange={(v) => setFilters((f) => ({ ...f, difficulty: v }))}
                options={[
                  { value: '1', label: '1 — Базовый' },
                  { value: '2', label: '2 — Средний' },
                  { value: '3', label: '3 — Повышенный' },
                  { value: '4', label: '4 — Высокий' },
                  { value: '5', label: '5 — Олимпиадный' },
                ]}
              />
              {canEdit && (
                <Button block icon={<EditOutlined />} onClick={() => setTagsModalOpen(true)}>
                  Фасеты
                </Button>
              )}
              <Button block icon={<SearchOutlined />} onClick={() => setSemanticOpen(true)}>
                🧠 Поиск по смыслу
              </Button>
              <Button block icon={<SearchOutlined />} onClick={() => setBankDupOpen(true)}>
                Дубли с банком
              </Button>
              <Space style={{ width: '100%' }}>
                <Button
                  style={{ flex: 1 }}
                  onClick={() => { setFilters({ origin: filters.origin || 'manual' }); setSearchInput(''); setBankLoadAll(false); }}
                  disabled={!searchInput && !Object.keys(filters).some((k) => k !== 'origin' && hasValue(filters[k]))}
                >
                  Сбросить
                </Button>
                <Button style={{ flex: 1 }} icon={<ReloadOutlined />} onClick={loadTasks} loading={loading}>
                  Обновить
                </Button>
              </Space>
            </Space>
          </div>
        </Space>
      </Card>

      {/* ── Заголовок + кнопка создания ───────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary">
          {bankIdle
            ? <>Банк МЦНМО — сузьте поиск</>
            : (searchInput || Object.keys(filters).some((k) => k !== 'origin' && hasValue(filters[k])))
              ? <>Найдено: <strong>{tasks.length}</strong></>
              : <>Всего задач: <strong>{tasks.length}</strong></>}
        </Text>
        <Space>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v)}
            options={[
              { label: 'Таблица', value: 'table' },
              { label: 'Карточки', value: 'cards' },
            ]}
          />
          <Button icon={<FolderOpenOutlined />} onClick={openSavedSheets}>
            Листы A5
          </Button>
          <Button icon={<FileTextOutlined />} onClick={openWorksheet}>
            Рабочий лист ({selectedRowKeys.length > 0 ? `выбрано ${selectedRowKeys.length}` : `все ${tasks.length}`})
          </Button>
          <Button icon={<EyeOutlined />} onClick={() => openPreview()}>
            Просмотр ({selectedRowKeys.length > 0 ? `выбрано ${selectedRowKeys.length}` : `все ${tasks.length}`})
          </Button>
          {canEdit && selectedRowKeys.length > 0 && (
            <Button
              icon={<ImportOutlined />}
              onClick={() => { setImportResults(null); setImportModalOpen(true); }}
            >
              В задачи ({selectedRowKeys.length})
            </Button>
          )}
          {canEdit && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Создать задачу
            </Button>
          )}
        </Space>
      </div>

      {/* ── Таблица / Карточки ───────────────────────────────────────── */}
      {bankIdle ? (
        <Card style={{ textAlign: 'center', padding: '32px 16px' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
            В банке МЦНМО <strong>17 634</strong> задачи — целиком их лучше не грузить.
          </Text>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Выберите раздел <strong>«Стереометрия»</strong>, <strong>объект</strong>, <strong>метод</strong>{' '}
            или <strong>факт</strong>, введите поиск или сложность — задачи подгрузятся.
            Либо загрузите всё (может быть медленно).
          </Text>
          <Button onClick={() => setBankLoadAll(true)} loading={loading}>
            Загрузить все 17 634
          </Button>
        </Card>
      ) : viewMode === 'table' ? (
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
          pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
          onRow={(record) => ({
            // Клик по строке — карточка задачи (кроме чекбокса, кнопок и ручки)
            onClick: (e) => {
              if (e.target.closest('button, a, input, label, .ant-checkbox-wrapper, .ant-table-selection-column, [draggable="true"]')) return;
              openCard(record.id, tasks.map((t) => t.id));
            },
            onDragOver: (e) => {
              if (!draggingTaskId || draggingTaskId === record.id) return;
              e.preventDefault();
              if (dropTargetTaskId !== record.id) setDropTargetTaskId(record.id);
            },
            onDrop: (e) => {
              e.preventDefault();
              if (!draggingTaskId || draggingTaskId === record.id) return;
              moveTaskBefore(draggingTaskId, record.id);
              setDraggingTaskId(null);
              setDropTargetTaskId(null);
            },
            style: {
              cursor: 'pointer',
              background: dropTargetTaskId === record.id ? '#e6f4ff' : undefined,
            },
          })}
          locale={{ emptyText: 'Нет задач. Создайте первую!' }}
        />
      ) : (
        <Card size="small" loading={loading}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 12,
            }}
          >
            {pagedCardTasks.map((record) => {
              const imageUrl = api.getGeometryImageUrl(record);
              const topic = record.expand?.topic?.title;
              const subtopic = record.expand?.subtopic?.title;
              const isSelected = selectedRowKeys.includes(record.id);

              return (
                <Card
                  key={record.id}
                  size="small"
                  title={(
                    <Space align="center">
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => toggleTaskSelection(record.id, e.target.checked)}
                      />
                      <Text code style={{ fontSize: 13 }}>{record.code}</Text>
                    </Space>
                  )}
                  extra={(
                    <Space size={4}>
                      {canEdit && (
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
                      )}
                      <Tooltip title="Просмотр">
                        <Button
                          type="text"
                          icon={<EyeOutlined />}
                          size="small"
                          onClick={() => openCard(record.id, tasks.map((t) => t.id))}
                        />
                      </Tooltip>
                      {canEdit && (
                        <Tooltip title="Дублировать">
                          <Button
                            type="text"
                            icon={<CopyOutlined />}
                            size="small"
                            loading={duplicatingId === record.id}
                            disabled={duplicatingId !== null && duplicatingId !== record.id}
                            onClick={() => handleDuplicate(record.id)}
                          />
                        </Tooltip>
                      )}
                      {canDelete && (
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
                      )}
                    </Space>
                  )}
                >
                  <Space
                    direction="vertical"
                    size={8}
                    style={{ width: '100%', cursor: 'pointer' }}
                    onClick={() => openCard(record.id, tasks.map((t) => t.id))}
                  >
                    <Space size={4} wrap>
                      {record.difficulty ? (
                        <Tooltip title={DIFFICULTY_LABELS[record.difficulty]}>
                          <Badge
                            count={record.difficulty}
                            style={{ backgroundColor: DIFFICULTY_COLORS[record.difficulty] }}
                          />
                        </Tooltip>
                      ) : (
                        <Text type="secondary">Сложность: —</Text>
                      )}
                      {(imageUrl || (record.drawing_view === 'svg' && record.drawing_svg)) ? (
                        <Tag color="gold" style={{ margin: 0 }}>
                          {record.drawing_view === 'svg' ? 'SVG' : 'IMG'}
                        </Tag>
                      ) : (
                        <Tag style={{ margin: 0 }}>Без чертежа</Tag>
                      )}
                      {record.source && (
                        <Tag color="blue" style={{ margin: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {record.source}
                        </Tag>
                      )}
                      {record.year && <Tag style={{ margin: 0 }}>{record.year}</Tag>}
                    </Space>

                    <div>
                      {topic && <Text style={{ fontSize: 12 }}>{topic}</Text>}
                      <br />
                      {subtopic
                        ? <Text type="secondary" style={{ fontSize: 11 }}>{subtopic}</Text>
                        : <Text type="secondary">—</Text>}
                    </div>

                    {record.drawing_view === 'svg' && record.drawing_svg ? (
                      <div
                        style={{
                          border: '1px solid #f0f0f0',
                          borderRadius: 8,
                          background: '#fff',
                          padding: 8,
                          maxHeight: 140,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <div
                          // eslint-disable-next-line react/no-danger
                          dangerouslySetInnerHTML={{ __html: sanitizeSvg(record.drawing_svg) }}
                          style={{ width: '100%', maxHeight: 124, overflow: 'hidden' }}
                        />
                      </div>
                    ) : imageUrl ? (
                      <div
                        style={{
                          border: '1px solid #f0f0f0',
                          borderRadius: 8,
                          background: '#fff',
                          padding: 8,
                        }}
                      >
                        <img
                          src={imageUrl}
                          alt={`Превью ${record.code || ''}`}
                          style={{
                            width: '100%',
                            height: 140,
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />
                      </div>
                    ) : null}

                    {stripStatementImages(record.statement_md) && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>Условие:</Text>
                        <div
                          style={{
                            fontSize: 13,
                            lineHeight: 1.45,
                            maxHeight: 64,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          <MathRenderer text={stripStatementImages(record.statement_md)} />
                        </div>
                      </div>
                    )}

                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>Ответ:</Text>
                      <div style={{ minHeight: 24 }}>
                        {record.answer ? (
                          <MathRenderer text={String(record.answer)} />
                        ) : (
                          <Text type="secondary">—</Text>
                        )}
                      </div>
                    </div>
                  </Space>
                </Card>
              );
            })}
          </div>

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              current={cardsPage}
              pageSize={cardsPageSize}
              total={tasks.length}
              showSizeChanger
              pageSizeOptions={['10', '20', '50']}
              onChange={(page, size) => {
                setCardsPage(page);
                if (size !== cardsPageSize) setCardsPageSize(size);
              }}
              showTotal={(total, range) => `${range[0]}-${range[1]} из ${total}`}
            />
          </div>
        </Card>
      )}

      <LoadGeometryPrintModal
        visible={savedSheetsOpen}
        onCancel={() => setSavedSheetsOpen(false)}
        tests={savedSheets}
        loading={savedSheetsLoading}
        onLoad={handleOpenSavedSheet}
        onDelete={handleDeleteSavedSheet}
      />

      <GeometryBankDuplicatesModal
        open={bankDupOpen}
        onClose={() => setBankDupOpen(false)}
        onOpenTask={openCardSingle}
      />

      <GeometrySemanticSearchModal
        open={semanticOpen}
        onClose={() => setSemanticOpen(false)}
        onOpenTask={openCardSingle}
      />

      <GeometryTagsModal
        open={tagsModalOpen}
        onClose={() => setTagsModalOpen(false)}
        geoTags={geoTags}
        onChanged={reloadGeoTags}
      />

      <GeometryTaskDrawer
        taskId={card.id}
        listIds={card.list}
        geoTags={geoTags}
        onOpen={openCard}
        onClose={closeCard}
        onFacet={handleFacet}
        canEdit={canEdit}
        onEdit={handleCardEdit}
        onDuplicate={handleCardDuplicate}
        onTakeToMine={handleTakeToMine}
        busy={cardBusy}
      />

      {/* ── Модал импорта в обычные задачи ───────────────────────────── */}
      <Modal
        title={`Импорт в обычные задачи (${selectedRowKeys.length} шт.)`}
        open={importModalOpen}
        onCancel={handleImportModalClose}
        footer={
          importResults ? (
            <Button onClick={handleImportModalClose}>Закрыть</Button>
          ) : (
            <Space>
              <Button onClick={handleImportModalClose}>Отмена</Button>
              <Button
                type="primary"
                icon={<ImportOutlined />}
                loading={importing}
                disabled={!importTopicId}
                onClick={handleImportToRegular}
              >
                Импортировать
              </Button>
            </Space>
          )
        }
        width={520}
        destroyOnHidden
      >
        {importResults ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
              <span style={{ color: '#52c41a' }}>
                <CheckCircleOutlined /> Добавлено: <strong>{importResults.added}</strong>
              </span>
              <span style={{ color: importResults.errors > 0 ? '#ff4d4f' : '#999' }}>
                <CloseCircleOutlined /> Ошибки: <strong>{importResults.errors}</strong>
              </span>
            </div>
            {importResults.details.length > 0 && (
              <div style={{ maxHeight: 240, overflowY: 'auto', fontSize: 12, background: '#fafafa', padding: '8px 12px', borderRadius: 4 }}>
                {importResults.details.map((d, i) => (
                  <div
                    key={i}
                    style={{ color: d.status === 'added' ? '#52c41a' : '#ff4d4f', padding: '2px 0' }}
                  >
                    {d.status === 'added' ? '+ ' : '! '}{d.message}
                  </div>
                ))}
              </div>
            )}
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div>
              <div style={{ marginBottom: 6, fontWeight: 500 }}>
                Тема <span style={{ color: '#ff4d4f' }}>*</span>
              </div>
              <Select
                style={{ width: '100%' }}
                placeholder="Выберите тему из обычных задач"
                value={importTopicId}
                onChange={(v) => { setImportTopicId(v); setImportSubtopicId(null); }}
                showSearch
                optionFilterProp="label"
                options={regularTopics.map((t) => ({
                  value: t.id,
                  label: t.ege_number ? `№${t.ege_number} ${t.title}` : t.title,
                }))}
              />
            </div>
            <div>
              <div style={{ marginBottom: 6, fontWeight: 500 }}>Подтема (необязательно)</div>
              <Select
                style={{ width: '100%' }}
                placeholder="Выберите подтему"
                value={importSubtopicId}
                onChange={setImportSubtopicId}
                allowClear
                showSearch
                optionFilterProp="label"
                disabled={!importTopicId}
                options={importFilteredSubtopics.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
            <div style={{ color: '#888', fontSize: 12 }}>
              Копируются: условие, ответ, решение, сложность, источник, год, код, название, чертёж (как изображение).
              Темы и теги — не копируются автоматически.
            </div>
          </Space>
        )}
      </Modal>
    </Space>
  );
}
