// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { BUILTIN_NOTE_TEMPLATES, duplicateNoteData, noteFromTemplate } from '../components/workspace/notes/noteTemplates';

describe('шаблоны и копии заметок', () => {
  const note = {
    id: 'n1', title: 'Урок', owner: 'teacher', lesson: 'lesson1', group: 'group1', note_date: '2026-10-31',
    is_pinned: true, is_archived: true,
    body: [{ id: 'parent', type: 'paragraph', content: [{ type: 'inlineMath', props: { formula: 'x^2' } }],
      children: [{ id: 'child', type: 'checkListItem', props: { checked: true }, content: 'Повторить' }] }],
    links: [{ type: 'student', id: 's1' }, { type: 'note', id: 'n2' }, { type: 'material', id: 'f1' }],
  };

  it('создаёт копию с формулами и файлами, без связи с исходным уроком и его учениками', () => {
    const data = duplicateNoteData(note);
    expect(data.title).toBe('Урок — копия');
    expect(data.group).toBe('group1');
    expect(data.body[0].id).toBeUndefined();
    expect(data.body[0].children[0].id).toBeUndefined();
    expect(data.body[0].content[0].props.formula).toBe('x^2');
    expect(data.body[0].children[0].props.checked).toBe(true);
    expect(data.links).toEqual([{ type: 'material', id: 'f1' }]);
    for (const field of ['owner', 'lesson', 'note_date', 'is_pinned', 'is_archived']) expect(data).not.toHaveProperty(field);
    expect(note.body[0].id).toBe('parent');
  });

  it('в новой заметке из шаблона сбрасывает чек-листы и контекст', () => {
    const data = noteFromTemplate(note);
    expect(data.body[0].children[0].props.checked).toBe(false);
    expect(data).not.toHaveProperty('group');
    expect(data).not.toHaveProperty('links');
    expect(note.body[0].children[0].props.checked).toBe(true);
  });

  it('готовые шаблоны независимы: правка новой заметки не меняет шаблон', () => {
    expect(BUILTIN_NOTE_TEMPLATES).toHaveLength(4);
    const template = BUILTIN_NOTE_TEMPLATES[0];
    const data = noteFromTemplate(template);
    data.body[0].content = 'Другая тема';
    expect(template.body[0].content).toBe('Цель урока');
  });
});
