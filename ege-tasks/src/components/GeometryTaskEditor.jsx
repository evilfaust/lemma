import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Slider,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  SaveOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { api } from '../shared/services/pocketbase';
import GeoGebraApplet from './GeoGebraApplet';
import MathRenderer from './MathRenderer';
import { GeometryPreviewCard, normalizeLayout, PRINT_CELL_ASPECT_RATIO, safeParseLayout } from './GeometryTaskPreview';
import './GeometryTaskPreview.css';

const { TextArea } = Input;
const { Text, Title } = Typography;

const APPNAME_OPTIONS = [
  { value: 'geometry', label: 'Геометрия' },
  { value: 'graphing', label: 'Графики функций' },
  { value: 'classic', label: 'Классик (все инструменты)' },
  { value: '3d', label: '3D — стереометрия' },
];

const DIFFICULTY_OPTIONS = [
  { value: 1, label: '1 — Базовый' },
  { value: 2, label: '2 — Средний' },
  { value: 3, label: '3 — Сложный' },
];

const isImageDrawing = (value = '') => value.startsWith('data:image/');
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const normalizeCrop = (crop = {}) => ({
  left: clamp(crop.left, 0, 45),
  right: clamp(crop.right, 0, 45),
  top: clamp(crop.top, 0, 45),
  bottom: clamp(crop.bottom, 0, 45),
});

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

