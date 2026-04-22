import { useState, useEffect, useCallback } from 'react';
import {
  Modal, Tabs, Form, Input, Select, Radio, Button,
  Space, List, Tag, Popconfirm, message, Spin, Empty, Divider,
} from 'antd';
import { SaveOutlined, PrinterOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import { buildOptions } from '../../utils/distractorGenerator';

const { Option } = Select;

const GENERATOR_LABELS = {
  trig_expressions:          'Вычисление выражений',
  trig_equations:            'Простейшие уравнения',
  inverse_trig:              'Обратные функции',
  double_angle:              'Двойной аргумент',
  trig_equations_advanced:   'Уравнения f(kx+b)=a',
};

function convertToMCVariants(tasksData, optionsCount) {
  return tasksData.map((variantTasks, i) => ({
    number: i + 1,
    tasks: variantTasks.map(task => ({
      question: task.exprLatex,
      answer:   task.resultLatex,
      options:  buildOptions(task.resultLatex, optionsCount),
    })),
  }));
}

function SaveTab({ tasksData, generatorType, generatorTitle, settings, onSaved }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldValue('title', generatorTitle || '');
  }, [generatorTitle, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    if (!tasksData?.length) {
      message.warning('Сначала сгенерируйте задания');
      return;
    }
    setSaving(true);
    try {
      const variants = convertToMCVariants(tasksData, values.optionsCount);
      const record = await api.createTrigMCTest({
        title:          values.title,
        class_number:   values.classNumber || null,
        generator_type: generatorType,
        options_count:  values.optionsCount,
        shuffle_mode:   values.shuffleMode,
        settings:       settings || {},
        variants,
      });
      message.success('Тест сохранён!');
      onSaved?.(record);
    } catch (e) {
      message.error('Ошибка сохранения: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const totalTasks = tasksData ? tasksData[0]?.length ?? 0 : 0;
  const variantsCount = tasksData?.length ?? 0;

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ optionsCount: 4, shuffleMode: 'fixed' }}
      style={{ paddingTop: 8 }}
    >
      <Form.Item
        name="title"
        label="Название теста"
        rules={[{ required: true, message: 'Введите название' }]}
      >
        <Input placeholder="Название теста" />
      </Form.Item>

      <Form.Item name="classNumber" label="Класс (необязательно)">
        <Select placeholder="Не указан" allowClear style={{ width: 120 }}>
          {Array.from({ length: 7 }, (_, i) => i + 5).map(n => (
            <Option key={n} value={n}>{n} класс</Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item name="optionsCount" label="Количество вариантов ответа">
        <Radio.Group>
          <Radio value={2}>2</Radio>
          <Radio value={3}>3</Radio>
          <Radio value={4}>4</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item name="shuffleMode" label="Порядок вариантов ответа">
        <Radio.Group>
          <Radio value="fixed">Фиксированный</Radio>
          <Radio value="per_student">Перемешать у каждого</Radio>
        </Radio.Group>
      </Form.Item>

      {tasksData ? (
        <div style={{
          background: '#f6f6f6', borderRadius: 6, padding: '8px 12px',
          fontSize: 13, color: '#555', marginBottom: 8,
        }}>
          Будет сохранено: <b>{variantsCount}</b> вариантов × <b>{totalTasks}</b> заданий
        </div>
      ) : (
        <div style={{ color: '#999', fontSize: 13, marginBottom: 8 }}>
          Задания не сгенерированы. Сначала нажмите «Сгенерировать» в генераторе.
        </div>
      )}

      <Button
        type="primary"
        icon={<SaveOutlined />}
        onClick={handleSave}
        loading={saving}
        disabled={!tasksData}
      >
        Сохранить тест
      </Button>
    </Form>
  );
}

function SavedTab({ generatorType, onPrint }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await api.getTrigMCTests();
      // показываем тесты только текущего типа генератора
      setTests(all.filter(t => t.generator_type === generatorType));
    } finally {
      setLoading(false);
    }
  }, [generatorType]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.deleteTrigMCTest(id);
      message.success('Тест удалён');
      setTests(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      message.error('Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>;
  if (!tests.length) return (
    <div style={{ paddingTop: 16 }}>
      <Empty description="Нет сохранённых тестов" />
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <Button icon={<ReloadOutlined />} size="small" onClick={load}>Обновить</Button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button icon={<ReloadOutlined />} size="small" onClick={load}>Обновить</Button>
      </div>
      <List
        dataSource={tests}
        renderItem={t => {
          const variantsCount = Array.isArray(t.variants) ? t.variants.length : 0;
          const tasksPerVariant = variantsCount > 0 ? (t.variants[0]?.tasks?.length ?? 0) : 0;
          return (
            <List.Item
              actions={[
                <Button
                  key="print"
                  size="small"
                  icon={<PrinterOutlined />}
                  onClick={() => onPrint(t)}
                >
                  Печать
                </Button>,
                <Popconfirm
                  key="del"
                  title="Удалить тест?"
                  onConfirm={() => handleDelete(t.id)}
                  okText="Да"
                  cancelText="Нет"
                >
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    loading={deletingId === t.id}
                  />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={t.title}
                description={
                  <Space size={4} wrap>
                    {t.class_number && <Tag>{t.class_number} кл.</Tag>}
                    <Tag color="blue">{variantsCount} вар.</Tag>
                    <Tag color="cyan">{tasksPerVariant} зад./вар.</Tag>
                    <Tag color="purple">{t.options_count} вар. ответа</Tag>
                    <span style={{ fontSize: 11, color: '#aaa' }}>
                      {new Date(t.created).toLocaleDateString('ru')}
                    </span>
                  </Space>
                }
              />
            </List.Item>
          );
        }}
      />
    </div>
  );
}

export default function TrigMCSaveModal({
  open,
  onClose,
  tasksData,
  generatorType,
  generatorTitle,
  settings,
  onPrint,
}) {
  const [activeTab, setActiveTab] = useState('save');
  const [savedCount, setSavedCount] = useState(0);

  const handleSaved = (record) => {
    setSavedCount(c => c + 1);
    setActiveTab('list');
  };

  const tabs = [
    {
      key: 'save',
      label: 'Сохранить',
      children: (
        <SaveTab
          tasksData={tasksData}
          generatorType={generatorType}
          generatorTitle={generatorTitle}
          settings={settings}
          onSaved={handleSaved}
        />
      ),
    },
    {
      key: 'list',
      label: (
        <span>
          Сохранённые
          {savedCount > 0 && (
            <Tag color="blue" style={{ marginLeft: 4, lineHeight: '16px' }}>{savedCount}</Tag>
          )}
        </span>
      ),
      children: (
        <SavedTab
          key={`${generatorType}-${savedCount}`}
          generatorType={generatorType}
          onPrint={(t) => {
            onPrint?.(t);
          }}
        />
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`Тест с выбором — ${GENERATOR_LABELS[generatorType] ?? generatorType}`}
      footer={null}
      width={520}
      destroyOnHidden={false}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabs}
        size="small"
      />
    </Modal>
  );
}
