import { useState, useCallback } from 'react';
import { api } from '../services/pocketbase';
import { formatAngleLatex } from './useUnitCircle';

const STANDARD_ANGLES = [
  { num: 0,  den: 1  }, // 0
  { num: 1,  den: 6  }, // π/6
  { num: 1,  den: 4  }, // π/4
  { num: 1,  den: 3  }, // π/3
  { num: 1,  den: 2  }, // π/2
  { num: 2,  den: 3  }, // 2π/3
  { num: 3,  den: 4  }, // 3π/4
  { num: 5,  den: 6  }, // 5π/6
  { num: 1,  den: 1  }, // π
  { num: 7,  den: 6  }, // 7π/6
  { num: 5,  den: 4  }, // 5π/4
  { num: 4,  den: 3  }, // 4π/3
  { num: 3,  den: 2  }, // 3π/2
  { num: 5,  den: 3  }, // 5π/3
  { num: 7,  den: 4  }, // 7π/4
  { num: 11, den: 6  }, // 11π/6
];

// Алфавит для заполнения пустых мест (исключая Й, Ё, Ъ, Ь, Ы)
const ALPHABET = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ".split("");

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRandomK(maxK) {
  if (maxK === 0) return 0;
  return Math.floor(Math.random() * (2 * maxK + 1)) - maxK;
}

export const DEFAULT_CRYPTO_SETTINGS = {
  circlesPerPage: 2,
  maxK: 1,
  showAxes: 'axes',
  showDegrees: false,
  showTicks: true,
  showTeacherKey: true,
};

export function useCryptogram() {
  const [title, setTitle] = useState('Тригонометрия: Шифровки');
  const [wordsText, setWordsText] = useState('СИНУС\nТАНГЕНС\nФУНКЦИЯ\nПЕРИОД');
  const [settings, setSettings] = useState({ ...DEFAULT_CRYPTO_SETTINGS });
  const [tasksData, setTasksData] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [saved, setSaved] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const generate = useCallback(() => {
    // Парсим слова (очистка от пробелов, приведение к верхнему регистру)
    const wordsRaw = wordsText.split('\n').map(w => w.trim().toUpperCase()).filter(w => w.length > 0);
    if (wordsRaw.length === 0) return; // Нет слов

    // Формируем варианты (каждое слово = отдельное задание)
    // Но так как у нас на странице может быть 2 или 4 кружка, варианты группируются по страницам.
    // Если слов 5, а circlesPerPage 2, будет 3 страницы (2+2+1).
    const variants = [];
    let currentVariant = [];

    for (let currentWord of wordsRaw) {
      // 1. Извлекаем уникальные буквы слова
      const uniqueLetters = Array.from(new Set(currentWord.split('')));
      if (uniqueLetters.length > 16) {
        // Больше 16 уникальных букв не влезает на круг
        uniqueLetters.splice(16);
      }

      // 2. Расставляем эти буквы на случайные стандартные углы
      const shuffledAngles = shuffleArray([...STANDARD_ANGLES]);
      const cipherMap = [];
      const letterToAngle = {};

      uniqueLetters.forEach((letter, i) => {
        const angle = shuffledAngles[i];
        cipherMap.push({ ...angle, letter });
        letterToAngle[letter] = angle;
      });

      // 3. Заполняем оставшиеся углы случайными буквами
      const unusedAngles = shuffledAngles.slice(uniqueLetters.length);
      const unusedAlphabet = shuffleArray(ALPHABET.filter(char => !uniqueLetters.includes(char)));
      
      unusedAngles.forEach((angle, i) => {
        const randomLetter = unusedAlphabet[i % unusedAlphabet.length];
        cipherMap.push({ ...angle, letter: randomLetter });
      });

      // 4. Формируем "вопросы" - последовательность углов для изначального слова
      const questions = currentWord.split('').map((char, index) => {
        const baseAngle = letterToAngle[char] || letterToAngle[uniqueLetters[0]]; // fallback
        const k = getRandomK(settings.maxK);
        return {
          id: index + 1,
          letter: char,
          display: formatAngleLatex(baseAngle.num, baseAngle.den, k)
        };
      });

      currentVariant.push({
        word: currentWord,
        cipherMap,
        questions
      });

      if (currentVariant.length === settings.circlesPerPage) {
        variants.push(currentVariant);
        currentVariant = [];
      }
    }

    if (currentVariant.length > 0) {
      variants.push(currentVariant);
    }

    setTasksData(variants);
    setSavedId(null);
  }, [wordsText, settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setSavedId(null);
    setTitle('Тригонометрия: Шифровки');
    setSettings({ ...DEFAULT_CRYPTO_SETTINGS });
    setWordsText('СИНУС\nТАНГЕНС\nФУНКЦИЯ\nПЕРИОД');
  }, []);

  // -- Сохранение --
  const loadSavedList = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const items = await api.getUnitCircleWorksheets();
      // Фильтруем только шифровки (допустим task_type === 'cryptogram')
      setSaved(items.filter(i => i.task_type === 'cryptogram'));
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
        task_type: 'cryptogram',
        variants_count: tasksData.length, // Это количество страниц, но пусть будет
        settings: { ...settings, wordsText },
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
  }, [title, settings, wordsText, tasksData, savedId]);

  const loadWorksheet = useCallback((item) => {
    setTitle(item.title || 'Тригонометрия: Шифровки');
    setSettings({ ...DEFAULT_CRYPTO_SETTINGS, ...item.settings });
    setWordsText(item.settings?.wordsText || 'СИНУС');
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
    wordsText, setWordsText,
    settings, updateSetting,
    tasksData,
    savedId,
    saved, loadingSaved, saving,
    generate, reset,
    loadSavedList, saveWorksheet, loadWorksheet, deleteWorksheet
  };
}
