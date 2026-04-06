import { useState, useCallback } from 'react';
import { api } from '../services/pocketbase';

// Начальное состояние трекинга для одного студента
const initStudentTracking = (taskCount) => {
  const result = {};
  for (let i = 0; i < taskCount; i++) {
    result[String(i)] = { attempts: 0, solved: false, failed: false };
  }
  return result;
};

// Инициализировать пустой tracking_data для всех студентов
const initTrackingData = (students, taskCount) => {
  const data = {};
  for (const name of students) {
    data[name] = initStudentTracking(taskCount);
  }
  return data;
};

export function useMarathon() {
  const [title, setTitle] = useState('Марафон');
  const [classNumber, setClassNumber] = useState(8);
  const [tasks, setTasks] = useState([]); // полные объекты задач
  const [students, setStudents] = useState([]); // массив строк (имён)
  const [trackingData, setTrackingData] = useState({}); // { studentName: { taskIndex: {attempts, solved, failed} } }
  const [savedId, setSavedId] = useState(null);
  const [saved, setSaved] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- Управление задачами ---

  const addTasks = useCallback((newTasks) => {
    setTasks(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const toAdd = newTasks.filter(t => !existingIds.has(t.id));
      return [...prev, ...toAdd];
    });
  }, []);

  const removeTask = useCallback((taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const moveTask = useCallback((fromIdx, toIdx) => {
    setTasks(prev => {
      const arr = [...prev];
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
  }, []);

  // --- Управление учениками ---

  const addStudent = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStudents(prev => {
      if (prev.includes(trimmed)) return prev;
      return [...prev, trimmed];
    });
  }, []);

  const removeStudent = useCallback((name) => {
    setStudents(prev => prev.filter(s => s !== name));
  }, []);

  const updateStudentName = useCallback((oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setStudents(prev => prev.map(s => s === oldName ? trimmed : s));
    setTrackingData(prev => {
      if (!prev[oldName]) return prev;
      const next = { ...prev };
      next[trimmed] = next[oldName];
      delete next[oldName];
      return next;
    });
  }, []);

  // --- Трекинг ---

  const initTracking = useCallback(() => {
    setTrackingData(initTrackingData(students, tasks.length));
  }, [students, tasks.length]);

  // Отметить попытку: success=true → задача решена, success=false → провал попытки
  const markAttempt = useCallback((studentName, taskIndex, success) => {
    setTrackingData(prev => {
      const next = { ...prev };
      const studentData = { ...(next[studentName] || {}) };
      const taskKey = String(taskIndex);
      const current = studentData[taskKey] || { attempts: 0, solved: false, failed: false };

      if (current.solved || current.failed) return prev; // нельзя менять финальное состояние

      if (success) {
        studentData[taskKey] = { ...current, solved: true };
      } else {
        const newAttempts = current.attempts + 1;
        studentData[taskKey] = {
          ...current,
          attempts: newAttempts,
          failed: newAttempts >= 3,
        };
      }

      next[studentName] = studentData;
      return next;
    });
  }, []);

  // Сбросить состояние задачи для ученика
  const resetTaskForStudent = useCallback((studentName, taskIndex) => {
    setTrackingData(prev => {
      const next = { ...prev };
      const studentData = { ...(next[studentName] || {}) };
      studentData[String(taskIndex)] = { attempts: 0, solved: false, false: false };
      next[studentName] = studentData;
      return next;
    });
  }, []);

  // --- Сохранение / Загрузка ---

  const loadSavedList = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const list = await api.getMarathons();
      setSaved(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  const saveMarathon = useCallback(async () => {
    if (!tasks.length) return;
    setSaving(true);
    try {
      const data = {
        title,
        class_number: classNumber,
        tasks: tasks.map(t => t.id),
        task_order: tasks.map(t => t.id),
        students,
        tracking_data: trackingData,
      };
      if (savedId) {
        await api.updateMarathon(savedId, data);
      } else {
        const rec = await api.createMarathon(data);
        setSavedId(rec.id);
      }
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [title, classNumber, tasks, students, trackingData, savedId]);

  // Автосохранение трекинга (вызывается из трекера после каждого изменения)
  const saveTracking = useCallback(async (newTrackingData) => {
    if (!savedId) return;
    try {
      await api.updateMarathon(savedId, { tracking_data: newTrackingData });
    } catch (e) {
      console.error('Error saving tracking:', e);
    }
  }, [savedId]);

  const loadMarathon = useCallback((item) => {
    setTitle(item.title || 'Марафон');
    setClassNumber(item.class_number || 8);
    const expandedTasks = item.expand?.tasks || [];
    // Восстановить порядок из task_order
    const order = item.task_order || [];
    const taskMap = Object.fromEntries(expandedTasks.map(t => [t.id, t]));
    const ordered = order.map(id => taskMap[id]).filter(Boolean);
    // Добавить задачи, не попавшие в order (на случай расхождения)
    const inOrder = new Set(order);
    const extra = expandedTasks.filter(t => !inOrder.has(t.id));
    setTasks([...ordered, ...extra]);
    setStudents(item.students || []);
    setTrackingData(item.tracking_data || {});
    setSavedId(item.id);
  }, []);

  const deleteMarathon = useCallback(async (id) => {
    await api.deleteMarathon(id);
    if (savedId === id) {
      setSavedId(null);
    }
    setSaved(prev => prev.filter(s => s.id !== id));
  }, [savedId]);

  const reset = useCallback(() => {
    setTitle('Марафон');
    setClassNumber(8);
    setTasks([]);
    setStudents([]);
    setTrackingData({});
    setSavedId(null);
  }, []);

  // Подсчёт решённых задач для студента
  const countSolved = (studentName) => {
    const data = trackingData[studentName] || {};
    return Object.values(data).filter(v => v.solved).length;
  };

  // Рейтинг — список студентов, отсортированных по кол-ву решённых
  const getRanking = () => {
    return [...students]
      .map(name => ({ name, solved: countSolved(name) }))
      .sort((a, b) => b.solved - a.solved);
  };

  return {
    title, setTitle,
    classNumber, setClassNumber,
    tasks,
    students,
    trackingData, setTrackingData,
    savedId,
    saved, loadingSaved,
    saving,
    addTasks,
    removeTask,
    moveTask,
    addStudent,
    removeStudent,
    updateStudentName,
    initTracking,
    markAttempt,
    resetTaskForStudent,
    saveMarathon,
    saveTracking,
    loadMarathon,
    loadSavedList,
    deleteMarathon,
    reset,
    countSolved,
    getRanking,
  };
}
