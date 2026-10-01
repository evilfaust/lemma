import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, App, Button, Card, Collapse, Empty, Input, Modal, Popconfirm, Select, Space, Table, Tooltip, Typography,
} from 'antd';
import {
  CopyOutlined, DeleteOutlined, FileAddOutlined, FolderOpenOutlined, SearchOutlined,
} from '@ant-design/icons';
import { api } from '../../../shared/services/pocketbase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  normalizeStructure, rowCount, structureFromPrintTest,
} from '../../../utils/geometryWork';
import GeometryBasketBar from '../GeometryBasketBar';
import { useGeometryRefs } from '../../../hooks/useGeometryRefs';
import { CreateGeometryWorkModal } from './GeometryWorkModals';

const { Text } = Typography;

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('ru-RU') : '');

/**
 * Работы раздела «Геометрия» (GEOMETRY_TASKS_PLAN.md § 4): список, создание
 * (пустая / из подборки / из темы), перенос старых листов A5.
 */
export default function GeometryWorksPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { canEdit, canDelete } = useAuth();
  const [works, setWorks] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createFrom, setCreateFrom] = useState({ ids: [], title: '' });
  const [topicOpen, setTopicOpen] = useState(false);
  const { topics } = useGeometryRefs(['topics']);
  const [topicId, setTopicId] = useState(null);
  const [topicLoading, setTopicLoading] = useState(false);
  const [printTests, setPrintTests] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setWorks(await api.getGeometryWorks());
      setLoadError(null);
    } catch (e) {
      setWorks([]);
      setLoadError(e?.status === 404
        ? 'Коллекции работ ещё нет — нужна миграция базы 1787300000'
        : 'Не удалось загрузить работы');
    }
  }, []);

  useEffect(() => {
    load();
    api.getGeometryPrintTests().then(setPrintTests).catch(() => {});
  }, [load]);

  const openCreate = (ids = [], title = '') => {
    setCreateFrom({ ids, title });
    setCreateOpen(true);
  };

  const handleCreated = (rec) => {
    setCreateOpen(false);
    navigate(`/app/geometry/works/${rec.id}`);
  };

  // «Работа из темы» — так переезжают темы-работы («Экзамен 7 кл», «ВПР»…)
  const createFromTopic = async () => {
    if (!topicId) return;
    setTopicLoading(true);
    try {
      const tasks = await api.getGeometryTasks({ topic: topicId, origin: 'all' });
      if (!tasks.length) {
        message.warning('В теме нет задач');
        return;
      }
      const ids = [...tasks].sort((a, b) => String(a.code).localeCompare(String(b.code), 'ru', { numeric: true })).map((t) => t.id);
      setTopicOpen(false);
      openCreate(ids, topics.find((t) => t.id === topicId)?.title || '');
    } finally {
      setTopicLoading(false);
    }
  };

  const fromPrintTest = async (test) => {
    setBusy(`pt-${test.id}`);
    try {
      const rec = await api.createGeometryWork({
        title: test.title || 'Лист A5',
        structure: structureFromPrintTest(test),
        print: { from_print_test: test.id, page_size: test.page_size, tasks_per_page: test.tasks_per_page },
      });
      message.success('Лист перенесён в работы');
      navigate(`/app/geometry/works/${rec.id}`);
    } catch (e) {
      message.error(`Не удалось перенести: ${e?.message || 'ошибка'}`);
    } finally {
      setBusy(null);
    }
  };

  const duplicate = async (w) => {
    setBusy(`dup-${w.id}`);
    try {
      const full = await api.getGeometryWork(w.id);
      await api.createGeometryWork({
        title: `${full.title} (копия)`,
        class: full.class || null,
        note: full.note || '',
        structure: full.structure,
        print: full.print || null,
      });
      message.success('Копия создана');
      load();
    } catch {
      message.error('Не удалось скопировать работу');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (w) => {
    try {
      await api.deleteGeometryWork(w.id);
      message.success('Работа удалена');
      load();
    } catch {
      message.error('Не удалось удалить работу');
    }
  };

  const convertedFrom = useMemo(() => {
    const m = new Map();
    for (const w of works || []) {
      const pid = w.print?.from_print_test;
      if (pid) m.set(pid, w.id);
    }
    return m;
  }, [works]);

  const shown = (works || []).filter((w) => !search.trim()
    || String(w.title).toLowerCase().includes(search.trim().toLowerCase()));

  const columns = [
    {
      title: 'Работа',
      key: 'title',
      render: (_, w) => (
        <Space direction="vertical" size={0}>
          <a onClick={() => navigate(`/app/geometry/works/${w.id}`)} style={{ fontWeight: 600 }}>{w.title}</a>
          {w.note && <Text type="secondary" style={{ fontSize: 12 }}>{w.note}</Text>}
        </Space>
      ),
    },
    { title: 'Класс', dataIndex: 'class', key: 'class', width: 80, render: (c) => c || '—' },
    {
      title: 'Состав',
      key: 'size',
      width: 170,
      render: (_, w) => {
        const s = normalizeStructure(w.structure);
        return `${rowCount(s)} задач · ${s.variants.length} вар.`;
      },
    },
    { title: 'Изменена', dataIndex: 'updated', key: 'updated', width: 110, render: fmtDate },
    {
      title: '',
      key: 'actions',
      width: 110,
      align: 'right',
      render: (_, w) => (
        <Space size={2}>
          <Tooltip title="Открыть">
            <Button type="text" size="small" icon={<FolderOpenOutlined />} onClick={() => navigate(`/app/geometry/works/${w.id}`)} />
          </Tooltip>
          {canEdit && (
            <Tooltip title="Копия">
              <Button type="text" size="small" icon={<CopyOutlined />} loading={busy === `dup-${w.id}`} onClick={() => duplicate(w)} />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm title="Удалить работу?" description="Задачи останутся в банке." okText="Удалить" cancelText="Нет"
              okButtonProps={{ danger: true }} onConfirm={() => remove(w)}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Поиск по названию"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: '1 1 240px' }}
          />
          {canEdit && (
            <>
              <Button onClick={() => { setTopicId(null); setTopicOpen(true); }}>Работа из темы…</Button>
              <Button type="primary" icon={<FileAddOutlined />} onClick={() => openCreate()}>Новая работа</Button>
            </>
          )}
        </div>
        <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          Задачи в работу удобнее всего собирать подборкой: в{' '}
          <a onClick={() => navigate('/app/geometry/tasks')}>банке задач</a> — «В подборку» у строки или в карточке,
          затем «Создать работу» на плашке внизу.
        </Text>
      </Card>

      {loadError && <Alert type="error" showIcon message={loadError} />}

      <Table
        rowKey="id"
        size="small"
        loading={works === null}
        dataSource={shown}
        columns={columns}
        pagination={{ defaultPageSize: 20, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="Работ пока нет" /> }}
        onRow={(w) => ({
          onDoubleClick: () => navigate(`/app/geometry/works/${w.id}`),
        })}
      />

      {canEdit && printTests.length > 0 && (
        <Collapse
          size="small"
          items={[{
            key: 'old',
            label: `Старые листы A5 (${printTests.length}) — перенести в работы`,
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                {printTests.map((t) => {
                  const done = convertedFrom.get(t.id);
                  const n = (t.task_order?.length || t.tasks?.length || 0);
                  return (
                    <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Text style={{ flex: 1 }}>{t.title || 'без названия'} <Text type="secondary">· {n} задач · {fmtDate(t.created)}</Text></Text>
                      {done ? (
                        <Button size="small" onClick={() => navigate(`/app/geometry/works/${done}`)}>Уже перенесён — открыть</Button>
                      ) : (
                        <Button size="small" loading={busy === `pt-${t.id}`} onClick={() => fromPrintTest(t)}>Сделать работой</Button>
                      )}
                    </div>
                  );
                })}
              </Space>
            ),
          }]}
        />
      )}

      {canEdit && <GeometryBasketBar />}

      <CreateGeometryWorkModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        taskIds={createFrom.ids}
        initialTitle={createFrom.title}
        onCreated={handleCreated}
      />

      <Modal
        title="Работа из темы"
        open={topicOpen}
        onCancel={() => setTopicOpen(false)}
        onOk={createFromTopic}
        okText="Дальше"
        cancelText="Отмена"
        okButtonProps={{ disabled: !topicId }}
        confirmLoading={topicLoading}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Тема своих задач"
            style={{ width: '100%' }}
            value={topicId}
            onChange={setTopicId}
            options={topics.map((t) => ({ value: t.id, label: t.title }))}
          />
          <Text type="secondary">
            Все задачи темы станут позициями работы (по порядку кодов). Так переносятся темы,
            заведённые вместо работ: «Экзамен 7 кл», «ВПР», «Каникулярное ДЗ». Сама тема и задачи не меняются.
          </Text>
        </Space>
      </Modal>
    </Space>
  );
}
