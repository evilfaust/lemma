import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { api } from '../services/pocketbase';

const ReferenceDataContext = createContext(null);

export function ReferenceDataProvider({ children }) {
  const [topics, setTopics] = useState([]);
  const [tags, setTags] = useState([]);
  const [years, setYears] = useState([]);
  const [sources, setSources] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [theoryCategories, setTheoryCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const reloadData = useCallback(async () => {
    setLoading(true);
    try {
      const [topicsData, tagsData, yearsData, sourcesData, subtopicsData, theoryCatsData] = await Promise.all([
        api.getTopics(),
        api.getTags(),
        api.getUniqueYears(),
        api.getUniqueSources(),
        api.getSubtopics(),
        api.getTheoryCategories(),
      ]);
      setTopics(topicsData);
      setTags(tagsData);
      setYears(yearsData);
      setSources(sourcesData);
      setSubtopics(subtopicsData);
      setTheoryCategories(theoryCatsData);
    } catch (error) {
      console.error('Error loading reference data:', error);
      message.error('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  }, []);

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
      loading,
      reloadData,
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
