import { useState, useCallback } from 'react';
import { App } from 'antd';
import { api } from '../services/pocketbase';

/**
 * Хук для создания тем и подтем с валидацией и дедупликацией.
 * Используется в TaskEditModal, TaskImporter.
 *
 * @param {Array} initialTopics — начальный список тем
 * @param {Array} initialSubtopics — начальный список подтем
 * @returns {Object} состояния и методы для создания тем/подтем
 */
export const useTopicSubtopicCreation = (initialTopics = [], initialSubtopics = []) => {
  const { message } = App.useApp();
  const [topics, setTopics] = useState(initialTopics);
  const [subtopics, setSubtopics] = useState(initialSubtopics);

  // Topic creation state
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicNumber, setNewTopicNumber] = useState(null);
  const [creatingTopic, setCreatingTopic] = useState(false);

  // Subtopic creation state
  const [newSubtopicName, setNewSubtopicName] = useState('');
  const [creatingSubtopic, setCreatingSubtopic] = useState(false);

  const normalize = (s) => (s || '').trim().toLowerCase();

  /**
   * Синхронизация с внешними данными (props/context).
   * Вызывать вручную при изменении внешних списков.
   */
  const syncTopics = useCallback((newList) => setTopics(newList), []);
  const syncSubtopics = useCallback((newList) => setSubtopics(newList), []);

  /**
   * Фильтрация подтем по теме.
   */
  const filterSubtopicsByTopic = useCallback((topicId) => {
    if (!topicId) return [];
    return subtopics.filter(st => st.topic === topicId);
  }, [subtopics]);

  /**
   * Создание новой темы.
   * @returns {Promise<Object|null>} созданная тема или null при ошибке
   */
  const handleCreateTopic = useCallback(async () => {
    const trimmedTitle = (newTopicTitle || '').trim();
    if (!trimmedTitle) {
      message.warning('Введите название темы');
      return null;
    }
    if (newTopicNumber === null || newTopicNumber === undefined || newTopicNumber === '') {
      message.warning('Укажите номер ЕГЭ');
      return null;
    }

    const existingByNumber = topics.find(t => String(t.ege_number) === String(newTopicNumber));
    if (existingByNumber) {
      message.warning(`Тема с номером ${newTopicNumber} уже существует: "${existingByNumber.title}"`);
      return existingByNumber;
    }

    const existingByTitle = topics.find(t => normalize(t.title) === normalize(trimmedTitle));
    if (existingByTitle) {
      message.warning(`Тема "${trimmedTitle}" уже существует`);
      return existingByTitle;
    }

    setCreatingTopic(true);
    try {
      const newTopic = await api.createTopic({
        title: trimmedTitle,
        ege_number: Number(newTopicNumber),
        order: Number(newTopicNumber),
      });
      setTopics(prev => [...prev, newTopic]);
      message.success(`Тема "${trimmedTitle}" создана`);
      setNewTopicTitle('');
      setNewTopicNumber(null);
      return newTopic;
    } catch (error) {
      console.error('Error creating topic:', error);
      message.error('Ошибка при создании темы');
      return null;
    } finally {
      setCreatingTopic(false);
    }
  }, [newTopicTitle, newTopicNumber, topics, message]);

  /**
   * Создание новой подтемы.
   * @param {string} topicId — ID темы
   * @returns {Promise<Object|null>} созданная подтема или null
   */
  const handleCreateSubtopic = useCallback(async (topicId) => {
    if (!topicId) {
      message.warning('Сначала выберите тему');
      return null;
    }
    const trimmedName = (newSubtopicName || '').trim();
    if (!trimmedName) {
      message.warning('Введите название подтемы');
      return null;
    }

    const existing = subtopics.find(st =>
      st.topic === topicId && normalize(st.name) === normalize(trimmedName)
    );
    if (existing) {
      message.warning(`Подтема "${trimmedName}" уже существует`);
      return existing;
    }

    setCreatingSubtopic(true);
    try {
      const newSub = await api.createSubtopic({
        name: trimmedName,
        topic: topicId,
      });
      setSubtopics(prev => [...prev, newSub]);
      message.success(`Подтема "${trimmedName}" создана`);
      setNewSubtopicName('');
      return newSub;
    } catch (error) {
      console.error('Error creating subtopic:', error);
      message.error('Ошибка при создании подтемы');
      return null;
    } finally {
      setCreatingSubtopic(false);
    }
  }, [newSubtopicName, subtopics, message]);

  return {
    topics,
    subtopics,
    syncTopics,
    syncSubtopics,
    // Topic creation
    newTopicTitle,
    setNewTopicTitle,
    newTopicNumber,
    setNewTopicNumber,
    creatingTopic,
    handleCreateTopic,
    // Subtopic creation
    newSubtopicName,
    setNewSubtopicName,
    creatingSubtopic,
    handleCreateSubtopic,
    // Helpers
    filterSubtopicsByTopic,
  };
};
