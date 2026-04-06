import { useState, useCallback } from 'react';
import { api } from '../services/pocketbase';

// ─── Все 16 стандартных углов (0 до 11π/6) ─────────────────────────────────
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
  { num: 11, den: 6  }, // 11π/6 = 330°
];

// ─── Форматирование угла ────────────────────────────────────────────────────
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

export function formatAngleLatex(num, den) {
  if (num === 0) return '0';
  const isNeg = num < 0;
  const sign  = isNeg ? '-' : '';
  const absN  = Math.abs(num);
  const g = gcd(absN, den);
  const n = absN / g;
  const d = den  / g;
  if (d === 1) return n === 1 ? `${sign}\\pi` : `${sign}${n}\\pi`;
  if (n === 1) return `${sign}\\dfrac{\\pi}{${d}}`;
  return `${sign}\\dfrac{${n}\\pi}{${d}}`;
}

// Компактная версия для таблицы (frac вместо dfrac)
export function formatAngleLatexCompact(num, den) {
  if (num === 0) return '0';
  const isNeg = num < 0;
  const sign  = isNeg ? '-' : '';
  const absN  = Math.abs(num);
  const g = gcd(absN, den);
  const n = absN / g;
  const d = den  / g;
  if (d === 1) return n === 1 ? `${sign}\\pi` : `${sign}${n}\\pi`;
  if (n === 1) return `${sign}\\frac{\\pi}{${d}}`;
  return `${sign}\\frac{${n}\\pi}{${d}}`;
}

// ─── Форматирование значения функции ────────────────────────────────────────
export function formatTrigValue(val) {
  if (Math.abs(val) < 1e-9) return '0';
  const isNeg = val < 0;
  const sign = isNeg ? '-' : '';
  const abs = Math.abs(val);
  if (Math.abs(abs - 1) < 1e-9)              return `${sign}1`;
  if (Math.abs(abs - 0.5) < 1e-9)            return `${sign}\\frac{1}{2}`;
  if (Math.abs(abs - Math.sqrt(2) / 2) < 1e-9) return `${sign}\\frac{\\sqrt{2}}{2}`;
  if (Math.abs(abs - Math.sqrt(3) / 2) < 1e-9) return `${sign}\\frac{\\sqrt{3}}{2}`;
  if (Math.abs(abs - Math.sqrt(3)) < 1e-9)   return `${sign}\\sqrt{3}`;
  if (Math.abs(abs - 1 / Math.sqrt(3)) < 1e-9) return `${sign}\\frac{\\sqrt{3}}{3}`;
  return `${sign}${Math.round(abs * 10000) / 10000}`;
}

// ─── Данные угла: все значения функций ──────────────────────────────────────
// k — сдвиг на k×2π (только для отображения угла; тригзначения те же)
function buildAngleData(angle, id, k = 0) {
  const { num, den } = angle;
  const theta = (num / den) * Math.PI;
  const sv = Math.sin(theta);
  const cv = Math.cos(theta);
  const tanUndef = Math.abs(cv) < 1e-9; // π/2, 3π/2
  const cotUndef = Math.abs(sv) < 1e-9; // 0, π
  // Отображаемый угол: (num + 2k·den)/den·π
  const dispNum = num + 2 * k * den;
  return {
    id,
    num,
    den,
    k,
    angleDisplay:        formatAngleLatex(dispNum, den),
    angleDisplayCompact: formatAngleLatexCompact(dispNum, den),
    sin: formatTrigValue(sv),
    cos: formatTrigValue(cv),
    tan: tanUndef ? null : formatTrigValue(sv / cv),
    cot: cotUndef ? null : formatTrigValue(cv / sv),
    tanUndef,
    cotUndef,
  };
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Настройки по умолчанию ────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  variantsCount:   4,
  anglesCount:     8,        // кол-во углов в таблице (случайный выбор из 16)
  maxK:            2,        // макс. сдвиг ±k×2π для углов (0 = без сдвига)
  showSin:         true,
  showCos:         true,
  showTan:         true,
  showCot:         true,
  showHelperLines: true,
  showAngleLabels: false,    // подписи углов вокруг окружности
  showTeacherKey:  true,
  layout:          'landscape',
};

// ─── Хук ───────────────────────────────────────────────────────────────────
export function useTrigValues() {
  const [title, setTitle]           = useState('Значения тригонометрических функций');
  const [settings, setSettings]     = useState({ ...DEFAULT_SETTINGS });
  const [tasksData, setTasksData]   = useState(null);
  const [savedId, setSavedId]       = useState(null);
  const [saved, setSaved]           = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [saving, setSaving]         = useState(false);

  const generate = useCallback(() => {
    const maxK = settings.maxK ?? 2;
    const count = Math.min(settings.anglesCount ?? 8, 16);

    const variants = Array.from({ length: settings.variantsCount }, () => {
      // Случайно выбираем count углов из 16 стандартных
      const shuffled = shuffleArray(STANDARD_ANGLES);
      const selected = shuffled.slice(0, count);
      selected.sort((a, b) => (a.num / a.den) - (b.num / b.den));

      // Каждый угол получает случайный сдвиг k ∈ [-maxK, +maxK]
      return selected.map((a, i) => {
        const k = maxK === 0 ? 0
          : Math.floor(Math.random() * (2 * maxK + 1)) - maxK;
        return buildAngleData(a, i + 1, k);
      });
    });

    setTasksData(variants);
    setSavedId(null);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setSavedId(null);
    setTitle('Значения тригонометрических функций');
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const loadSavedList = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const items = await api.getTrigValuesWorksheets();
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
        task_type:      `${settings.anglesCount ?? 8} углов`,
        variants_count: settings.variantsCount,
        settings,
        tasks_data:     tasksData,
      };
      if (savedId) {
        await api.updateTrigValuesWorksheet(savedId, payload);
      } else {
        const created = await api.createTrigValuesWorksheet(payload);
        setSavedId(created.id);
      }
    } finally {
      setSaving(false);
    }
  }, [title, settings, tasksData, savedId]);

  const loadWorksheet = useCallback((item) => {
    setTitle(item.title || 'Значения тригонометрических функций');
    setSettings({ ...DEFAULT_SETTINGS, ...item.settings });
    setTasksData(item.tasks_data);
    setSavedId(item.id);
  }, []);

  const deleteWorksheet = useCallback(async (id) => {
    await api.deleteTrigValuesWorksheet(id);
    setSaved(prev => prev.filter(w => w.id !== id));
    if (savedId === id) setSavedId(null);
  }, [savedId]);

  return {
    title, setTitle,
    settings, updateSetting,
    tasksData,
    generate, reset,
    savedId, saved, loadingSaved, saving,
    loadSavedList, saveWorksheet, loadWorksheet, deleteWorksheet,
  };
}
