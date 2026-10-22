// Общее для меню и разделов лендинга: куда ведут якоря и кнопка «GitHub».

export const GITHUB_URL = 'https://github.com/evilfaust/lemma'

// Порядок — путь учителя по странице: чертежи, затем рабочий день
// (подготовить → урок → проверить → журнал) и ученик.
export const NAV_ITEMS = [
  { id: 'drawings', label: 'Чертежи' },
  { id: 'prepare', label: 'Подготовка' },
  { id: 'lesson', label: 'Урок' },
  { id: 'check', label: 'Проверка' },
  { id: 'journal', label: 'Журнал' },
  { id: 'students', label: 'Ученикам' },
]

export function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}
