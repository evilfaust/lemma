import { useState, useEffect, useCallback } from 'react';
import {
  Modal, Tabs, Form, Input, Select, Radio, Button,
  Space, List, Tag, Popconfirm, message, Spin, Empty, Progress,
} from 'antd';
import { SaveOutlined, PrinterOutlined, DeleteOutlined, ReloadOutlined, ShareAltOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import { buildOptionsWithAI } from '../../utils/aiDistractorGenerator';
import { drillVariants, uncheckableItems } from '../../utils/drillTest';
import SessionPanel from '../worksheet/SessionPanel';
import WorkLessonLinks from '../worksheet/WorkLessonLinks';

const { Option } = Select;

export const GENERATOR_LABELS = {
  trig_expressions:        'Вычисление выражений',
  trig_equations:          'Простейшие уравнения',
  inverse_trig:            'Обратные функции',
  double_angle:            'Двойной аргумент',
  trig_equations_advanced: 'Уравнения f(kx+b)=a',
  reduction_formulas:      'Формулы приведения',
  addition_formulas:       'Формулы сложения',
  oral_counting:           'Устный счёт',
  oral_ege_base:           'Устный счёт: действия с десятичными',
  oral_fractions:          'Устный счёт: дроби',
  oral_powers_roots:       'Устный счёт: степени и корни',
  oral_logarithms:         'Устный счёт: логарифмы',
  log_exp_equations:       'Показательные и логарифмические уравнения',
  linear_equations:        'Линейные уравнения',
  quadratic_equations:     'Квадратные уравнения',
  quadratic_inequalities:  'Квадратные неравенства',
  linear_inequalities:     'Линейные неравенства',
  double_inequalities:     'Двойные неравенства',
  interval_method:         'Метод интервалов',
  derivatives:             'Вычисление производных',
  linear_systems:          'Системы линейных неравенств',
  quadratic_systems:       'Системы квадратных неравенств',
};

// Инструкция-префикс, записываемая в statement_md задачи
const GENERATOR_INSTRUCTIONS = {
  trig_expressions:        'Вычислите:',
  trig_equations:          'Решите уравнение:',
  inverse_trig:            'Вычислите:',
  double_angle:            'Вычислите или упростите:',
  trig_equations_advanced: 'Решите уравнение:',
  reduction_formulas:      'Упростите выражение:',
  addition_formulas:       'Вычислите или упростите:',
  log_exp_equations:       'Решите уравнение:',
  linear_equations:        'Решите уравнение:',
  quadratic_equations:     'Решите уравнение:',
  quadratic_inequalities:  'Решите неравенство:',
  linear_inequalities:     'Решите неравенство:',
  double_inequalities:     'Решите двойное неравенство:',
  interval_method:         'Решите неравенство методом интервалов:',
  derivatives:             'Найдите производную функции:',
  linear_systems:          'Решите систему неравенств:',
  quadratic_systems:       'Решите систему неравенств:',
};

/**
 * Варианты ответа. Генератор, который сам знает типичные ошибки (производные:
 * u′v′ вместо правила произведения, забытая внутренняя производная), отдаёт их
 * в `task.mistakes` — они правдоподобнее угаданных. Не хватило — добираем
 * обычным путём.
 */
async function optionsFor(task, generatorType, count) {
  const own = (task.mistakes || []).filter(t => t && t !== task.resultLatex);
  if (own.length >= count - 1) {
    return [
      { text: task.resultLatex, is_correct: true },
      ...own.slice(0, count - 1).map(t => ({ text: t, is_correct: false, error_type: 'rule' })),
    ];
  }
  const base = await buildOptionsWithAI(task.resultLatex, task.exprLatex, generatorType, count);
  if (!own.length) return base;
  const rest = base.filter(o => !o.is_correct && !own.includes(o.text));
  return [
    base.find(o => o.is_correct) || { text: task.resultLatex, is_correct: true },
    ...own.map(t => ({ text: t, is_correct: false, error_type: 'rule' })),
    ...rest,
  ].slice(0, count);
}

/**
 * Снимок листа → варианты теста. Задачи в банк НЕ пишутся (v3.9.296): задание
 * генератора живёт в самом тесте с ключом `v2-q7`, ответы ученика — в попытке.
 * В режиме ввода вариантов ответа нет — ученик пишет число сам.
 */
async function buildVariants(tasksData, optionsCount, generatorType, answerMode, onProgress) {
  const variants = drillVariants(tasksData, GENERATOR_INSTRUCTIONS[generatorType] || 'Вычислите:');
  if (answerMode === 'input') return variants;
  const total = tasksData.reduce((s, v) => s + v.length, 0);
  let done = 0;
  for (let vi = 0; vi < variants.length; vi++) {
    for (let ti = 0; ti < variants[vi].tasks.length; ti++) {
      variants[vi].tasks[ti].options = await optionsFor(tasksData[vi][ti], generatorType, optionsCount);
      done++;
      onProgress?.(5 + Math.round((done / total) * 85));
    }
  }
  return variants;
}

function SaveTab({ tasksData, generatorType, generatorTitle, settings, answerMode, onSaved }) {
  const [form] = Form.useForm();
  const [saving,   setSaving]   = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    form.setFieldValue('title', generatorTitle || '');
  }, [generatorTitle, form]);

  const isInput = answerMode === 'input';
  // Ответ-промежуток или «x ∈ (…)» по значению не сверить — такой лист
  // вписывать нельзя, только выбирать из вариантов
  const unchecked = isInput && tasksData ? uncheckableItems(tasksData) : [];

  const handleSave = async () => {
    const values = await form.validateFields();
    if (!tasksData?.length) {
      message.warning('Сначала сгенерируйте задания');
      return;
    }
    if (unchecked.length) {
      message.error('Есть задания, ответ на которые не проверить автоматически');
      return;
    }
    setSaving(true);
    setProgress(5);
    try {
      const variants = await buildVariants(
        tasksData,
        values.optionsCount,
        generatorType,
        answerMode,
        (pct) => setProgress(pct),
      );
      setProgress(95);
      const record = await api.createMCTest({
        title:              values.title,
        class_number:       values.classNumber || null,
        source_type:        'generator',
        generator_type:     generatorType,
        generator_settings: settings || {},
        answer_mode:        answerMode,
        options_count:      isInput ? 0 : values.optionsCount,
        shuffle_mode:       isInput ? 'fixed' : values.shuffleMode,
        variants,
      });
      setProgress(100);
      message.success('Тест сохранён — осталось выдать его ученикам');
      onSaved?.(record);
    } catch (e) {
      message.error('Ошибка сохранения: ' + (e?.message || e));
    } finally {
      setSaving(false);
      setProgress(0);
    }
  };

  const totalTasks    = tasksData ? (tasksData[0]?.length ?? 0) : 0;
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

      {!isInput && (
        <>
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
        </>
      )}

      {isInput && (
        <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
          Ученик вписывает ответ сам. Засчитывается любая запись того же числа:
          0,5 = 1/2, 2 1/3 = 7/3, «нет корней».
        </div>
      )}

      {unchecked.length > 0 && (
        <div style={{
          background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 6,
          padding: '8px 12px', fontSize: 13, marginBottom: 8,
        }}>
          Ответ не проверить автоматически ({unchecked.length}):{' '}
          {unchecked.slice(0, 3).map(u => `вар. ${u.variant}, №${u.position}`).join('; ')}
          {unchecked.length > 3 ? '…' : ''}. Сохраните как тест с выбором ответа.
        </div>
      )}

      {tasksData ? (
        <div style={{
          background: '#f6f6f6', borderRadius: 6, padding: '8px 12px',
          fontSize: 13, color: '#555', marginBottom: 8,
        }}>
          Будет сохранено: <b>{variantsCount}</b> вар. × <b>{totalTasks}</b> задач
          <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
            Задания хранятся внутри теста и в банк задач не попадают
          </div>
        </div>
      ) : (
        <div style={{ color: '#999', fontSize: 13, marginBottom: 8 }}>
          Задания не сгенерированы. Нажмите «Сгенерировать» в генераторе.
        </div>
      )}

      {saving && progress > 0 && (
        <Progress
          percent={progress}
          size="small"
          status={progress < 100 ? 'active' : 'success'}
          style={{ marginBottom: 8 }}
        />
      )}

      <Button
        type="primary"
        icon={<SaveOutlined />}
        onClick={handleSave}
        loading={saving}
        disabled={!tasksData || unchecked.length > 0}
      >
        {saving ? 'Сохранение...' : 'Сохранить тест'}
      </Button>
    </Form>
  );
}

