import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Button,
  InputNumber,
  Modal,
  Slider,
  Space,
  Typography,
  message,
} from 'antd';
import {
  CameraOutlined,
  ClearOutlined,
  ScissorOutlined,
} from '@ant-design/icons';
import GeoGebraApplet from './GeoGebraApplet';
import { normalizeCrop, cropPngByMargins } from '../utils/cropImage';

const { Text } = Typography;

/**
 * Панель рисования чертежей в GeoGebra с экспортом в PNG.
 *
 * Не сохраняет состояние GeoGebra — только результат (PNG).
 * Используется в TaskEditModal для задач устного счёта.
 *
 * Props:
 *   imageDataUrl  — текущий PNG (data:image/...) или null
 *   onImageChange — callback(dataUrl | null)
 *   height        — высота GeoGebra-апплета (default: 420)
 */
export default function GeoGebraDrawingPanel({
  imageDataUrl = null,
  onImageChange,
  height = 420,
}) {
  const ggbApiRef = useRef(null);
  const [saving, setSaving] = useState(false);

  // Crop modal state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropMargins, setCropMargins] = useState({ left: 0, right: 0, top: 0, bottom: 0 });
  const [croppingImage, setCroppingImage] = useState(false);

  const handleApiReady = useCallback((api) => {
    ggbApiRef.current = api;
  }, []);

  // Экспорт PNG из GeoGebra
  const handleSavePng = useCallback(() => {
    const api = ggbApiRef.current;
    if (!api || typeof api.getPNGBase64 !== 'function') {
      message.warning('GeoGebra ещё не загружена');
      return;
    }

    setSaving(true);
    try {
      const pngBase64 = api.getPNGBase64(2, false, 300);
      if (pngBase64) {
        const dataUrl = pngBase64.startsWith('data:image/')
          ? pngBase64
          : `data:image/png;base64,${pngBase64}`;
        onImageChange(dataUrl);
        message.success('PNG сохранён');
      } else {
        message.warning('Не удалось получить PNG. Нарисуйте что-нибудь.');
      }
    } catch {
      message.error('Ошибка экспорта PNG');
    } finally {
      setSaving(false);
    }
  }, [onImageChange]);

  // Crop modal
  const handleOpenCrop = useCallback(() => {
    if (!imageDataUrl) {
      message.warning('Сначала сохраните PNG');
      return;
    }
    setCropMargins({ left: 0, right: 0, top: 0, bottom: 0 });
    setCropModalOpen(true);
  }, [imageDataUrl]);

  const handleApplyCrop = useCallback(async () => {
    if (!imageDataUrl) return;
    setCroppingImage(true);
    try {
      const cropped = await cropPngByMargins(imageDataUrl, cropMargins);
      onImageChange(cropped);
      setCropModalOpen(false);
      message.success('PNG обрезан');
    } catch (error) {
      message.error(`Ошибка обрезки: ${error?.message}`);
    } finally {
      setCroppingImage(false);
    }
  }, [imageDataUrl, cropMargins, onImageChange]);

  const handleClear = useCallback(() => {
    onImageChange(null);
  }, [onImageChange]);

  const normalizedCrop = normalizeCrop(cropMargins);
  const setCropEdge = (edge, value) => {
    setCropMargins((prev) => normalizeCrop({ ...prev, [edge]: value }));
  };

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <GeoGebraApplet
        appName="geometry"
        readOnly={false}
        onApiReady={handleApiReady}
        height={height}
      />

      <Space wrap>
        <Button
          icon={<CameraOutlined />}
          onClick={handleSavePng}
          loading={saving}
          type="primary"
        >
          Сохранить PNG
        </Button>
        <Button
          icon={<ScissorOutlined />}
          onClick={handleOpenCrop}
          disabled={!imageDataUrl}
        >
          Обрезать
        </Button>
        <Button
          icon={<ClearOutlined />}
          onClick={handleClear}
          disabled={!imageDataUrl}
          danger
        >
          Очистить
        </Button>
      </Space>

      {imageDataUrl && (
        <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, padding: 8, textAlign: 'center' }}>
          <img
            src={imageDataUrl}
            alt="Чертёж"
            style={{ maxWidth: '100%', maxHeight: 200, display: 'block', margin: '0 auto' }}
          />
        </div>
      )}

      <Modal
        title="Обрезка PNG"
        open={cropModalOpen}
        onCancel={() => setCropModalOpen(false)}
        onOk={handleApplyCrop}
        okText="Применить"
        cancelText="Отмена"
        confirmLoading={croppingImage}
        width={820}
      >
        {!imageDataUrl ? (
          <Alert type="warning" showIcon message="Сначала сохраните PNG из GeoGebra" />
        ) : (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0, maxWidth: '100%' }}>
                <img
                  src={imageDataUrl}
                  alt="Предпросмотр обрезки"
                  style={{ maxWidth: '100%', maxHeight: 360, width: 'auto', height: 'auto', display: 'block' }}
                />
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${normalizedCrop.top}%`, background: 'rgba(0,0,0,0.28)' }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${normalizedCrop.bottom}%`, background: 'rgba(0,0,0,0.28)' }} />
                  <div style={{ position: 'absolute', left: 0, top: `${normalizedCrop.top}%`, bottom: `${normalizedCrop.bottom}%`, width: `${normalizedCrop.left}%`, background: 'rgba(0,0,0,0.28)' }} />
                  <div style={{ position: 'absolute', right: 0, top: `${normalizedCrop.top}%`, bottom: `${normalizedCrop.bottom}%`, width: `${normalizedCrop.right}%`, background: 'rgba(0,0,0,0.28)' }} />
                  <div style={{ position: 'absolute', left: `${normalizedCrop.left}%`, right: `${normalizedCrop.right}%`, top: `${normalizedCrop.top}%`, bottom: `${normalizedCrop.bottom}%`, border: '2px solid #ff4d4f', boxShadow: '0 0 0 1px rgba(255,255,255,0.95) inset' }} />
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
                <Slider min={0} max={45} step={1} value={normalizedCrop[edge]} onChange={(v) => setCropEdge(edge, v)} />
                <InputNumber min={0} max={45} value={normalizedCrop[edge]} onChange={(v) => setCropEdge(edge, v ?? 0)} addonAfter="%" style={{ width: '100%' }} />
              </div>
            ))}
          </Space>
        )}
      </Modal>
    </Space>
  );
}
