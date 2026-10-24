import { useState } from 'react';
import {
  App, Button, Checkbox, Modal, Progress, Select, Space, Tag, Typography,
} from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/pocketbase';
import { useGeometryRefs } from '../../hooks/useGeometryRefs';
import { TOPIC_SELECT } from '../shared/topicSelect';

const { Text, Title } = Typography;

const codesText = (list, key) => list.map((x) => x[key]).filter(Boolean).join(', ');

/**
 * Массовый перенос выбранных задач банка в раздел «Геометрия»
 * (блок панели «Изменить атрибуты» в `TaskList`). Логика —
 * `api.copyTasksToGeometry` + `utils/taskToGeometry.js`.
 *
 * По умолчанию задачи КОПИРУЮТСЯ. «Убрать из банка задач» удаляет только
 * исходники, которые нигде не используются: необязательные связи PocketBase
 * при удалении чистит молча (задача пропала бы из работы), а пункты листков
 * удаляет каскадом.
 */
export default function BulkToGeometry({ taskIds = [], canDelete = false, busy = false, onDone }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { topics, subtopics, loading: refsLoading } = useGeometryRefs(['topics', 'subtopics']);
  const [topic, setTopic] = useState(null);
  const [subtopic, setSubtopic] = useState(null);
  const [deleteSource, setDeleteSource] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [report, setReport] = useState(null);

  const count = taskIds.length;

  const run = async () => {
    setRunning(true);
    setProgress({ done: 0, total: count });
    try {
      const res = await api.copyTasksToGeometry(taskIds, {
        topic: topic || undefined,
        subtopic: subtopic || undefined,
        deleteSource: deleteSource && canDelete,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setReport({ ...res, deleteSource: deleteSource && canDelete });
      onDone?.(res);
    } catch (error) {
      console.error('Bulk copy to geometry error:', error);
      message.error('Не удалось перенести задачи в геометрию');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const confirm = () => {
    if (!count) { message.warning('Выберите задачи'); return; }
    Modal.confirm({
      title: `Перенести ${count} задач(и) в геометрию?`,
      content: deleteSource && canDelete
        ? 'Задачи появятся в разделе «Геометрия» (Мои задачи). Исходные удалятся из банка, кроме тех, что используются в работах, листках, тестах или уже имеют ответы учеников.'
        : 'В разделе «Геометрия» (Мои задачи) появятся копии; задачи в банке останутся на месте. Задачи, которые уже есть в геометрии, второй раз не копируются.',
      okText: 'Перенести',
      cancelText: 'Отмена',
      onOk: run,
    });
  };

  return (
    <>
      <Title level={5}>Перенести в геометрию</Title>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Select
          placeholder="Тема геометрии (необязательно)…"
          value={topic}
          onChange={(v) => { setTopic(v ?? null); setSubtopic(null); }}
          style={{ width: '100%' }}
          options={topics.map((t) => ({ label: t.title, value: t.id }))}
          loading={refsLoading.topics}
          disabled={running || busy}
          showSearch
          optionFilterProp="label"
          allowClear
          {...TOPIC_SELECT}
        />
        <Select
          placeholder={topic ? 'Подтема (необязательно)…' : 'Сначала тема'}
          value={subtopic}
          onChange={(v) => setSubtopic(v ?? null)}
          style={{ width: '100%' }}
          options={subtopics
            .filter((s) => s.topic === topic)
            .map((s) => ({ label: s.title, value: s.id }))}
          disabled={running || busy || !topic}
          showSearch
          optionFilterProp="label"
          allowClear
          {...TOPIC_SELECT}
        />
        {canDelete && (
          <Checkbox
            checked={deleteSource}
            onChange={(e) => setDeleteSource(e.target.checked)}
            disabled={running || busy}
          >
            Убрать из банка задач (только неиспользуемые)
          </Checkbox>
        )}
        <Button
          block
          icon={<ExportOutlined />}
          onClick={confirm}
          loading={running}
          disabled={busy || !count}
        >
          В геометрию {count ? `${count} задач(и)` : ''}
        </Button>
        {progress && (
          <Progress percent={progress.total ? Math.round((progress.done / progress.total) * 100) : 0} size="small" />
        )}
        <Text type="secondary" style={{ fontSize: 12 }}>
          Условие, ответ, решение и чертёж копируются в «Мои задачи» раздела «Геометрия»
          с новыми кодами GEO-…; раздел (планиметрия/стереометрия) угадывается по тексту.
        </Text>
      </Space>

      <Modal
        open={Boolean(report)}
        title="Перенос в геометрию"
        onCancel={() => setReport(null)}
        footer={[
          <Button key="close" onClick={() => setReport(null)}>Закрыть</Button>,
          <Button
            key="open"
            type="primary"
            disabled={!report?.created?.length && !report?.skipped?.length}
            onClick={() => { setReport(null); navigate('/app/geometry/tasks'); }}
          >
            Открыть банк геометрии
          </Button>,
        ]}
      >
        {report && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Tag color="green">Создано: {report.created.length}</Tag>
              {report.skipped.length > 0 && <Tag>Уже были: {report.skipped.length}</Tag>}
              {report.failed.length > 0 && <Tag color="red">Ошибки: {report.failed.length}</Tag>}
              {report.deleteSource && <Tag color="blue">Удалено из банка: {report.deleted.length}</Tag>}
            </div>
            {report.created.length > 0 && (
              <Text>
                Новые задачи: {codesText(report.created, 'geoCode')}
              </Text>
            )}
            {report.created.some((c) => c.noDrawing) && (
              <Text type="warning">
                Без чертежа (картинку не удалось скачать): {codesText(report.created.filter((c) => c.noDrawing), 'geoCode')}
              </Text>
            )}
            {report.skipped.length > 0 && (
              <Text type="secondary">
                Уже есть в геометрии: {report.skipped.map((s) => `${s.taskCode} → ${s.geoCode}`).join(', ')}
              </Text>
            )}
            {report.failed.length > 0 && (
              <Text type="danger">Не перенесены: {codesText(report.failed, 'taskCode')}</Text>
            )}
            {report.deleteSource && report.kept.length > 0 && (
              <div>
                <Text strong>Остались в банке задач:</Text>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {report.kept.map((k) => (
                    <li key={`${k.taskCode}-${k.reason}`}>
                      <Text>{k.taskCode}</Text> <Text type="secondary">— {k.reason}</Text>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Space>
        )}
      </Modal>
    </>
  );
}
