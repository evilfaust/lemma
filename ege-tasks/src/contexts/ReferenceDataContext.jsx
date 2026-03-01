import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { App } from 'antd';
import { api } from '../services/pocketbase';

const ReferenceDataContext = createContext(null);

export function ReferenceDataProvider({ children }) {
  const { message } = App.useApp();
  const [topics, setTopics] = useState([]);
  const [tags, setTags] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [theoryCategories, setTheoryCategories] = useState([]);
  const [tasksSnapshot, setTasksSnapshot] = useState([]);
  const [withAnswerCount, setWithAnswerCount] = useState(0);
  const [withSolutionCount, setWithSolutionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Извлекаем years и sources из snapshot (вместо двух отдельных getFullList)
  const years = useMemo(() => {
    return [...new Set(tasksSnapshot.map(r => r.year).filter(Boolean))].sort((a, b) => b - a);
  }, [tasksSnapshot]);

  const sources = useMemo(() => {
    return [...new Set(tasksSnapshot.map(r => r.source).filter(Boolean))].sort();
  }, [tasksSnapshot]);

  const reloadData = useCallback(async () => {
    setLoading(true);
    try {
      const [topicsData, tagsData, subtopicsData, theoryCatsData, snapshotData, answerCnt, solutionCnt] = await Promise.all([
        api.getTopics(),
        api.getTags(),
        api.getSubtopics(),
        api.getTheoryCategories(),
        api.getTasksStatsSnapshot(),
        api.getWithAnswerCount(),
        api.getWithSolutionCount(),
      ]);
      setTopics(topicsData);
      setTags(tagsData);
      setSubtopics(subtopicsData);
      setTheoryCategories(theoryCatsData);
      setTasksSnapshot(snapshotData);
      setWithAnswerCount(answerCnt);
      setWithSolutionCount(solutionCnt);
    } catch (error) {
      console.error('Error loading reference data:', error);
      message.error('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  }, [message]);

  // Перезагрузить только snapshot (для кнопок "Обновить" в Stats/Catalog)
  const reloadSnapshot = useCallback(async () => {
    try {
      const [snapshotData, answerCnt, solutionCnt] = await Promise.all([
        api.getTasksStatsSnapshot(),
        api.getWithAnswerCount(),
        api.getWithSolutionCount(),
      ]);
      setTasksSnapshot(snapshotData);
      setWithAnswerCount(answerCnt);
      setWithSolutionCount(solutionCnt);
    } catch (error) {
      console.error('Error reloading snapshot:', error);
      message.error('Ошибка при обновлении статистики');
    }
  }, [message]);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  return (
    <ReferenceDataContext.Provider value={{
      topics,
      tags,
      years,
      sources,
      subtopics,
      theoryCategories,
      tasksSnapshot,
      withAnswerCount,
      withSolutionCount,
      loading,
      reloadData,
      reloadSnapshot,
    }}>
      {children}
    </ReferenceDataContext.Provider>
  );
}

export function useReferenceData() {
  const ctx = useContext(ReferenceDataContext);
  if (!ctx) {
    throw new Error('useReferenceData must be used within a ReferenceDataProvider');
  }
  return ctx;
}
