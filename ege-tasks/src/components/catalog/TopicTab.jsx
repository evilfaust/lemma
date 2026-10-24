import { useEffect, useState } from 'react';
import { Card, Table, Space, Button, Modal, Form, Input, InputNumber, Select, Switch, Tag, Tooltip, App } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SwapOutlined, FolderOpenOutlined } from '@ant-design/icons';

const EXAM_TYPE_OPTIONS = [
  { value: 'ege_base',    label: 'ЕГЭ базовый (11 кл.)' },
  { value: 'ege_profile', label: 'ЕГЭ профильный (11 кл.)' },
  { value: 'oge',         label: 'ОГЭ (9 кл.)' },
  { value: 'vpr',         label: 'ВПР' },
  { value: 'oral',        label: 'Устный счёт' },
  { value: 'trig',        label: 'Тригонометрия' },
  { value: 'mordkovich',  label: 'Мордкович' },
  { value: 'other',       label: 'Прочее' },
];
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/pocketbase';
import { topicPrefix, PREFIX_PATTERN } from '../../utils/taskCode';

export default function TopicTab({ topicRows, tasksSnapshot, onOpenTasks, onMerge, onReload }) {
  const { topics, reloadData } = useReferenceData();
  const { canEdit, canDelete } = useAuth();
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form] = Form.useForm();

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(topicRows.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [topicRows.length, pageSize, currentPage]);

  const openModal = (topic = null) => {
    setEditing(topic);
    setModalOpen(true);
    form.setFieldsValue({
      title:       topic?.title       || '',
      ege_number:  topic?.ege_number  || null,
      exam_type:   topic?.exam_type   || null,
      exam_part:   topic?.exam_part   || null,
      order:       topic?.order       || null,
      archived:    topic?.archived    || false,
      code_prefix: topic?.code_prefix || '',
      description: topic?.description || '',
    });
  };

  // Какой префикс кодов получит тема с тем, что сейчас в форме (v3.9.397).
  const wExam = Form.useWatch('exam_type', form);
  const wNumber = Form.useWatch('ege_number', form);
  const wArchived = Form.useWatch('archived', form);
  const wPrefix = Form.useWatch('code_prefix', form);
  const formPrefix = topicPrefix({
    id: editing?.id, exam_type: wExam, ege_number: wNumber, archived: wArchived, code_prefix: wPrefix,
  });

  const save = async (values) => {
    values = { ...values, code_prefix: String(values.code_prefix || '').trim().toUpperCase() };
    try {
      if (editing) {
        await api.updateTopic(editing.id, values);
        message.success('Тема обновлена');
      } else {
        await api.createTopic(values);
        message.success('Тема создана');
      }
      setModalOpen(false);
      setEditing(null);
      reloadData();
    } catch (error) {
      const notUnique = error?.response?.data?.code_prefix?.code === 'validation_not_unique';
      message.error(notUnique ? 'Такой префикс кода уже у другой темы' : 'Ошибка при сохранении темы');
    }
  };

  const remove = (topic) => {
    Modal.confirm({
      title: 'Удалить тему?',
      content: `Тема "${topic.title}" будет удалена. Связанные задачи останутся, но без темы.`,
      okType: 'danger',
      onOk: async () => {
        try {
          const related = tasksSnapshot.filter(t => t.topic === topic.id);
          for (const task of related) {
            await api.updateTask(task.id, { topic: null, subtopic: [] });
          }
          await api.deleteTopic(topic.id);
          message.success('Тема удалена');
          reloadData();
          onReload();
        } catch (error) {
          message.error('Ошибка при удалении темы');
        }
      },
    });
  };

  return (
    <>
      <Card
        title="Темы"
        extra={canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Добавить тему</Button>}
      >
        <Table
          size="small"
          dataSource={topicRows}
          pagination={{
            current: currentPage,
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
          columns={[
            { title: '№', dataIndex: 'ege', width: 60, sorter: (a, b) => (a.ege || 0) - (b.ege || 0) },
            {
              title: 'Тема',
              dataIndex: 'title',
              sorter: (a, b) => (a.title || '').localeCompare(b.title || ''),
              render: (title, record) => (
                <Space size={6}>
                  <span>{title}</span>
                  {record.raw?.archived && (
                    <Tooltip title="Задание убрано из экзамена: задачи доступны, но в полный вариант тема не попадает">
                      <Tag color="default">архив</Tag>
                    </Tooltip>
                  )}
                </Space>
              ),
            },
            {
              title: 'Код',
              key: 'prefix',
              width: 90,
              sorter: (a, b) => topicPrefix(a.raw).localeCompare(topicPrefix(b.raw), 'ru', { numeric: true }),
              render: (_, record) => {
                const p = topicPrefix(record.raw);
                return p
                  ? <Tag style={{ fontFamily: 'monospace' }}>{p}-…</Tag>
                  : <Tooltip title="Тема кодов не раздаёт: код задачи вводится руками (Гордин, смешанные темы)"><span style={{ color: '#999' }}>—</span></Tooltip>;
              },
            },
            { title: 'Порядок', dataIndex: 'order', width: 90, sorter: (a, b) => (a.order || 0) - (b.order || 0) },
            { title: 'Кол-во', dataIndex: 'count', width: 90, sorter: (a, b) => a.count - b.count },
            {
              title: 'Действия',
              width: 260,
              render: (_, record) => (
                <Space>
                  <Tooltip title="Открыть задачи">
                    <Button size="small" icon={<FolderOpenOutlined />} onClick={() => onOpenTasks({ topic: record.key })} />
                  </Tooltip>
                  {canEdit && <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record.raw)} />}
                  {canEdit && <Button size="small" icon={<SwapOutlined />} onClick={() => onMerge('topic', record.raw)} />}
                  {canDelete && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(record.raw)} />}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? 'Редактировать тему' : 'Создать тему'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="exam_type" label="Контекст (тип экзамена)">
            <Select placeholder="Не указан" allowClear options={EXAM_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="ege_number" label="Номер задания в экзамене">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="exam_part" label="Часть экзамена (для профильного ЕГЭ: 1 или 2)">
            <InputNumber min={1} max={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="order" label="Порядок сортировки">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="archived"
            label="Архивная тема"
            valuePropName="checked"
            tooltip="Задание убрали из экзамена. Задачи остаются в каталоге и в генераторе листов, но в сборку полного варианта тема не идёт"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="code_prefix"
            label="Префикс кода задач"
            tooltip="У тем экзамена оставьте пустым — префикс считается сам: П12 (профиль №12), Б5 (база), ОГ3 (ОГЭ), ПА12 (архив). Для остальных тем — 2–4 буквы (КУ, ПЛ, И11). Новая тема без номера получит префикс по первым буквам названия. Смена префикса не перенумеровывает уже созданные задачи."
            normalize={(v) => String(v || '').toUpperCase()}
            rules={[{
              validator: (_, v) => (!v || PREFIX_PATTERN.test(v)
                ? Promise.resolve()
                : Promise.reject(new Error('Заглавные буквы, цифры и точка, до 16 знаков'))),
            }]}
            extra={formPrefix ? `Коды задач: ${formPrefix}-001, ${formPrefix}-002…` : 'Префикс подберётся по названию при создании'}
          >
            <Input placeholder="авто" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
