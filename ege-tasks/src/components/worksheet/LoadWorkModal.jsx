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
          dataSource={works}
          renderItem={work => (
            <List.Item
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
              <List.Item.Meta
                title={
                  <Space>
                    <span style={{ fontWeight: 600, fontSize: 16 }}>{work.title}</span>
                    {work.time_limit && <Tag color="green">{work.time_limit} мин</Tag>}
                    {work.expand?.topic && (
                      <Tag color="purple">
                        №{work.expand.topic.ege_number} - {work.expand.topic.title}
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <Space style={{ color: '#666', fontSize: 12 }}>
                    <span>
                      Создана: {new Date(work.created).toLocaleDateString('ru-RU')}
                    </span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
};

export default LoadWorkModal;
