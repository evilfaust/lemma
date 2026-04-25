import { useState, useCallback } from 'react';
import {
  Input, Button, Typography, Space, Alert,
  Divider, Tag, App, Tooltip, Popconfirm, Select, Spin, Switch,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined,
  PrinterOutlined, ReloadOutlined, KeyOutlined, InfoCircleOutlined,
  ThunderboltOutlined, SaveOutlined, FolderOpenOutlined,
} from '@ant-design/icons';
import { Modal, List } from 'antd';
import { api } from '../shared/services/pocketbase';
import MathRenderer from '../shared/components/MathRenderer';
import TaskSelectModal from './TaskSelectModal';
import { filterTaskText } from '../utils/filterTaskText';
import { buildCryptogramForVariant, getCryptogramLetterCount, getCryptogramUniqueLetterCount, normalizeCryptogramPhrase } from '../utils/cryptogram';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import {
  TrigGeneratorLayout,
  TrigSettingsSection,
  TrigActions,
  TrigPreviewPane,
  TrigPreviewCard,
  TrigStatBadge,
} from './trig/TrigGeneratorLayout';
import './CryptogramGenerator.css';

const { Text } = Typography;

/* ── Печатный блок шифровки ─────────────────────────────────────────────── */
function CryptogramPrintBlock({ tasks, phrase, title, stripPrefixes }) {
  const variant = { tasks, number: 1 };
  const cryptogram = buildCryptogramForVariant({ variant, phrase });

  return (
    <div className="cgp-root">
      {/* Шапка */}
      <div className="cgp-header">
        <div className="cgp-title">{title || 'Шифровка'}</div>
        <div className="cgp-subtitle">Имя: ______________________ Класс: ________</div>
      </div>

      {/* Задачи — 2 колонки */}
        <div className="cgp-tasks">
        {tasks.map((task, idx) => (
          <div key={task.id} className="cgp-task">
            <div className="cgp-task-num">
              {cryptogram?.valid && cryptogram.answerKey?.[idx]?.positions?.length > 0
                ? cryptogram.answerKey[idx].positions.join(', ')
                : `${idx + 1}.`}
            </div>
            <div className="cgp-task-body">
              {task.image && (
                <img
                  src={task.image}
                  alt=""
                  className="cgp-task-img"
                />
              )}
              <MathRenderer text={stripPrefixes ? filterTaskText(task.statement_md || '') : (task.statement_md || '')} />
            </div>
          </div>
        ))}
      </div>

      {/* Блок шифровки */}
      {cryptogram.valid ? (
        <div className="cgp-crypto-block">
          <div className="cgp-crypto-note">
            Найди свой ответ в таблице и впиши букву в клетки с теми номерами, которые указаны у задачи. Лишние строки — обманки.
          </div>

          {/* Таблица ответ → буква */}
          <div className="cgp-table">
              {cryptogram.entries.map((entry, i) => (
                <div key={i} className={`cgp-table-cell${entry.isDecoy ? ' cgp-table-cell--decoy' : ''}`}>
                  <div className="cgp-cell-answer">
                    <MathRenderer text={entry.answer} />
                  </div>
                  <div className="cgp-cell-letter">{entry.letter}</div>
                </div>
              ))}
            </div>

          {/* Строка-ответ */}
          <div className="cgp-result">
                <div className="cgp-result-label">Запиши буквы — получится слово / фраза:</div>
                <div className="cgp-result-cells">
              {cryptogram.answerCells.map((cell, i) =>
                cell.type === 'space'
                  ? <span key={i} className="cgp-result-gap" />
                  : (
                    <span key={i} className="cgp-result-slot">
                      <span className="cgp-result-answer">{cell.posNum}</span>
                      <span className="cgp-result-cell" />
                    </span>
                  )
              )}
                </div>
                <div className="cgp-result-note">
                  Впиши букву, найденную для задачи N, в клетку с номером N.
                </div>
              </div>
        </div>
      ) : (
        cryptogram.warnings.length > 0 && (
          <div className="cgp-warning-print">{cryptogram.warnings.join(' ')}</div>
        )
      )}

      {/* Ключ учителя (печатается после page-break) */}
      <div className="cgp-teacher-key">
        <div className="cgp-teacher-key-title">Ключ учителя — {title || 'Шифровка'}</div>
        <div className="cgp-teacher-answers">
              {tasks.map((task, idx) => {
                const entry = cryptogram.answerKey?.[idx];
                return (
                  <div key={task.id} className="cgp-teacher-answer-item">
                    <span className="cgp-ta-num">{idx + 1}.</span>
                <span className="cgp-ta-answer">
                  <MathRenderer text={task.answer || '—'} />
                </span>
                    {entry?.letter && (
                      <span className="cgp-ta-letter">
                        → {entry.letter}
                        {entry.positions?.length > 0 ? ` (${entry.positions.join(', ')})` : ''}
                      </span>
                    )}
                  </div>
                );
          })}
        </div>
        <div className="cgp-teacher-phrase">
          Слово / фраза: <strong>{normalizeCryptogramPhrase(phrase)}</strong>
        </div>
      </div>
    </div>
  );
}

