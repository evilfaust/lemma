/**
 * AuthContext — контекст авторизации учителя.
 *
 * Архитектура:
 * - PocketBase SDK хранит токен в localStorage (`pb_auth`) автоматически.
 * - Поверх этого живёт флаг "remember me":
 *     - localStorage['pb_remember'] === 'true'  → токен сохраняется между сессиями.
 *     - иначе → токен очищается при закрытии последней вкладки (через sessionStorage маркер).
 * - Защита от случайного использования студенческого токена: при инициализации
 *   проверяем `collectionName === 'teachers'`. Если нет — очищаем.
 *
 * Использование:
 *   const { teacher, login, logout, hasSection, canEdit, isSuperAdmin } = useAuth();
 *
 * Защита маршрутов реализована в `<ProtectedRoute>` (см. components/auth/).
 */
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import pb from '../shared/services/pocketbase';

// Все секции, которые могут быть в allowed_sections (см. App.jsx menuItems).
export const ALL_SECTIONS = [
  'workspace',     // Моё пространство (классы/группы, КТП, журнал — учительское фло)
  'tasks',         // Все задачи + Аналитика
  'worksheets',    // Рабочие листы
  'gamification',  // Геймификация
  'works',         // Мои работы + Редактор
  'students',      // Ученики (прогресс, тепловая карта, ачивки)
  'geometry',      // Геометрия
  'tdf',           // ТДФ + карточки + формулы
  'trig',          // Тригонометрия
  'arith',         // Устный счёт
  'equations',     // Уравнения (генераторы линейных и др.)
  'functions',     // Функции (графики, производная)
  'theory',        // Теория
  'listki',        // Листки (Гордин + свои)
  'lab',           // Лаборатория
  'import',        // Импорт задач (только editor+)
  'admin',         // Управление пользователями (только superadmin)
];

const REMEMBER_KEY = 'pb_remember';
const SESSION_MARKER = 'pb_session_active';

// Очищаем чужие токены (например, студенческие) при инициализации модуля.
// Эта проверка должна выполниться ДО любого useEffect.
(function purgeAlienAuth() {
  try {
    const isTeacher = pb.authStore.model?.collectionName === 'teachers';
    if (pb.authStore.isValid && !isTeacher) {
      pb.authStore.clear();
      return;
    }

    // Просроченный токен = выход. PocketBase не отвечает на него 401, а молча
    // считает запрос гостевым: списки с правилами доступа (уроки, классы,
    // выдачи, заметки) приходят пустыми, публичные (задачи, темы) — полными.
    // Модель же лежит в localStorage, и интерфейс продолжал «видеть» учителя —
    // так выглядел пустой календарь на телефоне, где Lemma не открывали
    // дольше срока жизни токена.
    if (pb.authStore.token && !pb.authStore.isValid) {
      pb.authStore.clear();
    }

    // Если "не запоминать" и нет маркера активной сессии — очищаем.
    const remember = localStorage.getItem(REMEMBER_KEY) === 'true';
    const sessionActive = sessionStorage.getItem(SESSION_MARKER) === '1';
    if (pb.authStore.isValid && !remember && !sessionActive) {
      pb.authStore.clear();
    }
    sessionStorage.setItem(SESSION_MARKER, '1');
  } catch (e) {
    console.warn('[AuthContext] purgeAlienAuth failed:', e);
  }
})();

const REFRESH_EVERY = 60 * 60 * 1000;

// Продлить токен учителя. Выкидываем только на ответ сервера «токен не годится»
// (4xx): обрыв сети (status 0) на мобильном интернете — не повод разлогинивать.
function refreshTeacherAuth() {
  return pb.collection('teachers')
    .authRefresh()
    .catch((err) => {
      console.warn('[AuthContext] authRefresh failed:', err?.status);
      if (err?.status >= 400 && err?.status < 500) pb.authStore.clear();
    });
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [teacher, setTeacher] = useState(() => {
    return pb.authStore.isValid && pb.authStore.model?.collectionName === 'teachers'
      ? pb.authStore.model
      : null;
  });

  // Подписываемся на изменения authStore (login/logout/token refresh).
  useEffect(() => {
    const unsub = pb.authStore.onChange((_token, model) => {
      if (model?.collectionName === 'teachers') {
        setTeacher({ ...model });
      } else {
        setTeacher(null);
      }
    }, false);
    return () => unsub();
  }, []);

  // Опционально — обновим модель с сервера при монтировании, если токен валиден
  // (чтобы подхватить изменённый role/allowed_sections).
  useEffect(() => {
    if (!pb.authStore.isValid || pb.authStore.model?.collectionName !== 'teachers') {
      return;
    }
    refreshTeacherAuth();
  }, []);

  // Вкладку на телефоне держат открытой днями, страница не перезагружается —
  // проверки при монтировании мало. Когда вкладка снова видна: просроченный
  // токен → на вход, живой → продлеваем (не чаще раза в REFRESH_EVERY).
  useEffect(() => {
    let lastRefresh = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (pb.authStore.model?.collectionName !== 'teachers') return;
      if (!pb.authStore.isValid) {
        pb.authStore.clear();
        return;
      }
      if (Date.now() - lastRefresh < REFRESH_EVERY) return;
      lastRefresh = Date.now();
      refreshTeacherAuth();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  const login = useCallback(async (username, password, remember = true) => {
    const res = await pb.collection('teachers').authWithPassword(username, password);
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, 'true');
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
    sessionStorage.setItem(SESSION_MARKER, '1');

    // Обновляем last_login — fire-and-forget. Используем updateRule
    // "self или superadmin", залогиненный учитель обновляет себя.
    pb.collection('teachers')
      .update(res.record.id, { last_login: new Date().toISOString() })
      .catch((err) => console.debug('[auth] last_login update failed:', err?.message));

    return res.record;
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
    localStorage.removeItem(REMEMBER_KEY);
  }, []);

  const role = teacher?.role ?? null;
  const isSuperAdmin = role === 'superadmin';
  const canEdit = role === 'superadmin' || role === 'editor';
  const canDelete = canEdit;
  // ИИ-тумблер (v3.9.117): суперадмин управляет в UserManager.
  // Отсутствие поля (старые записи/токен до миграции) = включено.
  const aiEnabled = !!teacher && teacher.ai_enabled !== false;

  const hasSection = useCallback(
    (key) => {
      if (!teacher) return false;
      if (role === 'superadmin') return true;
      const allowed = Array.isArray(teacher.allowed_sections)
        ? teacher.allowed_sections
        : [];
      return allowed.includes(key);
    },
    [teacher, role],
  );

  const value = useMemo(
    () => ({
      teacher,
      isAuthenticated: !!teacher,
      role,
      isSuperAdmin,
      canEdit,
      canDelete,
      aiEnabled,
      hasSection,
      login,
      logout,
    }),
    [teacher, role, isSuperAdmin, canEdit, canDelete, aiEnabled, hasSection, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

/**
 * То же без требования провайдера: null вне <AuthProvider>. Для общих
 * компонентов генераторов (кнопки листа), которые рендерятся и без входа —
 * например в тестах: права там просто «нет».
 */
export function useOptionalAuth() {
  return useContext(AuthContext);
}
