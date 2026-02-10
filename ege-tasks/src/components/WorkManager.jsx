import { useState, useEffect, useCallback } from 'react';
import { Card, List, Button, Tag, Empty, Spin, Modal, Space, Typography, Collapse, Tabs, App } from 'antd';
import { DeleteOutlined, SendOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { api } from '../services/pocketbase';
import SessionPanel from './worksheet/SessionPanel';
import MathRenderer from './MathRenderer';

const { Text, Title } = Typography;

/**
 * Страница «Мои работы» — список сохранённых работ с выдачей и статистикой.
 */
const WorkManager = () => {
  const { message } = App.useApp();
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeWork, setActiveWork] = useState(null); // ID работы, для которой открыта панель выдачи
  const [previewWork, setPreviewWork] = useState(null); // Работа для просмотра
  const [previewVariants, setPreviewVariants] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getWorks();
      setWorks(data);
    } catch (err) {
      console.error('Error loading works:', err);
      message.error('Ошибка загрузки работ');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadWorks();
  }, [loadWorks]);

  const handleDelete = (workId, workTitle) => {
    Modal.confirm({
      title: 'Удалить работу?',
      content: `Вы уверены, что хотите удалить работу «${workTitle}»? Все варианты, сессии и результаты учеников будут удалены.`,
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.deleteWork(workId);
          setWorks(prev => prev.filter(w => w.id !== workId));
          if (activeWork === workId) setActiveWork(null);
          message.success(`Работа «${workTitle}» удалена`);
        } catch (err) {
          message.error('Ошибка при удалении');
        }
      },
    });
  };

  const toggleSession = (workId) => {
    setActiveWork(prev => prev === workId ? null : workId);
  };

  const openPreview = async (work) => {
    setPreviewWork(work);
    setPreviewLoading(true);
    try {
      const variants = await api.getVariantsByWork(work.id);
      setPreviewVariants(variants);
    } catch (err) {
      console.error('Error loading variants:', err);
      message.error('Ошибка загрузки вариантов');
    }
    setPreviewLoading(false);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text type="secondary">Всего работ: {works.length}</Text>
        <Button icon={<ReloadOutlined />} onClick={loadWorks}>Обновить</Button>
      </div>

      {works.length === 0 ? (
        <Empty
          description="Нет сохранённых работ"
          style={{ padding: 60 }}
        >
          <Text type="secondary">
            Создайте контрольную работу в разделе «Контрольные работы» и сохраните её
          </Text>
        </Empty>
      ) : (
        <List
          dataSource={works}
          renderItem={work => (
            <Card
              size="small"
              style={{ marginBottom: 12 }}
              styles={{ body: { padding: activeWork === work.id ? '12px 16px' : '12px 16px' } }}
            >
              {/* Заголовок работы */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                    {work.title}
                  </div>
                  <Space size={8} wrap>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(work.created).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                    {work.time_limit && (
                      <Tag>{work.time_limit} мин</Tag>
                    )}
                    {work.expand?.topic && (
                      <Tag color="purple">
                        №{work.expand.topic.ege_number} — {work.expand.topic.title}
                      </Tag>
                    )}
                  </Space>
                </div>

                <Space>
                  <Button
                    icon={<EyeOutlined />}
                    onClick={() => openPreview(work)}
                  >
                    Просмотр
                  </Button>
                  <Button
                    type={activeWork === work.id ? 'primary' : 'default'}
                    icon={<SendOutlined />}
                    onClick={() => toggleSession(work.id)}
                  >
                    {activeWork === work.id ? 'Скрыть' : 'Выдать'}
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(work.id, work.title)}
                  />
                </Space>
              </div>

              {/* Панель выдачи + результаты */}
              {activeWork === work.id && (
                <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                  <SessionPanel workId={work.id} />
                </div>
              )}
            </Card>
          )}
        />
      )}
      {/* Модальное окно просмотра работы */}
      <Modal
        title={previewWork?.title || 'Просмотр работы'}
        open={!!previewWork}
        onCancel={() => { setPreviewWork(null); setPreviewVariants([]); }}
        footer={null}
        width={800}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        {previewLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
        ) : previewVariants.length === 0 ? (
          <Empty description="Нет вариантов" />
        ) : (
          <Tabs
            items={previewVariants.map((variant, idx) => ({
              key: variant.id,
              label: `Вариант ${variant.number || idx + 1}`,
              children: (
                <div>
                  {(variant.expand?.tasks || []).map((task, tIdx) => (
                    <div key={task.id} style={{ marginBottom: 16, padding: '8px 12px', background: '#fafafa', borderRadius: 8 }}>
                      <Text strong style={{ marginRight: 8 }}>Задача {tIdx + 1}</Text>
                      {task.code && <Tag>{task.code}</Tag>}
                      {task.difficulty && (
                        <Tag color={
                          { 1: 'green', 2: 'blue', 3: 'orange', 4: 'red', 5: 'purple' }[task.difficulty] || 'default'
                        }>
                          {{ 1: 'Базовый', 2: 'Средний', 3: 'Повышенный', 4: 'Высокий', 5: 'Олимпиадный' }[task.difficulty] || `Ур.${task.difficulty}`}
                        </Tag>
                      )}
                      <div style={{ marginTop: 8 }}>
                        <MathRenderer text={task.statement_md} />
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary">Ответ: </Text>
                        <MathRenderer text={task.answer} />
                      </div>
                    </div>
                  ))}
                </div>
              ),
            }))}
          />
        )}
      </Modal>
    </div>
  );
};

export default WorkManager;