/* ── Основной компонент ─────────────────────────────────────────────────── */
export default function CryptogramGenerator() {
  const { message } = App.useApp();
  const { topics, subtopics, tags } = useReferenceData();

  const [tasks, setTasks] = useState([]);
  const [phrase, setPhrase] = useState('');
  const [title, setTitle] = useState('');
  const [selectModalOpen, setSelectModalOpen] = useState(false);
  const [stripPrefixes, setStripPrefixes] = useState(true);

  // Генератор задач
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

  /* ── Автогенерация задач ── */
  const handleGenerate = useCallback(async () => {
    if (!genTopic) { message.warning('Выберите тему'); return; }
    if (uniqueLetterCount === 0) { message.warning('Введите фразу для шифровки'); return; }
    setGenLoading(true);
    try {
      const filters = { topic: genTopic, hasAnswer: true };
      if (genSubtopic) filters.subtopic = genSubtopic;
      const result = await api.getRandomTasksWithoutRepetition(
        uniqueLetterCount,
        filters,
        tasks.map(t => t.id)
      );
      const withAnswer = result.filter(t => t.answer?.trim());
      if (withAnswer.length < uniqueLetterCount) {
        message.warning(`Нашлось только ${withAnswer.length} задач с ответами (нужно ${uniqueLetterCount}). Попробуйте другую тему.`);
      }
      setTasks(withAnswer.slice(0, uniqueLetterCount));
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
        tasks: tasks.map(t => t.id),
        task_order: tasks.map(t => t.id),
        strip_prefixes: stripPrefixes,
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
  }, [phrase, tasks, title, stripPrefixes, savedId, message]);

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
    setStripPrefixes(item.strip_prefixes !== false);
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
  const handlePrint = () => {
    if (!canPrint) {
      message.warning(
        taskCount !== uniqueLetterCount
          ? `Задач: ${taskCount}, уникальных букв в фразе: ${uniqueLetterCount}. Должно совпадать.`
          : 'Добавьте задачи и введите фразу'
      );
      return;
    }
    const style = document.createElement('style');
    style.id = 'cgp-print-page-style';
    style.textContent = '@page { size: A5 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const s = document.getElementById('cgp-print-page-style');
      if (s) document.head.removeChild(s);
    }, 1500);
  };

  /* ── Рендер превью шифровки ── */
  const variant = { tasks, number: 1 };
  const cryptogram = phrase ? buildCryptogramForVariant({ variant, phrase }) : null;
  const previewReady = Boolean(cryptogram?.valid);
  const resetAll = () => {
    setTasks([]);
    setPhrase('');
    setTitle('');
    setSavedId(null);
    setGenTopic(null);
    setGenSubtopic(null);
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
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
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

            <TrigSettingsSection label="Подбор задач">
              <Spin spinning={genLoading}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 140px', minWidth: 120 }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>Тема</div>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      placeholder="Выберите тему"
                      allowClear
                      value={genTopic}
                      onChange={v => { setGenTopic(v); setGenSubtopic(null); }}
                      options={topics.map(t => ({ value: t.id, label: t.title }))}
                      showSearch
                      optionFilterProp="label"
                    />
                  </div>
                  <div style={{ flex: '1 1 120px', minWidth: 100 }}>
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

            <TrigSettingsSection label="Опции">
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
            ] : null}
          >
            {previewReady && (
              <>
                <TrigPreviewCard title="Таблица шифровки" meta={`${cryptogram.entries.length} карточек`}>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong style={{ fontSize: 13 }}>Таблица (в перемешанном виде):</Text>
                  </div>
                  <div className="cg-preview-table">
                    {cryptogram.entries.map((entry, i) => (
                      <div key={i} className={`cg-preview-cell${entry.isDecoy ? ' cg-preview-cell--decoy' : ''}`}>
                        <div className="cg-preview-answer">
                          <MathRenderer text={entry.answer} />
                        </div>
                        <div className="cg-preview-letter">{entry.letter}</div>
                      </div>
                    ))}
                  </div>
                </TrigPreviewCard>

                <TrigPreviewCard title="Строка ответа" meta={`${letterCount} позиций`}>
                  <div className="cg-preview-result">
                    {cryptogram.answerCells.map((cell, i) =>
                      cell.type === 'space'
                        ? <span key={i} className="cg-preview-gap" />
                        : (
                          <span key={i} className="cg-preview-answer-slot">
                            <span className="cg-preview-answer-val">{cell.posNum}</span>
                            <span className="cg-preview-cell-box" />
                          </span>
                        )
                    )}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      <InfoCircleOutlined style={{ marginRight: 4 }} />
                      Номера у задач показывают, в какие клетки ответа нужно вписать найденную букву. Серые ячейки — обманки.
                    </Text>
                  </div>
                </TrigPreviewCard>
              </>
            )}
          </TrigPreviewPane>
        }
      />

      {/* ── Скрытый блок для печати ── */}
      {canPrint && (
        <CryptogramPrintBlock tasks={tasks} phrase={phrase} title={title} stripPrefixes={stripPrefixes} />
      )}

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
