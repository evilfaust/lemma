const heading = (text) => ({ type: 'heading', props: { level: 2 }, content: text });
const paragraph = () => ({ type: 'paragraph', content: '' });
const sections = (...titles) => titles.flatMap((title) => [heading(title), paragraph()]);

export const BUILTIN_NOTE_TEMPLATES = [
  { id: 'lesson-plan', title: 'План урока', type: 'lesson', body: sections('Цель урока', 'Повторение', 'Новая тема', 'Практика', 'Домашнее задание', 'Итоги урока') },
  { id: 'test-review', title: 'Разбор контрольной', type: 'lesson', body: sections('Работа и тема', 'Типичные ошибки', 'Задачи для разбора', 'Кому нужна помощь', 'Что повторить') },
  { id: 'student-observation', title: 'Наблюдение за учеником', type: 'obs', body: sections('Ученик', 'Что получилось', 'Что вызывает трудности', 'Следующий шаг') },
  { id: 'parent-call', title: 'Разговор с родителями', type: 'call', body: sections('С кем говорили', 'Повод', 'Что обсудили', 'Договорённости') },
];

// Новые документы получают новые id блоков, чек-листы сбрасываются. Метаданные
// урока/группы/учеников намеренно не входят в шаблон и выбираются для новой записи.
export function freshNoteBody(body, { resetChecks = false } = {}) {
  if (!Array.isArray(body)) return [];
  return body.map(({ id, children, ...block }) => ({
    ...JSON.parse(JSON.stringify(block)),
    ...(resetChecks && block.type === 'checkListItem'
      ? { props: { ...block.props, checked: false } } : {}),
    ...(Array.isArray(children) ? { children: freshNoteBody(children, { resetChecks }) } : {}),
  }));
}

export function noteFromTemplate(template) {
  return { title: template.title, type: template.type || 'idea', body: freshNoteBody(template.body, { resetChecks: true }) };
}

export function duplicateNoteData(note) {
  return {
    title: `${note.title?.trim() || 'Без названия'} — копия`.slice(0, 200),
    type: note.type || (note.lesson ? 'lesson' : 'idea'),
    body: freshNoteBody(note.body),
    group: note.group || '',
    // Сохраняем только файлы: копия не отмечает учеников исходного урока.
    links: (Array.isArray(note.links) ? note.links : []).filter((l) => l.type === 'material'),
  };
}
