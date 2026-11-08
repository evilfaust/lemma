import React, { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import {
  Card, Button, Space, Alert, Spin, Row, Col, Statistic,
  Collapse, Select, Tag, Tooltip, Typography, App, InputNumber, Switch,
  DatePicker, Input,
} from 'antd';
import {
  ThunderboltOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import {
  useWorksheetGeneration,
  useTaskDragDrop,
  useWorksheetActions,
  useTaskEditing,
  useTaskStats,
} from '../hooks';
import { poolStatsDetailed } from '../utils/successStats';
import EgeBaseStructureTable from './worksheet/EgeBaseStructureTable';
import KimTaskContent, { KimAnswer } from './worksheet/KimTaskContent';
import KimTaskTools from './worksheet/KimTaskTools';
import KimViewSwitch, { useKimView } from './worksheet/KimViewSwitch';
import KimAnswersSheet from './worksheet/KimAnswersSheet';
import { printKimAnswers } from '../utils/printKimAnswers';
import VariantRenderer from './worksheet/VariantRenderer';
import AnswersPage from './worksheet/AnswersPage';
import ActionButtons from './worksheet/ActionButtons';
import ParallelVariantsModal from './worksheet/ParallelVariantsModal';
import SaveWorkModal from './worksheet/SaveWorkModal';
import LoadWorkModal from './worksheet/LoadWorkModal';
import SessionPanel from './worksheet/SessionPanel';
import TaskSelectModal from './TaskSelectModal';
import TaskReplaceModal from './TaskReplaceModal';
import TaskEditModal from './TaskEditModal';
import './TaskWorksheet.css';
import './EgeVariantGenerator.css';
import { api } from '../services/pocketbase';
import { useOptionalAuth } from '../contexts/AuthContext';
import { generatorsForTopic } from '../utils/egeBaseGeneratedTasks';
import { buildEgeBaseVariants } from '../utils/buildEgeBaseVariants';
import EgeBaseTaskGeneratorModal from './worksheet/EgeBaseTaskGeneratorModal';

const { Text } = Typography;
const { Option } = Select;
const APP_BRAND = '© Лемма 2025–2026 уч. г.';


// Размеры в px (при 96dpi: 1mm ≈ 3.78px)
const MM_TO_PX = 3.78;
const KIM_GAP_PX = 2.5 * MM_TO_PX; // 2.5mm gap

/**
 * Разбивает задачи по страницам на основе реальных DOM-измерений.
 * Простой жадный алгоритм: кладём задачу на текущую страницу если влезает,
 * иначе — на следующую.
 *
 * Печатная высота страницы — 206mm (а не физические 210mm A5): футер прижат
 * к низу через margin-top:auto, и на 210mm округления печати уносили его на
 * пустой следующий лист вместе с контентом последней страницы (задачи 18–21).
 *
 * Размеры печатной A5-страницы (≈148mm × 206mm, padding 5mm со всех сторон):
 *   content area: ≈138mm × 196mm
 *
 * Вычет "служебных" зон:
 *   header (text ~3mm + margin-bottom 4mm) ≈ 7mm
 *   footer (padding-top 2mm + text 3mm) ≈ 5mm
 *   → для задач: 196 - 7 - 5 = 184mm (берём 182 с небольшим запасом)
 *
 * Первая страница задач (стр.2) дополнительно имеет note-box:
 *   padding 1.5mm×2 + text 11px×3×1.18 ≈ 13mm + margin-bottom 2mm ≈ 18mm
 *   → для задач: 182 - 16 = 166mm
 */
const paginateKimByHeight = (tasks, heights) => {
  const withNumbers = tasks.map((task, i) => ({ ...task, kimNumber: i + 1 }));
  if (withNumbers.length === 0) return [];

  // Высота печатной страницы КИМ — 206mm (см. .kim-page в print-CSS, ужата с
  // 210mm ради запаса под футер). Полезная зона для задач = 206 − 10 (padding)
  // − 7 (header) − 5 (footer) ≈ 184mm; берём 182 с небольшим запасом.
  const PAGE_HEIGHT_PX = 182 * MM_TO_PX;
  const FIRST_PAGE_HEIGHT_PX = 166 * MM_TO_PX;

  const pages = [];
  let current = [];
  let usedPx = 0;

  for (const task of withNumbers) {
    const h = heights.get(task.id) || 60; // fallback
    const capacity = pages.length === 0 ? FIRST_PAGE_HEIGHT_PX : PAGE_HEIGHT_PX;
    const gapCost = current.length > 0 ? KIM_GAP_PX : 0;

    if (current.length > 0 && usedPx + gapCost + h > capacity) {
      pages.push(current);
      current = [];
      usedPx = 0;
    }

    if (current.length > 0) usedPx += KIM_GAP_PX;
    current.push(task);
    usedPx += h;
  }
  if (current.length > 0) pages.push(current);

  return pages;
};

const KimCoverPage = ({ variant, kimMeta }) => (
  <div className="kim-page kim-page-cover">
    <div className="kim-cover-body">
      <div className="kim-cover-title">Тренировочная работа по МАТЕМАТИКЕ</div>
      <div className="kim-cover-class">{kimMeta.classNum} класс</div>
      <div className="kim-cover-date">{kimMeta.displayDate}</div>
      <div className="kim-cover-variant">Вариант {kimMeta.variantNumberOverride || variant.number}</div>
      <div className="kim-cover-level">(базовый уровень)</div>

      <div className="kim-cover-student-row">
        <span>Выполнена: ФИО</span>
        <span className="kim-cover-line kim-cover-line-name" />
        <span>класс</span>
        <span className="kim-cover-line kim-cover-line-class" />
      </div>

      <div className="kim-cover-instruction-title">Инструкция по выполнению работы</div>

      <div className="kim-cover-text">
        <p>Работа по математике включает в себя 21 задание.</p>
        <p>На выполнение работы отводится 3 часа (180 минут).</p>
        <p>Ответы к заданиям записываются в виде числа или последовательности цифр в поле ответа в тексте работы.</p>
        <p>При выполнении заданий можно пользоваться черновиком. Записи в черновике не учитываются при оценивании работы. Баллы, полученные Вами за выполненные задания, суммируются. Постарайтесь выполнить как можно больше заданий и набрать наибольшее количество баллов.</p>
      </div>

      <div className="kim-cover-wish">Желаем успеха!</div>
    </div>
    <div className="kim-page-footer">{kimMeta.brand}</div>
  </div>
);

const KimTaskPage = ({ variant, pageNumber, tasks, kimMeta, editing }) => (
  <div className="kim-page kim-page-task">
    <div className="kim-page-header">
      <span>Математика. {kimMeta.classNum} класс. Вариант {kimMeta.variantNumberOverride || variant.number}</span>
      <span>{pageNumber}</span>
    </div>

    {pageNumber === 2 && (
      <div className="kim-page-note">
        <em>Ответом к каждому заданию является конечная десятичная дробь,
        целое число или последовательность цифр. Запишите ответы
        к заданиям в поле ответа в тексте работы.</em>
      </div>
    )}

    <div className="kim-book-tasks">
      {tasks.map((task) => (
        <div key={task.id} className="kim-book-task">
          {editing && <KimTaskTools task={task} editing={editing} />}
          <div className="kim-book-task-number">{task.kimNumber}</div>
          <div className="kim-book-task-main">
            <KimTaskContent task={task} answerTable />
            <KimAnswer task={task} />
          </div>
        </div>
      ))}
    </div>

    <div className="kim-page-footer">{kimMeta.brand}</div>
  </div>
);

/**
 * Печатный КИМ — плоский список A5-страниц.
 *
 * Двухфазный рендер:
 *  1. "measure": задачи рендерятся в скрытый блок внутри React-дерева,
 *     CSS применяется корректно (таблицы, KaTeX и т.д.)
 *  2. useLayoutEffect синхронно снимает offsetHeight, вычисляет пагинацию
 *  3. "render": плоский список A5-страниц (cover + task pages)
 *
 * Для печати: браузер сам разбивает по @page { size: A5; }.
 * Чтобы получить два листа на одном A4 — выбрать "2 страницы на листе" в диалоге печати.
 */
const KimVariantPrint = ({ variant, kimMeta, preview = false, editing = null }) => {
  const tasks = variant.tasks || [];
  const [state, setState] = useState({ taskKey: null, pages: null });
  const taskRefs = useRef([]);

  // Ключ measure-фазы включает СОДЕРЖИМОЕ, а не только id — иначе правка
  // задачи через редактор (id не меняется) не триггерит перерасчёт пагинации
  // и КИМ печатает устаревший текст из закэшированных страниц.
  const taskKey = tasks
    .map((t) => `${t.id}|${t.statement_md || ''}|${t.image || ''}|${t.has_image ? 1 : 0}|${t.kimImageSize || ''}|${t.figurePlacement || ''}`)
    .join('§');
  const needsMeasure = state.taskKey !== taskKey;

  useLayoutEffect(() => {
    if (!needsMeasure) return;
    if (tasks.length === 0) { setState({ taskKey, pages: [] }); return; }

    const heights = new Map();
    tasks.forEach((task, index) => {
      const el = taskRefs.current[index];
      if (el) heights.set(task.id, el.offsetHeight);
    });
    setState({ taskKey, pages: paginateKimByHeight(tasks, heights) });
  });

  // ── Фаза 2: плоский список A5-страниц ──
  // На экране буклет виден только в режиме «Как в печати» (preview); там же
  // у задач панель правки (KimTaskTools, в печать не идёт).
  const taskPages = state.pages || [];
  const booklet = taskPages.length > 0 && (
    <div className={`kim-booklet${preview ? ' kim-booklet--preview' : ''}`}>
      <KimCoverPage variant={variant} kimMeta={kimMeta} />
      {taskPages.map((pageTasks, index) => (
        <KimTaskPage
          key={index}
          variant={variant}
          pageNumber={index + 2}
          tasks={pageTasks}
          kimMeta={kimMeta}
          editing={preview ? editing : null}
        />
      ))}
    </div>
  );

  // ── Фаза 1: скрытый рендер для измерения ──
  // Прежние страницы остаются на месте, пока идёт перемер: иначе на экране
  // («Как в печати») страница на кадр становилась короче и прокрутка
  // прыгала вверх после каждой правки.
  if (needsMeasure) {
    return (
      <>
      {booklet}
      <div className="kim-measure-root">
        <div className="kim-measure-page">
          <div className="kim-measure-tasks">
            {tasks.map((task, index) => (
              <div
                key={task.id}
                ref={(el) => { taskRefs.current[index] = el; }}
                className="kim-book-task"
              >
                <div className="kim-book-task-number">{index + 1}</div>
                <div className="kim-book-task-main">
                  <KimTaskContent task={task} answerTable />
                  <KimAnswer task={task} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
    );
  }

  return booklet || null;
};

/**
 * Генератор полных вариантов ЕГЭ базового уровня (21 задание)
 */
const EgeVariantGenerator = () => {
  const { message } = App.useApp();
  const { egeBaseTopics, subtopics, tags, topics, years, sources, tasksSnapshot } = useReferenceData();
  const printRef = useRef();
  const auth = useOptionalAuth();
  const canGenerate = !!auth?.canEdit;
  const [loading, setGenerationLoading] = useState(false);
  const [generatorTarget, setGeneratorTarget] = useState(null);

  // Настройки каждого слота (21 строка)
  const [slots, setSlots] = useState([]);

  // Настройки генерации
  const [variantsCount, setVariantsCount] = useState(1);
  const [variantsMode, setVariantsMode] = useState('different');

  // Настройки формата
  const [columns] = useState(1);
  const [fontSize, setFontSize] = useState(13);
  const [solutionSpace, setSolutionSpace] = useState('medium');
  const [showSolutionSpace, setShowSolutionSpace] = useState(true);
  const [compactMode] = useState(false);
  const [kimStyle, setKimStyle] = useState(false);
  const [kimView, setKimView] = useKimView();
  const [kimVariantNumber, setKimVariantNumber] = useState('');
  const [kimClass, setKimClass] = useState('11');
  const [kimDate, setKimDate] = useState(null); // null = сегодня, dayjs-объект когда задана
  const [kimShowYear, setKimShowYear] = useState(true);

  // Вычисляемые значения для КИМ-печати
  const kimDisplayDate = (kimDate ? kimDate.toDate() : new Date())
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    .replace(' г.', ' года');
  const kimBrand = kimShowYear ? APP_BRAND : '© Лемма';
  const kimMeta = {
    variantNumberOverride: kimVariantNumber.trim(),
    classNum: kimClass || '11',
    displayDate: kimDisplayDate,
    brand: kimBrand,
  };

  // Модальные окна
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [parallelOpen, setParallelOpen] = useState(false);
  const [savedWorks, setSavedWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [currentWork, setCurrentWork] = useState(null);

  // Модальное окно выбора задачи для фиксации
  const [pinModalSlotIndex, setPinModalSlotIndex] = useState(null);

  // Хуки
  const { variants, setVariants, reset } = useWorksheetGeneration();
  const dragDropHandlers = useTaskDragDrop(variants, setVariants);
  const {
    saving,
    exporting,
    handlePrint,
    handleExportPDF,
    handleSaveWork,
    handleUpdateWork,
    handleLoadWorks,
    handleLoadWork,
    handleDeleteWork,
  } = useWorksheetActions();
  const taskEditing = useTaskEditing(variants, setVariants);

  // Инициализируем слоты как только загрузятся egeBaseTopics
  useEffect(() => {
    if (egeBaseTopics.length === 0) return;
    if (slots.length > 0) return;
    setSlots(
      egeBaseTopics.map(topic => ({
        topicId: topic.id,
        source: 'bank',
        generatorId: null,
        pinnedTask: null,
        subtopics: [],
        difficulty: [],
        tags: [],
      }))
    );
  }, [egeBaseTopics]); // eslint-disable-line react-hooks/exhaustive-deps

  // Пока активен стиль КИМ — держим @page A5 с НУЛЕВЫМИ полями последним
  // правилом в <head>. Иначе глобальный `@page { margin: 10mm 8mm }` из
  // TaskWorksheet.css (безымянные @page решаются по ПОРЯДКУ, а не специфичности;
  // именованные @page Chrome для полей игнорирует) даёт поля ~10мм: печатная
  // область становится МЕНЬШЕ страницы → футер обложки уезжает на пустой
  // 2-й лист, вся вёрстка сдвигается и последние задачи (18–21) пропадают.
  // Инъекция в конец <head> перебивает его при ЛЮБОМ способе печати (кнопка/Cmd+P).
  // Тот же приём, что и в OgeVariantGenerator.
  useEffect(() => {
    if (!kimStyle) return undefined;
    const style = document.createElement('style');
    style.setAttribute('data-kim-page', 'ege-base');
    style.textContent = '@page { size: A5 portrait; margin: 0; }';
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [kimStyle]);

  // Подтемы, сгруппированные по теме

  // Решаемость по каждой теме из реальных ответов учеников (attempt_answers),
  // а не из легаси-поля tasks.success_rate (там ~10к фейковых нулей). Пулинг
  // Σверных/Σвсего по задачам темы. Значение = { rate, c, n, lower } | {rate:null}.
  const { statsByTask, prior } = useTaskStats();
  const successRateByTopic = useMemo(() => {
    const map = {};
    egeBaseTopics.forEach(topic => {
      const ids = tasksSnapshot.filter(t => t.topic === topic.id).map(t => t.id);
      map[topic.id] = poolStatsDetailed(ids, statsByTask);
    });
    return map;
  }, [egeBaseTopics, tasksSnapshot, statsByTask]);

  const updateSlot = (index, field, value) => {
    setSlots(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === 'subtopics') {
        const available = generatorsForTopic(egeBaseTopics.find(t => t.id === next[index].topicId), subtopics, value);
        if (!available.some(g => g.id === next[index].generatorId)) next[index].generatorId = available[0]?.id || null;
        if (!available.length) next[index].source = 'bank';
      }
      if (field === 'generatorId') next[index].source = value ? 'generated' : 'bank';
      return next;
    });
  };

  const openPinModal = (slotIndex) => setPinModalSlotIndex(slotIndex);

  const handlePinTask = (task) => {
    if (pinModalSlotIndex === null) return;
    if (task.topic !== slots[pinModalSlotIndex]?.topicId) {
      message.warning('Выберите задачу из темы этого номера ЕГЭ');
      return;
    }
    updateSlot(pinModalSlotIndex, 'pinnedTask', task);
    setPinModalSlotIndex(null);
    message.success(`Задача ${task.code} зафиксирована в слоте №${egeBaseTopics[pinModalSlotIndex]?.ege_number}`);
  };

  const unpinSlot = (index) => updateSlot(index, 'pinnedTask', null);

  const handleGenerate = async () => {
    if (slots.length === 0) {
      message.warning('Темы ЕГЭ ещё загружаются...');
      return;
    }
    if (loading) return;
    if (!canGenerate && slots.some(s => s.source === 'generated' && !s.pinnedTask)) {
      message.error('Для создания задач нужны права редактора');
      return;
    }
    setGenerationLoading(true);
    try {
      const generated = await buildEgeBaseVariants({ slots, topics: egeBaseTopics, subtopics, variantsCount, variantsMode, api });
      setVariants(generated);
      setCurrentWork(null);
      message.success(`Собрано вариантов: ${generated.length}.${slots.some(s => s.source === 'generated' && !s.pinnedTask) ? ' Новые задачи сохранены в банк.' : ''}`);
    } catch (error) {
      message.error(error.message || 'Ошибка при генерации варианта');
    } finally {
      setGenerationLoading(false);
    }
  };

  const handleReset = () => { reset(); setCurrentWork(null); };

  // Размер чертежа в КИМ-печати per-задача (S/M/L/XL). Пишем в task.kimImageSize
  // конкретной позиции варианта; сохраняется в работе (variants.order.imageSize).
  const handleSetImageSize = (vIdx, tIdx, size) => {
    setVariants(prev => prev.map((variant, vi) => (
      vi !== vIdx ? variant : {
        ...variant,
        tasks: variant.tasks.map((task, ti) => (
          ti !== tIdx ? task : { ...task, kimImageSize: size }
        )),
      }
    )));
  };

  // Место чертежа в КИМ-печати (слева / под условием / справа) → task.figurePlacement;
  // сохраняется в работе рядом с размером (variants.order.figurePlacement).
  const handleSetFigurePlacement = (vIdx, tIdx, placement) => {
    setVariants(prev => prev.map((variant, vi) => (
      vi !== vIdx ? variant : {
        ...variant,
        tasks: variant.tasks.map((task, ti) => (
          ti !== tIdx ? task : { ...task, figurePlacement: placement }
        )),
      }
    )));
  };

  // Печать КИМ-варианта с правильными полями A4
  const handleKimPrint = () => {
    const styleId = 'kim-print-page-style';
    document.getElementById(styleId)?.remove();
    const style = document.createElement('style');
    style.id = styleId;
    // A5 portrait — поля внутри .kim-page (padding: 5mm)
    style.textContent = '@page { size: A5 portrait; margin: 0; }';
    document.head.appendChild(style);
    const cleanup = () => {
      style.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  };

  const handleSave = async (values) => {
    if (currentWork?.id) {
      await handleUpdateWork(currentWork.id, values, variants);
    } else {
      const work = await handleSaveWork(values, variants);
      if (work) setCurrentWork(work);
    }
    setSaveModalVisible(false);
  };

  const handleOpenLoadModal = async () => {
    setLoadModalVisible(true);
    setLoadingWorks(true);
    try {
      const works = await handleLoadWorks();
      setSavedWorks(works);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleLoad = async (workId) => {
    setLoadingWorks(true);
    try {
      const { work, variants: loaded } = await handleLoadWork(workId);
      setVariants(loaded);
      setCurrentWork(work);
      setLoadModalVisible(false);
      message.success(`Работа "${work.title}" загружена`);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleDelete = async (workId) => {
    await handleDeleteWork(workId);
    setSavedWorks(prev => prev.filter(w => w.id !== workId));
  };

  const canGenerateTask = task => generatorsForTopic(egeBaseTopics.find(t => t.id === task.topic), subtopics).length > 0;
  const openTaskGenerator = canGenerate ? (vi, ti, task) => setGeneratorTarget({ vi, ti, task }) : undefined;
  const applyGeneratedTask = task => {
    const { vi, ti } = generatorTarget;
    setVariants(prev => prev.map((variant, i) => i !== vi ? variant : {
      ...variant, tasks: variant.tasks.map((old, j) => j === ti ? task : old),
    }));
    setGeneratorTarget(null);
  };


  const hasVariants = variants.length > 0;

  return (
    <div className="task-worksheet-container ege-base-page">
      <header className="ege-base-page-header no-print">
        <div>
          <Typography.Title level={3}>Варианты ЕГЭ · базовый уровень</Typography.Title>
          <p>Полный вариант из 21 задания. Выберите задачи из банка или создайте новые по готовым прототипам. Номера с генераторами отмечены молнией.</p>
        </div>
        <Button icon={<FolderOpenOutlined />} onClick={handleOpenLoadModal}>Открыть работу</Button>
      </header>

      {/* Настройки */}
      <Card
        title="Состав варианта"
        className="no-print"
        style={{ marginBottom: 16 }}
      >
        {egeBaseTopics.length === 0 ? (
          <Spin tip="Загрузка тем ЕГЭ..." />
        ) : (
          <>
            <Row gutter={[16, 12]} align="middle" wrap className="ege-base-build-toolbar">
              <Col>
                <Text strong>Количество вариантов:</Text>{' '}
                <InputNumber
                  aria-label="Количество вариантов"
                  min={1} max={30}
                  value={variantsCount}
                  onChange={v => setVariantsCount(v || 1)}
                  style={{ width: 70 }}
                  size="small"
                />
              </Col>
              <Col>
                <Text strong>Задачи в вариантах:</Text>{' '}
                <Select
                  value={variantsMode}
                  onChange={setVariantsMode}
                  size="small"
                  style={{ width: 210 }}
                >
                  <Option value="different">Разные</Option>
                  <Option value="same">Одинаковые</Option>
                </Select>
              </Col>
              <Col flex="auto" />
              <Col>
                <Space>
                  {hasVariants && (
                    <Button onClick={handleReset} size="small">Сбросить</Button>
                  )}
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    loading={loading}
                    onClick={handleGenerate}
                    size="middle"
                  >
                    {hasVariants ? 'Собрать заново' : 'Собрать варианты'}
                  </Button>
                </Space>
              </Col>
            </Row>

            <EgeBaseStructureTable
              slots={slots} topics={egeBaseTopics} subtopics={subtopics}
              canGenerate={canGenerate} loading={loading}
              onUpdateSlot={updateSlot} onSetSlots={setSlots}
              onPin={openPinModal} onUnpin={unpinSlot}
              statsByTopic={successRateByTopic} prior={prior}
            />
            <Collapse className="ege-base-print-settings" items={[{
              key: 'print', label: 'Оформление и печать',
              children: (
                <>
                  <Row gutter={[16, 12]} align="middle" wrap>
                    <Col>
                      <Space>
                        <Text strong>Место для решения:</Text>
                        <Switch
                          checked={showSolutionSpace}
                          onChange={setShowSolutionSpace}
                          size="small"
                          disabled={kimStyle}
                        />
                      </Space>
                    </Col>
                    <Col>
                      <Space>
                        <Text strong>Стиль КИМ:</Text>
                        <Tooltip title="Печать в официальном формате: шапка с полями для ФИО, задания с ячейками ответов, лист ответов">
                          <Switch
                            checked={kimStyle}
                            onChange={v => { setKimStyle(v); if (v) setShowSolutionSpace(false); }}
                            size="small"
                            checkedChildren={<FileTextOutlined />}
                          />
                        </Tooltip>
                      </Space>
                    </Col>
                    {!kimStyle && <Col><Space><Text>Размер текста:</Text><InputNumber aria-label="Размер текста" min={9} max={18} value={fontSize} onChange={value => setFontSize(value || 13)} size="small" /></Space></Col>}
                    {!kimStyle && showSolutionSpace && <Col><Space><Text>Место под задачу:</Text><Select aria-label="Место для решения" size="small" value={solutionSpace} onChange={setSolutionSpace} style={{ width: 130 }} options={[{ value: 'small', label: 'Небольшое' }, { value: 'medium', label: 'Среднее' }, { value: 'large', label: 'Большое' }]} /></Space></Col>}
                  </Row>
                  {/* Настройки КИМ — дополнительная строка */}
                  {kimStyle && (
                    <Row
                      gutter={16}
                      align="middle"
                      wrap
                      style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e8e8e8' }}
                    >
                      <Col>
                        <Space size={6}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Вариант №</Text>
                          <Input
                            value={kimVariantNumber}
                            onChange={e => setKimVariantNumber(e.target.value)}
                            placeholder="авто"
                            size="small"
                            style={{ width: 72 }}
                            maxLength={8}
                          />
                        </Space>
                      </Col>
                      <Col>
                        <Space size={6}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Класс</Text>
                          <Input
                            value={kimClass}
                            onChange={e => setKimClass(e.target.value)}
                            size="small"
                            style={{ width: 56 }}
                            maxLength={4}
                          />
                        </Space>
                      </Col>
                      <Col>
                        <Space size={6}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Дата</Text>
                          <DatePicker
                            value={kimDate}
                            onChange={setKimDate}
                            format="DD.MM.YYYY"
                            placeholder="сегодня"
                            size="small"
                            allowClear
                            style={{ width: 130 }}
                          />
                        </Space>
                      </Col>
                      <Col>
                        <Space size={6}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Год в подписи</Text>
                          <Switch
                            checked={kimShowYear}
                            onChange={setKimShowYear}
                            size="small"
                          />
                        </Space>
                      </Col>
                      {(kimVariantNumber || kimClass !== '11' || kimDate) && (
                        <Col>
                          <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
                            → {kimDisplayDate} · {kimClass} кл. · Вар.&nbsp;{kimVariantNumber || '(авто)'}
                          </Text>
                        </Col>
                      )}
                    </Row>
                  )}
                </>
              ),
            }]} />
          </>
        )}
      </Card>

      {/* Ожидание генерации */}
      {loading && (
        <Card className="no-print">
          <Spin tip={`Подбираем задачи для ${variantsCount} варианта(-ов)...`} size="large">
            <div style={{ padding: 40 }} />
          </Spin>
        </Card>
      )}

      {hasVariants && !loading && (
        <>
          {/* Статистика */}
          <Card className="no-print" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col>
                <Statistic title="Вариантов" value={variants.length} />
              </Col>
              <Col>
                <Statistic title="Заданий в варианте" value={variants[0]?.tasks.length ?? 0} />
              </Col>
              <Col>
                <Statistic
                  title="Всего задач"
                  value={variants.reduce((s, v) => s + v.tasks.length, 0)}
                />
              </Col>
              {kimStyle && (
                <Col>
                  <Statistic title="Формат" value="КИМ" valueStyle={{ color: '#1890ff' }} />
                </Col>
              )}
            </Row>
          </Card>

          {/* Кнопки действий */}
          <div className="no-print" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <ActionButtons
              hasVariants={hasVariants}
              onPrint={kimStyle ? null : () => handlePrint(printRef)}
              onExportPDF={kimStyle ? null : () => handleExportPDF(printRef, 'Вариант ЕГЭ базовый уровень')}
              onSave={() => setSaveModalVisible(true)}
              saving={saving}
              exporting={exporting}
            />
            {kimStyle && (
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                size="large"
                onClick={handleKimPrint}
              >
                Распечатать КИМ
              </Button>
            )}
            {kimStyle && (
              <Button
                icon={<PrinterOutlined />}
                size="large"
                onClick={printKimAnswers}
              >
                Лист ответов (учителю)
              </Button>
            )}
            {variants[0]?.tasks?.length > 0 && (
              <Button onClick={() => setParallelOpen(true)}>
                🧬 Параллельные варианты (по образцу)
              </Button>
            )}
          </div>
          <ParallelVariantsModal
            open={parallelOpen}
            onClose={() => setParallelOpen(false)}
            baseTasks={variants[0]?.tasks || []}
            excludeTaskIds={variants.slice(1).flatMap((v) => (v.tasks || []).map((t) => t.id))}
            baseTitle="Вариант ЕГЭ"
          />

          {/* Область печати */}
          <div ref={printRef}>
            {variants.map((variant, vi) => (
              <div key={variant.number}>
                {/* Заголовок на экране */}
                <div className="no-print" style={{
                  borderBottom: '2px solid #1890ff',
                  marginBottom: 8,
                  paddingBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <Tag color="blue" style={{ fontSize: 14, padding: '2px 10px' }}>
                    Вариант {variant.number}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {variant.tasks.length} заданий
                  </Text>
                  {kimStyle && <Tag color="geekblue" icon={<FileTextOutlined />}>КИМ</Tag>}
                  {kimStyle && (
                    <span style={{ marginLeft: 'auto' }}>
                      <KimViewSwitch value={kimView} onChange={setKimView} />
                    </span>
                  )}
                </div>

                {/* Обычный вид (экран + обычная печать) */}
                {!kimStyle && (
                  <VariantRenderer
                    variant={variant}
                    variantIndex={vi}
                    compactMode={compactMode}
                    fontSize={fontSize}
                    columns={columns}
                    showStudentInfo={true}
                    showAnswersInline={false}
                    solutionSpace={showSolutionSpace ? solutionSpace : 'none'}
                    variantLabel="Вариант"
                    hideTaskPrefixes={false}
                    dragDropHandlers={dragDropHandlers}
                    onEditTask={taskEditing.handleEditTask}
                    onReplaceTask={taskEditing.handleReplaceTask}
                    onGenerateTask={openTaskGenerator}
                    canGenerateTask={canGenerateTask}
                  />
                )}

                {/* КИМ-стиль: экран — редактируемый вид, печать — официальный КИМ */}
                {kimStyle && (
                  <>
                    {/* Экранный вид для редактирования */}
                    {kimView !== 'print' && (
                    <div className="no-print">
                      <VariantRenderer
                        variant={variant}
                        variantIndex={vi}
                        compactMode={compactMode}
                        fontSize={fontSize}
                        columns={columns}
                        showStudentInfo={true}
                        showAnswersInline={false}
                        solutionSpace="none"
                        variantLabel="Вариант"
                        hideTaskPrefixes={false}
                        dragDropHandlers={dragDropHandlers}
                        onEditTask={taskEditing.handleEditTask}
                        onReplaceTask={taskEditing.handleReplaceTask}
                        onGenerateTask={openTaskGenerator}
                        canGenerateTask={canGenerateTask}
                        onSetImageSize={handleSetImageSize}
                        onSetFigurePlacement={handleSetFigurePlacement}
                      />
                    </div>
                    )}
                    {/* Печатный КИМ-вид — вне print-only, чтобы measure-фаза (offsetHeight)
                        работала корректно. На экране виден только «Как в печати». */}
                    <KimVariantPrint
                      variant={variant}
                      kimMeta={kimMeta}
                      preview={kimView === 'print'}
                      editing={{
                        variantIndex: vi,
                        onSetImageSize: handleSetImageSize,
                        onSetFigurePlacement: handleSetFigurePlacement,
                        onEditTask: taskEditing.handleEditTask,
                        onReplaceTask: taskEditing.handleReplaceTask,
                        onGenerateTask: openTaskGenerator,
                        canGenerateTask,
                      }}
                    />
                  </>
                )}

                {vi < variants.length - 1 && <div className="page-break" />}
              </div>
            ))}

            {/* Страница ответов — только для обычного стиля */}
            {!kimStyle && <AnswersPage variants={variants} variantLabel="Вариант" />}

            {/* Лист ответов учителю в режиме КИМ — печатается кнопкой, на экране виден «Как в печати» */}
            {kimStyle && (
              <KimAnswersSheet
                variants={variants}
                kimMeta={kimMeta}
                title={currentWork?.title}
                examLabel="ЕГЭ, базовый уровень"
                part1Last={null}
                preview={kimView === 'print'}
              />
            )}
          </div>

          {/* Онлайн-выдача */}
          {currentWork?.id && (
            <Card title="Онлайн-выдача варианта" className="no-print" style={{ marginTop: 16 }}>
              <SessionPanel workId={currentWork.id} />
            </Card>
          )}

          {!currentWork?.id && (
            <Alert
              className="no-print"
              style={{ marginTop: 16 }}
              message="Сохраните работу для онлайн-выдачи ученикам"
              description={
                <Button icon={<SaveOutlined />} type="primary" onClick={() => setSaveModalVisible(true)}>
                  Сохранить работу
                </Button>
              }
              type="warning"
              showIcon
            />
          )}
        </>
      )}

      {/* Модалы */}
      <EgeBaseTaskGeneratorModal
        target={generatorTarget}
        topic={egeBaseTopics.find(t => t.id === generatorTarget?.task.topic)}
        subtopics={subtopics}
        usedStatements={variants.flatMap(v => v.tasks.map(t => t.statement_md))}
        onApply={applyGeneratedTask}
        onCancel={() => setGeneratorTarget(null)}
      />
      <SaveWorkModal
        visible={saveModalVisible}
        onCancel={() => setSaveModalVisible(false)}
        onSave={handleSave}
        saving={saving}
        currentWork={currentWork}
        defaultTitle="Вариант ЕГЭ (база)"
      />
      <LoadWorkModal
        visible={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        onLoad={handleLoad}
        onDelete={handleDelete}
        works={savedWorks}
        loading={loadingWorks}
      />
      <TaskSelectModal
        visible={pinModalSlotIndex !== null}
        onCancel={() => setPinModalSlotIndex(null)}
        onSelect={handlePinTask}
        topics={egeBaseTopics}
        subtopics={subtopics}
        tags={tags}
        initialFilters={pinModalSlotIndex !== null ? { topic: slots[pinModalSlotIndex]?.topicId } : null}
        excludeIds={[]}
      />

      <TaskReplaceModal
        visible={taskEditing.replaceModalVisible}
        taskToReplace={taskEditing.taskToReplace}
        onConfirm={taskEditing.handleConfirmReplace}
        onCancel={taskEditing.handleCancelReplace}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        currentVariantTasks={
          taskEditing.taskToReplace
            ? variants[taskEditing.taskToReplace.variantIndex]?.tasks || []
            : []
        }
      />

      {taskEditing.taskToEdit && (
        <TaskEditModal
          task={taskEditing.taskToEdit}
          visible={taskEditing.editModalVisible}
          onClose={taskEditing.handleCancelEdit}
          onSave={taskEditing.handleSaveEdit}
          onDelete={taskEditing.handleDeleteEdit}
          allTags={tags || []}
          allSources={sources || []}
          allYears={years || []}
          allSubtopics={subtopics || []}
          allTopics={topics || []}
        />
      )}
    </div>
  );
};

export default EgeVariantGenerator;
