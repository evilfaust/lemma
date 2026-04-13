import { useEffect, useRef, useState } from 'react';
import { Modal, List, Button, Spin, Empty, Popconfirm, Typography, Input, Space } from 'antd';
import { DeleteOutlined, CheckOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * Мини-превью пиксельной матрицы на canvas.
 */
function MatrixCanvas({ matrix, size = 80 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!matrix || !ref.current) return;
    const rows = matrix.length;
    const cols = matrix[0]?.length || 0;
    if (!rows || !cols) return;

    const canvas = ref.current;
    const cellPx = Math.max(1, Math.floor(size / Math.max(cols, rows)));
    canvas.width = cols * cellPx;
    canvas.height = rows * cellPx;
    const ctx = canvas.getContext('2d');

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = matrix[r][c] ? '#1a1a1a' : '#f5f5f5';
        ctx.fillRect(c * cellPx, r * cellPx, cellPx, cellPx);
      }
    }
  }, [matrix, size]);

  return (
    <canvas
      ref={ref}
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 4,
        imageRendering: 'pixelated',
        display: 'block',
        maxWidth: size,
        maxHeight: size,
      }}
    />
  );
}

/**
 * Модал библиотеки пиксель-арт изображений.
 *
 * Props:
 *   open            — открыт ли модал
 *   onClose()       — закрыть
 *   images          — массив записей из pixel_art_images
 *   loading         — идёт загрузка списка
 *   onSelect(record)— выбрать изображение
 *   onDelete(id)    — удалить изображение
 *   onRename(id, newTitle) — переименовать
 */
export default function PixelArtImageLibraryModal({
  open,
  onClose,
  images,
  loading,
  onSelect,
  onDelete,
  onRename,
}) {
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const filtered = search.trim()
    ? images.filter(img => img.title?.toLowerCase().includes(search.trim().toLowerCase()))
    : images;

  const startRename = (img) => {
    setRenamingId(img.id);
    setRenameValue(img.title || '');
  };

  const commitRename = (id) => {
    if (renameValue.trim()) onRename(id, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <Modal
      title={`Библиотека картинок (${images.length})`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={680}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <div style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="Поиск по названию…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 320 }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : filtered.length === 0 ? (
        <Empty
          description={
            images.length === 0
              ? 'Библиотека пуста. Нарисуйте картинку и нажмите «Сохранить в библиотеку».'
              : 'Ничего не найдено'
          }
          style={{ padding: 40 }}
        />
      ) : (
        <List
          dataSource={filtered}
          renderItem={(img) => (
            <List.Item
              key={img.id}
              style={{ padding: '10px 0', gap: 12, alignItems: 'center' }}
              actions={[
                <Button
                  key="select"
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => onSelect(img)}
                >
                  Выбрать
                </Button>,
                <Popconfirm
                  key="delete"
                  title="Удалить из библиотеки?"
                  okText="Удалить"
                  cancelText="Отмена"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => onDelete(img.id)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
                {/* Превью */}
                <div style={{ flexShrink: 0 }}>
                  <MatrixCanvas matrix={img.matrix} size={80} />
                </div>

                {/* Мета */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {renamingId === img.id ? (
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        size="small"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onPressEnter={() => commitRename(img.id)}
                        autoFocus
                        style={{ maxWidth: 200 }}
                      />
                      <Button size="small" type="primary" onClick={() => commitRename(img.id)}>
                        ОК
                      </Button>
                      <Button size="small" onClick={() => setRenamingId(null)}>
                        ✕
                      </Button>
                    </Space.Compact>
                  ) : (
                    <div
                      style={{ fontWeight: 500, cursor: 'pointer', marginBottom: 2 }}
                      title="Дважды кликните для переименования"
                      onDoubleClick={() => startRename(img)}
                    >
                      {img.title || 'Без названия'}
                    </div>
                  )}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {img.grid_cols}×{img.grid_rows}
                    {img.threshold != null ? ` · порог ${img.threshold}` : ''}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {new Date(img.created).toLocaleDateString('ru-RU')}
                  </Text>
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
}
