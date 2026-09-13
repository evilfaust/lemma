import { useState, useCallback, useMemo } from 'react';
import {
  Input, Button, Typography, Space, Alert,
  Divider, Tag, App, Tooltip, Popconfirm, Select, Spin, Switch,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined,
  PrinterOutlined, ReloadOutlined, KeyOutlined,
  ThunderboltOutlined, SaveOutlined, FolderOpenOutlined, BulbOutlined,
} from '@ant-design/icons';
import { Modal, List } from 'antd';
import { api } from '../shared/services/pocketbase';
import MathRenderer from '../shared/components/MathRenderer';
import TaskSelectModal from './TaskSelectModal';
import { filterTaskText } from '../utils/filterTaskText';
import {
  buildCryptogramForVariant, getCryptogramLetterCount, getCryptogramUniqueLetterCount,
  normalizeCryptogramSettings, CRYPTOGRAM_MODE_PRESETS,
} from '../utils/cryptogram';
import CryptogramSheet from './cryptogram/CryptogramSheet';
import CryptogramPrintSettings from './cryptogram/CryptogramPrintSettings';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { useAuth } from '../contexts/AuthContext';
import {
  TrigGeneratorLayout,
  TrigSettingsSection,
  TrigActions,
  TrigPreviewPane,
  TrigStatBadge,
} from './trig/TrigGeneratorLayout';
import './CryptogramGenerator.css';

const { Text } = Typography;

const DEFINE_API = import.meta.env.VITE_DEFINE_API_URL || 'https://l.oipav.ru/define';

const EXAM_TYPE_LABELS = {
  ege_base:    'ЕГЭ базовый (11 кл.)',
  ege_profile: 'ЕГЭ профильный (11 кл.)',
  vpr:         'ВПР',
  oral:        'Устный счёт',
  trig:        'Тригонометрия',
  mordkovich:  'Мордкович',
  other:       'Прочее',
};

const topicLabel = (t) => t.ege_number ? `№${t.ege_number} — ${t.title}` : t.title;

