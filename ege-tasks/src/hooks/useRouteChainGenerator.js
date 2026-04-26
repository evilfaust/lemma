import { useState, useCallback } from 'react';

const CHAIN_API = import.meta.env.VITE_CHAIN_API_URL || 'https://l.oipav.ru/generate-chain';

const DIFFICULTY_LABELS = { 1: 'базовая', 2: 'средняя', 3: 'повышенная' };

export default function useRouteChainGenerator() {
  const [step, setStep] = useState('settings'); // 'settings' | 'preview'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatedTasks, setGeneratedTasks] = useState([]);

  const [description, setDescription] = useState('');
  const [length, setLength] = useState(4);
  const [difficulty, setDifficulty] = useState(2);
  const [narrative, setNarrative] = useState('');
  const [wishes, setWishes] = useState('');
  const [continueChain, setContinueChain] = useState(false);

  const generate = useCallback(async ({ existingTasks }) => {
    setLoading(true);
    setError(null);
    try {
      const body = {
        description: description.trim(),
        length,
        difficulty: DIFFICULTY_LABELS[difficulty] || 'средняя',
        narrative: narrative.trim() || undefined,
        wishes: wishes.trim() || undefined,
        previous_tasks: (continueChain && existingTasks?.length)
          ? existingTasks.map(t => ({ statement_md: t.statement_md || '', answer: t.answer || '' }))
          : undefined,
      };

      const resp = await fetch(CHAIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      if (!data.tasks?.length) throw new Error('Модель не вернула задачи');

      setGeneratedTasks(data.tasks.map(t => ({ statement_md: t.statement_md, answer: t.answer })));
      setStep('preview');
    } catch (e) {
      setError(e.message || 'Ошибка генерации');
    } finally {
      setLoading(false);
    }
  }, [description, length, difficulty, narrative, wishes, continueChain]);

  const updateTask = useCallback((index, field, value) => {
    setGeneratedTasks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const removeTask = useCallback((index) => {
    setGeneratedTasks(prev => prev.filter((_, i) => i !== index));
  }, []);

  const backToSettings = useCallback(() => {
    setStep('settings');
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setStep('settings');
    setLoading(false);
    setError(null);
    setGeneratedTasks([]);
    setDescription('');
    setLength(4);
    setDifficulty(2);
    setNarrative('');
    setWishes('');
    setContinueChain(false);
  }, []);

  return {
    step, loading, error, generatedTasks,
    description, setDescription,
    length, setLength,
    difficulty, setDifficulty,
    narrative, setNarrative,
    wishes, setWishes,
    continueChain, setContinueChain,
    generate, updateTask, removeTask, backToSettings, reset,
  };
}
