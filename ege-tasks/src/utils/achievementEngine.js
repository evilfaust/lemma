import { shuffleArray } from './shuffle';

/**
 * Выбрать случайный значок по редкости на основе процента правильных ответов
 * @param {Array} achievements - массив всех достижений
 * @param {number} percentage - процент правильных ответов (0-100)
 * @param {Array} excludedIds - ID, которые желательно не выдавать повторно
 * @returns {object|null} - выбранное достижение или null
 */
export function getRandomAchievement(achievements, percentage, excludedIds = []) {
  // Определить редкость на основе результата
  let rarity;
  if (percentage >= 90) {
    rarity = 'legendary';
  } else if (percentage >= 70) {
    rarity = 'rare';
  } else if (percentage >= 40) {
    rarity = 'common';
  } else {
    // Нет награды при результате < 40%
    return null;
  }

  // Фильтровать значки по типу 'random' и соответствующей редкости
  const filtered = achievements.filter(
    (a) => a.type === 'random' && a.rarity === rarity
  );

  if (filtered.length === 0) {
    return null;
  }

  // Предпочтительно не выдавать уже полученные значки той же редкости
  const excluded = new Set(excludedIds);
  const nonDuplicate = filtered.filter((a) => !excluded.has(a.id));
  const pool = nonDuplicate.length > 0 ? nonDuplicate : filtered;

  // Вернуть случайный значок из подходящих
  return shuffleArray([...pool])[0];
}

/**
 * Проверить и вернуть разблокированные достижения за условия
 * @param {Array} achievements - массив всех достижений
 * @param {object} attemptData - данные текущей попытки
 * @param {Array} allAttempts - все попытки студента (для подсчета количества)
 * @param {Array} previouslyUnlocked - ID уже разблокированных достижений
 * @returns {Array} - массив новых разблокированных достижений
 */
export function checkUnlockedAchievements(
  achievements,
  attemptData,
  allAttempts,
  previouslyUnlocked = []
) {
  const unlocked = [];

  // Фильтровать только достижения за условия
  const conditionAchievements = achievements.filter((a) => a.type === 'condition');

  for (const achievement of conditionAchievements) {
    // Пропустить уже разблокированные
    if (previouslyUnlocked.includes(achievement.id)) {
      continue;
    }

    // Проверить условие
    if (isAchievementUnlocked(achievement, attemptData, allAttempts)) {
      unlocked.push(achievement);
    }
  }

  return unlocked;
}

/**
 * Проверить, разблокировано ли конкретное достижение
 * @param {object} achievement - достижение для проверки
 * @param {object} attemptData - данные текущей попытки
 * @param {Array} allAttempts - все попытки студента
 * @returns {boolean} - true если условие выполнено
 */
function isAchievementUnlocked(achievement, attemptData, allAttempts) {
  const { condition_type, condition_value } = achievement;

  if (!condition_type || condition_value == null) {
    return false;
  }

  switch (condition_type) {
    case 'score':
      // Процент правильных >= condition_value.min
      return attemptData.percentage >= (condition_value.min || 0);

    case 'speed':
      // Время выполнения <= condition_value.max_minutes
      return attemptData.durationMinutes <= (condition_value.max_minutes || Infinity);

    case 'count':
      // Количество попыток >= condition_value.attempts
      // allAttempts уже включает текущую попытку
      return allAttempts.length >= (condition_value.attempts || 1);

    case 'special':
      // Специальные условия (время суток, день недели и т.д.)
      return checkSpecialCondition(condition_value, attemptData);

    default:
      return false;
  }
}

/**
 * Проверить специальное условие (время суток, день недели)
 * @param {object} conditionValue - параметры условия
 * @param {object} attemptData - данные попытки
 * @returns {boolean}
 */
function checkSpecialCondition(conditionValue, attemptData) {
  const { submittedAt } = attemptData;

  if (!submittedAt) {
    return false;
  }

  const date = new Date(submittedAt);
  const toMinutes = (timeString) => {
    if (typeof timeString !== 'string') return null;
    const [hRaw, mRaw] = timeString.split(':');
    const h = Number(hRaw);
    const m = Number(mRaw);
    if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  };

  // Проверка времени суток
  if (conditionValue.time_after || conditionValue.time_before) {
    const currentMinutes = date.getHours() * 60 + date.getMinutes();
    const after = toMinutes(conditionValue.time_after);
    const before = toMinutes(conditionValue.time_before);

    if (after !== null && before !== null) {
      // Окно может пересекать полночь: например, 22:00-06:00
      const inWindow = after <= before
        ? currentMinutes >= after && currentMinutes <= before
        : currentMinutes >= after || currentMinutes <= before;
      if (!inWindow) return false;
    } else if (after !== null && currentMinutes < after) {
      return false;
    } else if (before !== null && currentMinutes > before) {
      return false;
    }
  }

  // Проверка дня недели (0 = воскресенье, 6 = суббота).
  // Если передан массив, достаточно совпадения с одним из дней.
  if (conditionValue.day_of_week !== undefined) {
    const day = date.getDay();
    if (Array.isArray(conditionValue.day_of_week)) {
      return conditionValue.day_of_week.includes(day);
    }
    return day === conditionValue.day_of_week;
  }

  return true;
}

/**
 * Собрать все ID уже разблокированных достижений из всех попыток студента
 * @param {Array} attempts - все попытки студента
 * @returns {Array} - массив ID разблокированных достижений
 */
export function getPreviouslyUnlockedIds(attempts) {
  const ids = new Set();

  for (const attempt of attempts) {
    if (attempt.unlocked_achievements && Array.isArray(attempt.unlocked_achievements)) {
      for (const id of attempt.unlocked_achievements) {
        ids.add(id);
      }
    }
  }

  return Array.from(ids);
}
