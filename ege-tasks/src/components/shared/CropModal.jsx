import { useState } from 'react';
import { Modal, Space, Slider, InputNumber, Alert } from 'antd';
import { normalizeCrop, cropPngByMargins } from '../../utils/cropImage';

/**
 * Универсальный модал обрезки изображения.
 * Показывает превью с затемнёнными полями и 4 слайдера (left/right/top/bottom).
 *
 * @param {boolean} open - видимость модала
 * @param {function} onCancel - закрытие
 * @param {function} onCropped - (croppedDataUrl: string) => void — вызывается после успешной обрезки
 * @param {string|null} imageUrl - data-url или URL изображения для обрезки
 * @param {string} title - заголовок модала
 * @param {string} emptyMessage - сообщение если нет изображения
 * @param {object} messageApi - Ant Design message API (для success/error)
 */
export default function CropModal({
  open,
  onCancel,
  onCropped,
  imageUrl,
  title = 'Обрезка изображения',
  emptyMessage = 'Нет изображения для обрезки',
  messageApi,
}) {
  const [cropMargins, setCropMargins] = useState({ left: 0, right: 0, top: 0, bottom: 0 });
  const [cropping, setCropping] = useState(false);

  const nc = normalizeCrop(cropMargins);

  const handleOpen = () => {
    setCropMargins({ left: 0, right: 0, top: 0, bottom: 0 });
  };

  const handleApply = async () => {
    if (!imageUrl) return;
    setCropping(true);
    try {
      const cropped = await cropPngByMargins(imageUrl, cropMargins);
      onCropped(cropped);
      messageApi?.success?.('Изображение обрезано');
    } catch (err) {
      messageApi?.error?.(`Ошибка обрезки: ${err?.message || 'неизвестная ошибка'}`);
    } finally {
      setCropping(false);
    }
  };

  const setEdge = (edge, value) => {
    setCropMargins(prev => normalizeCrop({ ...prev, [edge]: value }));
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={handleApply}
      okText="Применить"
      cancelText="Отмена"
      confirmLoading={cropping}
      width={820}
      afterOpenChange={(visible) => { if (visible) handleOpen(); }}
    >
      {!imageUrl ? (
        <Alert type="warning" showIcon message={emptyMessage} />
      ) : (
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <div style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0, maxWidth: '100%' }}>
              <img
                src={imageUrl}
                alt="Предпросмотр обрезки"
                style={{ maxWidth: '100%', maxHeight: 360, width: 'auto', height: 'auto', display: 'block' }}
              />
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${nc.top}%`, background: 'rgba(0,0,0,0.28)' }} />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${nc.bottom}%`, background: 'rgba(0,0,0,0.28)' }} />
                <div style={{ position: 'absolute', left: 0, top: `${nc.top}%`, bottom: `${nc.bottom}%`, width: `${nc.left}%`, background: 'rgba(0,0,0,0.28)' }} />
                <div style={{ position: 'absolute', right: 0, top: `${nc.top}%`, bottom: `${nc.bottom}%`, width: `${nc.right}%`, background: 'rgba(0,0,0,0.28)' }} />
                <div style={{ position: 'absolute', left: `${nc.left}%`, right: `${nc.right}%`, top: `${nc.top}%`, bottom: `${nc.bottom}%`, border: '2px solid #ff4d4f', boxShadow: '0 0 0 1px rgba(255,255,255,0.95) inset' }} />
              </div>
            </div>
          </div>

          {[['left', 'Слева'], ['right', 'Справа'], ['top', 'Сверху'], ['bottom', 'Снизу']].map(([edge, label]) => (
            <div key={edge} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px', gap: 10, alignItems: 'center' }}>
              <span>{label}</span>
              <Slider min={0} max={45} step={1} value={nc[edge]} onChange={(v) => setEdge(edge, v)} />
              <InputNumber min={0} max={45} value={nc[edge]} onChange={(v) => setEdge(edge, v ?? 0)} addonAfter="%" style={{ width: '100%' }} />
            </div>
          ))}
        </Space>
      )}
    </Modal>
  );
}
