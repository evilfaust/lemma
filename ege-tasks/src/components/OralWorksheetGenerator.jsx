import { useState, useRef, useEffect } from 'react';
import {
  Card,
  Form,
  Select,
  Button,
  Space,
  Row,
  Col,
  Switch,
  Radio,
  InputNumber,
  Input,
  message,
  Spin,
  Tag,
  Divider,
  Collapse,
  Modal,
  List,
  Badge,
  Tooltip,
  Alert,
  Empty,
  Segmented,
} from 'antd';
import {
  PrinterOutlined,
  ReloadOutlined,
  FilterOutlined,
  SaveOutlined,
  SearchOutlined,
  SwapOutlined,
  FolderOpenOutlined,
  EditOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  FilePdfOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import html2pdf from 'html2pdf.js';
import MathRenderer from './MathRenderer';
import PrintableWorksheet from './PrintableWorksheet';
import TaskReplaceModal from './TaskReplaceModal';
import TaskEditModal from './TaskEditModal';
import { api } from '../services/pocketbase';
import { filterTaskText } from '../utils/filterTaskText';
import { usePuppeteerPDF } from '../hooks';
import './TaskWorksheet.css';

const { Option } = Select;
const { Panel } = Collapse;

const TaskSheetGenerator = ({ topics, tags, years = [], sources = [], subtopics = [] }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [allTasks, setAllTasks] = useState([]);
  const [variants, setVariants] = useState([]);
  const [columns, setColumns] = useState(1);
  const [fontSize, setFontSize] = useState(12);
  const [showAnswersInline, setShowAnswersInline] = useState(false);
  const [showAnswersPage, setShowAnswersPage] = useState(true);
  const [showStudentInfo, setShowStudentInfo] = useState(true);
  const [variantLabel, setVariantLabel] = useState('Вариант');
  const [solutionSpace, setSolutionSpace] = useState('medium');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  const [compactMode, setCompactMode] = useState(false);
  const [hideTaskPrefixes, setHideTaskPrefixes] = useState(false);
  const [outputMode, setOutputMode] = useState('sheet'); // 'sheet' | 'cards'
  const [cardFormat, setCardFormat] = useState('А6');
  const [showCardAnswers, setShowCardAnswers] = useState(false);
  const [showCardSolutions, setShowCardSolutions] = useState(false);
  const [showCardStudentInfo, setShowCardStudentInfo] = useState(true);
  const printRef = useRef();

  // PDF экспорт
  const [pdfMethod, setPdfMethod] = useState('puppeteer');
  const puppeteerPDF = usePuppeteerPDF();

  // Состояния для тегов
  const [availableTags, setAvailableTags] = useState([]);
  const [tagCounts, setTagCounts] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Состояния для распределения по сложности
  const [difficultyCounts, setDifficultyCounts] = useState([]);

  // Состояния для замены задачи
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [taskToReplace, setTaskToReplace] = useState(null);

  // Состояния для редактирования задачи
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);

  // Состояния для сохранения работы
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [savingWork, setSavingWork] = useState(false);

  // Состояния для загрузки работы
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [savedWorks, setSavedWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);

  // Состояния для drag and drop
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverTask, setDragOverTask] = useState(null);

  // Счётчик доступных задач
  const [availableTasksCount, setAvailableTasksCount] = useState(0);
  const [loadingTasksCount, setLoadingTasksCount] = useState(false);

  // Загружаем доступные теги и счётчик задач при изменении темы/подтем
  useEffect(() => {
    loadAvailableTags();
  }, [selectedTopic, selectedSubtopic]);

  const loadAvailableTags = async () => {
    setLoadingTags(true);
    setLoadingTasksCount(true);
    try {
      const filters = {};
      if (selectedTopic) {
        filters.topic = selectedTopic;
      }

      if (selectedSubtopic) {
        filters.subtopic = selectedSubtopic;
      }

      // Получаем задачи для текущих фильтров (или все если фильтров нет)
      const tasks = await api.getTasks(Object.keys(filters).length > 0 ? filters : {});

      // Сохраняем количество доступных задач
      setAvailableTasksCount(tasks.length);

      // Собираем уникальные теги
      const tagSet = new Set();
      tasks.forEach(task => {
        if (task.tags) {
          if (Array.isArray(task.tags)) {
            task.tags.forEach(tagId => {
              if (tagId) tagSet.add(tagId);
            });
          } else if (typeof task.tags === 'string' && task.tags.length > 0) {
            tagSet.add(task.tags);
          }
        }
      });

      // Фильтруем доступные теги
      const filteredTags = tags.filter(tag => tagSet.has(tag.id));
      setAvailableTags(filteredTags);

    } catch (error) {
      console.error('Error loading available tags:', error);
    } finally {
      setLoadingTags(false);
      setLoadingTasksCount(false);
    }
  };

  const addTagCount = () => {
    const newTagCounts = [...tagCounts, { tag: null, count: 1 }];
    setTagCounts(newTagCounts);

    // Обновляем общее количество
    const totalFromTags = newTagCounts.reduce((sum, item) => sum + (item.count || 0), 0);
    form.setFieldValue('tasksPerVariant', totalFromTags);
  };

  const removeTagCount = (index) => {
    const newTagCounts = tagCounts.filter((_, i) => i !== index);
    setTagCounts(newTagCounts);

    // Обновляем общее количество
    const totalFromTags = newTagCounts.reduce((sum, item) => sum + (item.count || 0), 0);
    form.setFieldValue('tasksPerVariant', totalFromTags);
  };

  const updateTagCount = (index, field, value) => {
    const newTagCounts = [...tagCounts];
    newTagCounts[index][field] = value;
    setTagCounts(newTagCounts);

    // Автоматически обновляем общее количество задач
    if (field === 'count') {
      const totalFromTags = newTagCounts.reduce((sum, item) => sum + (item.count || 0), 0);
      form.setFieldValue('tasksPerVariant', totalFromTags);
    }
  };

  const getTotalTasksFromTags = () => {
    return tagCounts.reduce((sum, item) => sum + (item.count || 0), 0);
  };

  // Функции для распределения по сложности
  const difficultyOptions = [
    { value: '1', label: '1 - Базовый', color: '#52c41a' },
    { value: '2', label: '2 - Средний', color: '#faad14' },
    { value: '3', label: '3 - Повышенный', color: '#ff4d4f' },
    { value: '4', label: '4 - Высокий', color: '#722ed1' },
    { value: '5', label: '5 - Олимпиадный', color: '#13c2c2' },
  ];

  const addDifficultyCount = () => {
    const newCounts = [...difficultyCounts, { difficulty: null, count: 1 }];
    setDifficultyCounts(newCounts);
    const total = newCounts.reduce((sum, item) => sum + (item.count || 0), 0);
    form.setFieldValue('tasksPerVariant', total);
  };

  const removeDifficultyCount = (index) => {
    const newCounts = difficultyCounts.filter((_, i) => i !== index);
    setDifficultyCounts(newCounts);
    const total = newCounts.reduce((sum, item) => sum + (item.count || 0), 0);
    form.setFieldValue('tasksPerVariant', total);
  };

  const updateDifficultyCount = (index, field, value) => {
    const newCounts = [...difficultyCounts];
    newCounts[index][field] = value;
    setDifficultyCounts(newCounts);
    if (field === 'count') {
      const total = newCounts.reduce((sum, item) => sum + (item.count || 0), 0);
      form.setFieldValue('tasksPerVariant', total);
    }
  };

  const getTotalTasksFromDifficulty = () => {
    return difficultyCounts.reduce((sum, item) => sum + (item.count || 0), 0);
  };

  const validateDifficultyCounts = () => {
    for (let i = 0; i < difficultyCounts.length; i++) {
      if (!difficultyCounts[i].difficulty) {
        message.error(`Выберите уровень сложности для строки ${i + 1}`);
        return false;
      }
    }
    const selected = difficultyCounts.map(item => item.difficulty);
    const unique = new Set(selected);
    if (selected.length !== unique.size) {
      message.error('Каждый уровень сложности можно выбрать только один раз');
      return false;
    }
    return true;
  };

  const validateTagCounts = () => {
    const totalTasks = form.getFieldValue('tasksPerVariant') || 0;
    const totalFromTags = getTotalTasksFromTags();

    if (totalFromTags !== totalTasks) {
      message.error(`Сумма задач по тегам (${totalFromTags}) должна равняться общему количеству (${totalTasks})`);
      return false;
    }

    // Проверяем, что все теги выбраны
    for (let i = 0; i < tagCounts.length; i++) {
      if (!tagCounts[i].tag) {
        message.error(`Выберите тег для строки ${i + 1}`);
        return false;
      }
    }

    // Проверяем на дубликаты тегов
    const selectedTags = tagCounts.map(item => item.tag);
    const uniqueTags = new Set(selectedTags);
    if (selectedTags.length !== uniqueTags.size) {
      message.error('Каждый тег можно выбрать только один раз');
      return false;
    }

    return true;
  };

  const handleGenerate = async (values) => {
    setLoading(true);
    try {
      const variantsCount = values.variantsCount || 1;
      const tasksPerVariant = values.tasksPerVariant || 20;
      const variantsMode = values.variantsMode || 'different';

      const generatedVariants = [];

      // Базовые фильтры из формы (включая теги-фильтры)
      const baseFilterTags = values.filterTags && values.filterTags.length > 0 ? values.filterTags : null;

      // Вспомогательная функция для добавления общих фильтров
      const applyCommonFilters = (filters) => {
        if (values.topic) filters.topic = values.topic;
        if (values.subtopic) filters.subtopic = values.subtopic;
        if (values.difficulty) filters.difficulty = values.difficulty;
        if (values.source) filters.source = values.source;
        if (values.year) filters.year = values.year;
        if (baseFilterTags) filters.tags = baseFilterTags;
        if (values.hasAnswer !== undefined) filters.hasAnswer = values.hasAnswer === 'yes';
        if (values.hasSolution !== undefined) filters.hasSolution = values.hasSolution === 'yes';
        return filters;
      };

      // Если теги настроены, используем их
      if (tagCounts.length > 0) {
        // Валидация
        if (!validateTagCounts()) {
          setLoading(false);
          return;
        }

        // Вспомогательная: фильтры для конкретного тега распределения
        const makeTagFilters = (tagId) => {
          const combinedTags = baseFilterTags
            ? [...new Set([tagId, ...baseFilterTags])]
            : [tagId];
          return applyCommonFilters({ tags: combinedTags });
        };

        // Собираем все доступные задачи по тегам для проверки
        const allAvailableTasks = {};
        for (const tagCount of tagCounts) {
          const tasks = await api.getTasks(makeTagFilters(tagCount.tag));
          allAvailableTasks[tagCount.tag] = tasks;
        }

        // Для режима "Разные задачи" генерируем каждый вариант отдельно
        if (variantsMode === 'different') {
          // Отслеживаем использованные задачи, чтобы не повторяться между вариантами
          const usedTaskIds = new Set();

          for (let i = 0; i < variantsCount; i++) {
            const variantTasks = [];

            for (const tagCount of tagCounts) {
              // Получаем задачи для этого тега, исключая уже использованные
              const availableTasks = allAvailableTasks[tagCount.tag].filter(
                t => !usedTaskIds.has(t.id)
              );

              // Перемешиваем и берём нужное количество
              const shuffled = [...availableTasks].sort(() => Math.random() - 0.5);
              const selected = shuffled.slice(0, tagCount.count);

              if (selected.length < tagCount.count) {
                const tagName = availableTags.find(t => t.id === tagCount.tag)?.title || 'неизвестный';
                message.warning(`Вариант ${i + 1}: для тега "${tagName}" найдено только ${selected.length} задач из ${tagCount.count} (не хватает уникальных задач)`);
              }

              // Добавляем в использованные
              selected.forEach(t => usedTaskIds.add(t.id));
              variantTasks.push(...selected);
            }

            // Перемешиваем задачи внутри варианта если нужно
            if (values.sortType === 'random') {
              variantTasks.sort(() => Math.random() - 0.5);
            }

            generatedVariants.push({
              number: i + 1,
              tasks: variantTasks,
            });
          }
        } else {
          // Для режимов "shuffled" и "same" - собираем один набор задач
          const baseTasks = [];
          for (const tagCount of tagCounts) {
            const tasks = await api.getRandomTasks(tagCount.count, makeTagFilters(tagCount.tag));

            if (tasks.length < tagCount.count) {
              const tagName = availableTags.find(t => t.id === tagCount.tag)?.title || 'неизвестный';
              message.warning(`Для тега "${tagName}" найдено только ${tasks.length} задач из ${tagCount.count} запрошенных`);
            }

            baseTasks.push(...tasks);
          }

          // Перемешиваем базовый набор если нужно
          if (values.sortType === 'random') {
            baseTasks.sort(() => Math.random() - 0.5);
          }

          if (variantsMode === 'shuffled') {
            // Одинаковые задачи, разный порядок
            for (let i = 0; i < variantsCount; i++) {
              const shuffled = [...baseTasks].sort(() => Math.random() - 0.5);
              generatedVariants.push({
                number: i + 1,
                tasks: shuffled,
              });
            }
          } else {
            // Одинаковые задачи, одинаковый порядок
            for (let i = 0; i < variantsCount; i++) {
              generatedVariants.push({
                number: i + 1,
                tasks: [...baseTasks],
              });
            }
          }
        }

        setAllTasks(generatedVariants.flatMap(v => v.tasks));

      } else if (difficultyCounts.length > 0) {
        // Генерация с распределением по сложности
        if (!validateDifficultyCounts()) {
          setLoading(false);
          return;
        }

        // Сортируем по возрастанию сложности — лёгкие задачи вначале
        const sortedDifficultyCounts = [...difficultyCounts].sort(
          (a, b) => (a.difficulty || '0').localeCompare(b.difficulty || '0')
        );

        // Собираем задачи по уровням сложности
        const allAvailableTasks = {};
        for (const dc of sortedDifficultyCounts) {
          const filters = applyCommonFilters({ difficulty: dc.difficulty });
          const tasks = await api.getTasks(filters);
          allAvailableTasks[dc.difficulty] = tasks;
        }

        if (variantsMode === 'different') {
          const usedTaskIds = new Set();

          for (let i = 0; i < variantsCount; i++) {
            const variantTasks = [];

            // Добавляем задачи группами по возрастанию сложности
            for (const dc of sortedDifficultyCounts) {
              const availableTasks = allAvailableTasks[dc.difficulty].filter(
                t => !usedTaskIds.has(t.id)
              );

              const shuffled = [...availableTasks].sort(() => Math.random() - 0.5);
              const selected = shuffled.slice(0, dc.count);

              if (selected.length < dc.count) {
                const label = difficultyOptions.find(o => o.value === dc.difficulty)?.label || dc.difficulty;
                message.warning(`Вариант ${i + 1}: для сложности "${label}" найдено только ${selected.length} задач из ${dc.count}`);
              }

              selected.forEach(t => usedTaskIds.add(t.id));
              variantTasks.push(...selected);
            }

            // Не перемешиваем — порядок по возрастанию сложности сохраняется

            generatedVariants.push({
              number: i + 1,
              tasks: variantTasks,
            });
          }
        } else {
          const baseTasks = [];
          // Добавляем задачи группами по возрастанию сложности
          for (const dc of sortedDifficultyCounts) {
            const filters = applyCommonFilters({ difficulty: dc.difficulty });
            const tasks = await api.getRandomTasks(dc.count, filters);

            if (tasks.length < dc.count) {
              const label = difficultyOptions.find(o => o.value === dc.difficulty)?.label || dc.difficulty;
              message.warning(`Для сложности "${label}" найдено только ${tasks.length} задач из ${dc.count}`);
            }

            baseTasks.push(...tasks);
          }

          // Не перемешиваем — порядок по возрастанию сложности сохраняется

          if (variantsMode === 'shuffled') {
            // В режиме "перемешанные" — перемешиваем только внутри каждого уровня сложности,
            // но общий порядок (от лёгких к сложным) сохраняется
            for (let i = 0; i < variantsCount; i++) {
              generatedVariants.push({ number: i + 1, tasks: [...baseTasks] });
            }
          } else {
            for (let i = 0; i < variantsCount; i++) {
              generatedVariants.push({ number: i + 1, tasks: [...baseTasks] });
            }
          }
        }

        setAllTasks(generatedVariants.flatMap(v => v.tasks));

      } else {
        // Стандартная генерация без тегов и без распределения по сложности
        const filters = applyCommonFilters({});

        const hasServerFilters = Object.keys(filters).length > 0;
        const tasksData = await api.getTasks(hasServerFilters ? filters : {});

        let filteredTasks = tasksData;

        // Клиентский поиск
        if (values.search) {
          const searchLower = values.search.toLowerCase();
          filteredTasks = filteredTasks.filter(task =>
            task.code?.toLowerCase().includes(searchLower) ||
            task.statement_md?.toLowerCase().includes(searchLower)
          );
        }

        if (filteredTasks.length === 0) {
          message.warning('Задачи не найдены по заданным фильтрам');
          setAllTasks([]);
          setVariants([]);
          setLoading(false);
          return;
        }

        // Сортировка
        let sortedTasks = [...filteredTasks];
        const sortType = values.sortType || 'code';

        if (sortType === 'code') {
          sortedTasks.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        } else if (sortType === 'difficulty') {
          sortedTasks.sort((a, b) => (a.difficulty || '1').localeCompare(b.difficulty || '1'));
        } else if (sortType === 'random') {
          sortedTasks = sortedTasks.sort(() => Math.random() - 0.5);
        }

        setAllTasks(sortedTasks);

        if (variantsMode === 'different') {
          // Разные задачи в каждом варианте
          for (let i = 0; i < variantsCount; i++) {
            const startIdx = i * tasksPerVariant;
            const endIdx = Math.min(startIdx + tasksPerVariant, sortedTasks.length);
            generatedVariants.push({
              number: i + 1,
              tasks: sortedTasks.slice(startIdx, endIdx),
            });
          }
        } else if (variantsMode === 'shuffled') {
          // Одинаковые задачи, разный порядок
          const baseTasks = sortedTasks.slice(0, tasksPerVariant);
          for (let i = 0; i < variantsCount; i++) {
            const shuffled = [...baseTasks].sort(() => Math.random() - 0.5);
            generatedVariants.push({
              number: i + 1,
              tasks: shuffled,
            });
          }
        } else {
          // Одинаковые задачи, одинаковый порядок
          const baseTasks = sortedTasks.slice(0, tasksPerVariant);
          for (let i = 0; i < variantsCount; i++) {
            generatedVariants.push({
              number: i + 1,
              tasks: [...baseTasks],
            });
          }
        }
      }

      setVariants(generatedVariants);

      const totalTasks = generatedVariants.reduce((sum, v) => sum + v.tasks.length, 0);
      message.success(`Сгенерировано ${variantsCount} вариант(ов), всего ${totalTasks} задач`);
    } catch (error) {
      console.error('Error loading tasks:', error);
      message.error('Ошибка при загрузке задач');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!printRef.current) return;

    const workTitle = form.getFieldValue('workTitle') || 'Лист задач';

    // Используем новый метод если доступен
    if (pdfMethod === 'puppeteer') {
      const success = await puppeteerPDF.exportToPDF(printRef, workTitle);

      // Fallback на старый метод если Puppeteer недоступен
      if (!success && !puppeteerPDF.serverAvailable) {
        message.warning('Переключаемся на резервный метод экспорта...');
        await handleExportPDFLegacy(workTitle);
      }
      return;
    }

    // Используем старый метод
    await handleExportPDFLegacy(workTitle);
  };

  const handleExportPDFLegacy = async (workTitle) => {
    message.loading({ content: 'Генерируем PDF (Legacy)...', key: 'pdf', duration: 0 });

    try {
      const opt = {
        margin: [7, 7, 7, 7], // мм
        filename: `${workTitle}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        },
        pagebreak: { mode: 'css', before: '.page-break', avoid: ['.task-item', '.variant-header'] }
      };

      await html2pdf().set(opt).from(printRef.current).save();
      message.success({ content: 'PDF успешно сохранён', key: 'pdf', duration: 2 });
    } catch (error) {
      console.error('Error generating PDF:', error);
      message.error({ content: 'Ошибка при генерации PDF', key: 'pdf', duration: 2 });
    }
  };

  const handleReset = () => {
    setAllTasks([]);
    setVariants([]);
    setSelectedTopic(null);
    setSelectedSubtopic(null);
    setTagCounts([]);
    setDifficultyCounts([]);
    form.resetFields();
  };

  const handleFormValuesChange = (changedValues) => {
    if ('topic' in changedValues) {
      setSelectedTopic(changedValues.topic || null);
      setSelectedSubtopic(null);
      form.setFieldValue('subtopic', undefined);
      form.setFieldValue('filterTags', []);
      setTagCounts([]);
      setDifficultyCounts([]);
    }
  };

  const handleReplaceTask = (variantIndex, taskIndex, task) => {
    setTaskToReplace({ variantIndex, taskIndex, task });
    setReplaceModalVisible(true);
  };

  const handleConfirmReplace = (newTask) => {
    const { variantIndex, taskIndex } = taskToReplace;
    const newVariants = [...variants];
    newVariants[variantIndex].tasks[taskIndex] = newTask;
    setVariants(newVariants);
    setReplaceModalVisible(false);
    message.success('Задача успешно заменена');
  };

  const handleCancelReplace = () => {
    setReplaceModalVisible(false);
    setTaskToReplace(null);
  };

  const handleEditTask = (task) => {
    setTaskToEdit(task);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async (taskId, values) => {
    try {
      await api.updateTask(taskId, values);
      const newVariants = variants.map(variant => ({
        ...variant,
        tasks: variant.tasks.map(t =>
          t.id === taskId ? { ...t, ...values } : t
        )
      }));
      setVariants(newVariants);
      setEditModalVisible(false);
      setTaskToEdit(null);
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteEdit = async (taskId) => {
    await api.deleteTask(taskId);
    // Удаляем задачу из всех вариантов
    const newVariants = variants.map(variant => ({
      ...variant,
      tasks: variant.tasks.filter(t => t.id !== taskId)
    }));
    setVariants(newVariants);
    setEditModalVisible(false);
    setTaskToEdit(null);
  };

  const handleSaveWork = async (values) => {
    setSavingWork(true);
    try {
      const workData = {
        title: values.workTitle || 'Лист задач',
        topic: form.getFieldValue('topic') || null,
        time_limit: values.timeLimit ? parseInt(values.timeLimit) : null,
      };

      const work = await api.createWork(workData);

      for (const variant of variants) {
        const taskIds = variant.tasks.map(t => t.id);
        const order = variant.tasks.map((t, idx) => ({ taskId: t.id, position: idx }));

        await api.createVariant({
          work: work.id,
          number: variant.number,
          tasks: taskIds,
          order: order,
        });
      }

      message.success(`Работа "${workData.title}" успешно сохранена с ${variants.length} вариантами`);
      setSaveModalVisible(false);
    } catch (error) {
      console.error('Error saving work:', error);
      message.error('Ошибка при сохранении работы');
    } finally {
      setSavingWork(false);
    }
  };

  const handleOpenLoadModal = async () => {
    setLoadModalVisible(true);
    setLoadingWorks(true);
    try {
      const works = await api.getWorks();
      setSavedWorks(works);
    } catch (error) {
      console.error('Error loading works:', error);
      message.error('Ошибка при загрузке работ');
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleLoadWork = async (workId) => {
    setLoadingWorks(true);
    try {
      const work = await api.getWork(workId);
      const variantsData = await api.getVariantsByWork(workId);

      const loadedVariants = [];
      for (const variantData of variantsData) {
        const tasksIds = variantData.tasks || [];
        const order = variantData.order || [];

        const tasks = [];
        for (const taskId of tasksIds) {
          const task = await api.getTask(taskId);
          if (task) {
            tasks.push(task);
          }
        }

        if (order.length > 0) {
          tasks.sort((a, b) => {
            const posA = order.find(o => o.taskId === a.id)?.position ?? 999;
            const posB = order.find(o => o.taskId === b.id)?.position ?? 999;
            return posA - posB;
          });
        }

        loadedVariants.push({
          number: variantData.number,
          tasks: tasks,
        });
      }

      setVariants(loadedVariants);

      form.setFieldsValue({
        workTitle: work.title,
        topic: work.topic,
      });

      setLoadModalVisible(false);
      message.success(`Работа "${work.title}" успешно загружена`);
    } catch (error) {
      console.error('Error loading work:', error);
      message.error('Ошибка при загрузке работы');
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleDeleteWork = async (workId, workTitle) => {
    try {
      const variantsData = await api.getVariantsByWork(workId);
      for (const variant of variantsData) {
        await api.deleteVariant(variant.id);
      }

      await api.deleteWork(workId);
      setSavedWorks(savedWorks.filter(w => w.id !== workId));
      message.success(`Работа "${workTitle}" удалена`);
    } catch (error) {
      console.error('Error deleting work:', error);
      message.error('Ошибка при удалении работы');
    }
  };

  // Обработчики drag and drop
  const handleDragStart = (e, variantIndex, taskIndex) => {
    setDraggedTask({ variantIndex, taskIndex });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, variantIndex, taskIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTask({ variantIndex, taskIndex });
  };

  const handleDragLeave = () => {
    setDragOverTask(null);
  };

  const handleDrop = (e, targetVariantIndex, targetTaskIndex) => {
    e.preventDefault();

    if (!draggedTask) return;

    const { variantIndex: sourceVariantIndex, taskIndex: sourceTaskIndex } = draggedTask;

    // Если перетащили на то же место
    if (sourceVariantIndex === targetVariantIndex && sourceTaskIndex === targetTaskIndex) {
      setDraggedTask(null);
      setDragOverTask(null);
      return;
    }

    const newVariants = [...variants];
    const sourceTask = newVariants[sourceVariantIndex].tasks[sourceTaskIndex];

    // Удаляем задачу из исходного варианта
    newVariants[sourceVariantIndex].tasks.splice(sourceTaskIndex, 1);

    // Вставляем задачу в целевой вариант
    newVariants[targetVariantIndex].tasks.splice(targetTaskIndex, 0, sourceTask);

    setVariants(newVariants);
    setDraggedTask(null);
    setDragOverTask(null);
    message.success('Задача перемещена');
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverTask(null);
  };

  const applyTaskTextFilter = (text) => {
    if (!hideTaskPrefixes) return text;
    return filterTaskText(text);
  };

  const renderVariant = (variant, workTitle, variantIndex) => {
    // Компактный режим для устного счета
    if (compactMode) {
      return (
        <div key={variant.number} className="variant-container compact-mode">
          <div className="variant-header-compact">
            <h2>{variantLabel} {variant.number}</h2>
          </div>

          <div
            className="tasks-content-compact"
            style={{
              fontSize: `${fontSize}pt`,
            }}
          >
            {variant.tasks.map((task, taskIndex) => {
              const isDragging = draggedTask?.variantIndex === variantIndex && draggedTask?.taskIndex === taskIndex;
              const isDragOver = dragOverTask?.variantIndex === variantIndex && dragOverTask?.taskIndex === taskIndex;

              return (
              <div
                key={task.id}
                className={`task-item-compact ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, variantIndex, taskIndex)}
                onDragOver={(e) => handleDragOver(e, variantIndex, taskIndex)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, variantIndex, taskIndex)}
                onDragEnd={handleDragEnd}
              >
                <div className="compact-answer-box"></div>
                <div className="compact-task-content">
                  <span className="compact-task-number">{taskIndex + 1}.</span>
                  <MathRenderer text={applyTaskTextFilter(task.statement_md)} />
                </div>
                {/* Кнопки управления (только на экране) */}
                <div className="no-print compact-controls">
                  <Tooltip title="Редактировать задачу">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEditTask(task)}
                    />
                  </Tooltip>
                  <Tooltip title="Заменить задачу">
                    <Button
                      type="text"
                      size="small"
                      icon={<SwapOutlined />}
                      onClick={() => handleReplaceTask(variantIndex, taskIndex, task)}
                    />
                  </Tooltip>
                </div>
              </div>
              );
            })}
          </div>

          <div className="page-break"></div>
        </div>
      );
    }

    // Обычный режим
    return (
      <div key={variant.number} className="variant-container">
        <div className="variant-header">
          <h2>{variantLabel} {variant.number}</h2>
          {showStudentInfo && (
            <div className="student-info">
              <div className="student-info-field">
                <span className="student-info-label">Фамилия:</span>
                <div className="student-info-line"></div>
              </div>
              <div className="student-info-field">
                <span className="student-info-label">Имя:</span>
                <div className="student-info-line"></div>
              </div>
            </div>
          )}
        </div>

        <div
          className="tasks-content"
          style={{
            fontSize: `${fontSize}pt`,
            columnCount: columns,
            columnGap: '20px',
            columnRule: columns > 1 ? '1px solid #ddd' : 'none',
          }}
        >
          {variant.tasks.map((task, taskIndex) => {
            const isDragging = draggedTask?.variantIndex === variantIndex && draggedTask?.taskIndex === taskIndex;
            const isDragOver = dragOverTask?.variantIndex === variantIndex && dragOverTask?.taskIndex === taskIndex;

            return (
            <div
              key={task.id}
              className={`task-item ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, variantIndex, taskIndex)}
              onDragOver={(e) => handleDragOver(e, variantIndex, taskIndex)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, variantIndex, taskIndex)}
              onDragEnd={handleDragEnd}
            >
              <div className="task-header">
                <span className="task-number">{taskIndex + 1}.</span>
                <span className="task-code">{task.code}</span>
                <div className="no-print" style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                  <Tooltip title="Редактировать задачу">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEditTask(task)}
                    />
                  </Tooltip>
                  <Tooltip title="Заменить задачу">
                    <Button
                      type="text"
                      size="small"
                      icon={<SwapOutlined />}
                      onClick={() => handleReplaceTask(variantIndex, taskIndex, task)}
                    />
                  </Tooltip>
                </div>
                {/* Прямоугольник для ответа (только для печати) */}
                <div className="answer-box"></div>
              </div>

              <div className="task-content">
                <MathRenderer text={applyTaskTextFilter(task.statement_md)} />

                {task.has_image && task.image_url && (
                  <div className="task-image">
                    <img src={task.image_url} alt="" />
                  </div>
                )}
              </div>

              {showAnswersInline && task.answer && (
                <div className="task-answer">
                  <strong>Ответ:</strong>{' '}
                  <MathRenderer text={task.answer} />
                </div>
              )}

              {!showAnswersInline && (
                <div className={`answer-space answer-space-${solutionSpace}`}>
                  {solutionSpace !== 'none' && 'Решение:'}
                </div>
              )}
            </div>
            );
          })}
        </div>

        <div className="page-break"></div>
      </div>
    );
  };

  const renderAnswersPage = () => {
    if (!showAnswersPage || variants.length === 0) return null;

    return (
      <div className="answers-page">
        <h2>Ответы</h2>
        {variants.map((variant) => (
          <div key={variant.number} className="variant-answers">
            <h3>{variantLabel} {variant.number}</h3>
            <div className="answers-grid">
              {variant.tasks.map((task, index) => (
                <div key={task.id} className="answer-item">
                  <span className="answer-number">{index + 1}.</span>
                  <span className="answer-value">
                    {task.answer ? <MathRenderer text={task.answer} /> : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="task-worksheet-container">
      <Card
        title={
          <Space>
            <FilterOutlined />
            Листы задач - настройки
          </Space>
        }
        className="no-print"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleGenerate}
          onValuesChange={handleFormValuesChange}
          initialValues={{
            columns: 1,
            fontSize: 12,
            sortType: 'random',
            variantsCount: 1,
            variantsMode: 'different',
            tasksPerVariant: 20,
          }}
        >
          <Collapse defaultActiveKey={['filters', 'tags', 'variants', 'format']}>
            {/* Фильтры */}
            <Panel
              header={
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span>📋 Фильтры задач</span>
                  <Badge
                    count={loadingTasksCount ? '...' : availableTasksCount}
                    overflowCount={9999}
                    style={{ backgroundColor: availableTasksCount > 0 ? '#52c41a' : '#ff4d4f' }}
                    showZero
                  />
                </span>
              }
              key="filters"
            >
              <Row gutter={16}>
                <Col xs={24}>
                  <Form.Item name="search" label="Поиск по коду или тексту">
                    <Input
                      placeholder="Введите код задачи или текст..."
                      prefix={<SearchOutlined />}
                      allowClear
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="topic"
                    label="Тема"
                  >
                    <Select
                      placeholder="Все темы"
                      showSearch
                      optionFilterProp="children"
                      allowClear
                    >
                      {topics.map(topic => (
                        <Option key={topic.id} value={topic.id}>
                          №{topic.ege_number} - {topic.title}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="subtopic" label="Подтема">
                    <Select
                      placeholder={selectedTopic ? "Выберите подтему" : "Сначала выберите тему"}
                      showSearch
                      optionFilterProp="children"
                      allowClear
                      disabled={!selectedTopic}
                      onChange={(value) => setSelectedSubtopic(value || null)}
                    >
                      {subtopics
                        .filter(subtopic => !selectedTopic || subtopic.topic === selectedTopic)
                        .map(subtopic => (
                          <Option key={subtopic.id} value={subtopic.id}>
                            {subtopic.name}
                          </Option>
                        ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="difficulty" label="Сложность">
                    <Select placeholder="Любая" allowClear>
                      <Option value="1">1 - Базовый</Option>
                      <Option value="2">2 - Средний</Option>
                      <Option value="3">3 - Повышенный</Option>
                      <Option value="4">4 - Высокий</Option>
                      <Option value="5">5 - Олимпиадный</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="filterTags" label="Теги">
                    <Select
                      mode="multiple"
                      placeholder="Фильтр по тегам"
                      allowClear
                      showSearch
                      optionFilterProp="children"
                      loading={loadingTags}
                    >
                      {availableTags.map(tag => (
                        <Option key={tag.id} value={tag.id}>
                          <Tag color={tag.color} style={{ marginRight: 4 }}>{tag.title}</Tag>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="source" label="Источник">
                    <Select placeholder="Любой" allowClear showSearch>
                      {sources.map(s => (
                        <Option key={s} value={s}>{s}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="year" label="Год">
                    <Select placeholder="Любой" allowClear showSearch>
                      {years.map(y => (
                        <Option key={y} value={y}>{y}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="sortType" label="Сортировка">
                    <Select>
                      <Option value="code">По коду</Option>
                      <Option value="difficulty">По сложности</Option>
                      <Option value="random">Случайная</Option>
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="hasAnswer" label="Наличие ответа">
                    <Radio.Group>
                      <Radio.Button value={undefined}>Все</Radio.Button>
                      <Radio.Button value="yes">С ответом</Radio.Button>
                      <Radio.Button value="no">Без ответа</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="hasSolution" label="Наличие решения">
                    <Radio.Group>
                      <Radio.Button value={undefined}>Все</Radio.Button>
                      <Radio.Button value="yes">С решением</Radio.Button>
                      <Radio.Button value="no">Без решения</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>
            </Panel>

            {/* Теги */}
            <Panel header="🏷️ Распределение по тегам (опционально)" key="tags">
              {!selectedTopic && (
                <Alert
                  message="Выберите тему, чтобы настроить распределение по тегам"
                  type="warning"
                  style={{ marginBottom: 16 }}
                />
              )}

              {selectedTopic && loadingTags && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <Spin tip="Загрузка доступных тегов..." />
                </div>
              )}

              {selectedTopic && !loadingTags && availableTags.length === 0 && (
                <Alert
                  message="В выбранной теме нет задач с тегами"
                  type="info"
                  style={{ marginBottom: 16 }}
                />
              )}

              {selectedTopic && !loadingTags && availableTags.length > 0 && (
                <>
                  <Alert
                    message={`Найдено ${availableTags.length} тег(ов) в задачах этой темы. Настройте количество задач для каждого тега. Общее количество задач будет автоматически рассчитано.`}
                    type="info"
                    style={{ marginBottom: 16 }}
                  />

                  {tagCounts.map((item, index) => (
                    <Row key={index} gutter={16} style={{ marginBottom: 8 }}>
                      <Col xs={24} md={12}>
                        <Select
                          placeholder="Выберите тег"
                          value={item.tag}
                          onChange={(value) => updateTagCount(index, 'tag', value)}
                          style={{ width: '100%' }}
                        >
                          {availableTags.map(tag => (
                            <Option key={tag.id} value={tag.id}>
                              {tag.title}
                            </Option>
                          ))}
                        </Select>
                      </Col>
                      <Col xs={18} md={10}>
                        <InputNumber
                          min={1}
                          max={100}
                          value={item.count}
                          onChange={(value) => updateTagCount(index, 'count', value)}
                          style={{ width: '100%' }}
                          placeholder="Количество задач"
                        />
                      </Col>
                      <Col xs={6} md={2}>
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => removeTagCount(index)}
                        />
                      </Col>
                    </Row>
                  ))}

                  <Button
                    type="dashed"
                    onClick={addTagCount}
                    icon={<PlusOutlined />}
                    style={{ width: '100%', marginBottom: 16 }}
                  >
                    Добавить тег
                  </Button>

                  {tagCounts.length > 0 && (
                    <Alert
                      message={
                        <div>
                          <div>Задач по тегам: <strong>{getTotalTasksFromTags()}</strong></div>
                          <div>Общее количество: <strong>{form.getFieldValue('tasksPerVariant') || 0}</strong></div>
                          {getTotalTasksFromTags() !== (form.getFieldValue('tasksPerVariant') || 0) && (
                            <div style={{ color: '#ff4d4f', marginTop: 4 }}>
                              ⚠️ Суммы не совпадают!
                            </div>
                          )}
                        </div>
                      }
                      type={getTotalTasksFromTags() === (form.getFieldValue('tasksPerVariant') || 0) ? 'success' : 'error'}
                      style={{ marginBottom: 16 }}
                    />
                  )}
                </>
              )}
            </Panel>

            {/* Сложность */}
            <Panel header="📊 Распределение по сложности (опционально)" key="difficulty">
              {!selectedTopic && (
                <Alert
                  message="Выберите тему, чтобы настроить распределение по сложности"
                  type="warning"
                  style={{ marginBottom: 16 }}
                />
              )}

              {selectedTopic && tagCounts.length > 0 && (
                <Alert
                  message="Распределение по сложности нельзя использовать одновременно с распределением по тегам"
                  type="warning"
                  style={{ marginBottom: 16 }}
                />
              )}

              {selectedTopic && tagCounts.length === 0 && (
                <>
                  {difficultyCounts.map((item, index) => (
                    <Row key={index} gutter={16} style={{ marginBottom: 8 }}>
                      <Col xs={24} md={12}>
                        <Select
                          placeholder="Выберите уровень сложности"
                          value={item.difficulty}
                          onChange={(value) => updateDifficultyCount(index, 'difficulty', value)}
                          style={{ width: '100%' }}
                        >
                          {difficultyOptions.map(opt => (
                            <Option key={opt.value} value={opt.value}>
                              <Tag color={opt.color} style={{ marginRight: 4 }}>{opt.value}</Tag>
                              {opt.label}
                            </Option>
                          ))}
                        </Select>
                      </Col>
                      <Col xs={18} md={10}>
                        <InputNumber
                          min={1}
                          max={100}
                          value={item.count}
                          onChange={(value) => updateDifficultyCount(index, 'count', value)}
                          style={{ width: '100%' }}
                          placeholder="Количество задач"
                        />
                      </Col>
                      <Col xs={6} md={2}>
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => removeDifficultyCount(index)}
                        />
                      </Col>
                    </Row>
                  ))}

                  <Button
                    type="dashed"
                    onClick={addDifficultyCount}
                    icon={<PlusOutlined />}
                    style={{ width: '100%', marginBottom: 16 }}
                  >
                    Добавить уровень сложности
                  </Button>

                  {difficultyCounts.length > 0 && (
                    <Alert
                      message={
                        <div>
                          <div>Задач по сложности: <strong>{getTotalTasksFromDifficulty()}</strong></div>
                          <div>Общее количество: <strong>{form.getFieldValue('tasksPerVariant') || 0}</strong></div>
                          {getTotalTasksFromDifficulty() !== (form.getFieldValue('tasksPerVariant') || 0) && (
                            <div style={{ color: '#ff4d4f', marginTop: 4 }}>
                              ⚠️ Суммы не совпадают!
                            </div>
                          )}
                        </div>
                      }
                      type={getTotalTasksFromDifficulty() === (form.getFieldValue('tasksPerVariant') || 0) ? 'success' : 'error'}
                      style={{ marginBottom: 16 }}
                    />
                  )}
                </>
              )}
            </Panel>

            {/* Варианты */}
            <Panel header="🎲 Генерация вариантов" key="variants">
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="variantsCount" label="Количество вариантов">
                    <InputNumber min={1} max={10} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    name="tasksPerVariant"
                    label="Задач в варианте"
                    tooltip={tagCounts.length > 0 || difficultyCounts.length > 0 ? "Автоматически рассчитывается из распределения" : ""}
                  >
                    <InputNumber
                      min={1}
                      max={100}
                      style={{ width: '100%' }}
                      disabled={tagCounts.length > 0 || difficultyCounts.length > 0}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="variantsMode" label="Режим вариантов">
                    <Select>
                      <Option value="different">Разные задачи</Option>
                      <Option value="shuffled">Одинаковые, разный порядок</Option>
                      <Option value="same">Одинаковые задачи</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Panel>

            {/* Формат */}
            <Panel header="🎨 Формат печати" key="format">
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={24}>
                  <Form.Item label="Режим вывода" style={{ marginBottom: 0 }}>
                    <Radio.Group
                      value={outputMode}
                      onChange={(e) => setOutputMode(e.target.value)}
                      buttonStyle="solid"
                      size="large"
                    >
                      <Radio.Button value="sheet">Лист задач</Radio.Button>
                      <Radio.Button value="cards">Карточки</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '8px 0 16px' }} />

              {outputMode === 'sheet' && (
                <>
                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Колонки"
                        tooltip={compactMode ? "В компактном режиме - количество вариантов в ряд" : "Колонки для задач в варианте"}
                      >
                        <Radio.Group
                          value={columns}
                          onChange={(e) => setColumns(e.target.value)}
                          buttonStyle="solid"
                        >
                          <Radio.Button value={1}>1</Radio.Button>
                          <Radio.Button value={2}>2</Radio.Button>
                          <Radio.Button value={3}>3</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={8}>
                      <Form.Item label="Размер шрифта">
                        <Radio.Group
                          value={fontSize}
                          onChange={(e) => setFontSize(e.target.value)}
                          buttonStyle="solid"
                        >
                          <Radio.Button value={10}>10pt</Radio.Button>
                          <Radio.Button value={12}>12pt</Radio.Button>
                          <Radio.Button value={14}>14pt</Radio.Button>
                          <Radio.Button value={16}>16pt</Radio.Button>
                          <Radio.Button value={20}>20pt</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Место для решения">
                        <Radio.Group
                          value={solutionSpace}
                          onChange={(e) => setSolutionSpace(e.target.value)}
                          buttonStyle="solid"
                        >
                          <Radio.Button value="none">Нет</Radio.Button>
                          <Radio.Button value="small">Мало</Radio.Button>
                          <Radio.Button value="medium">Средне</Radio.Button>
                          <Radio.Button value="large">Много</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item label="Компактный режим">
                        <Switch checked={compactMode} onChange={setCompactMode} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Скрыть «Вычислите:» и т.п."
                        tooltip="Убирает типовые фразы из начала условия задач"
                      >
                        <Switch checked={hideTaskPrefixes} onChange={setHideTaskPrefixes} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Поля для ФИО">
                        <Switch
                          checked={showStudentInfo}
                          onChange={setShowStudentInfo}
                          disabled={compactMode}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Ответы в тексте">
                        <Switch
                          checked={showAnswersInline}
                          onChange={setShowAnswersInline}
                          disabled={compactMode}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item label="Лист с ответами">
                        <Switch checked={showAnswersPage} onChange={setShowAnswersPage} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item label="Название варианта">
                        <Input
                          value={variantLabel}
                          onChange={(e) => setVariantLabel(e.target.value)}
                          placeholder="Вариант"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )}

              {outputMode === 'cards' && (
                <>
                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Form.Item label="Формат карточки">
                        <Select value={cardFormat} onChange={setCardFormat}>
                          <Option value="А6">А6 (4 на листе A4)</Option>
                          <Option value="А5">А5 (2 на листе A4)</Option>
                          <Option value="А4">А4 (1 на листе)</Option>
                        </Select>
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={8}>
                      <Form.Item label="Размер шрифта">
                        <Radio.Group
                          value={fontSize}
                          onChange={(e) => setFontSize(e.target.value)}
                          buttonStyle="solid"
                        >
                          <Radio.Button value={10}>10pt</Radio.Button>
                          <Radio.Button value={12}>12pt</Radio.Button>
                          <Radio.Button value={14}>14pt</Radio.Button>
                          <Radio.Button value={16}>16pt</Radio.Button>
                          <Radio.Button value={20}>20pt</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item label="Поля для ФИ">
                        <Switch checked={showCardStudentInfo} onChange={setShowCardStudentInfo} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Ответы в карточках">
                        <Switch checked={showCardAnswers} onChange={setShowCardAnswers} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Решения в карточках">
                        <Switch checked={showCardSolutions} onChange={setShowCardSolutions} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Скрыть «Вычислите:» и т.п."
                        tooltip="Убирает типовые фразы из начала условия задач"
                      >
                        <Switch checked={hideTaskPrefixes} onChange={setHideTaskPrefixes} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item label="Название карточки">
                        <Input
                          value={variantLabel}
                          onChange={(e) => setVariantLabel(e.target.value)}
                          placeholder="Проверочная работа"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )}
            </Panel>
          </Collapse>

          <Form.Item style={{ marginTop: 16 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<ReloadOutlined />}
                loading={loading}
                size="large"
              >
                Сформировать лист
              </Button>
              <Button
                type="default"
                icon={<FolderOpenOutlined />}
                onClick={handleOpenLoadModal}
                size="large"
              >
                Открыть сохраненную
              </Button>
              {variants.length > 0 && (
                <>
                  <Button
                    type="default"
                    icon={<SaveOutlined />}
                    onClick={() => setSaveModalVisible(true)}
                    size="large"
                  >
                    Сохранить работу
                  </Button>
                  <Button
                    type="default"
                    icon={<PrinterOutlined />}
                    onClick={handlePrint}
                    size="large"
                  >
                    Печать
                  </Button>
                  <Tooltip
                    title={
                      pdfMethod === 'puppeteer'
                        ? 'Высокое качество PDF с идеальным рендерингом формул'
                        : 'Стандартный экспорт PDF'
                    }
                  >
                    <Badge
                      count={pdfMethod === 'puppeteer' ? <RocketOutlined style={{ color: '#52c41a' }} /> : 0}
                      offset={[-5, 5]}
                    >
                      <Button
                        type="default"
                        icon={<FilePdfOutlined />}
                        onClick={handleExportPDF}
                        loading={puppeteerPDF.exporting}
                        size="large"
                      >
                        Сохранить PDF
                      </Button>
                    </Badge>
                  </Tooltip>
                  <Segmented
                    options={[
                      {
                        label: (
                          <Tooltip title="Новая технология: высокое качество, быстрая генерация">
                            <span>
                              <RocketOutlined /> Новый
                            </span>
                          </Tooltip>
                        ),
                        value: 'puppeteer',
                        disabled: !puppeteerPDF.serverAvailable,
                      },
                      {
                        label: (
                          <Tooltip title="Классический метод экспорта">
                            <span>Обычный</span>
                          </Tooltip>
                        ),
                        value: 'legacy',
                      },
                    ]}
                    value={pdfMethod}
                    onChange={setPdfMethod}
                    size="large"
                  />
                  <Button onClick={handleReset} size="large">
                    Сбросить
                  </Button>
                </>
              )}
            </Space>
          </Form.Item>
        </Form>

        {/* Превью информация */}
        {variants.length > 0 && (
          <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
            <Row gutter={16}>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                    {variants.length}
                  </div>
                  <div style={{ color: '#666' }}>Вариант(ов)</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                    {variants[0]?.tasks.length || 0}
                  </div>
                  <div style={{ color: '#666' }}>Задач в варианте</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fa8c16' }}>
                    {variants.reduce((sum, v) => sum + v.tasks.length, 0)}
                  </div>
                  <div style={{ color: '#666' }}>Всего задач</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: showAnswersPage ? '#52c41a' : '#ff4d4f' }}>
                    {showAnswersPage ? '✓' : '✗'}
                  </div>
                  <div style={{ color: '#666' }}>Лист ответов</div>
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Card>

      {/* Печатный лист */}
      {variants.length > 0 && outputMode === 'sheet' && (
        <div ref={printRef} className="printable-worksheet">
          {compactMode && columns > 1 ? (
            // Группируем варианты по страницам (по columns штук на страницу)
            (() => {
              const pages = [];
              for (let i = 0; i < variants.length; i += columns) {
                const pageVariants = variants.slice(i, i + columns);
                pages.push(
                  <div key={i} className="variants-page">
                    <div
                      className="compact-variants-grid"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${columns}, 1fr)`,
                        columnGap: '10px',
                      }}
                    >
                      {pageVariants.map((variant, idx) => renderVariant(variant, form.getFieldValue('workTitle'), i + idx))}
                    </div>
                  </div>
                );
              }
              return pages;
            })()
          ) : (
            variants.map((variant, index) => renderVariant(variant, form.getFieldValue('workTitle'), index))
          )}
          {renderAnswersPage()}
        </div>
      )}

      {/* Режим карточек */}
      {variants.length > 0 && outputMode === 'cards' && (
        <PrintableWorksheet
          ref={printRef}
          key={variants.map(v => v.tasks.map(t => t.id).join(',')).join('|')}
          cards={variants.map(v => v.tasks)}
          title={variantLabel || 'Проверочная работа'}
          showAnswers={showCardAnswers}
          showSolutions={showCardSolutions}
          format={cardFormat}
          cardsCount={variants.length}
          tasksPerCard={variants[0]?.tasks.length || 0}
          topicName=""
          variantLabel={variantLabel || 'Проверочная работа'}
          topics={topics}
          tags={tags}
          subtopics={subtopics}
          hideTaskPrefixes={hideTaskPrefixes}
          fontSize={fontSize}
          showStudentInfo={showCardStudentInfo}
          onEditTask={handleEditTask}
          onCardsChange={(newCards) => {
            // Синхронизируем обратно в variants
            const newVariants = variants.map((v, i) => ({
              ...v,
              tasks: newCards[i] || v.tasks,
            }));
            setVariants(newVariants);
          }}
        />
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" tip="Генерируем варианты..." />
        </div>
      )}

      {/* Модальное окно для замены задачи */}
      <TaskReplaceModal
        visible={replaceModalVisible}
        taskToReplace={taskToReplace}
        onConfirm={handleConfirmReplace}
        onCancel={handleCancelReplace}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        currentVariantTasks={taskToReplace ? variants[taskToReplace.variantIndex]?.tasks || [] : []}
      />

      {/* Модальное окно для редактирования задачи */}
      {taskToEdit && (
        <TaskEditModal
          task={taskToEdit}
          visible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
          onSave={handleSaveEdit}
          onDelete={handleDeleteEdit}
          allTags={tags || []}
          allSources={sources || []}
          allYears={years || []}
          allSubtopics={subtopics || []}
          allTopics={topics || []}
        />
      )}

      {/* Модальное окно для сохранения работы */}
      <Modal
        title={
          <Space>
            <SaveOutlined />
            <span>Сохранить работу</span>
          </Space>
        }
        open={saveModalVisible}
        onCancel={() => setSaveModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          layout="vertical"
          onFinish={handleSaveWork}
          initialValues={{
            workTitle: 'Лист задач',
            timeLimit: null,
          }}
        >
          <Alert
            message="Информация"
            description={`Будет сохранено ${variants.length} вариант(ов) с общим количеством ${variants.reduce((sum, v) => sum + v.tasks.length, 0)} задач.`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="workTitle"
            label="Название работы"
            rules={[{ required: true, message: 'Введите название работы' }]}
          >
            <Input placeholder="Например: Контрольная - логарифмы" />
          </Form.Item>

          <Form.Item name="timeLimit" label="Время на выполнение (минут)">
            <InputNumber
              min={1}
              max={300}
              style={{ width: '100%' }}
              placeholder="Например: 15"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={savingWork}>
                Сохранить
              </Button>
              <Button onClick={() => setSaveModalVisible(false)}>
                Отмена
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно для загрузки сохраненной работы */}
      <Modal
        title={
          <Space>
            <FolderOpenOutlined />
            <span>Сохраненные работы</span>
          </Space>
        }
        open={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        footer={null}
        width={800}
      >
        {loadingWorks ? (
          <div style={{ textAlign: 'center', padding: 30 }}>
            <Spin tip="Загружаем работы..." />
          </div>
        ) : savedWorks.length === 0 ? (
          <Empty description="Нет сохраненных работ" style={{ padding: 30 }} />
        ) : (
          <List
            dataSource={savedWorks}
            renderItem={(work) => (
              <List.Item
                actions={[
                  <Button
                    type="primary"
                    size="small"
                    icon={<FolderOpenOutlined />}
                    onClick={() => handleLoadWork(work.id)}
                  >
                    Открыть
                  </Button>,
                  <Button
                    danger
                    size="small"
                    onClick={() => {
                      Modal.confirm({
                        title: 'Удалить работу?',
                        content: `Вы уверены, что хотите удалить работу "${work.title}"? Это действие нельзя отменить.`,
                        okText: 'Удалить',
                        okType: 'danger',
                        cancelText: 'Отмена',
                        onOk: () => handleDeleteWork(work.id, work.title),
                      });
                    }}
                  >
                    Удалить
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span style={{ fontWeight: 600, fontSize: 16 }}>{work.title}</span>
                      {work.time_limit && <Tag color="green">{work.time_limit} мин</Tag>}
                      {work.expand?.topic && (
                        <Tag color="purple">№{work.expand.topic.ege_number} - {work.expand.topic.title}</Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space style={{ color: '#666', fontSize: 12 }}>
                      <span>Создана: {new Date(work.created).toLocaleDateString('ru-RU')}</span>
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
};

export default TaskSheetGenerator;
