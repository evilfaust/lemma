import { useState, useRef, useCallback, useMemo } from 'react';
import { Modal, Button, Input, Select, InputNumber, Space, App } from 'antd';
import { PlusOutlined, DeleteOutlined, CameraOutlined } from '@ant-design/icons';
import GeoGebraApplet from '../GeoGebraApplet';
import './GeoGebraBlocksModal.css';

const APPNAME_OPTIONS = [
  { value: 'geometry', label: 'Геометрия' },
  { value: 'graphing', label: 'Графики функций' },
  { value: 'classic', label: 'Классик' },
  { value: '3d', label: '3D' },
];

const createDefaultApplet = (suffix = Date.now().toString(36).slice(-5)) => ({
  id: `ggb-${suffix}`,
  appName: 'geometry',
  height: 520,
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
  const [readingState, setReadingState] = useState(false);
  const apiRef = useRef(null);

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

  const handleSave = useCallback(() => {
    const normalized = {
      ...draft,
      id: (draft.id || '').trim(),
      appName: draft.appName || 'geometry',
      height: Number(draft.height || 520),
      caption: draft.caption || '',
      geogebraBase64: draft.geogebraBase64 || '',
      previewImage: draft.previewImage || '',
    };

    if (!normalized.id) {
      message.warning('Укажите id GeoGebra-блока');
      return;
    }

    if (applets.some(a => a.id === normalized.id && a.id !== selectedId)) {
      message.warning('Блок с таким id уже существует');
      return;
    }

    onAppletsChange(prev => {
      const idx = prev.findIndex(a => a.id === selectedId);
      if (idx === -1) return [...prev, normalized];
      const next = [...prev];
      next[idx] = normalized;
      return next;
    });
    setSelectedId(normalized.id);
    message.success('GeoGebra-блок сохранён');
  }, [draft, applets, selectedId, onAppletsChange, message]);

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

  const handleReadFromApplet = useCallback(async () => {
    const ggbApi = apiRef.current;
    if (!ggbApi) {
      message.warning('GeoGebra ещё не загружена');
      return;
    }

    setReadingState(true);
    try {
      const geogebraBase64 = await new Promise((resolve) => {
        ggbApi.getBase64((b64) => resolve(b64 || ''));
      });
      const pngBase64 = ggbApi.getPNGBase64(2, false, 300);
      const previewImage = pngBase64
        ? (pngBase64.startsWith('data:image/') ? pngBase64 : `data:image/png;base64,${pngBase64}`)
        : '';

      setDraft(prev => ({
        ...prev,
        geogebraBase64,
        previewImage: previewImage || prev.previewImage,
      }));
      message.success('Состояние и PNG считаны из GeoGebra');
    } catch {
      message.error('Не удалось считать состояние GeoGebra');
    } finally {
      setReadingState(false);
    }
  }, [message]);

  const handleClose = useCallback(() => {
    apiRef.current = null;
    onClose();
  }, [onClose]);

  // Инициализация при открытии
  const handleAfterOpenChange = useCallback((visible) => {
    if (!visible) return;
    if (selectedId && appletsById.has(selectedId)) return;
    if (applets.length > 0) {
      selectApplet(applets[0].id);
    } else {
      handleCreate();
    }
  }, [selectedId, appletsById, applets, selectApplet, handleCreate]);

  return (
    <Modal
      title="GeoGebra-блоки статьи"
      open={open}
      onCancel={handleClose}
      afterOpenChange={handleAfterOpenChange}
      footer={null}
      width={980}
      destroyOnClose={false}
    >
      <div className="ggb-modal">
        <div className="ggb-modal-sidebar">
          <div className="ggb-modal-sidebar-actions">
            <Button icon={<PlusOutlined />} onClick={handleCreate}>Новый блок</Button>
          </div>
          <div className="ggb-modal-list">
            {applets.length === 0 && (
              <div className="ggb-modal-empty">Блоков пока нет</div>
            )}
            {applets.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ggb-modal-item ${selectedId === item.id ? 'active' : ''}`}
                onClick={() => selectApplet(item.id)}
              >
                <strong>{item.id}</strong>
                <span>{item.caption || 'Без подписи'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="ggb-modal-editor">
          <div className="ggb-modal-fields">
            <Input
              value={draft.id}
              onChange={(e) => setDraft(prev => ({ ...prev, id: e.target.value }))}
              placeholder="ID блока (например ggb-triangle)"
            />
            <Select
              value={draft.appName}
              onChange={(v) => setDraft(prev => ({ ...prev, appName: v }))}
              options={APPNAME_OPTIONS}
              style={{ width: 180 }}
            />
            <InputNumber
              min={260}
              max={900}
              value={draft.height}
              onChange={(v) => setDraft(prev => ({ ...prev, height: Number(v || 520) }))}
            />
          </div>

          <Input
            value={draft.caption}
            onChange={(e) => setDraft(prev => ({ ...prev, caption: e.target.value }))}
            placeholder="Подпись блока (опционально)"
          />

          <div className="ggb-modal-applet">
            <GeoGebraApplet
              key={`${draft.id}-${(draft.geogebraBase64 || '').slice(0, 24)}-${draft.appName}`}
              appName={draft.appName || 'geometry'}
              readOnly={false}
              initialBase64={draft.geogebraBase64 || ''}
              onApiReady={(api) => { apiRef.current = api; }}
              height={Number(draft.height || 520)}
            />
          </div>

          <Space wrap>
            <Button
              type="primary"
              icon={<CameraOutlined />}
              onClick={handleReadFromApplet}
              loading={readingState}
            >
              Считать из GeoGebra
            </Button>
            <Button onClick={handleSave}>Сохранить блок</Button>
            <Button
              onClick={() => onInsertBlock?.(draft)}
              disabled={!draft.id}
            >
              Вставить блок в текст
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
              disabled={!selectedId}
            >
              Удалить
            </Button>
          </Space>

          {draft.previewImage && (
            <div className="ggb-modal-preview">
              <img src={draft.previewImage} alt="GeoGebra preview" />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
