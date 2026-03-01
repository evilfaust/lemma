import { useState, useEffect, useCallback } from 'react';
import { api } from '../shared/services/pocketbase';

/**
 * Хук для загрузки доступных тегов по выбранной теме/подтеме.
 * Получает задачи, собирает уникальные tag ID, фильтрует из allTags.
 *
 * @param {string|null} topicId  - выбранная тема
 * @param {string|null} subtopicId - выбранная подтема
 * @param {Array} allTags - полный список тегов (из useReferenceData)
 * @returns {{ availableTags: Array, loadingTags: boolean, reloadTags: () => void }}
 */
export function useAvailableTags(topicId, subtopicId, allTags) {
  const [availableTags, setAvailableTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);

  const loadAvailableTags = useCallback(async () => {
    if (!topicId) {
      setAvailableTags([]);
      return;
    }

    setLoadingTags(true);
    try {
      const filters = { topic: topicId };
      if (subtopicId) filters.subtopic = subtopicId;

      const tasks = await api.getTasks(filters);

      // Собираем уникальные теги
      const tagSet = new Set();
      tasks.forEach(task => {
        if (task.tags) {
          if (Array.isArray(task.tags)) {
            task.tags.forEach(tagId => { if (tagId) tagSet.add(tagId); });
          } else if (typeof task.tags === 'string' && task.tags.length > 0) {
            tagSet.add(task.tags);
          }
        }
      });

      setAvailableTags(allTags.filter(tag => tagSet.has(tag.id)));
    } catch (error) {
      console.error('Error loading available tags:', error);
    } finally {
      setLoadingTags(false);
    }
  }, [topicId, subtopicId, allTags]);

  useEffect(() => {
    loadAvailableTags();
  }, [loadAvailableTags]);

  return { availableTags, loadingTags, reloadTags: loadAvailableTags };
}
