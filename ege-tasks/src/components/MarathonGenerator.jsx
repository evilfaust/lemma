import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button, Card, Input, InputNumber, Space, List, Tag, Tooltip,
  Modal, Empty, Spin, message, Popconfirm, Typography,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SaveOutlined, FolderOpenOutlined, CheckCircleOutlined,
  PrinterOutlined, ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined,
  TrophyOutlined, UserOutlined, OrderedListOutlined, FileTextOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { useMarathon } from '../hooks/useMarathon';
import { api } from '../shared/services/pocketbase';
import TaskSelectModal from './TaskSelectModal';
import MarathonCardsPrint from './marathon/MarathonCardsPrint';
import MarathonTeacherSheet from './marathon/MarathonTeacherSheet';
import MarathonTeacherSheetFull from './marathon/MarathonTeacherSheetFull';
import MarathonRatingPrint from './marathon/MarathonRatingPrint';
import MarathonWorksheetPrint from './marathon/MarathonWorksheetPrint';
import MarathonTracker from './marathon/MarathonTracker';
import MarathonTeacherKey from './marathon/MarathonTeacherKey';
import PrintOption from './marathon/PrintOption';
import SheetThumb from './marathon/SheetThumb';
import StatusStrip from './marathon/StatusStrip';
import QueueStrip from './marathon/QueueStrip';
import QueueBoard from './marathon/QueueBoard';
import MathRenderer from '../shared/components/MathRenderer';
import { cardFormatLabel, cardGrid, readCardSettings } from '../utils/marathonCards';
import './MarathonGenerator.css';

const { Text } = Typography;
const DIFFICULTY_COLOR = { 1: '#52c41a', 2: '#faad14', 3: '#ff4d4f', 4: '#a8071a', 5: '#722ed1' };
const DIFFICULTY_LABEL = { 1: 'Лёгкая', 2: 'Средняя', 3: 'Сложная', 4: 'Высокая', 5: 'Олимпиадная' };

// Есть ли реальный прогресс в trackingData
function hasProgress(trackingData) {
  return Object.values(trackingData).some(studentData =>
    Object.entries(studentData).some(([k, v]) =>
      !k.startsWith('_') && (v.solved || v.failed || v.attempts > 0)
    )
  );
}

// Инициализирован ли трекер (есть записи по ученикам)
function isTrackerInitialized(students, trackingData) {
  return students.length > 0 && students.every(s => s in trackingData);
}

