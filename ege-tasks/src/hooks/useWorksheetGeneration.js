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
    generateFromStructure,
    reset,
  };
};