function SavedTab({ generatorType, onPrint, onIssue }) {
  const [tests,      setTests]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTests(await api.getMCTestsByGeneratorType(generatorType));
    } finally {
      setLoading(false);
    }
  }, [generatorType]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      // Старые тесты (до v3.9.296) создавали задачи в банке — их убираем вместе
      // с тестом; у новых задач в банке нет
      const test = tests.find(t => t.id === id);
      const taskIds = (test?.variants || [])
        .flatMap(v => (v.tasks || []).map(t => t.task_id).filter(Boolean));
      if (taskIds.length) await Promise.allSettled(taskIds.map(tid => api.deleteTask(tid)));
      await api.deleteMCTest(id);
      message.success('Тест удалён');
      setTests(prev => prev.filter(t => t.id !== id));
    } catch {
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
          const variantsCount   = Array.isArray(t.variants) ? t.variants.length : 0;
          const tasksPerVariant = variantsCount > 0 ? (t.variants[0]?.tasks?.length ?? 0) : 0;
          return (
            <List.Item
              actions={[
                <Button
                  key="issue" size="small" type="primary" icon={<ShareAltOutlined />}
                  onClick={() => onIssue(t)}
                >
                  Выдать
                </Button>,
                <Button
                  key="print" size="small" icon={<PrinterOutlined />}
                  onClick={() => onPrint(t)}
                >
                  Печать
                </Button>,
                <Popconfirm
                  key="del"
                  title="Удалить тест и все его задачи?"
                  onConfirm={() => handleDelete(t.id)}
                  okText="Да" cancelText="Нет"
                >
                  <Button size="small" danger icon={<DeleteOutlined />} loading={deletingId === t.id} />
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
                    {t.answer_mode === 'input'
                      ? <Tag color="gold">вписать ответ</Tag>
                      : <Tag color="purple">{t.options_count} вар. ответа</Tag>}
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
  fillMode,
  onPrint,
}) {
  const answerMode = fillMode ? 'input' : 'choice';
  const [activeTab,  setActiveTab]  = useState('save');
  const [savedCount, setSavedCount] = useState(0);
  // Тест, который сейчас выдаётся: ссылка, QR и результаты прямо в окне —
  // раньше выдача жила только в разделе «Тесты с выбором», и найти её из
  // генератора было нельзя
  const [issueTest,  setIssueTest]  = useState(null);

  // Каждое открытие окна — с чистого листа: иначе после прошлой выдачи
  // кнопка «Тест A/B/C/D» открывала бы старый тест
  useEffect(() => {
    if (open) { setIssueTest(null); setActiveTab('save'); }
  }, [open]);

  const handleSaved = (record) => {
    setSavedCount(c => c + 1);
    setActiveTab('list');
    if (record) setIssueTest(record);
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
          answerMode={answerMode}
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
          onPrint={(t) => { onPrint?.(t); }}
          onIssue={setIssueTest}
        />
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`${answerMode === 'input' ? 'Тест «Вписать ответ»' : 'Тест с выбором'} — ${GENERATOR_LABELS[generatorType] ?? generatorType}`}
      footer={null}
      width={issueTest ? 860 : 520}
      destroyOnHidden={false}
    >
      {issueTest ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => setIssueTest(null)}>
              К тестам
            </Button>
            <span style={{ fontWeight: 600 }}>Выдача: {issueTest.title}</span>
          </div>
          <WorkLessonLinks workId={issueTest.id} workTitle={issueTest.title} materialType="mc_test" />
          <SessionPanel
            key={issueTest.id}
            mcTestId={issueTest.id}
            defaultTitle={issueTest.title}
          />
        </div>
      ) : (
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} size="small" />
      )}
    </Modal>
  );
}
