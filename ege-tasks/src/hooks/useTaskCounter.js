import { useState, useEffect } from 'react';
import { api } from '../shared/services/pocketbase';

/**
 * Хук для подсчёта доступных задач с учётом фильтров формы.
 * Запрос дебаунсится на 500мс. Без темы счётчик не работает (слишком тяжёлый запрос).
 *
 * @param {Object} watchedValues - значения полей формы (Form.useWatch)
 * @returns {{ availableTasksCount: number, loadingTasksCount: boolean }}
 */
export function useTaskCounter(watchedValues) {
  const [availableTasksCount, setAvailableTasksCount] = useState(0);
  const [loadingTasksCount, setLoadingTasksCount] = useState(false);

  useEffect(() => {
    if (!watchedValues) return;

    // Без темы счётчик не показываем
    if (!watchedValues.topic) {
      setAvailableTasksCount(0);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingTasksCount(true);
      try {
        const filters = {};
        if (watchedValues.topic) filters.topic = watchedValues.topic;
        if (watchedValues.subtopic) filters.subtopic = watchedValues.subtopic;
        if (watchedValues.difficulty) filters.difficulty = watchedValues.difficulty;
        if (watchedValues.source) filters.source = watchedValues.source;
        if (watchedValues.year) filters.year = watchedValues.year;
        if (watchedValues.filterTags?.length > 0) filters.tags = watchedValues.filterTags;
        if (watchedValues.hasAnswer != null) {
          filters.hasAnswer = watchedValues.hasAnswer === 'yes';
        }
        if (watchedValues.hasSolution != null) {
          filters.hasSolution = watchedValues.hasSolution === 'yes';
        }

        let tasks = await api.getTasks(filters);

        if (watchedValues.search) {
          const searchLower = watchedValues.search.toLowerCase();
          tasks = tasks.filter(task =>
            task.code?.toLowerCase().includes(searchLower) ||
            task.statement_md?.toLowerCase().includes(searchLower)
          );
        }

        setAvailableTasksCount(tasks.length);
      } catch (error) {
        console.error('Error loading tasks count:', error);
        setAvailableTasksCount(0);
      } finally {
        setLoadingTasksCount(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [watchedValues]);

  return { availableTasksCount, loadingTasksCount };
}
