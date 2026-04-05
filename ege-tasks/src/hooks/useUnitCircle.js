import { useState, useCallback } from 'react';
import { api } from '../services/pocketbase';

// ─── Углы ───────────────────────────────────────────────────────────────────
// 16 стандартных позиций на единичной окружности (num/den * π)
const STANDARD_ANGLES = [
  { num: 0,  den: 1  }, // 0
  { num: 1,  den: 6  }, // π/6  = 30°
  { num: 1,  den: 4  }, // π/4  = 45°
  { num: 1,  den: 3  }, // π/3  = 60°
  { num: 1,  den: 2  }, // π/2  = 90°
  { num: 2,  den: 3  }, // 2π/3 = 120°
  { num: 3,  den: 4  }, // 3π/4 = 135°
  { num: 5,  den: 6  }, // 5π/6 = 150°
  { num: 1,  den: 1  }, // π    = 180°
  { num: 7,  den: 6  }, // 7π/6 = 210°
  { num: 5,  den: 4  }, // 5π/4 = 225°
  { num: 4,  den: 3  }, // 4π/3 = 240°
  { num: 3,  den: 2  }, // 3π/2 = 270°
  { num: 5,  den: 3  }, // 5π/3 = 300°
  { num: 7,  den: 4  }, // 7π/4 = 315°
  { num: 11, den: 6  }, // 11π/6= 330°
];

// НОД (для упрощения дробей)
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

// Форматирование угла: num/den * π + k*2π → строка типа "13π/6", "-11π/6"
export function formatAngle(num, den, k = 0) {
  const totalNum = num + 2 * k * den;
  if (totalNum === 0) return '0';
  const g = gcd(Math.abs(totalNum), den);
  const n = totalNum / g;
  const d = den / g;
  if (d === 1) {
    if (n === 1)  return 'π';
    if (n === -1) return '-π';
    return `${n}π`;
  }
  if (n === 1)  return `π/${d}`;
  if (n === -1) return `-π/${d}`;
  return `${n}π/${d}`;
}

// Тасование Фишера-Йейтса (не мутирует оригинал)
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Генерация одного задания (одна окружность)
function generateTask(taskType, pointsCount, maxK) {
  const shuffled = shuffleArray(STANDARD_ANGLES);
  const selected = shuffled.slice(0, Math.min(pointsCount, 16));

  const points = selected.map(({ num, den }, i) => {
    let k = 0;
    if (maxK > 0) {
      k = Math.floor(Math.random() * (2 * maxK + 1)) - maxK;
    }
    return {
      id: i + 1,
      num,
      den,
      k,
      display: formatAngle(num, den, k),
    };
  });

  // Сортируем по угловой позиции для более естественного вида в печатном листе
  points.sort((a, b) => (a.num / a.den) - (b.num / b.den));
  // Перенумеровываем после сортировки
  points.forEach((p, i) => { p.id = i + 1; });

  return { type: taskType, points };
}

// Генерация одного варианта (несколько окружностей)
function generateVariant(settings) {
  const { circlesPerPage, pointsPerCircle, maxK, taskType } = settings;
  const tasks = [];
  for (let i = 0; i < circlesPerPage; i++) {
    let type = taskType;
    if (taskType === 'mixed') {
      type = i % 2 === 0 ? 'direct' : 'inverse';
    }
    tasks.push(generateTask(type, pointsPerCircle, maxK));
  }
  return tasks;
}

// ─── Настройки по умолчанию ──────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  variantsCount: 4,
  circlesPerPage: 2,      // 2 | 4
  pointsPerCircle: 8,     // 4–12
  maxK: 1,                // максимальное смещение на k×2π (0 = только [0,2π))
  taskType: 'mixed',      // 'direct' | 'inverse' | 'mixed'
  showAxes: 'axes',       // 'none' | 'axes' | 'all'
  showDegrees: false,
  showTicks: true,
  showTeacherKey: true,
};

// ─── Хук ─────────────────────────────────────────────────────────────────────
export function useUnitCircle() {
  const [title, setTitle] = useState('Единичная окружность');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [tasksData, setTasksData] = useState(null); // null = ещё не сгенерировано
  const [savedId, setSavedId] = useState(null);
  const [saved, setSaved] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Обновление отдельной настройки
  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // Генерация вариантов
  const generate = useCallback(() => {
    const variants = Array.from(
      { length: settings.variantsCount },
      () => generateVariant(settings)
    );
    setTasksData(variants);
    setSavedId(null); // новая генерация сбрасывает связь с сохранённой
  }, [settings]);

  // Сброс
  const reset = useCallback(() => {
    setTasksData(null);
    setSavedId(null);
    setTitle('Единичная окружность');
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  // ─── DB операции ────────────────────────────────────────────────────────────
  const loadSavedList = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const items = await api.getUnitCircleWorksheets();
      setSaved(items);
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  const saveWorksheet = useCallback(async () => {
    if (!tasksData) return;
    setSaving(true);
    try {
      const payload = {
        title,
        task_type: settings.taskType,
        variants_count: settings.variantsCount,
        settings,
        tasks_data: tasksData,
      };
      if (savedId) {
        await api.updateUnitCircleWorksheet(savedId, payload);
      } else {
        const created = await api.createUnitCircleWorksheet(payload);
        setSavedId(created.id);
      }
    } finally {
      setSaving(false);
    }
  }, [title, settings, tasksData, savedId]);

  const loadWorksheet = useCallback((item) => {
    setTitle(item.title || 'Единичная окружность');
    setSettings({ ...DEFAULT_SETTINGS, ...item.settings });
    setTasksData(item.tasks_data);
    setSavedId(item.id);
  }, []);

  const deleteWorksheet = useCallback(async (id) => {
    await api.deleteUnitCircleWorksheet(id);
    setSaved(prev => prev.filter(w => w.id !== id));
    if (savedId === id) {
      setSavedId(null);
    }
  }, [savedId]);

  return {
    title, setTitle,
    settings, updateSetting,
    tasksData,
    savedId,
    saved, loadingSaved,
    saving,
    generate,
    reset,
    loadSavedList,
    saveWorksheet,
    loadWorksheet,
    deleteWorksheet,
  };
}
