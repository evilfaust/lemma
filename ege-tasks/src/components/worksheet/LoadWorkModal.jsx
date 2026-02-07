import { Modal, Button, Space, Spin, Empty, List, Tag } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';

/**
 * Модальное окно загрузки сохранённых работ.
 *
 * @param {boolean} visible - видимость модалки
 * @param {Function} onCancel - закрытие модалки
 * @param {Array} works - список сохранённых работ
 * @param {boolean} loading - индикатор загрузки
 * @param {Function} onLoad - загрузка работы (workId) => void
 * @param {Function} onDelete - удаление работы (workId, workTitle) => void
 */
const LoadWorkModal = ({
  visible,
  onCancel,
  works = [],
  loading = false,
  onLoad,
  onDelete,
}) => {
  return (
    <Modal
      title={
        <Space>
          <FolderOpenOutlined />
          <span>Сохранённые работы</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 30 }}>
          <Spin tip="Загружаем работы..." />
        </div>
      ) : works.length === 0 ? (
        <Empty description="Нет сохранённых работ" style={{ padding: 30 }} />
      ) : (
        <List
          size="small"
          dataSource={works}
          renderItem={work => (
            <List.Item
              style={{ padding: '10px 0' }}
              actions={[
                <Button
                  type="primary"
                  size="small"
                  icon={<FolderOpenOutlined />}
                  onClick={() => onLoad(work.id)}
                >
                  Открыть
                </Button>,
                <Button
                  danger
                  size="small"
                  onClick={() => {
                    Modal.confirm({
                      title: 'Удалить работу?',
                      content: `Вы уверены, что хотите удалить работу "${work.title}"?`,
                      okText: 'Удалить',
                      okType: 'danger',
                      cancelText: 'Отмена',
                      onOk: () => onDelete(work.id, work.title),
                    });
                  }}
                >
                  Удалить
                </Button>,
              ]}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.2 }}>
                  {work.title}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, color: '#666', fontSize: 12 }}>
                  <span>
                    Создана: {new Date(work.created).toLocaleDateString('ru-RU')}
                  </span>
                  {work.time_limit && <span>• {work.time_limit} мин</span>}
                  {work.expand?.topic && (
                    <Tag color="purple" style={{ marginInlineEnd: 0 }}>
                      №{work.expand.topic.ege_number} - {work.expand.topic.title}
                    </Tag>
                  )}
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
};

export default LoadWorkModal;
