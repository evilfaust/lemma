import { useCallback, useEffect, useRef, useState } from 'react';
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
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  BulbOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { api } from '../shared/services/pocketbase';
import GeoGebraApplet from './GeoGebraApplet';
import MathRenderer from './MathRenderer';

const { TextArea } = Input;
const { Text, Title } = Typography;

const TASK_TYPE_OPTIONS = [
  { value: 'ready', label: 'Готовый чертёж — студент видит построение' },
  { value: 'build', label: 'Построение — студент строит сам' },
  { value: 'mixed', label: 'Смешанный — частичный шаблон' },
];

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
  const initialLegacyImage = isImageDrawing(task?.geogebra_base64 || '') ? task?.geogebra_base64 : '';
  const [ggbBase64, setGgbBase64] = useState(initialLegacyImage ? '' : (task?.geogebra_base64 || ''));
  const [ggbImageBase64, setGgbImageBase64] = useState(task?.geogebra_image_base64 || initialLegacyImage || '');
  const [ggbSaved, setGgbSaved] = useState(!!(task?.geogebra_base64 || task?.geogebra_image_base64));
  const [savingDrawing, setSavingDrawing] = useState(false);
  const [appName, setAppName] = useState(task?.geogebra_appname || 'geometry');
  const [drawingView, setDrawingView] = useState(task?.drawing_view === 'geogebra' ? 'geogebra' : 'image');
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropMargins, setCropMargins] = useState({ left: 0, right: 0, top: 0, bottom: 0 });
  const [croppingImage, setCroppingImage] = useState(false);

  // ── Состояние подсказок ───────────────────────────────────────────────────
  const [hints, setHints] = useState(
    Array.isArray(task?.hints) ? task.hints : [],
  );

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

  // ── Управление подсказками ─────────────────────────────────────────────────
  const addHint = () => {
    setHints((prev) => [...prev, { order: prev.length + 1, text_md: '' }]);
  };

  const removeHint = (index) => {
    setHints((prev) => prev.filter((_, i) => i !== index).map((h, i) => ({ ...h, order: i + 1 })));
  };

  const updateHint = (index, text_md) => {
    setHints((prev) => prev.map((h, i) => (i === index ? { ...h, text_md } : h)));
  };

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
      const normalizedTaskType = values.task_type || '';

      if (!normalizedCode) {
        message.error('Укажите код задачи');
        return;
      }
      if (!normalizedTaskType) {
        message.error('Выберите тип задачи');
        return;
      }

      payload = {
        code: normalizedCode,
        title: values.title || '',
        topic: values.topic || null,
        subtopic: values.subtopic || null,
        difficulty: values.difficulty || null,
        task_type: normalizedTaskType,
        statement_md: values.statement_md || '',
        answer: values.answer || '',
        solution_md: values.solution_md || '',
        geogebra_base64: ggbBase64 || '',
        geogebra_image_base64: ggbImageBase64 || '',
        geogebra_svg: '',
        geogebra_appname: appName,
        drawing_view: drawingView,
        hints: hints.filter((h) => h.text_md.trim()),
        source: values.source || '',
        year: values.year || null,
      };

      if (isCreate) {
        await api.createGeometryTask(payload);
        message.success('Задача создана');
      } else {
        await api.updateGeometryTask(task.id, payload);
        message.success('Задача сохранена');
      }
      onSaved();
    } catch (error) {
      console.error('Save error details:', error?.data);
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
    task_type: task?.task_type || 'ready',
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
        imageBase64={ggbImageBase64}
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
      key: 'hints',
      forceRender: true,
      label: (
        <span>
          Подсказки{' '}
          {hints.length > 0 && (
            <Tag style={{ marginLeft: 4, fontSize: 11 }}>{hints.length}</Tag>
          )}
        </span>
      ),
      children: <TabHints
        hints={hints}
        onAdd={addHint}
        onRemove={removeHint}
        onChange={updateHint}
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <Form.Item
          name="code"
          label="Код задачи"
          rules={[{ required: true, message: 'Укажите код' }]}
        >
          <Input placeholder="GEO-001" />
        </Form.Item>

        <Form.Item name="task_type" label="Тип задачи" rules={[{ required: true }]}>
          <Select options={TASK_TYPE_OPTIONS} />
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
      <GeoGebraApplet
        appName={appName}
        readOnly={false}
        initialBase64={initialBase64}
        onApiReady={onApiReady}
        height={560}
      />

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

// ── Вкладка 3: Подсказки ─────────────────────────────────────────────────
function TabHints({ hints, onAdd, onRemove, onChange }) {
  return (
    <Space direction="vertical" size={12} style={{ width: '100%', padding: '16px 0' }}>
      <Alert
        type="info"
        showIcon
        icon={<BulbOutlined />}
        message="Подсказки показываются по одной. Студент сам решает, когда раскрывать следующую."
      />

      {hints.map((hint, index) => (
        <Card
          key={index}
          size="small"
          title={
            <Space>
              <BulbOutlined style={{ color: '#faad14' }} />
              <span>Подсказка {index + 1}</span>
            </Space>
          }
          extra={
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => onRemove(index)}
            />
          }
        >
          <TextArea
            value={hint.text_md}
            onChange={(e) => onChange(index, e.target.value)}
            rows={3}
            placeholder="Подсказка в Markdown + LaTeX. Например: Воспользуйтесь теоремой о средней линии: $KL = \frac{MN}{2}$"
          />
          {hint.text_md && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                background: '#fffbe6',
                borderRadius: 6,
                borderLeft: '3px solid #faad14',
              }}
            >
              <MathRenderer text={hint.text_md} />
            </div>
          )}
        </Card>
      ))}

      {hints.length === 0 && (
        <Card
          size="small"
          styles={{ body: { textAlign: 'center', padding: 24, color: '#aaa' } }}
        >
          Подсказок пока нет. Добавьте первую.
        </Card>
      )}

      <Button icon={<PlusOutlined />} onClick={onAdd} block>
        Добавить подсказку
      </Button>
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
