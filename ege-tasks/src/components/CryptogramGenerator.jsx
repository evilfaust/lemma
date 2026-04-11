import { useState, useRef, useCallback } from 'react';
import {
  Card, Row, Col, Input, Button, Typography, Space, Alert,
  Divider, Tag, App, Tooltip, Popconfirm, Select, InputNumber, Spin, Switch,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined,
  PrinterOutlined, ReloadOutlined, KeyOutlined, InfoCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { api } from '../shared/services/pocketbase';
import MathRenderer from '../shared/components/MathRenderer';
import TaskSelectModal from './TaskSelectModal';
import { filterTaskText } from '../utils/filterTaskText';
import { buildCryptogramForVariant, getCryptogramLetterCount, getCryptogramUniqueLetterCount, normalizeCryptogramPhrase } from '../utils/cryptogram';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import './CryptogramGenerator.css';

const { Text, Title } = Typography;

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
            <div className="cgp-task-num">{idx + 1}.</div>
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
            Найди свой ответ в таблице — запиши соответствующую букву. Лишние строки — обманки.
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
                  <span className="cgp-ta-letter">→ {entry.letter}</span>
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

  const printRef = useRef(null);

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

  return (
    <div style={{ padding: '16px 20px', maxWidth: 960, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 20 }}>
        <KeyOutlined style={{ marginRight: 8 }} />
        Генератор шифровок
      </Title>

      <Row gutter={16}>
        {/* ── Левая колонка: настройки ── */}
        <Col xs={24} md={10}>
          <Card size="small" title="Название листа" style={{ marginBottom: 12 }}>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Например: Шифровка — Тема 7"
            />
          </Card>

          <Card size="small" title="Зашифрованная фраза" style={{ marginBottom: 12 }}>
            <Input
              value={phrase}
              onChange={e => setPhrase(e.target.value)}
              placeholder="Например: ТЕОРЕМА ПИФАГОРА"
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          </Card>

          <Card
            size="small"
            title={`Задачи (${taskCount})`}
            extra={
              <Button
                size="small"
                icon={<PlusOutlined />}
                type="dashed"
                onClick={() => setSelectModalOpen(true)}
              >
                Добавить
              </Button>
            }
            style={{ marginBottom: 12 }}
          >
            {/* ── Автогенератор задач ── */}
            <Spin spinning={genLoading}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 140px', minWidth: 120 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Тема</div>
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
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Подтема</div>
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
            <Divider style={{ margin: '6px 0' }} />
            {tasks.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Добавьте задачи с числовыми ответами. Количество задач должно совпадать с числом <strong>уникальных</strong> букв в фразе (одна задача = одна буква).
              </Text>
            ) : (
              <div className="cg-task-list">
                {tasks.map((task, idx) => (
                  <div key={task.id} className="cg-task-row">
                    <div className="cg-task-num">{idx + 1}.</div>
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
                            </span>
                          )}
                        </Text>
                      )}
                    </div>
                    <Space size={2}>
                      <Tooltip title="Вверх">
                        <Button
                          size="small"
                          icon={<ArrowUpOutlined />}
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, -1)}
                        />
                      </Tooltip>
                      <Tooltip title="Вниз">
                        <Button
                          size="small"
                          icon={<ArrowDownOutlined />}
                          disabled={idx === tasks.length - 1}
                          onClick={() => handleMove(idx, 1)}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="Убрать задачу?"
                        onConfirm={() => handleRemove(task.id)}
                        okText="Да"
                        cancelText="Нет"
                      >
                        <Button size="small" icon={<DeleteOutlined />} danger />
                      </Popconfirm>
                    </Space>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Switch
              size="small"
              checked={stripPrefixes}
              onChange={setStripPrefixes}
            />
            <Text style={{ fontSize: 12 }}>Срезать «Вычислите», «Найдите» и т.д.</Text>
          </div>

          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              block
              disabled={!canPrint}
              onClick={handlePrint}
            >
              Печать
            </Button>
            <Button
              icon={<ReloadOutlined />}
              block
              onClick={() => { setTasks([]); setPhrase(''); setTitle(''); }}
            >
              Сбросить
            </Button>
          </Space>
        </Col>

        {/* ── Правая колонка: превью шифровки ── */}
        <Col xs={24} md={14}>
          <Card size="small" title="Превью таблицы шифровки">
            {!cryptogram ? (
              <Text type="secondary">Введите фразу и добавьте задачи</Text>
            ) : !cryptogram.valid ? (
              <Alert type="warning" showIcon message={cryptogram.warnings.join(' ')} />
            ) : (
              <>
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
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ marginBottom: 6 }}>
                  <Text strong style={{ fontSize: 13 }}>Строка для ответа:</Text>
                </div>
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
                    Серые ячейки — обманки (decoy), их буквы не входят во фразу
                  </Text>
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Скрытый блок для печати ── */}
      <div ref={printRef}>
        {canPrint && (
          <CryptogramPrintBlock tasks={tasks} phrase={phrase} title={title} stripPrefixes={stripPrefixes} />
        )}
      </div>

      <TaskSelectModal
        visible={selectModalOpen}
        onCancel={() => setSelectModalOpen(false)}
        onSelect={handleAddTask}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        excludeIds={tasks.map(t => t.id)}
      />
    </div>
  );
}
