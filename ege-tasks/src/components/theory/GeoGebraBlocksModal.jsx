import { useState, useRef, useCallback, useMemo } from 'react';
import { Drawer, Button, Input, Space, Tooltip, App } from 'antd';
import {
  PlusOutlined, DeleteOutlined, SaveOutlined,
  NodeIndexOutlined, CameraOutlined, ScissorOutlined,
} from '@ant-design/icons';
import GeoGebraApplet from '../GeoGebraApplet';
import CropModal from '../shared/CropModal';
import './GeoGebraBlocksModal.css';

const createDefaultApplet = (suffix = Date.now().toString(36).slice(-5)) => ({
  id: `ggb-${suffix}`,
  caption: '',
  geogebraBase64: '',
  previewImage: '',
});

export default function GeoGebraBlocksModal({
  open,
  onClose,
  applets,
  onAppletsChange,
  onInsertBlock,
}) {
  const { message } = App.useApp();
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(createDefaultApplet);
  const [capturing, setCapturing] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [ggbHeight, setGgbHeight] = useState(600);
  const apiRef = useRef(null);
  const appletWrapRef = useRef(null);

  const appletsById = useMemo(
    () => new Map(applets.filter(a => a?.id).map(a => [a.id, a])),
    [applets],
  );

  const selectApplet = useCallback((id) => {
    const found = applets.find(a => a.id === id);
    if (!found) return;
    setSelectedId(id);
    setDraft({ ...createDefaultApplet(id.replace(/^ggb-/, '')), ...found, id });
  }, [applets]);

  const handleCreate = useCallback(() => {
    const fresh = createDefaultApplet();
    setSelectedId(fresh.id);
    setDraft(fresh);
  }, []);

  const handleClose = useCallback(() => {
    apiRef.current = null;
    onClose();
  }, [onClose]);

  // Инициализация при открытии + измерение реальной высоты контейнера
  const handleAfterOpenChange = useCallback((visible) => {
    if (!visible) return;

    // Выбор аплета
    if (!selectedId || !appletsById.has(selectedId)) {
      if (applets.length > 0) {
        selectApplet(applets[0].id);
      } else {
        handleCreate();
      }
    }

    // Измеряем реальную высоту контейнера GeoGebra после окончания анимации Drawer
    requestAnimationFrame(() => {
      const h = appletWrapRef.current?.offsetHeight;
      if (h > 100) setGgbHeight(h);
    });
  }, [selectedId, appletsById, applets, selectApplet, handleCreate]);

  // Шаг 1: Снять PNG из GeoGebra (+ сохранить .ggb-состояние в draft)
  const handleCapturePng = useCallback(async () => {
    const ggbApi = apiRef.current;
    if (!ggbApi) {
      message.warning('GeoGebra ещё не загружена');
      return;
    }
    setCapturing(true);
    try {
      const geogebraBase64 = await new Promise((resolve) => {
        ggbApi.getBase64((b64) => resolve(b64 || ''));
      });
      const pngBase64 = ggbApi.getPNGBase64(2, false, 300);
      if (!pngBase64) {
        message.warning('Нарисуйте что-нибудь перед сохранением');
        return;
      }
      const previewImage = pngBase64.startsWith('data:image/')
        ? pngBase64
        : `data:image/png;base64,${pngBase64}`;
      setDraft(prev => ({ ...prev, geogebraBase64, previewImage }));
      message.success('PNG снят');
    } catch {
      message.error('Не удалось считать PNG из GeoGebra');
    } finally {
      setCapturing(false);
    }
  }, [message]);

  // Шаг 2 (опционально): Обрезать PNG
  const handleOpenCrop = useCallback(() => {
    if (!draft.previewImage) {
      message.warning('Сначала снимите PNG');
      return;
    }
    setCropModalOpen(true);
  }, [draft.previewImage, message]);

  const handleCropped = useCallback((croppedDataUrl) => {
    setDraft(prev => ({ ...prev, previewImage: croppedDataUrl }));
    setCropModalOpen(false);
  }, []);

  // Шаг 3: Сохранить текущий draft в список блоков
  const doCommit = useCallback((normalized) => {
    onAppletsChange(prev => {
      const idx = prev.findIndex(a => a.id === selectedId);
      if (idx === -1) return [...prev, normalized];
      const next = [...prev];
      next[idx] = normalized;
      return next;
    });
    setSelectedId(normalized.id);
    setDraft(prev => ({ ...prev, ...normalized }));
  }, [selectedId, onAppletsChange]);

  const buildNormalized = useCallback(() => {
    const normalized = {
      id: (draft.id || '').trim(),
      caption: draft.caption || '',
      geogebraBase64: draft.geogebraBase64 || '',
      previewImage: draft.previewImage || '',
    };
    if (!normalized.id) {
      message.warning('Укажите id GeoGebra-блока');
      return null;
    }
    if (applets.some(a => a.id === normalized.id && a.id !== selectedId)) {
      message.warning('Блок с таким id уже существует');
      return null;
    }
    return normalized;
  }, [draft, applets, selectedId, message]);

  const handleSave = useCallback(() => {
    const normalized = buildNormalized();
    if (!normalized) return;
    doCommit(normalized);
    message.success('GeoGebra-блок сохранён');
  }, [buildNormalized, doCommit, message]);

  const handleSaveAndInsert = useCallback(() => {
    const normalized = buildNormalized();
    if (!normalized) return;
    doCommit(normalized);
    onInsertBlock?.(normalized);
    handleClose();
    message.success('Блок вставлен в статью');
  }, [buildNormalized, doCommit, onInsertBlock, handleClose, message]);

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    const rest = applets.filter(a => a.id !== selectedId);
    onAppletsChange(rest);
    if (rest.length > 0) {
      selectApplet(rest[0].id);
    } else {
      handleCreate();
    }
  }, [selectedId, applets, onAppletsChange, selectApplet, handleCreate]);

  return (
    <>
      <Drawer
        title={
          <div className="ggb-drawer-header">
            <span className="ggb-drawer-title">
              <NodeIndexOutlined className="ggb-drawer-title-icon" />
              GeoGebra-блоки статьи
            </span>
            <Button size="small" icon={<PlusOutlined />} onClick={handleCreate}>
              Новый блок
            </Button>
          </div>
        }
        open={open}
        onClose={handleClose}
        afterOpenChange={handleAfterOpenChange}
        width="min(1440px, 96vw)"
        placement="right"
        destroyOnHidden={false}
        className="ggb-drawer"
        styles={{ body: { display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: 10, overflow: 'hidden' } }}
        footer={null}
      >
        {/* Горизонтальная лента блоков */}
        <div className="ggb-drawer-strip">
          {applets.length === 0 ? (
            <span className="ggb-drawer-strip-empty">Блоков нет — создайте первый</span>
          ) : (
            applets.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ggb-strip-item ${selectedId === item.id ? 'active' : ''}`}
                onClick={() => selectApplet(item.id)}
              >
                <div className="ggb-strip-thumb">
                  {item.previewImage
                    ? <img src={item.previewImage} alt={item.id} />
                    : <span className="ggb-strip-placeholder">GGB</span>
                  }
                </div>
                <span className="ggb-strip-label">{item.id}</span>
              </button>
            ))
          )}
        </div>

        {/* Поля: ID и подпись */}
        <div className="ggb-drawer-fields">
          <div className="ggb-drawer-field">
            <label className="ggb-field-label">ID блока</label>
            <Input
              value={draft.id}
              onChange={(e) => setDraft(prev => ({ ...prev, id: e.target.value }))}
              placeholder="ggb-triangle"
              size="small"
            />
          </div>
          <div className="ggb-drawer-field">
            <label className="ggb-field-label">Подпись</label>
            <Input
              value={draft.caption}
              onChange={(e) => setDraft(prev => ({ ...prev, caption: e.target.value }))}
              placeholder="Рис. 1. Прямоугольный треугольник"
              size="small"
            />
          </div>
        </div>

        {/* GeoGebra — занимает всё доступное пространство */}
        <div className="ggb-drawer-applet" ref={appletWrapRef}>
          <GeoGebraApplet
            key={`${draft.id}-${(draft.geogebraBase64 || '').slice(0, 24)}-h${ggbHeight}`}
            appName="geometry"
            readOnly={false}
            initialBase64={draft.geogebraBase64 || ''}
            onApiReady={(api) => { apiRef.current = api; }}
            height={ggbHeight}
          />
        </div>

        {/* Нижняя панель: действия + превью */}
        <div className="ggb-drawer-bottom">
          <div className="ggb-drawer-actions">
            <Space size={6} wrap>
              <Tooltip title="Считать PNG и .ggb-состояние из GeoGebra">
                <Button
                  icon={<CameraOutlined />}
                  onClick={handleCapturePng}
                  loading={capturing}
                >
                  Снять PNG
                </Button>
              </Tooltip>
              <Tooltip title="Обрезать захваченный PNG">
                <Button
                  icon={<ScissorOutlined />}
                  onClick={handleOpenCrop}
                  disabled={!draft.previewImage}
                >
                  Обрезать
                </Button>
              </Tooltip>
            </Space>

            <Space size={6} wrap>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                className="ggb-btn-save"
              >
                Сохранить
              </Button>
              <Tooltip title="Сохранить и вставить блок в текст статьи">
                <Button
                  icon={<NodeIndexOutlined />}
                  onClick={handleSaveAndInsert}
                  disabled={!draft.id}
                >
                  Сохранить и вставить
                </Button>
              </Tooltip>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
                disabled={!selectedId}
              />
            </Space>
          </div>

          {/* Превью PNG — компактное */}
          {draft.previewImage && (
            <div className="ggb-drawer-preview">
              <img src={draft.previewImage} alt="preview" />
            </div>
          )}
        </div>
      </Drawer>

      <CropModal
        open={cropModalOpen}
        onCancel={() => setCropModalOpen(false)}
        onCropped={handleCropped}
        imageUrl={draft.previewImage}
        title="Обрезка GeoGebra PNG"
        emptyMessage="Сначала снимите PNG из GeoGebra"
        messageApi={message}
      />
    </>
  );
}
