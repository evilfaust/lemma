/// <reference path="../pb_data/types.d.ts" />

// Правила доступа для со-ведения класса (поля заведены в 1786100000).
//
// 🚨 Главный принцип: доступ НЕ раздаётся по каждой коллекции отдельно, а
// выводится ЧЕРЕЗ КЛАСС. `co_teachers` живёт только на `teaching_groups`, а
// правила уроков, посещаемости, учеников, членств и заметок уроков доходят до
// него по relation. Один источник правды: убрал коллегу из класса — доступ
// пропал везде.
//
// Что со-учитель получает (решение пользователя 16.09.2026 — «полный доступ»):
//   • уроки класса: видит, правит, переносит, удаляет, отмечает посещаемость;
//   • учеников класса и журнал членства: ЧИТАЕТ (правка карточки ученика и
//     его перевод остаются у владельца);
//   • заметку урока: видит и правит — но ТОЛЬКО привязанную к уроку
//     (`lesson != ""`). Личные заметки учителя об этом классе не открываются;
//   • сам класс: видит и правит карточку, но НЕ удаляет — полный доступ к
//     уроку не означает права снести чужой класс.
//
// Точечный шаринг урока (`lessons.shared_with`) даёт видеть и править этот
// урок и его посещаемость, но не удалять его.
//
// 🚨 Ученический контур НЕ трогаем: attempts/attempt_answers/variants и
// публичные viewRule работ и выдач остаются как были. После применения
// обязательно проверить student-пути — миграция 1783300000 в июле уже роняла
// live-дашборд марафона, и это всплыло не сразу (PocketBase сверяет viewRule
// при доставке realtime-события, а subscribe() при этом не падает).
//
// Откат: down() восстанавливает правила из снимка ПРОДа от 16.09.2026.

const T = '@request.auth.collectionName = "teachers"';
const NV = '@request.auth.role != "viewer"';
const OWN = '(owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")';

// Со-ведение: «я в списке ведущих этого класса».
const CO_SELF = 'co_teachers ?= @request.auth.id';                // на самой группе
const CO_GROUP = 'group.co_teachers ?= @request.auth.id';         // через поле group
const CO_LESSON = 'lesson.group.co_teachers ?= @request.auth.id'; // через урок
const CO_STUDENT = 'teaching_group.co_teachers ?= @request.auth.id';
const SHARED = 'shared_with ?= @request.auth.id';                 // точечный доступ к уроку
const SHARED_LESSON = 'lesson.shared_with ?= @request.auth.id';

const NEW_RULES = {
  teaching_groups: {
    listRule: `${T} && (${OWN} || ${CO_SELF})`,
    viewRule: `(${T} && (${OWN} || ${CO_SELF})) || kind = "course"`,
    updateRule: `${T} && ${NV} && (${OWN} || ${CO_SELF})`,
    // deleteRule НЕ трогаем — класс сносит только владелец.
  },

  lessons: {
    listRule: `${T} && (${OWN} || ${CO_GROUP} || ${SHARED})`,
    viewRule: `${T} && (${OWN} || ${CO_GROUP} || ${SHARED})`,
    updateRule: `${T} && ${NV} && (${OWN} || ${CO_GROUP} || ${SHARED})`,
    // Удалять урок может владелец и со-учитель класса; получивший урок
    // точечно — нет (он гость на одном занятии).
    deleteRule: `${T} && ${NV} && (${OWN} || ${CO_GROUP})`,
  },

  lesson_attendance: {
    listRule: `${T} && (${OWN} || ${CO_LESSON} || ${SHARED_LESSON})`,
    viewRule: `${T} && (${OWN} || ${CO_LESSON} || ${SHARED_LESSON})`,
    updateRule: `${T} && ${NV} && (${OWN} || ${CO_LESSON} || ${SHARED_LESSON})`,
    deleteRule: `${T} && ${NV} && (${OWN} || ${CO_LESSON} || ${SHARED_LESSON})`,
  },

  // 🚨 ПДн детей: расширяем только ЧТЕНИЕ и только по текущей группе ученика.
  students: {
    listRule: `${T} && (${OWN} || ${CO_STUDENT})`,
    viewRule: `(${T} && (${OWN} || ${CO_STUDENT})) || id = @request.auth.id`,
  },

  group_memberships: {
    listRule: `${T} && (${OWN} || ${CO_GROUP})`,
    viewRule: `${T} && (${OWN} || ${CO_GROUP})`,
  },

  // Только заметки УРОКОВ со-ведомого класса; личные заметки о классе — нет.
  teacher_notes: {
    listRule: `${T} && (${OWN} || (lesson != "" && ${CO_LESSON}))`,
    viewRule: `${T} && (${OWN} || (lesson != "" && ${CO_LESSON}))`,
    updateRule: `${T} && ${NV} && (${OWN} || (lesson != "" && ${CO_LESSON}))`,
  },
};

// Снимок ПРОДа от 16.09.2026 (то, что стояло до этой миграции).
const OLD_RULES = {
  teaching_groups: {
    listRule: '@request.auth.collectionName = "teachers" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
    viewRule: '(@request.auth.collectionName = "teachers" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")) || kind = "course"',
    updateRule: '@request.auth.collectionName = "teachers" && @request.auth.role != "viewer" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
  },
  lessons: {
    listRule: '@request.auth.collectionName = "teachers" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
    viewRule: '@request.auth.collectionName = "teachers" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
    updateRule: '@request.auth.collectionName = "teachers" && @request.auth.role != "viewer" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
    deleteRule: '@request.auth.collectionName = "teachers" && @request.auth.role != "viewer" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
  },
  lesson_attendance: {
    listRule: '@request.auth.collectionName = "teachers" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
    viewRule: '@request.auth.collectionName = "teachers" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
    updateRule: '@request.auth.collectionName = "teachers" && @request.auth.role != "viewer" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
    deleteRule: '@request.auth.collectionName = "teachers" && @request.auth.role != "viewer" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
  },
  students: {
    listRule: '@request.auth.collectionName = "teachers" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
    viewRule: '(@request.auth.collectionName = "teachers" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")) || id = @request.auth.id',
  },
  group_memberships: {
    listRule: '@request.auth.collectionName = "teachers" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
    viewRule: '@request.auth.collectionName = "teachers" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
  },
  teacher_notes: {
    listRule: '@request.auth.collectionName = "teachers" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
    viewRule: '@request.auth.collectionName = "teachers" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
    updateRule: '@request.auth.collectionName = "teachers" && @request.auth.role != "viewer" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")',
  },
};

function applyRules(app, rulesMap) {
  for (const [name, rules] of Object.entries(rulesMap)) {
    const col = app.findCollectionByNameOrId(name);
    for (const [key, value] of Object.entries(rules)) {
      col[key] = value;
    }
    app.save(col);
    console.log(`[1786200000] ${name}: правила обновлены`);
  }
}

migrate((app) => {
  applyRules(app, NEW_RULES);
  console.log("[1786200000] Со-ведение класса: правила применены");
}, (app) => {
  applyRules(app, OLD_RULES);
  console.log("[1786200000] Со-ведение класса: правила откачены к снимку 16.09.2026");
});
