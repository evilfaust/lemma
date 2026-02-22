import { Button, Empty, List, Modal, Space, Spin } from 'antd';
import { DeleteOutlined, FolderOpenOutlined } from '@ant-design/icons';

const LoadGeometryPrintModal = ({
  visible,
  onCancel,
  tests = [],
  loading = false,
  onLoad,
  onDelete,
}) => {
  return (
    <Modal
      title={(
        <Space>
          <FolderOpenOutlined />
          <span>Сохранённые листы A5</span>
        </Space>
      )}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={820}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 30 }}>
          <Spin tip="Загружаем листы..." />
        </div>
      ) : tests.length === 0 ? (
        <Empty description="Пока нет сохранённых листов" style={{ padding: 30 }} />
      ) : (
        <List
          size="small"
          dataSource={tests}
          renderItem={(test) => {
            const tasksCount = Array.isArray(test.tasks) ? test.tasks.length : 0;
            return (
              <List.Item
                style={{ padding: '10px 0' }}
                actions={[
                  <Button
                    key="open"
                    type="primary"
                    size="small"
                    icon={<FolderOpenOutlined />}
                    onClick={() => onLoad(test.id)}
                  >
                    Открыть
                  </Button>,
                  <Button
                    key="delete"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(test.id, test.title)}
                  >
                    Удалить
                  </Button>,
                ]}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.2 }}>
                    {test.title || 'Лист без названия'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, color: '#666', fontSize: 12, flexWrap: 'wrap' }}>
                    <span>Создан: {new Date(test.created).toLocaleDateString('ru-RU')}</span>
                    <span>• Формат: {test.page_size || 'A5'}</span>
                    <span>• Задач: {tasksCount}</span>
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      )}
    </Modal>
  );
};

export default LoadGeometryPrintModal;
