import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Select, Space, Tag, Typography, message } from 'antd';
import {
  FullscreenExitOutlined,
  FullscreenOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import GeoGebraApplet from '../GeoGebraApplet';
import CropModal from '../shared/CropModal';

const { Text } = Typography;

const APPNAME_OPTIONS = [
  { value: 'geometry', label: 'Геометрия' },
  { value: 'graphing', label: 'Графики функций' },
  { value: 'classic', label: 'Классик (все инструменты)' },
  { value: '3d', label: '3D — стереометрия' },
];

export default function TabDrawing({
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
  onCropApplied,
  onClearDrawing,
}) {
  const drawingContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 900,
  );
  const [cropModalOpen, setCropModalOpen] = useState(false);

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

  const handleOpenCrop = () => {
    if (!imageBase64) {
      message.warning('Сначала сохраните PNG');
      return;
    }
    setCropModalOpen(true);
  };

  const handleCropped = (croppedDataUrl) => {
    onCropApplied(croppedDataUrl);
    setCropModalOpen(false);
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

          <Button onClick={handleOpenCrop} disabled={!imageBase64}>
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

      <CropModal
        open={cropModalOpen}
        onCancel={() => setCropModalOpen(false)}
        onCropped={handleCropped}
        imageUrl={imageBase64}
        title="Обрезка PNG"
        emptyMessage="Сначала сохраните PNG из GeoGebra"
        messageApi={message}
      />
    </Space>
  );
}
