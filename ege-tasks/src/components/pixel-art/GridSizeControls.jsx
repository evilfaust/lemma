import { Slider, InputNumber, Button, Row, Col, Typography, Space, Tooltip, Alert } from 'antd';
import { LinkOutlined, DisconnectOutlined, AimOutlined } from '@ant-design/icons';
import { calcCellSize, suggestGridSize } from '../../utils/imageToMatrix';

const { Text } = Typography;

const PRESETS = [
  { label: '1:1',  cols: 25, rows: 25 },
  { label: '4:3',  cols: 28, rows: 21 },
  { label: '3:4',  cols: 21, rows: 28 },
  { label: '16:9', cols: 32, rows: 18 },
  { label: '9:16', cols: 18, rows: 32 },
];

/**
 * Панель настройки размера сетки и порога яркости.
 *
 * Props:
 *   gridCols, gridRows, threshold     — текущие значения
 *   onColsChange, onRowsChange         — колбэки изменения (без учёта блокировки)
 *   onThresholdChange
 *   imageDimensions                    — { width, height } | null
 *   lockAspect                         — bool
 *   onLockAspectChange(bool)
 *   onApply()                          — кнопка «Пересчитать»
 *   processing                         — bool (идёт обработка)
 *   twoSheets                          — bool (влияет на расчёт размера клетки)
 */
export default function GridSizeControls({
  gridCols,
  gridRows,
  threshold,
  onColsChange,
  onRowsChange,
  onThresholdChange,
  imageDimensions,
  lockAspect,
  onLockAspectChange,
  onApply,
  processing,
  twoSheets = false,
}) {
  const cellMm = calcCellSize(gridCols, gridRows, twoSheets);
  const tooSmall = cellMm < 5.5;
  const tooTiny = cellMm < 4;

  // Ширина сетки с учётом блокировки пропорций
  const handleColsChange = (val) => {
    if (!val) return;
    onColsChange(val);
    if (lockAspect && imageDimensions) {
      const rows = Math.max(5, Math.min(50, Math.round(val * imageDimensions.height / imageDimensions.width)));
      onRowsChange(rows);
    }
  };

  // Высота сетки с учётом блокировки пропорций
  const handleRowsChange = (val) => {
    if (!val) return;
    onRowsChange(val);
    if (lockAspect && imageDimensions) {
      const cols = Math.max(5, Math.min(50, Math.round(val * imageDimensions.width / imageDimensions.height)));
      onColsChange(cols);
    }
  };

  const handlePreset = ({ cols, rows }) => {
    onColsChange(cols);
    onRowsChange(rows);
  };

  const handleMatchImage = () => {
    if (!imageDimensions) return;
    const { cols, rows } = suggestGridSize(imageDimensions.width, imageDimensions.height, gridCols);
    onColsChange(cols);
    onRowsChange(rows);
  };

  return (
    <div>
      {/* ── Пресеты ── */}
      <div style={{ marginBottom: 10 }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          Соотношение сторон:
        </Text>
        <Space wrap size={4}>
          {PRESETS.map(p => (
            <Button
              key={p.label}
              size="small"
              onClick={() => handlePreset(p)}
              type={gridCols === p.cols && gridRows === p.rows ? 'primary' : 'default'}
            >
              {p.label}
            </Button>
          ))}
          <Tooltip title={imageDimensions ? 'Подобрать под пропорции загруженного изображения' : 'Сначала загрузите изображение'}>
            <Button
              size="small"
              icon={<AimOutlined />}
              onClick={handleMatchImage}
              disabled={!imageDimensions}
            >
              По рисунку
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* ── Блокировка пропорций ── */}
      <div style={{ marginBottom: 12 }}>
        <Button
          size="small"
          icon={lockAspect ? <LinkOutlined /> : <DisconnectOutlined />}
          onClick={() => onLockAspectChange(!lockAspect)}
          type={lockAspect ? 'primary' : 'default'}
        >
          {lockAspect ? 'Пропорции зафиксированы' : 'Зафиксировать пропорции'}
        </Button>
      </div>

      {/* ── Ширина ── */}
      <Row align="middle" gutter={6} style={{ marginBottom: 6 }}>
        <Col span={6}><Text style={{ fontSize: 13 }}>Ширина:</Text></Col>
        <Col span={11}>
          <Slider min={5} max={50} value={gridCols} onChange={handleColsChange} tooltip={{ formatter: v => `${v} кл.` }} />
        </Col>
        <Col span={5}>
          <InputNumber min={5} max={50} value={gridCols} onChange={handleColsChange} size="small" style={{ width: '100%' }} />
        </Col>
        <Col span={2}><Text type="secondary" style={{ fontSize: 11 }}>кл.</Text></Col>
      </Row>

      {/* ── Высота ── */}
      <Row align="middle" gutter={6} style={{ marginBottom: 6 }}>
        <Col span={6}><Text style={{ fontSize: 13 }}>Высота:</Text></Col>
        <Col span={11}>
          <Slider min={5} max={50} value={gridRows} onChange={handleRowsChange} tooltip={{ formatter: v => `${v} кл.` }} />
        </Col>
        <Col span={5}>
          <InputNumber min={5} max={50} value={gridRows} onChange={handleRowsChange} size="small" style={{ width: '100%' }} />
        </Col>
        <Col span={2}><Text type="secondary" style={{ fontSize: 11 }}>кл.</Text></Col>
      </Row>

      {/* ── Порог яркости ── */}
      <Row align="middle" gutter={6} style={{ marginBottom: 12 }}>
        <Col span={6}><Text style={{ fontSize: 13 }}>Порог:</Text></Col>
        <Col span={11}>
          <Slider min={50} max={220} value={threshold} onChange={onThresholdChange} />
        </Col>
        <Col span={5}>
          <InputNumber min={50} max={220} value={threshold} onChange={onThresholdChange} size="small" style={{ width: '100%' }} />
        </Col>
        <Col span={2}></Col>
      </Row>

      {/* ── Размер клетки ── */}
      <div style={{ marginBottom: 10 }}>
        <Text
          type={tooTiny ? 'danger' : tooSmall ? 'warning' : 'secondary'}
          style={{ fontSize: 12 }}
        >
          Размер клетки на листе: <b>{cellMm.toFixed(1)} мм × {cellMm.toFixed(1)} мм</b>
          {tooTiny && ' — слишком мелко!'}
          {!tooTiny && tooSmall && ' — мелковато'}
          {!tooSmall && ' ✓'}
        </Text>
      </div>

      {tooSmall && !tooTiny && (
        <Alert
          type="warning"
          message={`Клетки ${cellMm.toFixed(1)} мм — ученикам может быть неудобно закрашивать. Уменьшите сетку или включите режим «Два листа».`}
          style={{ marginBottom: 10 }}
          showIcon
        />
      )}
      {tooTiny && (
        <Alert
          type="error"
          message={`Клетки ${cellMm.toFixed(1)} мм — слишком мелко для заполнения карандашом. Уменьшите количество клеток.`}
          style={{ marginBottom: 10 }}
          showIcon
        />
      )}

      <Button
        type="primary"
        onClick={onApply}
        loading={processing}
        block
        disabled={!processing && false}
      >
        Пересчитать
      </Button>
    </div>
  );
}