/* ── Основной компонент ─────────────────────────────────────────────────── */
export default function CryptogramGenerator() {
  const { message } = App.useApp();
  const { aiEnabled } = useAuth(); // ИИ-тумблер: гейт AI-определения
  const { topics, subtopics, tags } = useReferenceData();

  const [tasks, setTasks] = useState([]);
  const [phrase, setPhrase] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [defLoading, setDefLoading] = useState(false);
  const [selectModalOpen, setSelectModalOpen] = useState(false);
  const [stripPrefixes, setStripPrefixes] = useState(true);

  // Настройки печатного листа (движок print-sheet)
  const [settings, setSettings] = useState(() => normalizeCryptogramSettings({}));
  const [pageCounts, setPageCounts] = useState({});

  // Генератор задач
  const [genContext, setGenContext] = useState(null);
  const [genTopic, setGenTopic] = useState(null);
  const [genSubtopic, setGenSubtopic] = useState(null);
  const [genLoading, setGenLoading] = useState(false);

  // Сохранение/загрузка
  const [savedId, setSavedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [savedList, setSavedList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const letterCount = getCryptogramLetterCount(phrase);
  const uniqueLetterCount = getCryptogramUniqueLetterCount(phrase);
  const taskCount = tasks.length;
  const canPrint = taskCount > 0 && uniqueLetterCount > 0 && taskCount === uniqueLetterCount;

  const patchSettings = useCallback((patch) => {
    setSettings(prev => normalizeCryptogramSettings({ ...prev, ...patch }));
  }, []);

  // Смена режима тянет за собой пресет: на половине A4 полная шапка не
  // оставила бы места задачам, а на целом листе компактная выглядит сиротливо.
  const handleModeChange = useCallback((mode) => {
    setSettings(prev => normalizeCryptogramSettings({
      ...prev, ...(CRYPTOGRAM_MODE_PRESETS[mode] || {}), mode,
    }));
  }, []);

  /* ── Управление задачами ── */
  const handleAddTask = useCallback((task) => {
    setTasks(prev => {
      if (prev.find(t => t.id === task.id)) {
        message.warning('Задача уже добавлена');
        return prev;
      }
      return [...prev, task];
    });
    setSelectModalOpen(false);
  }, [message]);

  const handleRemove = useCallback((id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleMove = useCallback((idx, dir) => {
    setTasks(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  /* ── Генерация определения через AI ── */
  const handleGetDefinition = useCallback(async () => {
    const term = phrase.trim();
    if (!term) return;
    setDefLoading(true);
    try {
      const resp = await fetch(DEFINE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const definition = data.definition || '';
      if (!definition) {
        message.warning('Модель не смогла сформулировать описание — попробуйте ещё раз или введите вручную.');
      } else {
        setDescription(definition);
      }
    } catch (e) {
      message.error('Не удалось получить определение. Проверьте подключение к интернету.');
    } finally {
      setDefLoading(false);
    }
  }, [phrase, message]);

  /* ── Автогенерация задач ── */
  const handleGenerate = useCallback(async () => {
    if (!genTopic) { message.warning('Выберите тему'); return; }
    if (uniqueLetterCount === 0) { message.warning('Введите фразу для шифровки'); return; }
    setGenLoading(true);
    try {
      const filters = { topic: genTopic, hasAnswer: true };
      if (genSubtopic) filters.subtopic = genSubtopic;
      // Запрашиваем с запасом — для дедупликации по ответу
      const result = await api.getRandomTasksWithoutRepetition(
        uniqueLetterCount * 5,
        filters,
        tasks.map(t => t.id)
      );
      // Дедупликация по нормализованному ответу
      const seen = new Set();
      const unique = result.filter(t => {
        if (!t.answer?.trim()) return false;
        const key = t.answer.trim().toLowerCase().replace(/\s+/g, '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (unique.length < uniqueLetterCount) {
        message.warning(`Нашлось только ${unique.length} задач с уникальными ответами (нужно ${uniqueLetterCount}). Попробуйте другую тему или подтему.`);
      }
      setTasks(unique.slice(0, uniqueLetterCount));
    } catch (e) {
      message.error('Ошибка при загрузке задач');
    } finally {
      setGenLoading(false);
    }
  }, [genTopic, genSubtopic, uniqueLetterCount, tasks, message]);

  /* ── Сохранение ── */
  const handleSave = useCallback(async () => {
    if (!phrase.trim() && tasks.length === 0) {
      message.warning('Добавьте фразу и задачи перед сохранением');
      return;
    }
    setSaving(true);
    try {
      const data = {
        title: title || 'Шифровка',
        phrase,
        description,
        tasks: tasks.map(t => t.id),
        task_order: tasks.map(t => t.id),
        strip_prefixes: stripPrefixes,
        settings,
      };
      const record = savedId
        ? await api.updateCryptogram(savedId, data)
        : await api.createCryptogram(data);
      setSavedId(record.id);
      message.success(savedId ? 'Шифровка обновлена' : 'Шифровка сохранена');
    } catch {
      message.error('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  }, [phrase, tasks, title, description, stripPrefixes, settings, savedId, message]);

  /* ── Загрузка ── */
  const handleOpenLoad = useCallback(async () => {
    setLoadModalOpen(true);
    setLoadingList(true);
    try {
      const list = await api.getCryptograms();
      setSavedList(list);
    } catch {
      message.error('Ошибка при загрузке списка');
    } finally {
      setLoadingList(false);
    }
  }, [message]);

  const handleLoadItem = useCallback((item) => {
    setTitle(item.title || '');
    setPhrase(item.phrase || '');
    setDescription(item.description || '');
    setStripPrefixes(item.strip_prefixes !== false);
    // Шифровки, сохранённые до появления настроек листа, приходят без поля —
    // нормализация даёт им печатный вид по умолчанию.
    setSettings(normalizeCryptogramSettings(item.settings));
    const ordered = (item.task_order || [])
      .map(id => item.expand?.tasks?.find?.(t => t.id === id))
      .filter(Boolean);
    const remaining = (item.expand?.tasks || []).filter(t => !item.task_order?.includes(t.id));
    setTasks([...ordered, ...remaining]);
    setSavedId(item.id);
    setLoadModalOpen(false);
  }, []);

  const handleDelete = useCallback(async (id) => {
    try {
      await api.deleteCryptogram(id);
      setSavedList(prev => prev.filter(i => i.id !== id));
      if (savedId === id) setSavedId(null);
      message.success('Удалено');
    } catch {
      message.error('Ошибка при удалении');
    }
  }, [savedId, message]);

  /* ── Печать ── */
  // Поля листа рисует сам движок (padding .ps-page), поэтому @page нулевой.
  // Инъекция последним стилем перебивает глобальный `@page { margin: 10mm 8mm }`
  // из TaskWorksheet.css — иначе поля удваиваются.
  const handlePrint = () => {
    if (!canPrint) {
      message.warning(
        taskCount !== uniqueLetterCount
          ? `Задач: ${taskCount}, уникальных букв в фразе: ${uniqueLetterCount}. Должно совпадать.`
          : 'Добавьте задачи и введите фразу'
      );
      return;
    }
    const styleId = 'cryptogram-print-page-style';
    document.getElementById(styleId)?.remove();
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    const cleanup = () => {
      document.getElementById(styleId)?.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  /* ── Рендер превью шифровки ── */
  const cryptogram = phrase
    ? buildCryptogramForVariant({ variant: { tasks, number: 1 }, phrase })
    : null;
  const previewReady = Boolean(cryptogram?.valid);

  // В компактном режиме копия обязана уместиться в половину листа — иначе
  // резать нечего: одна шифровка займёт оба листа.
  const duoOverflow = useMemo(() => {
    if (settings.mode !== 'duo') return 0;
    const counts = Object.values(pageCounts);
    return counts.length ? Math.max(...counts) : 0;
  }, [settings.mode, pageCounts]);

  const resetAll = () => {
    setTasks([]);
    setPhrase('');
    setTitle('');
    setDescription('');
    setSavedId(null);
    setGenTopic(null);
    setGenSubtopic(null);
    setSettings(normalizeCryptogramSettings({}));
  };

  return (
    <>
      <TrigGeneratorLayout
        icon={<KeyOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Например: Шифровка — Тема 7"
        leftWidth={380}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 10 }}>
            <div style={{
              flex: 1, minHeight: 0, overflow: 'auto',
              display: 'flex', flexDirection: 'column', gap: 10,
              margin: '0 -4px', padding: '0 4px 4px',
            }}>
            <TrigSettingsSection label="Фраза">
            <Input
              value={phrase}
              onChange={e => setPhrase(e.target.value)}
              placeholder="Например: ТЕОРЕМА ПИФАГОРА"
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: taskCount > 0 && uniqueLetterCount > 0 && taskCount !== uniqueLetterCount ? 8 : 0 }}>
              <Tag>Всего букв: {letterCount}</Tag>
              <Tag color={taskCount === uniqueLetterCount && taskCount > 0 ? 'green' : 'default'}>
                Уникальных букв: {uniqueLetterCount}
              </Tag>
              <Tag color={taskCount === uniqueLetterCount && taskCount > 0 ? 'green' : 'default'}>
                Задач: {taskCount}
              </Tag>
            </div>
            {taskCount > 0 && uniqueLetterCount > 0 && taskCount !== uniqueLetterCount && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 8, fontSize: 12 }}
                message={`Нужно, чтобы число задач (${taskCount}) совпало с числом уникальных букв (${uniqueLetterCount})`}
              />
            )}
            </TrigSettingsSection>

            <TrigSettingsSection label="Описание термина">
              <Input.TextArea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Определение появится здесь после генерации или введите вручную…"
                autoSize={{ minRows: 2, maxRows: 5 }}
                style={{ marginBottom: 6, fontSize: 12 }}
              />
              {aiEnabled && (
                <Button
                  size="small"
                  icon={<BulbOutlined />}
                  loading={defLoading}
                  disabled={!phrase.trim()}
                  onClick={handleGetDefinition}
                  style={{ width: '100%' }}
                >
                  {defLoading ? 'Генерирую (~30 сек)…' : 'Сгенерировать определение (AI)'}
                </Button>
              )}
              {aiEnabled && !phrase.trim() && (
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
                  Сначала введите фразу-термин выше
                </div>
              )}
            </TrigSettingsSection>

            <TrigSettingsSection label="Подбор задач">
              <Spin spinning={genLoading}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>Контекст</div>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      placeholder="Все контексты"
                      allowClear
                      value={genContext}
                      onChange={v => { setGenContext(v); setGenTopic(null); setGenSubtopic(null); }}
                      options={Object.entries(EXAM_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>Тема</div>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      placeholder="Выберите тему"
                      allowClear
                      value={genTopic}
                      onChange={v => { setGenTopic(v); setGenSubtopic(null); }}
                      options={(genContext
                        ? topics.filter(t => t.exam_type === genContext)
                        : topics
                      ).map(t => ({ value: t.id, label: topicLabel(t) }))}
                      showSearch
                      optionFilterProp="label"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>Подтема</div>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      placeholder="Любая"
                      allowClear
                      value={genSubtopic}
                      onChange={setGenSubtopic}
                      options={(subtopics || [])
                        .filter(s => !genTopic || s.topic === genTopic)
                        .map(s => ({ value: s.id, label: s.name }))
                      }
                      disabled={!genTopic}
                    />
                  </div>
                  <Button
                    size="small"
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    onClick={handleGenerate}
                    disabled={!genTopic || uniqueLetterCount === 0}
                  >
                    Сгенерировать {uniqueLetterCount > 0 ? `(${uniqueLetterCount})` : ''}
                  </Button>
                </div>
              </Spin>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>Задачи ({taskCount})</span>
                <Button size="small" icon={<PlusOutlined />} type="dashed" onClick={() => setSelectModalOpen(true)}>
                  Добавить
                </Button>
              </div>
              {tasks.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Добавьте задачи с числовыми ответами. Количество задач должно совпадать с числом <strong>уникальных</strong> букв в фразе.
                </Text>
              ) : (
                <div className="cg-task-list">
                  {tasks.map((task, idx) => (
                    <div key={task.id} className="cg-task-row">
                      <div className="cg-task-num">
                        {cryptogram?.valid && cryptogram.answerKey?.[idx]?.positions?.length > 0
                          ? cryptogram.answerKey[idx].positions.join(', ')
                          : `${idx + 1}.`}
                      </div>
                      <div className="cg-task-preview">
                        <Text style={{ fontSize: 12 }} ellipsis>
                          <MathRenderer text={(stripPrefixes ? filterTaskText(task.statement_md || '') : task.statement_md || '')?.slice(0, 80) || '—'} />
                        </Text>
                        {task.answer && (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            Ответ: <MathRenderer text={task.answer} />
                            {cryptogram?.valid && cryptogram.answerKey?.[idx]?.letter && (
                              <span style={{ color: '#c41d7f', fontWeight: 700, marginLeft: 4 }}>
                                → {cryptogram.answerKey[idx].letter}
                                {cryptogram.answerKey[idx].positions?.length > 0 && (
                                  <span style={{ color: '#8c8c8c', fontWeight: 500 }}>
                                    {' '}({cryptogram.answerKey[idx].positions.join(', ')})
                                  </span>
                                )}
                              </span>
                            )}
                          </Text>
                        )}
                      </div>
                      <Space size={2}>
                        <Tooltip title="Вверх">
                          <Button size="small" icon={<ArrowUpOutlined />} disabled={idx === 0} onClick={() => handleMove(idx, -1)} />
                        </Tooltip>
                        <Tooltip title="Вниз">
                          <Button size="small" icon={<ArrowDownOutlined />} disabled={idx === tasks.length - 1} onClick={() => handleMove(idx, 1)} />
                        </Tooltip>
                        <Popconfirm title="Убрать задачу?" onConfirm={() => handleRemove(task.id)} okText="Да" cancelText="Нет">
                          <Button size="small" icon={<DeleteOutlined />} danger />
                        </Popconfirm>
                      </Space>
                    </div>
                  ))}
                </div>
              )}
            </TrigSettingsSection>

            <TrigSettingsSection label="Печатный лист">
              <CryptogramPrintSettings
                settings={settings}
                patch={patchSettings}
                onMode={handleModeChange}
              />
              <Divider style={{ margin: '10px 0 8px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch size="small" checked={stripPrefixes} onChange={setStripPrefixes} />
                <Text style={{ fontSize: 12 }}>Срезать «Вычислите», «Найдите» и т.д.</Text>
              </div>
              {savedId && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                  ID: {savedId}
                </div>
              )}
            </TrigSettingsSection>
            </div>

            <TrigActions>
              <Button type="primary" icon={<PrinterOutlined />} block disabled={!canPrint} onClick={handlePrint}>
                Печать
              </Button>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button icon={<SaveOutlined />} block loading={saving} onClick={handleSave}>
                  {savedId ? 'Обновить' : 'Сохранить'}
                </Button>
                <Button icon={<FolderOpenOutlined />} block onClick={handleOpenLoad}>
                  Загрузить
                </Button>
              </div>
              <Button icon={<ReloadOutlined />} block onClick={resetAll}>
                Сбросить
              </Button>
            </TrigActions>
          </div>
        }
        right={
          <TrigPreviewPane
            hasData={previewReady}
            emptyIcon={<KeyOutlined />}
            emptyTitle={cryptogram ? cryptogram.warnings.join(' ') : 'Введите фразу и добавьте задачи'}
            emptyHint={!cryptogram ? 'Шифровка строится по ответам задач' : undefined}
            summary={previewReady ? [
              <TrigStatBadge key="letters" tone="accent">{letterCount} букв</TrigStatBadge>,
              <TrigStatBadge key="unique">{uniqueLetterCount} уник.</TrigStatBadge>,
              <TrigStatBadge key="tasks" tone="success">{taskCount} задач</TrigStatBadge>,
              <TrigStatBadge key="mode">{settings.mode === 'duo' ? '2 на листе' : 'A4'}</TrigStatBadge>,
            ] : null}
          >
            {previewReady && (
              <>
                {duoOverflow > 1 && (
                  <Alert
                    className="no-print"
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="Копия не помещается в половину листа"
                    description={`Шифровка занимает ${duoOverflow} половинки, и разрезать лист пополам не получится. Уберите пару задач, уменьшите кегль, включите узкие поля или компактную шапку.`}
                  />
                )}
                <CryptogramSheet
                  tasks={tasks}
                  phrase={phrase}
                  title={title}
                  description={description}
                  settings={settings}
                  stripPrefixes={stripPrefixes}
                  onPageCounts={setPageCounts}
                />
              </>
            )}
          </TrigPreviewPane>
        }
      />

      <TaskSelectModal
        visible={selectModalOpen}
        onCancel={() => setSelectModalOpen(false)}
        onSelect={handleAddTask}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        excludeIds={tasks.map(t => t.id)}
      />

      <Modal
        title="Загрузить шифровку"
        open={loadModalOpen}
        onCancel={() => setLoadModalOpen(false)}
        footer={null}
        width={520}
      >
        <List
          loading={loadingList}
          dataSource={savedList}
          locale={{ emptyText: 'Нет сохранённых шифровок' }}
          renderItem={item => (
            <List.Item
              actions={[
                <Button
                  key="load"
                  type="link"
                  size="small"
                  onClick={() => handleLoadItem(item)}
                >
                  Загрузить
                </Button>,
                <Popconfirm
                  key="del"
                  title="Удалить шифровку?"
                  okText="Да"
                  cancelText="Нет"
                  onConfirm={() => handleDelete(item.id)}
                >
                  <Button type="link" size="small" danger>Удалить</Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={item.title || 'Без названия'}
                description={
                  <span style={{ fontSize: 12, color: '#888' }}>
                    {item.phrase ? `«${item.phrase.slice(0, 40)}${item.phrase.length > 40 ? '…' : ''}»` : '—'}
                    {' · '}
                    {(item.expand?.tasks?.length || 0)} задач
                  </span>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
}
