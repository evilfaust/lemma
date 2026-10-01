import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, FileAddOutlined, PlusSquareOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useGeometryBasket } from '../../hooks/useGeometryBasket';
import { CreateGeometryWorkModal, AddToGeometryWorkModal } from './works/GeometryWorkModals';

const { Text } = Typography;
const SHOWN = 12;

/**
 * Плашка «Подборка» внизу страниц раздела «Геометрия» (GEOMETRY_TASKS_PLAN.md § 4):
 * задачи, отобранные из банка/поиска/карточки, → новая работа или новые
 * позиции существующей. Пустая подборка плашку не показывает.
 *
 * @param {function} [onOpenTask] — (id) открыть карточку задачи по клику на код
 */
export default function GeometryBasketBar({ onOpenTask }) {
  const navigate = useNavigate();
  const basket = useGeometryBasket();
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const ids = basket.items.map((x) => x.id);

  if (!basket.items.length && !createOpen && !addOpen) return null;

  const openWork = (rec) => {
    basket.clear();
    setCreateOpen(false);
    setAddOpen(false);
    navigate(`/app/geometry/works/${rec.id}`);
  };

  return (
    <>
      {basket.items.length > 0 && (
        <div
          style={{
            position: 'sticky', bottom: 0, zIndex: 20, marginTop: 8,
            background: '#fff', border: '1px solid #d6e4ff', borderRadius: 10,
            boxShadow: '0 -4px 16px rgba(0,0,0,0.08)', padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}
        >
          <Space size={6}>
            <ShoppingOutlined style={{ color: '#1677ff', fontSize: 18 }} />
            <Text strong>Подборка: {basket.items.length}</Text>
          </Space>
          <div style={{ flex: 1, minWidth: 160, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {basket.items.slice(0, SHOWN).map((x) => (
              <Tag
                key={x.id}
                closable
                onClose={(e) => { e.preventDefault(); basket.remove(x.id); }}
                style={{ margin: 0, cursor: onOpenTask ? 'pointer' : 'default' }}
                onClick={onOpenTask ? () => onOpenTask(x.id) : undefined}
              >
                {x.code || x.id.slice(0, 6)}
              </Tag>
            ))}
            {basket.items.length > SHOWN && <Text type="secondary">и ещё {basket.items.length - SHOWN}</Text>}
          </div>
          <Space wrap>
            <Popconfirm title="Очистить подборку?" okText="Очистить" cancelText="Нет" onConfirm={basket.clear}>
              <Tooltip title="Очистить подборку">
                <Button icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
            <Button icon={<PlusSquareOutlined />} onClick={() => setAddOpen(true)}>
              В существующую работу
            </Button>
            <Button type="primary" icon={<FileAddOutlined />} onClick={() => setCreateOpen(true)}>
              Создать работу
            </Button>
          </Space>
        </div>
      )}

      <CreateGeometryWorkModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        taskIds={ids}
        onCreated={openWork}
      />
      <AddToGeometryWorkModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        taskIds={ids}
        onAdded={openWork}
      />
    </>
  );
}