export default function MarathonGenerator() {
  const { topics, subtopics, tags } = useReferenceData();

  const {
    title, setTitle,
    classNumber, setClassNumber,
    tasks, students, trackingData, setTrackingData,
    savedId, saved, loadingSaved, saving, saveStatus,
    addTasks, removeTask, moveTask,
    addStudent, removeStudent, updateStudentName,
    saveMarathon, saveTracking, loadMarathon, loadSavedList, deleteMarathon, reset,
    initTracking,
    livePublic, setLive,
  } = useMarathon();

  // --- Фазы и подвкладки ---
  const [phase, setPhase] = useState('prep'); // 'prep' | 'live'
  const [prepTab, setPrepTab] = useState('content'); // 'content' | 'cards' | 'teacher' | 'rating'
  const [liveTab, setLiveTab] = useState('tracker'); // 'tracker'

  // --- Прочий UI-стейт ---
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [trackerMode, setTrackerMode] = useState('grid'); // 'grid' | 'queue'
  // Печатные листы открываются во весь экран (там же их настройки и предпросмотр)
  const [worksheetMode, setWorksheetMode] = useState(null); // 'work' | 'card' | null
  const [showCards,        setShowCards]        = useState(false);
  const [showRating,       setShowRating]       = useState(false);
  const [showWorksheet,    setShowWorksheet]    = useState(false);
  const [showAnswerSheet,  setShowAnswerSheet]  = useState(false);
  const [showTeacherFull,  setShowTeacherFull]  = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null); // имя редактируемого
  const [editingValue, setEditingValue] = useState('');

  // --- Открытие марафона по ссылке ?marathon=<id> ---
  // Так в марафон попадает работа («Мои работы» → 🏆): марафон уже создан,
  // здесь его остаётся загрузить.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get('marathon');
  const openedRef = useRef(null);

  useEffect(() => {
    if (!requestedId || openedRef.current === requestedId) return;
    openedRef.current = requestedId;

    let alive = true;
    api.getMarathon(requestedId)
      .then((rec) => {
        if (!alive) return;
        loadMarathon(rec);
        setPhase('prep');
      })
      .catch((e) => {
        console.error('Не удалось открыть марафон:', e);
        message.error('Не удалось открыть марафон');
      })
      .finally(() => {
        if (!alive) return;
        // Параметр отработал — убираем из адреса, чтобы «Новый марафон» не
        // выглядел как повторное открытие сохранённого.
        const next = new URLSearchParams(searchParams);
        next.delete('marathon');
        setSearchParams(next, { replace: true });
      });

    return () => { alive = false; };
  }, [requestedId, loadMarathon, searchParams, setSearchParams]);

  // --- Обработчики ---

  const handleAddStudent = () => {
    if (!newStudentName.trim()) return;
    addStudent(newStudentName.trim());
    setNewStudentName('');
  };

  const handleBulkImport = () => {
    const names = bulkText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    names.forEach(name => addStudent(name));
    setBulkText('');
    setShowBulk(false);
  };

  const handleStartRename = (name) => {
    setEditingStudent(name);
    setEditingValue(name);
  };

  const handleFinishRename = (oldName) => {
    if (editingValue.trim() && editingValue.trim() !== oldName) {
      updateStudentName(oldName, editingValue.trim());
    }
    setEditingStudent(null);
    setEditingValue('');
  };

  const handleSave = async () => {
    if (!tasks.length) return message.warning('Добавьте хотя бы одну задачу');
    try {
      await saveMarathon();
      message.success(savedId ? 'Марафон обновлён' : 'Марафон сохранён');
    } catch {
      message.error('Ошибка при сохранении');
    }
  };

  const handleLoad = async () => {
    setShowLoadModal(true);
    await loadSavedList();
  };

  const handleLoadItem = async (item) => {
    setShowLoadModal(false);
    try {
      const full = await api.getMarathon(item.id);
      const order = full.task_order || [];
      const raw = full.expand?.tasks;
      const expandedTasks = Array.isArray(raw) ? raw : raw ? [raw] : [];

      if (order.length > expandedTasks.length && order.length > 0) {
        const missingIds = order.filter(id => !expandedTasks.find(t => t.id === id));
        if (missingIds.length > 0) {
          try {
            const recoveredTasks = await Promise.all(
              missingIds.map(id => api.getTask(id).catch(() => null))
            );
            full.expand = full.expand || {};
            full.expand.tasks = [...expandedTasks, ...recoveredTasks.filter(Boolean)];
          } catch (e) {
            console.error('Failed to recover missing tasks', e);
          }
        }
      }
      loadMarathon(full);
      message.success('Марафон загружен');
    } catch (e) {
      console.error(e);
      loadMarathon(item);
      message.success('Марафон загружен (ошибка полной загрузки)');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteMarathon(id);
      message.success('Удалено');
    } catch {
      message.error('Ошибка удаления');
    }
  };

  // Плотность листа карточек живёт в localStorage (её ставят на самом листе) —
  // перечитываем при возврате оттуда, чтобы схема на вкладке не врала.
  const cardSettings = useMemo(() => readCardSettings(), [showCards]);

  const handleInitTracking = () => {
    if (!students.length) return message.warning('Добавьте учеников');
    if (!tasks.length) return message.warning('Добавьте задачи');
    initTracking();
    message.success('Трекер инициализирован');
  };

  // Переключение в фазу урока: инициализировать если нужно
  const handleSwitchToLive = () => {
    if (!students.length || !tasks.length) {
      message.warning('Добавьте учеников и задачи перед началом урока');
      return;
    }
    setPhase('live');
    setLiveTab('tracker');
  };

  // CSV экспорт результатов
  const handleExportCSV = () => {
    const calcScore = (data, taskCount) => {
      let total = 0;
      for (let i = 0; i < taskCount; i++) {
        const d = data[String(i)];
        if (!d || (!d.solved && !d.failed)) continue;
        if (d.failed) continue;
        if (d.solved) {
          const a = d.attempts || 0;
          total += a === 0 ? 3 : a === 1 ? 2 : 1;
        }
      }
      return total;
    };

    const header = ['Ученик', ...tasks.map((_, i) => `Задача ${i + 1}`), 'Итого'];
    const rows = students.map(name => {
      const data = trackingData[name] || {};
      const cells = tasks.map((_, i) => {
        const d = data[String(i)];
        if (!d || (!d.solved && !d.failed && !d.attempts)) return '';
        if (d.failed) return '0';
        if (d.solved) {
          const a = d.attempts || 0;
          return String(a === 0 ? 3 : a === 1 ? 2 : 1);
        }
        return `попыток:${d.attempts}`;
      });
      const total = calcScore(data, tasks.length);
      return [name, ...cells, String(total)];
    });

    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const bom = '﻿'; // UTF-8 BOM для Excel
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'марафон'}_результаты.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // =====================================================================
  // ФАЗА «ПОДГОТОВКА» — подвкладки
  // =====================================================================

  // Подвкладка: Содержимое (задачи + ученики + параметры)
  const contentTab = (
    <div className="mg-setup">
      {/* Название и кнопки сохранения живут в шапке страницы — здесь они
          дублировались, и «Новый» стоял там, где ждёшь «Сохранить». */}
      <div className="mg-params">
        <span className="mg-param">
          <span className="mg-param-label">Класс</span>
          <InputNumber
            size="small"
            value={classNumber}
            onChange={setClassNumber}
            min={5} max={11}
            style={{ width: 72 }}
          />
        </span>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Название марафона и сохранение — в шапке страницы.
        </Text>
        {savedId && <span className="mg-param-id">ID: {savedId}</span>}
      </div>

      {/* Задачи */}
      <Card
        size="small"
        title={
          <Space>
            <OrderedListOutlined />
            {`Задачи (${tasks.length})`}
          </Space>
        }
        className="mg-card"
        extra={
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowTaskModal(true)}
          >
            Добавить задачи
          </Button>
        }
      >
        {tasks.length === 0 ? (
          <Empty description="Задачи не выбраны" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={tasks}
            renderItem={(task, idx) => (
              <List.Item
                key={task.id}
                className="mg-task-item"
                actions={[
                  <Tooltip title="Переместить вверх">
                    <Button
                      size="small"
                      icon={<ArrowUpOutlined />}
                      disabled={idx === 0}
                      onClick={() => moveTask(idx, idx - 1)}
                    />
                  </Tooltip>,
                  <Tooltip title="Переместить вниз">
                    <Button
                      size="small"
                      icon={<ArrowDownOutlined />}
                      disabled={idx === tasks.length - 1}
                      onClick={() => moveTask(idx, idx + 1)}
                    />
                  </Tooltip>,
                  <Tooltip title="Удалить">
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeTask(task.id)}
                    />
                  </Tooltip>,
                ]}
              >
                <Space size={8} align="start" style={{ width: '100%', flexWrap: 'wrap' }}>
                  <div
                    className="mg-task-num"
                    style={{ background: DIFFICULTY_COLOR[task.difficulty] || '#1890ff' }}
                  >
                    {idx + 1}
                  </div>
                  <Tag
                    color={DIFFICULTY_COLOR[task.difficulty] || 'blue'}
                    style={{ fontSize: 11 }}
                  >
                    {DIFFICULTY_LABEL[task.difficulty] || '?'}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>{task.code}</Text>
                  <div className="mg-task-preview" style={{ fontSize: 13 }}>
                    <MathRenderer
                      content={(task.statement_md || '').slice(0, 200) + ((task.statement_md || '').length > 200 ? '…' : '')}
                    />
                  </div>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Ученики */}
      <Card
        size="small"
        title={
          <Space>
            <UserOutlined />
            {`Ученики (${students.length})`}
          </Space>
        }
        className="mg-card"
        extra={
          <Button size="small" onClick={() => setShowBulk(v => !v)}>
            Пакетный импорт
          </Button>
        }
      >
        <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
          <Input
            placeholder="Фамилия Имя"
            value={newStudentName}
            onChange={e => setNewStudentName(e.target.value)}
            onPressEnter={handleAddStudent}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddStudent}>
            Добавить
          </Button>
        </Space.Compact>

        {showBulk && (
          <div className="mg-bulk-import">
            <Input.TextArea
              placeholder={"Иванов Иван\nПетров Пётр\nСидорова Мария"}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              rows={5}
              style={{ marginBottom: 8 }}
            />
            <Space>
              <Button type="primary" size="small" onClick={handleBulkImport}>
                Добавить всех
              </Button>
              <Button size="small" onClick={() => { setShowBulk(false); setBulkText(''); }}>
                Отмена
              </Button>
            </Space>
            <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 4 }}>
              По одному имени на строку. Дубликаты игнорируются.
            </Text>
          </div>
        )}

        {students.length === 0 ? (
          <Text type="secondary">Список учеников пуст</Text>
        ) : (
          <div className="mg-students-list">
            {students.map((name, idx) => (
              <div key={name} className="mg-student-item">
                <span className="mg-student-idx">{idx + 1}.</span>
                {editingStudent === name ? (
                  <Input
                    size="small"
                    value={editingValue}
                    onChange={e => setEditingValue(e.target.value)}
                    onPressEnter={() => handleFinishRename(name)}
                    onBlur={() => handleFinishRename(name)}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                ) : (
                  <span
                    className="mg-student-name"
                    onDoubleClick={() => handleStartRename(name)}
                    title="Двойной клик — переименовать"
                  >
                    {name}
                  </span>
                )}
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeStudent(name)}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );

  // ── Вкладки печати ───────────────────────────────────────────────────────
  // Каждый лист описан одинаково: схема раскладки, что это за лист, что внутри
  // и кнопка. Настройки и предпросмотр — на экране самого листа.

  const noTasks = tasks.length === 0;
  const emptyTasks = <Empty description="Добавьте задачи в разделе «Содержимое»" />;

  // Метка сложности на плитке — только когда задачи РАЗНЫЕ. Одинаковая метка на
  // всех карточках ничего не сообщает и читается как украшение.
  const mixedDifficulty = new Set(tasks.map(t => t.difficulty || 1)).size > 1;

  const openWorksheet = (mode) => {
    setWorksheetMode(mode);
    setShowWorksheet(true);
  };

  // Подвкладка: Рабочий лист (отрезные блоки: с местом для решения / карточка)
  const worksheetTab = (
    <div className="mg-print-tab">
      {noTasks ? emptyTasks : (
        <>
          <PrintOption
            thumb={<SheetThumb variant="work" count={3} />}
            title="С местом для решения"
            desc="Лист режется по пунктиру, блок достаётся ученику: поле ФИ, клетки попыток, условие и место под запись."
            bullets={['2–6 блоков на лист', 'клетка, линейка или пусто', 'чертёж в углу зоны решения']}
            actions={(
              <Button type="primary" icon={<PrinterOutlined />} onClick={() => openWorksheet('work')}>
                Открыть лист
              </Button>
            )}
          />
          <PrintOption
            thumb={<SheetThumb variant="work" count={5} solution={false} />}
            title="Только карточка"
            desc="Те же отрезные блоки во всю ширину листа, но без места для записи: ученик решает в тетради, а задач на лист влезает больше."
            bullets={['3–12 блоков на лист', 'чертёж внутри карточки', 'без поля ФИ и клеток попыток']}
            actions={(
              <Button icon={<PrinterOutlined />} onClick={() => openWorksheet('card')}>
                Открыть лист
              </Button>
            )}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Печатаете на весь класс — включите на листе «Заполнять лист»: пачка закончится
            ровно на краю листа, без пустого хвоста.
          </Text>
        </>
      )}
    </div>
  );

  // Подвкладка: Карточки задач (плитка карточек на A4)
  const cardsTab = (
    <div className="mg-print-tab">
      {noTasks ? emptyTasks : (
        <>
          <PrintOption
            thumb={<SheetThumb variant="cards" count={cardSettings.count} cols={cardGrid(cardSettings.count).cols} />}
            title="Карточки задач"
            desc="Лист A4 режется на равные карточки: номер, название марафона и условие. Ученик берёт карточку и решает в тетради."
            bullets={[
              `сейчас ${cardSettings.count} на лист · ${cardFormatLabel(cardSettings.count)}`,
              'от 1 до 12 карточек на лист',
              'поле «Ответ», код задачи и сложность — по выбору',
            ]}
            actions={(
              <Button type="primary" icon={<PrinterOutlined />} onClick={() => setShowCards(true)}>
                Открыть карточки
              </Button>
            )}
          />

          <div className="mg-tiles-head">
            <span className="mg-tiles-title">Что попадёт на карточки</span>
            <Text type="secondary" style={{ fontSize: 12 }}>{tasks.length} задач в порядке марафона</Text>
          </div>

          <div className="mg-tiles">
            {tasks.map((task, idx) => (
              <div key={task.id} className="mg-tile">
                <div className="mg-tile-head">
                  <span className="mg-tile-num">{idx + 1}</span>
                  {mixedDifficulty && (
                    <span className="mg-tile-diff">
                      {DIFFICULTY_LABEL[task.difficulty] || DIFFICULTY_LABEL[1]}
                    </span>
                  )}
                  {task.code && <span className="mg-tile-code">{task.code}</span>}
                </div>
                <div className="mg-tile-body">
                  <MathRenderer content={task.statement_md || ''} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // Подвкладка: Лист учителя — ключи на экране + два печатных листа
  const teacherTab = (
    <div className="mg-print-tab">
      {noTasks ? emptyTasks : (
        <>
          <Card size="small" title="Ключи марафона" className="mg-card">
            <MarathonTeacherKey tasks={tasks} />
          </Card>

          <div className="mg-tiles-head">
            <span className="mg-tiles-title">Распечатать</span>
          </div>

          <PrintOption
            thumb={<SheetThumb variant="answers" count={9} cols={3} />}
            title="Лист ответов"
            desc="Один A4: номер, чертёж и ответ, без условий. Лист, с которым стоят у доски, когда очередь идёт подряд."
            bullets={['сетка подбирается по числу задач', 'чертежи отключаются тумблером']}
            actions={(
              <Button type="primary" icon={<PrinterOutlined />} onClick={() => setShowAnswerSheet(true)}>
                Открыть
              </Button>
            )}
          />
          <PrintOption
            thumb={<SheetThumb variant="table" />}
            title="Полный лист учителя"
            desc="Таблица с условием, ответом и решением. Для сложных задач, где при проверке нужен контекст."
            bullets={['условие + ответ + решение', 'печатается на несколько листов']}
            actions={(
              <Button icon={<PrinterOutlined />} onClick={() => setShowTeacherFull(true)}>
                Открыть
              </Button>
            )}
          />
        </>
      )}
    </div>
  );

  // Подвкладка: Печатный бланк рейтинга
  const ratingReady = students.length > 0 && tasks.length > 0;
  const ratingTab = (
    <div className="mg-print-tab">
      <PrintOption
        thumb={<SheetThumb variant="table" />}
        title="Бланк рейтинга"
        desc="Лист для руки: строки — ученики, столбцы — задачи, в клетке квадратики попыток. Закрасили удачную — балл читается по ней же."
        bullets={[
          ratingReady
            ? `${students.length} учеников × ${tasks.length} задач`
            : 'нужны ученики и задачи',
          'альбомный или книжный лист',
          'не влезло — переносится на следующий лист с шапкой',
        ]}
        disabled={!ratingReady}
        actions={(
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => setShowRating(true)}
            disabled={!ratingReady}
          >
            Открыть бланк
          </Button>
        )}
      />
      {!ratingReady && (
        <Empty description="Добавьте учеников и задачи в разделе «Содержимое»" />
      )}
    </div>
  );

  // =====================================================================
  // ФАЗА «УРОК ИДЁТ» — трекер
  // =====================================================================

  const trackerInitialized = isTrackerInitialized(students, trackingData);

  // Экран до инициализации трекера
  const initScreen = (
    <div className="mg-init-screen">
      <div className="mg-init-icon">🏁</div>
      <h2 className="mg-init-title">Готовы запустить марафон?</h2>
      <p className="mg-init-desc">
        Трекер отслеживает прогресс каждого ученика по каждой задаче в реальном времени.
      </p>
      <div className="mg-init-summary">
        <div className="mg-init-stat">
          <strong>{students.length}</strong>
          <span>учеников</span>
        </div>
        <div className="mg-init-stat">
          <strong>{tasks.length}</strong>
          <span>задач</span>
        </div>
        <div className="mg-init-stat">
          <strong>{tasks.length * 3}</strong>
          <span>max очков</span>
        </div>
      </div>
      <Button
        type="primary"
        size="large"
        onClick={() => {
          handleInitTracking();
        }}
        style={{ marginTop: 8 }}
      >
        🚀 Старт марафона
      </Button>
      {hasProgress(trackingData) && (
        <p className="mg-init-warn">
          ⚠️ Это сбросит текущий прогресс трекера
        </p>
      )}
    </div>
  );

  const trackerContent = (
    <div className="lesson-content">
      {/* Тулбар урока */}
      <div className="mg-lesson-toolbar">
        <div className="seg">
          <button
            className={trackerMode === 'grid' ? 'is-active' : ''}
            onClick={() => setTrackerMode('grid')}
          >
            📊 Сетка
          </button>
          <button
            className={trackerMode === 'queue' ? 'is-active' : ''}
            onClick={() => setTrackerMode('queue')}
          >
            📋 По задачам
          </button>
        </div>

        {savedId && (
          <>
            <button
              className="btn is-primary"
              onClick={async () => {
                // Дашборд живёт на ученическом домене и читает марафон без
                // учительского токена — значит нужен включённый «эфир»
                // (marathons.viewRule, миграция 1784700000).
                if (!livePublic) {
                  try {
                    await setLive(true);
                  } catch {
                    message.error('Не удалось включить эфир — дашборд не откроется');
                    return;
                  }
                }
                const base = import.meta.env.VITE_STUDENT_URL || `${window.location.origin}/student`;
                window.open(`${base}/marathon-live/${savedId}`, '_blank');
              }}
            >
              <DashboardOutlined /> Live-дашборд
            </button>

            {livePublic && (
              <button
                className="btn"
                title="Пока эфир включён, дашборд открывается по ссылке без входа"
                onClick={async () => {
                  try {
                    await setLive(false);
                    message.success('Эфир выключен — дашборд больше не открывается по ссылке');
                  } catch {
                    message.error('Не удалось выключить эфир');
                  }
                }}
              >
                📡 В эфире — выключить
              </button>
            )}
          </>
        )}

        <button className="btn" onClick={handleInitTracking}>
          <ReloadOutlined /> Сброс трекера
        </button>
      </div>

      {/* KPI + лидеры */}
      <StatusStrip
        students={students}
        tasks={tasks}
        trackingData={trackingData}
      />

      {/* Очередь к учителю */}
      <QueueStrip
        students={students}
        tasks={tasks}
        trackingData={trackingData}
        setTrackingData={setTrackingData}
        onSaveTracking={savedId ? saveTracking : null}
      />

      {/* Сетка / По задачам */}
      {trackerMode === 'grid' ? (
        <MarathonTracker
          tasks={tasks}
          students={students}
          trackingData={trackingData}
          setTrackingData={setTrackingData}
          onSaveTracking={savedId ? saveTracking : null}
        />
      ) : (
        <QueueBoard
          tasks={tasks}
          students={students}
          trackingData={trackingData}
          setTrackingData={setTrackingData}
          onSaveTracking={savedId ? saveTracking : null}
        />
      )}
    </div>
  );

  // =====================================================================
  // ПОДВКЛАДКИ — рендер по фазе
  // =====================================================================

  const PREP_TABS = [
    { key: 'content',   label: 'Содержимое',      icon: <OrderedListOutlined /> },
    { key: 'worksheet', label: 'Рабочий лист',    icon: <PrinterOutlined /> },
    { key: 'cards',     label: 'Карточки',         icon: <FileTextOutlined /> },
    { key: 'teacher',   label: 'Лист учителя',    icon: <UserOutlined /> },
    { key: 'rating',    label: 'Бланк рейтинга',  icon: <TrophyOutlined /> },
  ];

  const LIVE_TABS = [
    { key: 'tracker', label: 'Трекер', icon: <TrophyOutlined /> },
  ];

  const currentPrepContent = {
    content: contentTab,
    worksheet: worksheetTab,
    cards: cardsTab,
    teacher: teacherTab,
    rating: ratingTab,
  };

  const currentLiveContent = {
    tracker: trackerInitialized ? trackerContent : initScreen,
  };

  const activeTabs = phase === 'prep' ? PREP_TABS : LIVE_TABS;
  const activeSubtab = phase === 'prep' ? prepTab : liveTab;
  const setActiveSubtab = phase === 'prep' ? setPrepTab : setLiveTab;
  const tabContent = phase === 'prep'
    ? currentPrepContent[prepTab]
    : currentLiveContent[liveTab];

  // =====================================================================
  // RENDER
  // =====================================================================

  if (showWorksheet) {
    return (
      <MarathonWorksheetPrint
        tasks={tasks}
        title={title}
        initialMode={worksheetMode}
        onBack={() => { setShowWorksheet(false); setWorksheetMode(null); }}
      />
    );
  }

  if (showCards) {
    return (
      <MarathonCardsPrint
        tasks={tasks}
        title={title}
        onBack={() => setShowCards(false)}
      />
    );
  }

  if (showRating) {
    return (
      <MarathonRatingPrint
        students={students}
        tasks={tasks}
        title={title}
        classNumber={classNumber}
        onBack={() => setShowRating(false)}
      />
    );
  }

  if (showAnswerSheet) {
    return (
      <MarathonTeacherSheet
        tasks={tasks}
        title={title}
        onBack={() => setShowAnswerSheet(false)}
      />
    );
  }

  if (showTeacherFull) {
    return (
      <MarathonTeacherSheetFull
        tasks={tasks}
        title={title}
        onBack={() => setShowTeacherFull(false)}
      />
    );
  }

  return (
    <div className="marathon-generator">
      {/* ---- Sticky-шапка ---- */}
      <div className="m-header">
        <div className="m-title-row">
          <input
            className="m-title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Название марафона"
            spellCheck={false}
          />
          <div className="m-actions">
            {saveStatus === 'saving' && (
              <span className="m-chip is-saving">⏳ Сохранение…</span>
            )}
            {saveStatus === 'saved' && (
              <span className="m-chip is-saved">✓ Сохранено</span>
            )}
            {saveStatus === 'dirty' && (
              <span className="m-chip">● Не сохранено</span>
            )}
            <button className="btn" onClick={handleLoad}>
              <FolderOpenOutlined /> Загрузить
            </button>
            {/* Кнопка видна всегда: в «Содержимом» её дубля больше нет, а
                исчезающее главное действие читается как поломка. */}
            <button
              className="btn is-primary"
              onClick={handleSave}
              disabled={saving || !tasks.length}
            >
              <SaveOutlined /> {savedId ? 'Обновить' : 'Сохранить'}
            </button>
            {phase === 'live' && students.length > 0 && tasks.length > 0 && (
              <button className="btn" onClick={handleExportCSV} title="Экспорт результатов CSV">
                ↓ CSV
              </button>
            )}
            <Popconfirm title="Сбросить всё?" onConfirm={reset}>
              <button className="btn">
                <ReloadOutlined /> Новый
              </button>
            </Popconfirm>
          </div>
        </div>

        <div className="m-meta">
          <span className="m-chip">
            {classNumber} класс
          </span>
          <span className="m-chip">
            <span className="m-chip-num">{tasks.length}</span> задач
          </span>
          <span className="m-chip">
            <span className="m-chip-num">{students.length}</span> учеников
          </span>
          {savedId && (
            <span className="m-chip is-saved">
              <CheckCircleOutlined /> Сохранён
            </span>
          )}
        </div>

        {/* Phase toggle */}
        <div className={`phase-toggle${phase === 'live' ? ' is-live' : ''}`}>
          <span className="pill" />
          <button
            className={phase === 'prep' ? 'is-active' : ''}
            onClick={() => setPhase('prep')}
          >
            Подготовка
          </button>
          <button
            className={`${phase === 'live' ? 'is-active is-live' : ''}`}
            onClick={handleSwitchToLive}
          >
            {phase === 'live' && <span className="live-dot" />}
            Урок идёт
          </button>
        </div>

        {/* Subtabs */}
        <div className="subtabs">
          {activeTabs.map(tab => (
            <div
              key={tab.key}
              className={`subtab${activeSubtab === tab.key ? ' is-active' : ''}`}
              onClick={() => setActiveSubtab(tab.key)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Контент подвкладки ---- */}
      <div className="mg-tab-content">
        {tabContent}
      </div>

      {/* ---- Модал выбора задач ---- */}
      <TaskSelectModal
        visible={showTaskModal}
        onCancel={() => setShowTaskModal(false)}
        onSelect={(selected) => {
          const arr = Array.isArray(selected) ? selected : [selected];
          addTasks(arr);
          setShowTaskModal(false);
        }}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        excludeIds={tasks.map(t => t.id)}
      />

      {/* ---- Модал загрузки ---- */}
      <Modal
        title="Загрузить марафон"
        open={showLoadModal}
        onCancel={() => setShowLoadModal(false)}
        footer={null}
        width={520}
      >
        {loadingSaved ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
        ) : saved.length === 0 ? (
          <Empty description="Нет сохранённых марафонов" />
        ) : (
          <List
            dataSource={saved}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button size="small" type="primary" onClick={() => handleLoadItem(item)}>
                    Загрузить
                  </Button>,
                  <Popconfirm title="Удалить марафон?" onConfirm={() => handleDelete(item.id)}>
                    <Button size="small" danger>Удалить</Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={item.title}
                  description={
                    <Space size={4}>
                      <Tag>{item.class_number} класс</Tag>
                      <Tag>{(item.task_order || []).length} задач</Tag>
                      <Tag>{(item.students || []).length} учеников</Tag>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(item.created).toLocaleDateString('ru')}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>

    </div>
  );
}