const cropPngByMargins = async (dataUrl, crop) => {
  const normalized = normalizeCrop(crop);
  const img = await loadImage(dataUrl);
  const sx = Math.round((normalized.left / 100) * img.width);
  const sy = Math.round((normalized.top / 100) * img.height);
  const sw = Math.round(img.width * (1 - (normalized.left + normalized.right) / 100));
  const sh = Math.round(img.height * (1 - (normalized.top + normalized.bottom) / 100));

  if (sw < 20 || sh < 20) {
    throw new Error('Слишком сильная обрезка. Уменьшите поля.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать canvas');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/png');
};

const getGeoGebraBase64 = (ggbApi) => new Promise((resolve) => {
  if (!ggbApi || typeof ggbApi.getBase64 !== 'function') {
    resolve('');
    return;
  }
  try {
    ggbApi.getBase64((value) => resolve(value || ''));
  } catch {
    resolve('');
  }
});

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const getValidationData = (err) => {
  if (!err || typeof err !== 'object') return {};
  return err?.data?.data || err?.data || err?.response?.data || {};
};

/**
 * Редактор геометрической задачи.
 *
 * Props:
 *   task       — объект задачи для редактирования (null = создание новой)
 *   onSaved    — callback после успешного сохранения
 *   onCancel   — callback для кнопки «Назад»
 *   totalTasks — общее кол-во задач (для генерации кода)
 */
export default function GeometryTaskEditor({ task, onSaved, onCancel, totalTasks = 0 }) {
  const [form] = Form.useForm();
  const isCreate = !task;

  // ── Состояние чертежа ─────────────────────────────────────────────────────
  const ggbApiRef = useRef(null);
  // Legacy: старые задачи могли хранить PNG в geogebra_base64 или geogebra_image_base64
  const legacyImage = task?.geogebra_image_base64 || task?.geogebra_base64 || '';
  const initialLegacyImage = isImageDrawing(legacyImage) ? legacyImage : '';
  const [ggbBase64, setGgbBase64] = useState(initialLegacyImage ? '' : (task?.geogebra_base64 || ''));
  // ggbImageBase64 — PNG в памяти (только после экспорта из GeoGebra в текущей сессии).
  // Существующий чертёж отображается через URL файлового поля geogebra_image_base64.
  const [ggbImageBase64, setGgbImageBase64] = useState(initialLegacyImage || '');
  // Чертёж считается сохранённым если есть PNG-файл или legacy/base64-данные.
  const [ggbSaved, setGgbSaved] = useState(!!(task?.drawing_image || task?.geogebra_base64 || task?.geogebra_image_base64));
  // URL существующего файла-чертежа (после миграции)
  const existingDrawingUrl = api.getGeometryImageUrl(task);
  const [savingDrawing, setSavingDrawing] = useState(false);
  const [appName, setAppName] = useState(task?.geogebra_appname || 'geometry');
  const [drawingView, setDrawingView] = useState(task?.drawing_view === 'geogebra' ? 'geogebra' : 'image');
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropMargins, setCropMargins] = useState({ left: 0, right: 0, top: 0, bottom: 0 });
  const [croppingImage, setCroppingImage] = useState(false);

  // ── Состояние макета (для печатного листа A5) ─────────────────────────────
  const [layoutPrint, setLayoutPrint] = useState(() => {
    const persisted = safeParseLayout(task?.preview_layout)?.print ?? null;
    return normalizeLayout(persisted, 'print');
  });

  // ── Предпросмотры текстов ─────────────────────────────────────────────────
  const [previewStatement, setPreviewStatement] = useState(task?.statement_md || '');
  const [previewSolution, setPreviewSolution] = useState(task?.solution_md || '');

  // ── Состояние сохранения/удаления ─────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Темы и подтемы из справочника ────────────────────────────────────────
  const [geoTopics, setGeoTopics] = useState([]);
  const [geoSubtopics, setGeoSubtopics] = useState([]);
  const [selectedTopicId, setSelectedTopicId] = useState(task?.topic || null);

  useEffect(() => {
    Promise.all([api.getGeometryTopics(), api.getGeometrySubtopics()])
      .then(([topics, subtopics]) => {
        setGeoTopics(topics);
        setGeoSubtopics(subtopics);
      })
      .catch(() => {});
  }, []);

  // ── Сохранить чертёж из GeoGebra API ─────────────────────────────────────
  const handleSaveDrawing = useCallback(() => {
    if (!ggbApiRef.current) {
      message.warning('GeoGebra ещё не загружена');
      return;
    }
    setSavingDrawing(true);
    ggbApiRef.current.getBase64(async (base64) => {
      const normalizedGgb = base64 || '';
      setGgbBase64(normalizedGgb);

      try {
        const pngBase64 = ggbApiRef.current.getPNGBase64(2, false, 300);
        if (pngBase64) {
          const imageData = pngBase64.startsWith('data:image/')
            ? pngBase64
            : `data:image/png;base64,${pngBase64}`;
          setGgbImageBase64(imageData);
        }
      } catch {
        // ignore
      }

      setGgbSaved(true);
      setSavingDrawing(false);
      message.success('Чертёж сохранён (GeoGebra + PNG)');
    });
  }, []);

  const handleClearDrawing = useCallback(() => {
    setGgbBase64('');
    setGgbImageBase64('');
    setGgbSaved(false);
    if (ggbApiRef.current) ggbApiRef.current.reset();
  }, []);

  const handleSaveDrawingAsImage = useCallback(() => {
    if (!ggbApiRef.current || typeof ggbApiRef.current.getPNGBase64 !== 'function') {
      message.warning('GeoGebra ещё не загружена');
      return;
    }

    setSavingDrawing(true);
    try {
      const pngBase64 = ggbApiRef.current.getPNGBase64(2, false, 300);
      if (!pngBase64) {
        throw new Error('GeoGebra не вернула изображение');
      }

      const imageData = pngBase64.startsWith('data:image/')
        ? pngBase64
        : `data:image/png;base64,${pngBase64}`;

      setGgbImageBase64(imageData);
      setGgbSaved(true);
      message.success('PNG обновлён');
    } catch (error) {
      message.error(`Не удалось сохранить PNG: ${error?.message || 'неизвестная ошибка'}`);
    } finally {
      setSavingDrawing(false);
    }
  }, []);

  const handleOpenCropModal = useCallback(() => {
    if (!ggbImageBase64) {
      message.warning('Сначала сохраните PNG');
      return;
    }
    setCropMargins({ left: 0, right: 0, top: 0, bottom: 0 });
    setCropModalOpen(true);
  }, [ggbImageBase64]);

  const handleApplyCrop = useCallback(async () => {
    if (!ggbImageBase64) return;
    setCroppingImage(true);
    try {
      const cropped = await cropPngByMargins(ggbImageBase64, cropMargins);
      setGgbImageBase64(cropped);
      setDrawingView('image');
      setGgbSaved(true);
      setCropModalOpen(false);
      message.success('PNG обрезан и обновлён');
    } catch (error) {
      message.error(`Не удалось обрезать PNG: ${error?.message || 'неизвестная ошибка'}`);
    } finally {
      setCroppingImage(false);
    }
  }, [cropMargins, ggbImageBase64]);

  // ── Управление макетом ────────────────────────────────────────────────────
  const handleEditorLayoutChange = useCallback((layerName, patch) => {
    setLayoutPrint((prev) => normalizeLayout({
      ...prev,
      [layerName]: { ...prev[layerName], ...patch },
    }, 'print'));
  }, []);

  const handleEditorLayoutReset = useCallback(() => {
    setLayoutPrint(normalizeLayout(null, 'print'));
  }, []);

  // ── Генерация кода ────────────────────────────────────────────────────────
  const generateCode = () => {
    const n = String(totalTasks + 1).padStart(3, '0');
    return `GEO-${n}`;
  };

  // ── Сохранение задачи ─────────────────────────────────────────────────────
  const handleSave = async () => {
    let values;
    let payload = null;
    try {
      values = await form.validateFields();
    } catch {
      message.error('Заполните обязательные поля');
      return;
    }

    setSaving(true);
    try {
      const normalizedCode = (values.code || '').trim();

      if (!normalizedCode) {
        message.error('Укажите код задачи');
        return;
      }

      // Конвертируем in-memory PNG в File для загрузки в PocketBase file storage.
      // Если новый чертёж не генерировался — поле файла не включаем (сохраняется существующий файл).
      let drawingImageFile = null;
      if (ggbImageBase64) {
        try {
          const raw = ggbImageBase64.replace(/^data:image\/\w+;base64,/, '');
          const binary = atob(raw);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          drawingImageFile = new File([bytes], 'drawing.png', { type: 'image/png' });
        } catch {
          // при ошибке конвертации — не обновляем файл
        }
      }

      // Всегда берём актуальное состояние GeoGebra из апплета при сохранении задачи,
      // чтобы при следующем редактировании чертёж сразу восстановился.
      const liveGgbBase64 = await getGeoGebraBase64(ggbApiRef.current);
      const finalGgbBase64 = liveGgbBase64 || ggbBase64 || '';
      if (finalGgbBase64 !== ggbBase64) {
        setGgbBase64(finalGgbBase64);
      }

      payload = {
        code: normalizedCode,
        title: values.title || '',
        // В текущей схеме PB поле task_type валидируется на update.
        // Сохраняем существующее значение (или пустую строку как в текущих данных).
        task_type: task?.task_type ?? '',
        topic: values.topic || null,
        subtopic: values.subtopic || null,
        difficulty: values.difficulty || null,
        statement_md: values.statement_md || '',
        answer: values.answer || '',
        solution_md: values.solution_md || '',
        geogebra_base64: finalGgbBase64,
        // PNG храним файлом в file field коллекции.
        geogebra_appname: appName,
        drawing_view: drawingView,
        source: values.source || '',
        year: values.year || null,
        preview_layout: {
          ...(safeParseLayout(task?.preview_layout) || {}),
          print: layoutPrint,
        },
      };

      const saveWithPayload = async (p) => {
        if (isCreate) {
          await api.createGeometryTask(p);
          return;
        }
        await api.updateGeometryTask(task.id, p);
      };

      const saveWithTaskTypeFallback = async (basePayload) => {
        const typeCandidates = [
          basePayload?.task_type,
          'ready',
          'build',
          'mixed',
        ]
          .map((v) => (typeof v === 'string' ? v.trim() : v))
          .filter((v) => typeof v === 'string' && v.length > 0);

        const uniqueTypes = Array.from(new Set(typeCandidates));
        const variants = [
          ...uniqueTypes.map((taskType) => ({ ...basePayload, task_type: taskType })),
          { ...basePayload, task_type: null },
          (() => {
            const next = { ...basePayload };
            delete next.task_type;
            return next;
          })(),
        ];

        let lastError = null;
        for (const candidate of variants) {
          try {
            await saveWithPayload(candidate);
            return;
          } catch (err) {
            lastError = err;
            const validation = getValidationData(err);
            if (!validation?.task_type) {
              throw err;
            }
          }
        }
        throw lastError;
      };

      if (!drawingImageFile) {
        await saveWithTaskTypeFallback(payload);
      } else {
        const candidateFields = [];
        if (hasOwn(task, 'geogebra_image_base64')) candidateFields.push('geogebra_image_base64');
        if (hasOwn(task, 'drawing_image')) candidateFields.push('drawing_image');
        if (candidateFields.length === 0) {
          candidateFields.push('geogebra_image_base64', 'drawing_image');
        }

        let saved = false;
        let lastError = null;

        for (const fileField of candidateFields) {
          const payloadWithFile = { ...payload };
          payloadWithFile[fileField] = drawingImageFile;
          if (fileField !== 'geogebra_image_base64') delete payloadWithFile.geogebra_image_base64;
          if (fileField !== 'drawing_image') delete payloadWithFile.drawing_image;

          try {
            await saveWithTaskTypeFallback(payloadWithFile);
            saved = true;
            break;
          } catch (err) {
            lastError = err;
            const validation = getValidationData(err);
            const hasFieldValidationError = Boolean(
              validation?.[fileField] || validation?.geogebra_image_base64 || validation?.drawing_image,
            );
            if (!hasFieldValidationError) {
              throw err;
            }
          }
        }

        if (!saved && lastError) {
          throw lastError;
        }
      }

      message.success(isCreate ? 'Задача создана' : 'Задача сохранена');
      onSaved();
    } catch (error) {
      console.error('Save error details:', error?.data);
      console.dir(error?.data, { depth: 6 });
      console.error('Save payload was:', payload);
      const details = error?.data
        ? Object.entries(error.data)
            .map(([k, v]) => `${k}: ${v?.message || v?.code || JSON.stringify(v)}`)
            .join('; ')
        : error?.message || 'неизвестная ошибка';
      message.error(`Ошибка сохранения: ${details}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Удаление задачи ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteGeometryTask(task.id);
      message.success('Задача удалена');
      onSaved();
    } catch {
      message.error('Ошибка при удалении задачи');
    } finally {
      setDeleting(false);
    }
  };

  // ── Начальные значения формы ──────────────────────────────────────────────
  const initialValues = {
    code: task?.code || generateCode(),
    title: task?.title || '',
    topic: task?.topic || null,
    subtopic: task?.subtopic || null,
    difficulty: task?.difficulty || undefined,
    statement_md: task?.statement_md || '',
    answer: task?.answer || '',
    solution_md: task?.solution_md || '',
    source: task?.source || '',
    year: task?.year || undefined,
  };

  // ── Вкладки ───────────────────────────────────────────────────────────────
  const tabItems = [
    {
      key: 'condition',
      label: 'Условие',
      forceRender: true,
      children: <TabCondition
        form={form}
        initialValues={initialValues}
        previewStatement={previewStatement}
        onStatementChange={setPreviewStatement}
        geoTopics={geoTopics}
        geoSubtopics={geoSubtopics}
        selectedTopicId={selectedTopicId}
        onTopicChange={(id) => {
          setSelectedTopicId(id);
          form.setFieldValue('subtopic', null);
        }}
      />,
    },
    {
      key: 'drawing',
      forceRender: true,
      label: (
        <span>
          Чертёж{' '}
          {ggbSaved && <Tag color="blue" style={{ marginLeft: 4, fontSize: 11 }}>✓</Tag>}
        </span>
      ),
      children: <TabDrawing
        appName={appName}
        onAppNameChange={(v) => { setAppName(v); setGgbSaved(false); }}
        initialBase64={ggbBase64}
        imageBase64={ggbImageBase64 || existingDrawingUrl}
        onApiReady={(api) => { ggbApiRef.current = api; }}
        ggbSaved={ggbSaved}
        drawingView={drawingView}
        onDrawingViewChange={setDrawingView}
        savingDrawing={savingDrawing}
        onSaveDrawing={handleSaveDrawing}
        onSaveDrawingAsImage={handleSaveDrawingAsImage}
        onOpenCropModal={handleOpenCropModal}
        cropModalOpen={cropModalOpen}
        cropMargins={cropMargins}
        onCropMarginsChange={setCropMargins}
        croppingImage={croppingImage}
        onApplyCrop={handleApplyCrop}
        onCloseCropModal={() => setCropModalOpen(false)}
        onClearDrawing={handleClearDrawing}
      />,
    },
    {
      key: 'layout',
      forceRender: true,
      label: 'Макет',
      children: <TabLayout
        task={task}
        previewStatement={previewStatement}
        ggbImageBase64={ggbImageBase64}
        layout={layoutPrint}
        onLayoutChange={handleEditorLayoutChange}
        onReset={handleEditorLayoutReset}
      />,
    },
    {
      key: 'solution',
      forceRender: true,
      label: 'Решение',
      children: <TabSolution
        form={form}
        initialValues={initialValues}
        previewSolution={previewSolution}
        onSolutionChange={setPreviewSolution}
      />,
    },
  ];

  // ── Рендер ────────────────────────────────────────────────────────────────
  return (
    <Space direction="vertical" size={0} style={{ width: '100%' }}>
      {/* Заголовок с кнопкой назад */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onCancel}>
            Назад к задачам
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {isCreate ? 'Новая геометрическая задача' : `Редактирование: ${task.code}`}
          </Title>
        </Space>

        {/* Кнопки действий */}
        <Space>
          {!isCreate && (
            <Popconfirm
              title="Удалить задачу?"
              description="Это действие необратимо."
              okText="Удалить"
              cancelText="Отмена"
              okButtonProps={{ danger: true }}
              onConfirm={handleDelete}
            >
              <Button danger icon={<DeleteOutlined />} loading={deleting}>
                Удалить
              </Button>
            </Popconfirm>
          )}
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            {isCreate ? 'Создать задачу' : 'Сохранить'}
          </Button>
        </Space>
      </div>

      {/* Предупреждение в режиме редактирования */}
      {!isCreate && (
        <Alert
          type="info"
          showIcon
          message="Изменения будут применены немедленно. Чертёж нужно сохранить отдельно кнопкой «Сохранить чертёж»."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Форма + вкладки */}
      <Form form={form} layout="vertical" initialValues={initialValues}>
        <Tabs items={tabItems} type="card" />
      </Form>
    </Space>
  );
}

// ── Вкладка 1: Условие ────────────────────────────────────────────────────
function TabCondition({
  form, initialValues, previewStatement, onStatementChange,
  geoTopics, geoSubtopics, selectedTopicId, onTopicChange,
}) {
  const filteredSubtopics = selectedTopicId
    ? geoSubtopics.filter((s) => s.topic === selectedTopicId)
    : geoSubtopics;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '16px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Form.Item
          name="code"
          label="Код задачи"
          rules={[{ required: true, message: 'Укажите код' }]}
        >
          <Input placeholder="GEO-001" />
        </Form.Item>

        <Form.Item name="difficulty" label="Сложность">
          <Select options={DIFFICULTY_OPTIONS} allowClear placeholder="Не указана" />
        </Form.Item>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
        <Form.Item name="topic" label="Тема">
          <Select
            placeholder="Выберите тему"
            allowClear
            options={geoTopics.map((t) => ({ value: t.id, label: t.title }))}
            onChange={onTopicChange}
          />
        </Form.Item>

        <Form.Item name="subtopic" label="Подтема">
          <Select
            placeholder={selectedTopicId ? 'Выберите подтему' : 'Сначала выберите тему'}
            allowClear
            disabled={!selectedTopicId && filteredSubtopics.length === 0}
            options={filteredSubtopics.map((s) => ({ value: s.id, label: s.title }))}
          />
        </Form.Item>

        <Form.Item name="source" label="Источник">
          <Input placeholder="Атанасян, §7" />
        </Form.Item>

        <Form.Item name="year" label="Год">
          <InputNumber
            style={{ width: '100%' }}
            placeholder="2024"
            min={1990}
            max={2030}
          />
        </Form.Item>
      </div>

      <Form.Item
        name="statement_md"
        label="Условие задачи (Markdown + LaTeX)"
      >
        <TextArea
          rows={5}
          placeholder="Дано: $\triangle MEN$, $MN - KL = 6$. Найдите $MN$."
          onChange={(e) => onStatementChange(e.target.value)}
        />
      </Form.Item>

      {previewStatement && (
        <Card
          size="small"
          title={<Text type="secondary" style={{ fontSize: 12 }}>Предпросмотр условия</Text>}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <MathRenderer text={previewStatement} />
        </Card>
      )}

      <Form.Item name="answer" label="Ответ">
        <Input placeholder="12 (числовой ответ; для нескольких вариантов: 3|3.0)" style={{ maxWidth: 300 }} />
      </Form.Item>
    </Space>
  );
}

// ── Вкладка 2: Чертёж ─────────────────────────────────────────────────────
function TabDrawing({
  appName,
  onAppNameChange,
  initialBase64,
  imageBase64,
  onApiReady,
  ggbSaved,
  drawingView,
  onDrawingViewChange,
  savingDrawing,
  onSaveDrawing,
  onSaveDrawingAsImage,
  onOpenCropModal,
  cropModalOpen,
  cropMargins,
  onCropMarginsChange,
  croppingImage,
  onApplyCrop,
  onCloseCropModal,
  onClearDrawing,
}) {
  const drawingContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 900,
  );

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    const onFullscreenChange = () => {
      if (!drawingContainerRef.current) {
        setIsFullscreen(false);
        return;
      }
      setIsFullscreen(document.fullscreenElement === drawingContainerRef.current);
    };

    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (drawingContainerRef.current?.requestFullscreen) {
          await drawingContainerRef.current.requestFullscreen();
        }
        return;
      }
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      message.warning('Не удалось переключить полноэкранный режим.');
    }
  }, []);

  const appletHeight = isFullscreen
    ? Math.max(680, viewportHeight - 96)
    : 680;

  const normalizedCrop = normalizeCrop(cropMargins);
  const setCropEdge = (edge, value) => {
    onCropMarginsChange((prev) => normalizeCrop({ ...prev, [edge]: value }));
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '16px 0' }}>
      {/* Панель управления */}
      <Card size="small">
        <Space wrap>
          <div>
            <Text type="secondary" style={{ marginRight: 8 }}>Режим:</Text>
            <Select
              value={appName}
              onChange={onAppNameChange}
              options={APPNAME_OPTIONS}
              style={{ width: 220 }}
            />
          </div>

          <div>
            <Text type="secondary" style={{ marginRight: 8 }}>Показывать:</Text>
            <Select
              value={drawingView}
              onChange={onDrawingViewChange}
              style={{ width: 220 }}
              options={[
                { value: 'image', label: 'Картинку (PNG)' },
                { value: 'geogebra', label: 'GeoGebra объект' },
              ]}
            />
          </div>

          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={savingDrawing}
            onClick={onSaveDrawing}
          >
            Сохранить чертёж (GeoGebra + PNG)
          </Button>

          <Button
            loading={savingDrawing}
            onClick={onSaveDrawingAsImage}
          >
            Сохранить как картинку (PNG)
          </Button>

          <Button onClick={onOpenCropModal} disabled={!imageBase64}>
            Обрезать PNG
          </Button>

          <Button
            icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? 'Свернуть' : 'На весь экран'}
          </Button>

          <Button onClick={onClearDrawing} danger>
            Очистить
          </Button>

          {ggbSaved && (
            <Tag color="success" style={{ fontSize: 13, padding: '4px 10px' }}>
              ✓ Чертёж сохранён
            </Tag>
          )}
          {!ggbSaved && (
            <Tag color="warning" style={{ fontSize: 13, padding: '4px 10px' }}>
              Чертёж не сохранён
            </Tag>
          )}
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        message={
          <span>
            Нарисуйте чертёж в поле ниже. Можно сохранить в формате GeoGebra
            кнопкой <strong>«Сохранить чертёж (GeoGebra + PNG)»</strong> или обновить только картинку
            кнопкой <strong>«Сохранить как картинку (PNG)»</strong>.
            После этого можно обрезать лишние поля кнопкой <strong>«Обрезать PNG»</strong>.
          </span>
        }
      />

      {!!imageBase64 && (
        <Card
          size="small"
          title="Текущая сохранённая картинка (PNG)"
          styles={{ body: { padding: 12 } }}
        >
          <img
            src={imageBase64}
            alt="Чертёж"
            style={{ width: '100%', maxHeight: 320, objectFit: 'contain', display: 'block' }}
          />
        </Card>
      )}

      {/* GeoGebra апплет */}
      <div
        ref={drawingContainerRef}
        style={{
          width: '100%',
          background: '#fff',
          borderRadius: 10,
          padding: isFullscreen ? 10 : 0,
        }}
      >
        <GeoGebraApplet
          appName={appName}
          readOnly={false}
          initialBase64={initialBase64}
          onApiReady={onApiReady}
          height={appletHeight}
        />
      </div>

      <Modal
        title="Обрезка PNG"
        open={cropModalOpen}
        onCancel={onCloseCropModal}
        onOk={onApplyCrop}
        okText="Применить"
        cancelText="Отмена"
        confirmLoading={croppingImage}
        width={820}
      >
        {!imageBase64 ? (
          <Alert type="warning" showIcon message="Сначала сохраните PNG из GeoGebra" />
        ) : (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0, maxWidth: '100%' }}>
                <img
                  src={imageBase64}
                  alt="Предпросмотр обрезки"
                  style={{ maxWidth: '100%', maxHeight: 360, width: 'auto', height: 'auto', display: 'block' }}
                />
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      height: `${normalizedCrop.top}%`,
                      background: 'rgba(0, 0, 0, 0.28)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: `${normalizedCrop.bottom}%`,
                      background: 'rgba(0, 0, 0, 0.28)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: `${normalizedCrop.top}%`,
                      bottom: `${normalizedCrop.bottom}%`,
                      width: `${normalizedCrop.left}%`,
                      background: 'rgba(0, 0, 0, 0.28)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: `${normalizedCrop.top}%`,
                      bottom: `${normalizedCrop.bottom}%`,
                      width: `${normalizedCrop.right}%`,
                      background: 'rgba(0, 0, 0, 0.28)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: `${normalizedCrop.left}%`,
                      right: `${normalizedCrop.right}%`,
                      top: `${normalizedCrop.top}%`,
                      bottom: `${normalizedCrop.bottom}%`,
                      border: '2px solid #ff4d4f',
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.95) inset',
                    }}
                  />
                </div>
              </div>
            </div>

            {[
              ['left', 'Слева'],
              ['right', 'Справа'],
              ['top', 'Сверху'],
              ['bottom', 'Снизу'],
            ].map(([edge, label]) => (
              <div key={edge} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px', gap: 10, alignItems: 'center' }}>
                <Text>{label}</Text>
                <Slider
                  min={0}
                  max={45}
                  step={1}
                  value={normalizedCrop[edge]}
                  onChange={(v) => setCropEdge(edge, v)}
                />
                <InputNumber
                  min={0}
                  max={45}
                  value={normalizedCrop[edge]}
                  onChange={(v) => setCropEdge(edge, v ?? 0)}
                  addonAfter="%"
                  style={{ width: '100%' }}
                />
              </div>
            ))}
          </Space>
        )}
      </Modal>
    </Space>
  );
}

// ── Вкладка 3: Макет ──────────────────────────────────────────────────────
function TabLayout({ task, previewStatement, ggbImageBase64, layout, onLayoutChange, onReset }) {
  const [layoutEditMode, setLayoutEditMode] = useState(true);
  const [showAnswers, setShowAnswers] = useState(false);

  // Создаём mock-задачу для предпросмотра с актуальными данными из редактора
  const previewTask = useMemo(() => ({
    ...(task || {}),
    statement_md: previewStatement || task?.statement_md || '',
    // Если в этой сессии был экспортирован новый PNG — показываем его
    ...(ggbImageBase64 ? { geogebra_image_base64: ggbImageBase64 } : {}),
  }), [task, previewStatement, ggbImageBase64]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '16px 0' }}>
      <Alert
        type="info"
        showIcon
        message="Расположение чертежа и условия для печатного листа A5. Перетаскивайте блоки мышью, тяните за угловые маркеры для изменения размера. Макет сохраняется вместе с задачей."
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Space size={8}>
            <Switch checked={layoutEditMode} onChange={setLayoutEditMode} />
            <Text>Редактировать макет</Text>
          </Space>
          <Space size={8}>
            <Switch checked={showAnswers} onChange={setShowAnswers} />
            <Text>Показывать ответ</Text>
          </Space>
          <Tag>Карточка A5</Tag>
        </Space>
        <Button icon={<UndoOutlined />} onClick={onReset}>
          Сбросить по умолчанию
        </Button>
      </div>

      {/* Ячейка предпросмотра — масштаб как у одной ячейки на студенческом листе */}
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
          <GeometryPreviewCard
            task={previewTask}
            index={0}
            showAnswers={showAnswers}
            mode="student"
            drawingMode="task"
            editable={layoutEditMode}
            layout={layout}
            onLayoutChange={onLayoutChange}
          />
        </div>
      </div>

      <Card
        size="small"
        styles={{ body: { padding: '10px 16px', color: '#888', fontSize: 12, lineHeight: 1.6 } }}
      >
        <strong>Как это работает:</strong> здесь задаётся расположение блоков на ячейке листа A5.
        При формировании листа позиции берутся из этого макета автоматически — ничего не нужно
        настраивать заново. При необходимости тонкую настройку можно сделать прямо на листе A5.
      </Card>
    </Space>
  );
}

// ── Вкладка 4: Решение ───────────────────────────────────────────────────
function TabSolution({ form, previewSolution, onSolutionChange }) {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '16px 0' }}>
      <Form.Item
        name="solution_md"
        label="Подробное решение (Markdown + LaTeX)"
      >
        <TextArea
          rows={10}
          placeholder={
            'Пример:\n\nПо теореме о средней линии треугольника $KL \\parallel MN$ и $KL = \\dfrac{MN}{2}$.\n\nЗначит $MN - KL = MN - \\dfrac{MN}{2} = \\dfrac{MN}{2} = 6$.\n\nОтсюда $MN = 12$.'
          }
          onChange={(e) => onSolutionChange(e.target.value)}
        />
      </Form.Item>

      {previewSolution && (
        <Card
          size="small"
          title={<Text type="secondary" style={{ fontSize: 12 }}>Предпросмотр решения</Text>}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <MathRenderer text={previewSolution} />
        </Card>
      )}
    </Space>
  );
}
