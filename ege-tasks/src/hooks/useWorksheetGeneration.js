import { useState } from 'react';
import { message } from 'antd';
import { api } from '../services/pocketbase';

/**
 * Хук для генерации вариантов работ с задачами
 * Поддерживает разные режимы генерации и структуры фильтров
 */
export const useWorksheetGeneration = () => {
  const [variants, setVariants] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  /**
   * Генерация вариантов на основе структуры блоков
   * @param {Array} structure - Массив блоков с фильтрами
   * @param {Object} options - Опции генерации
   * @param {string} options.variantsMode - 'different' | 'shuffled' | 'same'
   * @param {number} options.variantsCount - Количество вариантов
   * @param {string} options.sortType - 'code' | 'difficulty' | 'random'
   */
  const generateFromStructure = async (structure, options = {}) => {
    const {
      variantsMode = 'different',
      variantsCount = 1,
      sortType = 'random',
    } = options;

    setLoading(true);

    try {
      const generatedVariants = [];

      if (variantsMode === 'different') {
        // Разные задачи в каждом варианте
        const usedTaskIds = new Set();

        for (let i = 0; i < variantsCount; i++) {
          const variantTasks = [];

          for (const block of structure) {
            // Получаем задачи для этого блока
            const filters = buildFilters(block);
            const availableTasks = await api.getTasks(filters);

            // Исключаем уже использованные задачи
            const filteredTasks = availableTasks.filter(t => !usedTaskIds.has(t.id));

            // Перемешиваем и берём нужное количество
            const shuffled = [...filteredTasks].sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, block.count);

            if (selected.length < block.count) {
              message.warning(
                `Вариант ${i + 1}, блок "${getBlockLabel(block)}": найдено только ${selected.length} из ${block.count} задач`
              );
            }

            // Добавляем в использованные
            selected.forEach(t => usedTaskIds.add(t.id));
            variantTasks.push(...selected);
          }

          // Сортировка задач в варианте
          if (sortType === 'random') {
            variantTasks.sort(() => Math.random() - 0.5);
          } else if (sortType === 'code') {
            variantTasks.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
          } else if (sortType === 'difficulty') {
            variantTasks.sort((a, b) => (a.difficulty || '1').localeCompare(b.difficulty || '1'));
          }

          generatedVariants.push({
            number: i + 1,
            tasks: variantTasks,
          });
        }
      } else if (variantsMode === 'shuffled') {
        // Одинаковые задачи, разный порядок
        const baseTasks = [];

        for (const block of structure) {
          const filters = buildFilters(block);
          const tasks = await api.getRandomTasks(block.count, filters);

          if (tasks.length < block.count) {
            message.warning(
              `Блок "${getBlockLabel(block)}": найдено только ${tasks.length} из ${block.count} задач`
            );
          }

          baseTasks.push(...tasks);
        }

        // Сортировка базового набора
        if (sortType === 'code') {
          baseTasks.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        } else if (sortType === 'difficulty') {
          baseTasks.sort((a, b) => (a.difficulty || '1').localeCompare(b.difficulty || '1'));
        }

        // Создаём варианты с перемешанным порядком
        for (let i = 0; i < variantsCount; i++) {
          const shuffled = [...baseTasks].sort(() => Math.random() - 0.5);
          generatedVariants.push({
            number: i + 1,
            tasks: shuffled,
          });
        }
      } else {
        // Одинаковые задачи, одинаковый порядок
        const baseTasks = [];

        for (const block of structure) {
          const filters = buildFilters(block);
          const tasks = await api.getRandomTasks(block.count, filters);

          if (tasks.length < block.count) {
            message.warning(
              `Блок "${getBlockLabel(block)}": найдено только ${tasks.length} из ${block.count} задач`
            );
          }

          baseTasks.push(...tasks);
        }

        // Сортировка
        if (sortType === 'code') {
          baseTasks.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        } else if (sortType === 'difficulty') {
          baseTasks.sort((a, b) => (a.difficulty || '1').localeCompare(b.difficulty || '1'));
        }

        // Создаём одинаковые варианты
        for (let i = 0; i < variantsCount; i++) {
          generatedVariants.push({
            number: i + 1,
            tasks: [...baseTasks],
          });
        }
      }

      setVariants(generatedVariants);
      setAllTasks(generatedVariants.flatMap(v => v.tasks));

      const totalTasks = generatedVariants.reduce((sum, v) => sum + v.tasks.length, 0);
      message.success(`Сгенерировано ${variantsCount} вариант(ов), всего ${totalTasks} задач`);

      return generatedVariants;
    } catch (error) {
      console.error('Error generating variants:', error);
      message.error('Ошибка при генерации вариантов');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Генерация вариантов на основе фильтров (для OralWorksheetGenerator)
   *
   * @param {Object} filters - Базовые фильтры
   * @param {string} [filters.topic] - ID темы
   * @param {string} [filters.subtopic] - ID подтемы
   * @param {string} [filters.difficulty] - Уровень сложности
   * @param {string[]} [filters.tags] - Теги-фильтры
   * @param {string} [filters.source] - Источник
   * @param {number} [filters.year] - Год
   * @param {boolean} [filters.hasAnswer] - Наличие ответа
   * @param {boolean} [filters.hasSolution] - Наличие решения
   * @param {string} [filters.search] - Поиск по тексту/коду
   *
   * @param {Object} options - Опции генерации
   * @param {string} options.variantsMode - 'different' | 'shuffled' | 'same'
   * @param {number} options.variantsCount - Количество вариантов
   * @param {number} options.tasksPerVariant - Задач на вариант
   * @param {string} options.sortType - 'code' | 'difficulty' | 'random'
   * @param {Array} [options.tagDistribution] - Распределение по тегам [{tag, count}]
   * @param {Array} [options.difficultyDistribution] - Распределение по сложности [{difficulty, count}]
   * @param {Function} [options.getLabelForTag] - (tagId) => name для предупреждений
   * @param {Function} [options.getLabelForDifficulty] - (diffValue) => label для предупреждений
   */
  const generateFromFilters = async (filters = {}, options = {}) => {
    const {
      variantsMode = 'different',
      variantsCount = 1,
      tasksPerVariant = 20,
      sortType = 'random',
      tagDistribution,
      difficultyDistribution,
      getLabelForTag,
      getLabelForDifficulty,
    } = options;

    setLoading(true);

    try {
      const generatedVariants = [];

      // Построение базовых фильтров для API
      const buildBaseFilters = (extra = {}) => {
        const f = { ...extra };
        if (filters.topic) f.topic = filters.topic;
        if (filters.subtopic) f.subtopic = filters.subtopic;
        if (filters.difficulty && !extra.difficulty) f.difficulty = filters.difficulty;
        if (filters.source) f.source = filters.source;
        if (filters.year) f.year = filters.year;
        if (filters.hasAnswer !== undefined) f.hasAnswer = filters.hasAnswer;
        if (filters.hasSolution !== undefined) f.hasSolution = filters.hasSolution;
        if (filters.tags && filters.tags.length > 0) {
          f.tags = extra.tags
            ? [...new Set([...extra.tags, ...filters.tags])]
            : filters.tags;
        }
        return f;
      };

      if (tagDistribution && tagDistribution.length > 0) {
        // === Режим распределения по тегам ===
        const allAvailableTasks = {};
        for (const item of tagDistribution) {
          const tagFilters = buildBaseFilters({ tags: [item.tag] });
          const tasks = await api.getTasks(tagFilters);
          allAvailableTasks[item.tag] = tasks;
        }

        if (variantsMode === 'different') {
          const usedTaskIds = new Set();
          for (let i = 0; i < variantsCount; i++) {
            const variantTasks = [];
            for (const item of tagDistribution) {
              const available = allAvailableTasks[item.tag].filter(t => !usedTaskIds.has(t.id));
              const shuffled = [...available].sort(() => Math.random() - 0.5);
              const selected = shuffled.slice(0, item.count);
              if (selected.length < item.count) {
                const name = getLabelForTag?.(item.tag) || item.tag;
                message.warning(`Вариант ${i + 1}: для тега "${name}" найдено только ${selected.length} задач из ${item.count}`);
              }
              selected.forEach(t => usedTaskIds.add(t.id));
              variantTasks.push(...selected);
            }
            // Перемешиваем только при random, чтобы сохранить группировку по тегам
            if (sortType === 'random') {
              sortTasks(variantTasks, sortType);
            }
            generatedVariants.push({ number: i + 1, tasks: variantTasks });
          }
        } else {
          const baseTasks = [];
          for (const item of tagDistribution) {
            const tagFilters = buildBaseFilters({ tags: [item.tag] });
            const tasks = await api.getRandomTasks(item.count, tagFilters);
            if (tasks.length < item.count) {
              const name = getLabelForTag?.(item.tag) || item.tag;
              message.warning(`Для тега "${name}" найдено только ${tasks.length} задач из ${item.count}`);
            }
            baseTasks.push(...tasks);
          }
          // Перемешиваем только при random, чтобы сохранить группировку по тегам
          if (sortType === 'random') {
            sortTasks(baseTasks, sortType);
          }
          createVariantsFromBase(baseTasks, variantsCount, variantsMode, generatedVariants);
        }

      } else if (difficultyDistribution && difficultyDistribution.length > 0) {
        // === Режим распределения по сложности ===
        const sorted = [...difficultyDistribution].sort(
          (a, b) => (a.difficulty || '0').localeCompare(b.difficulty || '0')
        );

        const allAvailableTasks = {};
        for (const item of sorted) {
          const df = buildBaseFilters({ difficulty: item.difficulty });
          const tasks = await api.getTasks(df);
          allAvailableTasks[item.difficulty] = tasks;
        }

        if (variantsMode === 'different') {
          const usedTaskIds = new Set();
          for (let i = 0; i < variantsCount; i++) {
            const variantTasks = [];
            for (const item of sorted) {
              const available = allAvailableTasks[item.difficulty].filter(t => !usedTaskIds.has(t.id));
              const shuffled = [...available].sort(() => Math.random() - 0.5);
              const selected = shuffled.slice(0, item.count);
              if (selected.length < item.count) {
                const label = getLabelForDifficulty?.(item.difficulty) || item.difficulty;
                message.warning(`Вариант ${i + 1}: для сложности "${label}" найдено только ${selected.length} задач из ${item.count}`);
              }
              selected.forEach(t => usedTaskIds.add(t.id));
              variantTasks.push(...selected);
            }
            // Не перемешиваем — порядок по возрастанию сложности сохраняется
            generatedVariants.push({ number: i + 1, tasks: variantTasks });
          }
        } else {
          const baseTasks = [];
          for (const item of sorted) {
            const df = buildBaseFilters({ difficulty: item.difficulty });
            const tasks = await api.getRandomTasks(item.count, df);
            if (tasks.length < item.count) {
              const label = getLabelForDifficulty?.(item.difficulty) || item.difficulty;
              message.warning(`Для сложности "${label}" найдено только ${tasks.length} задач из ${item.count}`);
            }
            baseTasks.push(...tasks);
          }
          // Не перемешиваем — порядок по возрастанию сложности сохраняется
          // Принудительно 'same' чтобы shuffled не сломал порядок сложности
          createVariantsFromBase(baseTasks, variantsCount, 'same', generatedVariants);
        }

      } else {
        // === Стандартная генерация ===
        const apiFilters = buildBaseFilters();
        const hasFilters = Object.keys(apiFilters).length > 0;
        let tasks = await api.getTasks(hasFilters ? apiFilters : {});

        // Клиентский поиск
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          tasks = tasks.filter(task =>
            task.code?.toLowerCase().includes(searchLower) ||
            task.statement_md?.toLowerCase().includes(searchLower)
          );
        }

        if (tasks.length === 0) {
          message.warning('Задачи не найдены по заданным фильтрам');
          setAllTasks([]);
          setVariants([]);
          return [];
        }

        sortTasks(tasks, sortType);

        if (variantsMode === 'different') {
          for (let i = 0; i < variantsCount; i++) {
            const startIdx = i * tasksPerVariant;
            const endIdx = Math.min(startIdx + tasksPerVariant, tasks.length);
            generatedVariants.push({ number: i + 1, tasks: tasks.slice(startIdx, endIdx) });
          }
        } else {
          const baseTasks = tasks.slice(0, tasksPerVariant);
          createVariantsFromBase(baseTasks, variantsCount, variantsMode, generatedVariants);
        }
      }

      setVariants(generatedVariants);
      setAllTasks(generatedVariants.flatMap(v => v.tasks));

      const totalTasks = generatedVariants.reduce((sum, v) => sum + v.tasks.length, 0);
      message.success(`Сгенерировано ${variantsCount} вариант(ов), всего ${totalTasks} задач`);

      return generatedVariants;
    } catch (error) {
      console.error('Error generating variants:', error);
      message.error('Ошибка при загрузке задач');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Вспомогательная: сортировка задач
   */
  const sortTasks = (tasks, sortType) => {
    if (sortType === 'random') {
      tasks.sort(() => Math.random() - 0.5);
    } else if (sortType === 'code') {
      tasks.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    } else if (sortType === 'difficulty') {
      tasks.sort((a, b) => (a.difficulty || '1').localeCompare(b.difficulty || '1'));
    }
  };

  /**
   * Вспомогательная: создание вариантов из базового набора (shuffled/same)
   */
  const createVariantsFromBase = (baseTasks, count, mode, target) => {
    for (let i = 0; i < count; i++) {
      const tasks = mode === 'shuffled'
        ? [...baseTasks].sort(() => Math.random() - 0.5)
        : [...baseTasks];
      target.push({ number: i + 1, tasks });
    }
  };

  /**
   * Построение фильтров для API из блока
   */
  const buildFilters = (block) => {
    const filters = {};

    if (block.topic) filters.topic = block.topic;
    if (block.subtopics && block.subtopics.length > 0) filters.subtopics = block.subtopics;
    if (block.difficulty && block.difficulty.length > 0) filters.difficulty = block.difficulty;
    if (block.tags && block.tags.length > 0) filters.tags = block.tags;
    if (block.source) filters.source = block.source;
    if (block.year) filters.year = block.year;
    if (block.hasAnswer !== undefined) filters.hasAnswer = block.hasAnswer === 'yes';
    if (block.hasSolution !== undefined) filters.hasSolution = block.hasSolution === 'yes';

    return filters;
  };

  /**
   * Получение читаемой метки блока
   */
  const getBlockLabel = (block) => {
    return block.label || block.topic || 'Блок';
  };

  /**
   * Сброс состояния
   */
  const reset = () => {
    setVariants([]);
    setAllTasks([]);
  };

  return {
    variants,
    setVariants,
    allTasks,
    loading,
    setLoading,
    generateFromStructure,
    generateFromFilters,
    reset,
  };
};
