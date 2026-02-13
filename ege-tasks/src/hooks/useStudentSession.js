import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/pocketbase';
import { shuffleArray } from '../utils/shuffle';

/**
 * Хук для управления сессией ученика.
 * Загружает сессию, проверяет существующую попытку, назначает вариант.
 */
export function useStudentSession(sessionId, deviceId) {
  const [session, setSession] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [variant, setVariant] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getIssueNumber = useCallback((attemptRecord, attempts = []) => {
    if (!attemptRecord?.id) return 1;

    const sameDeviceAttempts = attempts
      .filter(a => a.device_id === attemptRecord.device_id)
      .sort((a, b) => new Date(a.created) - new Date(b.created));

    const index = sameDeviceAttempts.findIndex(a => a.id === attemptRecord.id);
    return index >= 0 ? index + 1 : sameDeviceAttempts.length + 1;
  }, []);

  // Загрузка сессии и проверка существующей попытки
  useEffect(() => {
    if (!sessionId || !deviceId) return;

    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        // Загрузить сессию
        const sessionData = await api.getSession(sessionId);
        if (!sessionData) {
          setError('Сессия не найдена');
          setLoading(false);
          return;
        }
        setSession(sessionData);

        // Проверить существующую попытку для ЭТОЙ СЕССИИ
        // Если студент авторизован, ищем по student_id И session_id
        // Иначе по device_id И session_id
        let existingAttempt = null;
        const student = api.getAuthStudent();

        if (student) {
          // Авторизованный студент - ищем попытки для ЭТОЙ сессии
          const studentAttempts = await api.getAttemptsByStudent(sessionId, student.id);
          // Берем последнюю попытку для этой сессии (studentAttempts уже отфильтрованы по session)
          existingAttempt = studentAttempts[0] || null;
        } else {
          // Неавторизованный - ищем по device_id для этой сессии
          existingAttempt = await api.getAttemptByDevice(sessionId, deviceId);
        }

        if (existingAttempt) {
          const allAttempts = await api.getAttemptsBySession(sessionId);
          setAttempt({
            ...existingAttempt,
            issueNumber: getIssueNumber(existingAttempt, allAttempts),
          });
          // Загрузить вариант с задачами
          const variantData = await api.getVariant(existingAttempt.variant);
          if (variantData) {
            setVariant(variantData);
            await loadVariantTasks(variantData);
          }
        }
      } catch (err) {
        console.error('Error initializing student session:', err);
        setError('Ошибка загрузки сессии');
      }
      setLoading(false);
    };

    init();
  }, [sessionId, deviceId, getIssueNumber]);

  // Загрузка задач варианта в правильном порядке
  const loadVariantTasks = async (variantData) => {
    if (!variantData) return;
    const expand = variantData.expand || {};
    let taskList = expand.tasks || [];

    // Если есть order, сортируем задачи по нему
    if (variantData.order && Array.isArray(variantData.order)) {
      const orderMap = {};
      variantData.order.forEach((taskId, idx) => { orderMap[taskId] = idx; });
      taskList = [...taskList].sort((a, b) => {
        const idxA = orderMap[a.id] !== undefined ? orderMap[a.id] : 999;
        const idxB = orderMap[b.id] !== undefined ? orderMap[b.id] : 999;
        return idxA - idxB;
      });
    }

    setTasks(taskList);
  };

  // Начать новую попытку: назначить вариант и создать attempt
  const startAttempt = useCallback(async (studentName) => {
    if (!session) return null;

    try {
      // Получить все варианты работы
      const allVariants = await api.getVariantsByWork(session.work);
      if (allVariants.length === 0) {
        setError('В работе нет вариантов');
        return null;
      }

      // Получить все попытки этой сессии для подсчёта назначений
      const allAttempts = await api.getAttemptsBySession(sessionId);

      // Подсчитать, сколько раз каждый вариант назначен
      const assignmentCount = {};
      allVariants.forEach(v => { assignmentCount[v.id] = 0; });
      allAttempts.forEach(a => {
        if (assignmentCount[a.variant] !== undefined) {
          assignmentCount[a.variant]++;
        }
      });

      // Выбрать варианты с минимальным количеством назначений
      const minCount = Math.min(...Object.values(assignmentCount));
      const candidateIds = Object.keys(assignmentCount).filter(
        id => assignmentCount[id] === minCount
      );

      // Случайный из кандидатов
      const shuffled = shuffleArray([...candidateIds]);
      const chosenVariantId = shuffled[0];
      const chosenVariant = allVariants.find(v => v.id === chosenVariantId);

      // Создать attempt
      const taskList = chosenVariant.expand?.tasks || [];
      const student = api.getAuthStudent();
      const newAttempt = await api.createAttempt({
        session: sessionId,
        student_name: studentName,
        device_id: deviceId,
        student: student?.id || null, // Привязываем к студенту если авторизован
        variant: chosenVariantId,
        status: 'started',
        score: 0,
        total: taskList.length,
      });

      setAttempt({
        ...newAttempt,
        issueNumber: getIssueNumber(newAttempt, [...allAttempts, newAttempt]),
      });
      setVariant(chosenVariant);
      await loadVariantTasks(chosenVariant);

      return newAttempt;
    } catch (err) {
      console.error('Error starting attempt:', err);
      setError('Ошибка при начале теста');
      return null;
    }
  }, [session, sessionId, deviceId, getIssueNumber]);

  // Периодическое обновление attempt (для ручной выдачи ачивок учителем)
  useEffect(() => {
    if (!attempt || !attempt.id || attempt.status === 'started') return;

    const refreshAttempt = async () => {
      try {
        const student = api.getAuthStudent();
        let fresh = null;
        if (student) {
          const attempts = await api.getAttemptsByStudent(sessionId, student.id);
          fresh = attempts.find(a => a.id === attempt.id) || null;
        } else {
          const attempts = await api.getAttemptsByDevice(sessionId, deviceId);
          fresh = attempts.find(a => a.id === attempt.id) || null;
        }
        if (fresh) {
          // Обновляем только если изменились поля ачивок или статус
          const achChanged = fresh.achievement !== attempt.achievement
            || JSON.stringify(fresh.unlocked_achievements) !== JSON.stringify(attempt.unlocked_achievements)
            || fresh.status !== attempt.status
            || fresh.score !== attempt.score;
          if (achChanged) {
            setAttempt(prev => ({ ...prev, ...fresh, issueNumber: prev?.issueNumber }));
          }
        }
      } catch (err) {
        // Игнорируем ошибки polling
      }
    };

    const interval = setInterval(refreshAttempt, 10000); // каждые 10 секунд
    return () => clearInterval(interval);
  }, [attempt?.id, attempt?.status, attempt?.achievement, attempt?.unlocked_achievements, sessionId, deviceId]);

  return {
    session,
    attempt,
    setAttempt,
    variant,
    tasks,
    loading,
    error,
    startAttempt,
  };
}
