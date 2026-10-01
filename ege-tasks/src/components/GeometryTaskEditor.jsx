import {
  lazy, Suspense, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  App,
  Button,
  Form,
  Popconfirm,
  Space,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  HighlightOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { api } from '../shared/services/pocketbase';
import { normalizeLayout, safeParseLayout } from './GeometryTaskPreview';
import { ggbXmlToSvg } from '../utils/ggbToSvg';
import { stereoDrawingSvg, stereoSpecFromSvg } from '../utils/stereo/dsl';
import { planimDrawingSvg, planimSpecFromSvg } from '../utils/planim/dsl';
import { guessGeometrySection } from '../utils/geometrySection';
import useFieldInserts from '../hooks/useFieldInserts';
import TabCondition from './geometry/TabCondition';
import TabDrawing from './geometry/TabDrawing';
import TabLayout from './geometry/TabLayout';
import TabSolution from './geometry/TabSolution';

const StereoModal = lazy(() => import('./stereo/StereoModal'));
const PlanimModal = lazy(() => import('./planim/PlanimModal'));

const { Title } = Typography;

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

const pngFromGeoGebra = (ggbApi) => {
  const png = ggbApi?.getPNGBase64?.(2, false, 300);
  if (!png) return '';
  return png.startsWith('data:image/') ? png : `data:image/png;base64,${png}`;
};

/** Указания задачи: json-массив [{ order, text_md }] (у банка МЦНМО — из импорта). */
export function normalizeHints(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { list = []; }
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((h) => h && typeof h.text_md === 'string')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((h) => ({ text_md: h.text_md }));
}

/**
 * Редактор геометрической задачи.
 *
 * Props:
 *   task     — объект задачи для редактирования (null = создание новой)
 *   onSaved  — callback после успешного сохранения
 *   onCancel — callback для кнопки «Назад»
 */
export default function GeometryTaskEditor({ task, onSaved, onCancel }) {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const isCreate = !task;

  // Расширенный редактор (CodeMirror) для условия и решения — выбор учителя,
  // запоминается между сессиями. Тот же паттерн, что в TaskEditModal.
  const [codeEditor, setCodeEditor] = useState(() => {
    try { return localStorage.getItem('geoEditor.codeMode') === '1'; } catch { return false; }
  });
  const toggleCodeEditor = useCallback(() => {
    setCodeEditor((prev) => {
      const next = !prev;
      try { localStorage.setItem('geoEditor.codeMode', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const fieldMode = codeEditor ? 'code' : 'plain';

  // ── Несохранённые изменения ─────────────────────────────────────────────────
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback(() => setDirty(true), []);

  // ── Состояние чертежа ─────────────────────────────────────────────────────
  const ggbApiRef = useRef(null);
  // GeoGebra менялась после последнего снимка PNG — на печати была бы старая картинка.
  const ggbChangedRef = useRef(false);
  const [ggbBase64, setGgbBase64] = useState(task?.geogebra_base64 || '');
  const [ggbImageBase64, setGgbImageBase64] = useState('');
  const [ggbSaved, setGgbSaved] = useState(!!(task?.geogebra_base64 || task?.geogebra_image_base64 || task?.drawing_svg));
  const existingDrawingUrl = api.getGeometryImageUrl(task);
  const [savingDrawing, setSavingDrawing] = useState(false);
  const [appName, setAppName] = useState(task?.geogebra_appname || 'geometry');
  const [drawingView, setDrawingView] = useState(task?.drawing_view || 'image');
  const [drawingSvg, setDrawingSvg] = useState(task?.drawing_svg || '');
  const [convertingSvg, setConvertingSvg] = useState(false);
  const [stereoOpen, setStereoOpen] = useState(false);
  const [planimOpen, setPlanimOpen] = useState(false);

  // ── Состояние макета ─────────────────────────────────────────────────────
  const [layoutPrint, setLayoutPrint] = useState(() => {
    const persisted = safeParseLayout(task?.preview_layout)?.print ?? null;
    return normalizeLayout(persisted, 'print');
  });

  // ── Тексты: предпросмотр и вставка (общий тулбар с редактором задач) ────────
  const [previewStatement, setPreviewStatement] = useState(task?.statement_md || '');
  const [previewSolution, setPreviewSolution] = useState(task?.solution_md || '');
  const statementRef = useRef(null);
  const solutionRef = useRef(null);
  const inserts = useFieldInserts({
    form,
    fields: {
      statement_md: { ref: statementRef, setPreview: (t) => { setPreviewStatement(t); markDirty(); } },
      solution_md: { ref: solutionRef, setPreview: (t) => { setPreviewSolution(t); markDirty(); } },
    },
  });

  // ── Указания и вложения к решению ──────────────────────────────────────────
  const [hints, setHints] = useState(() => normalizeHints(task?.hints));
  const [solutionFiles, setSolutionFiles] = useState(() => {
    const raw = task?.solution_files;
    return Array.isArray(raw) ? raw : [];
  });

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

  // Код новой задачи — следующий свободный GEO-NNN по всей базе.
  useEffect(() => {
    if (!isCreate) return;
    api.getNextGeometryCode().then((code) => {
      if (code && !form.isFieldTouched('code')) form.setFieldValue('code', code);
    });
  }, [isCreate, form]);

  // ── GeoGebra ──────────────────────────────────────────────────────────────
  const handleApiReady = useCallback((apiObj) => {
    ggbApiRef.current = apiObj;
    // Слушатели — чуть позже: загрузка сохранённого чертежа тоже шлёт события.
    setTimeout(() => {
      const onChange = () => { ggbChangedRef.current = true; setDirty(true); };
      try {
        apiObj.registerAddListener?.(onChange);
        apiObj.registerRemoveListener?.(onChange);
        apiObj.registerUpdateListener?.(onChange);
      } catch { /* старый апплет без слушателей — просто без подсказки */ }
    }, 1500);
  }, []);

  const handleSaveDrawing = useCallback(() => {
    if (!ggbApiRef.current) {
      message.warning('GeoGebra ещё не загружена');
      return;
    }
    setSavingDrawing(true);
    ggbApiRef.current.getBase64((base64) => {
      setGgbBase64(base64 || '');
      try {
        const png = pngFromGeoGebra(ggbApiRef.current);
        if (png) setGgbImageBase64(png);
      } catch {
        // ignore
      }
      ggbChangedRef.current = false;
      setGgbSaved(true);
      setSavingDrawing(false);
      setDirty(true);
      message.success('Чертёж сохранён (GeoGebra + PNG)');
    });
  }, [message]);

  const handleClearDrawing = useCallback(() => {
    setGgbBase64('');
    setGgbImageBase64('');
    setGgbSaved(false);
    setDirty(true);
    if (ggbApiRef.current) ggbApiRef.current.reset();
  }, []);

  const handleSaveDrawingAsImage = useCallback(() => {
    if (!ggbApiRef.current || typeof ggbApiRef.current.getPNGBase64 !== 'function') {
      message.warning('GeoGebra ещё не загружена');
      return;
    }
    setSavingDrawing(true);
    try {
      const png = pngFromGeoGebra(ggbApiRef.current);
      if (!png) throw new Error('GeoGebra не вернула изображение');
      setGgbImageBase64(png);
      ggbChangedRef.current = false;
      setGgbSaved(true);
      setDirty(true);
      message.success('PNG обновлён');
    } catch (error) {
      message.error(`Не удалось сохранить PNG: ${error?.message || 'неизвестная ошибка'}`);
    } finally {
      setSavingDrawing(false);
    }
  }, [message]);

  const handleCropApplied = useCallback((croppedDataUrl) => {
    setGgbImageBase64(croppedDataUrl);
    setDrawingView('image');
    setGgbSaved(true);
    setDirty(true);
  }, []);

  const handleConvertToSvg = useCallback(() => {
    if (!ggbApiRef.current) {
      message.warning('GeoGebra ещё не загружена');
      return;
    }
    setConvertingSvg(true);
    try {
      setDrawingSvg(ggbXmlToSvg(ggbApiRef.current.getXML()));
      setDirty(true);
      message.success('SVG готов — он сохранится вместе с задачей');
    } catch (err) {
      message.error(`Ошибка конвертации SVG: ${err?.message || 'неизвестная ошибка'}`);
    } finally {
      setConvertingSvg(false);
    }
  }, [message]);

  // Стереочертёж — SVG-чертёж задачи с исходником внутри (правится снова).
  const stereoSpec = stereoSpecFromSvg(drawingSvg);
  const handleStereoApply = useCallback(({ scene, camera, color }) => {
    setDrawingSvg(stereoDrawingSvg(scene, camera, { color }));
    setDrawingView('svg');
    setGgbSaved(true);
    setDirty(true);
    setStereoOpen(false);
    message.success('Стереочертёж стал чертежом задачи');
  }, [message]);

  // Планиметрический чертёж — так же: SVG задачи с исходником внутри.
  const planimSpec = planimSpecFromSvg(drawingSvg);
  const handlePlanimApply = useCallback(({ scene, color, grid }) => {
    setDrawingSvg(planimDrawingSvg(scene, { color, grid }));
    setDrawingView('svg');
    setGgbSaved(true);
    setDirty(true);
    setPlanimOpen(false);
    message.success('Чертёж стал чертежом задачи');
  }, [message]);

  // ── Управление макетом ────────────────────────────────────────────────────
  const handleEditorLayoutChange = useCallback((layerName, patch) => {
    setLayoutPrint((prev) => normalizeLayout({
      ...prev,
      [layerName]: { ...prev[layerName], ...patch },
    }, 'print'));
    setDirty(true);
  }, []);

  const handleEditorLayoutReset = useCallback(() => {
    setLayoutPrint(normalizeLayout(null, 'print'));
    setDirty(true);
  }, []);

  // GeoGebra поменяли, а PNG — нет: спросить, обновить ли картинку.
  const askRefreshPng = () => new Promise((resolve) => {
    modal.confirm({
      title: 'Чертёж в GeoGebra изменён',
      content: 'Картинка для печати (PNG) осталась прежней. Обновить её из GeoGebra? '
        + 'Если PNG был обрезан вручную, обрезку придётся повторить.',
      okText: 'Обновить картинку',
      cancelText: 'Сохранить как есть',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });

  // ── Сохранение задачи ─────────────────────────────────────────────────────
  const handleSave = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      message.error('Заполните обязательные поля');
      return;
    }
    const normalizedCode = (values.code || '').trim();
    if (!normalizedCode) {
      message.error('Укажите код задачи');
      return;
    }

    let imageData = ggbImageBase64;
    if (ggbChangedRef.current && drawingView === 'image' && ggbApiRef.current && await askRefreshPng()) {
      try {
        imageData = pngFromGeoGebra(ggbApiRef.current) || imageData;
        setGgbImageBase64(imageData);
        ggbChangedRef.current = false;
      } catch { /* останется прежняя картинка */ }
    }

    setSaving(true);
    try {
      let drawingImageFile = null;
      if (imageData) {
        try {
          const raw = imageData.replace(/^data:image\/\w+;base64,/, '');
          const binary = atob(raw);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          drawingImageFile = new File([bytes], 'drawing.png', { type: 'image/png' });
        } catch {
          // при ошибке конвертации — не обновляем файл
        }
      }

      const liveGgbBase64 = await getGeoGebraBase64(ggbApiRef.current);
      const finalGgbBase64 = liveGgbBase64 || ggbBase64 || '';
      if (finalGgbBase64 !== ggbBase64) setGgbBase64(finalGgbBase64);

      const payload = {
        code: normalizedCode,
        title: values.title || '',
        task_type: values.ready ? 'ready' : '',
        section: values.section || guessGeometrySection({
          statement: values.statement_md,
          topicTitle: geoTopics.find((t) => t.id === values.topic)?.title,
        }),
        topic: values.topic || null,
        subtopic: values.subtopic || null,
        difficulty: values.difficulty || null,
        statement_md: values.statement_md || '',
        answer: values.answer || '',
        solution_md: values.solution_md || '',
        solution_files: solutionFiles,
        hints: hints
          .map((h) => h.text_md.trim())
          .filter(Boolean)
          .map((text_md, i) => ({ order: i + 1, text_md })),
        geogebra_base64: finalGgbBase64,
        geogebra_appname: appName,
        drawing_view: drawingView,
        drawing_svg: drawingSvg || '',
        source: values.source || '',
        year: values.year || null,
        preview_layout: {
          ...(safeParseLayout(task?.preview_layout) || {}),
          print: layoutPrint,
        },
      };
      if (drawingImageFile) payload.geogebra_image_base64 = drawingImageFile;

      if (isCreate) await api.createGeometryTask(payload);
      else await api.updateGeometryTask(task.id, payload);

      setDirty(false);
      message.success(isCreate ? 'Задача создана' : 'Задача сохранена');
      onSaved();
    } catch (error) {
      const fieldErrors = Object.entries(error?.data?.data || {})
        .map(([k, v]) => `${k}: ${v?.message || v?.code || JSON.stringify(v)}`)
        .join('; ');
      const details = fieldErrors || error?.message || 'неизвестная ошибка';
      message.error(`Ошибка сохранения: ${details}`);
    } finally {
      setSaving(false);
    }
  };

  // Ctrl+S — сохранить; уход со страницы с правками — предупреждение.
  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const handleBack = () => {
    if (!dirty) { onCancel(); return; }
    modal.confirm({
      title: 'Уйти без сохранения?',
      content: 'Изменения в задаче пропадут.',
      okText: 'Уйти',
      okButtonProps: { danger: true },
      cancelText: 'Остаться',
      onOk: onCancel,
    });
  };

  // ── Удаление задачи ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteGeometryTask(task.id);
      message.success('Задача удалена');
      setDirty(false);
      onSaved();
    } catch {
      message.error('Ошибка при удалении задачи');
    } finally {
      setDeleting(false);
    }
  };

  // ── Начальные значения формы ──────────────────────────────────────────────
  const initialValues = {
    code: task?.code || '',
    title: task?.title || '',
    ready: task?.task_type === 'ready',
    section: task?.section || undefined,
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
        fieldMode={fieldMode}
        previewStatement={previewStatement}
        onStatementChange={setPreviewStatement}
        statementRef={statementRef}
        inserts={inserts}
        geoTopics={geoTopics}
        geoSubtopics={geoSubtopics}
        selectedTopicId={selectedTopicId}
        onTopicChange={(id) => {
          setSelectedTopicId(id);
          form.setFieldValue('subtopic', null);
          // Тема «Стереометрия»/«Планиметрия» сама подсказывает раздел
          const title = String(geoTopics.find((t) => t.id === id)?.title || '').toLowerCase();
          const hint = title.includes('стереометр') ? 'stereo' : title.includes('планиметр') ? 'planim' : null;
          if (hint && !form.getFieldValue('section')) form.setFieldValue('section', hint);
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
        onAppNameChange={(v) => { setAppName(v); setGgbSaved(false); setDirty(true); }}
        initialBase64={ggbBase64}
        imageBase64={ggbImageBase64 || existingDrawingUrl}
        onApiReady={handleApiReady}
        ggbSaved={ggbSaved}
        drawingView={drawingView}
        onDrawingViewChange={(v) => { setDrawingView(v); setDirty(true); }}
        savingDrawing={savingDrawing}
        onSaveDrawing={handleSaveDrawing}
        onSaveDrawingAsImage={handleSaveDrawingAsImage}
        onCropApplied={handleCropApplied}
        onClearDrawing={handleClearDrawing}
        drawingSvg={drawingSvg}
        convertingSvg={convertingSvg}
        onConvertToSvg={handleConvertToSvg}
        onGetXml={() => ggbApiRef.current?.getXML?.() ?? ''}
        onSvgChange={(svg) => { setDrawingSvg(svg); setDirty(true); }}
        isStereo={!!stereoSpec}
        onOpenStereo={() => setStereoOpen(true)}
        isPlanim={!!planimSpec}
        onOpenPlanim={() => setPlanimOpen(true)}
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
      label: (
        <span>
          Решение
          {hints.length > 0 && <Tag style={{ marginLeft: 6, fontSize: 11 }}>указаний: {hints.length}</Tag>}
        </span>
      ),
      children: <TabSolution
        fieldMode={fieldMode}
        previewSolution={previewSolution}
        onSolutionChange={setPreviewSolution}
        solutionRef={solutionRef}
        inserts={inserts}
        hints={hints}
        onHintsChange={(h) => { setHints(h); setDirty(true); }}
        solutionFiles={solutionFiles}
        onSolutionFilesChange={(f) => { setSolutionFiles(f); setDirty(true); }}
        solutionDrawingUrl={task?.image_role === 'solution' ? api.getGeometryImageUrl(task) : ''}
      />,
    },
  ];

  // ── Рендер ────────────────────────────────────────────────────────────────
  return (
    <Space direction="vertical" size={0} style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            Назад к задачам
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {isCreate ? 'Новая геометрическая задача' : `Редактирование: ${task.code}`}
          </Title>
          {dirty && <Tag color="orange">не сохранено</Tag>}
          <Tooltip title="Подсветка LaTeX/markdown, перенос строк и поиск-замена (Ctrl+F / Ctrl+H) для условия и решения">
            <Button
              size="small"
              type={codeEditor ? 'primary' : 'default'}
              icon={<HighlightOutlined />}
              onClick={toggleCodeEditor}
            >
              {codeEditor ? 'Расширенный редактор: вкл' : 'Расширенный редактор'}
            </Button>
          </Tooltip>
        </Space>

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
          <Tooltip title="Ctrl+S">
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              {isCreate ? 'Создать задачу' : 'Сохранить'}
            </Button>
          </Tooltip>
        </Space>
      </div>

      <Form form={form} layout="vertical" initialValues={initialValues} onValuesChange={markDirty}>
        <Tabs items={tabItems} type="card" />
      </Form>

      {inserts.modals}
      {stereoOpen && (
        <Suspense fallback={null}>
          <StereoModal
            open
            initialSpec={stereoSpec}
            showFormat={false}
            applyLabel={stereoSpec ? 'Обновить чертёж задачи' : 'Сделать чертежом задачи'}
            onClose={() => setStereoOpen(false)}
            onApply={handleStereoApply}
          />
        </Suspense>
      )}
      {planimOpen && (
        <Suspense fallback={null}>
          <PlanimModal
            open
            initialSpec={planimSpec}
            showFormat={false}
            applyLabel={planimSpec ? 'Обновить чертёж задачи' : 'Сделать чертежом задачи'}
            onClose={() => setPlanimOpen(false)}
            onApply={handlePlanimApply}
          />
        </Suspense>
      )}
    </Space>
  );
}
