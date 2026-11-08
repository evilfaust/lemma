import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, App, Button, DatePicker, Dropdown, Input, Popconfirm, Segmented, Select, Spin, Tooltip,
} from 'antd';
import {
  ContainerOutlined, DeleteOutlined, FileTextOutlined, InboxOutlined, PaperClipOutlined,
  PlusOutlined, PushpinFilled, PushpinOutlined, SearchOutlined, UndoOutlined, TeamOutlined,
  ThunderboltOutlined, DownOutlined, BoldOutlined, FontSizeOutlined, UnorderedListOutlined,
  CheckSquareOutlined, FunctionOutlined, PictureOutlined, TableOutlined, ExportOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, MoreOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import InsertStudentsModal from './InsertStudentsModal';
import { WorkspacePageHeader, EmptyState, Chip, GroupChip } from './ui';
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs, filterSuggestionItems, insertOrUpdateBlock } from '@blocknote/core';
import { ru as bnRu } from '@blocknote/core/locales';
import { api } from '../../shared/services/pocketbase';
import { materialsApi } from '../../shared/services/pb/filesClient';
import { useAuth } from '../../contexts/AuthContext';
import { MathBlock, mathSlashItem } from './notesMathBlock';
import { extractNoteText, extractCheckItems } from './notesText';
import { NOTE_TYPES, noteTypeMeta } from './notes/noteTypes';
import NoteContextPanel from './notes/NoteContextPanel';
import { InlineMath, InlineMathEditContext, InlineFormulaDialog } from './notes/InlineMath';
import { createNoteDraftStore, createNoteSaveQueue } from './notes/noteDrafts';
import { duplicateNoteData, freshNoteBody, noteFromTemplate } from './notes/noteTemplates';
import { NoteTemplatesDialog, SaveNoteTemplateDialog } from './notes/NoteTemplatesDialog';
import { currentTeacher } from '../../shared/services/pb/client';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './NotesWorkspace.css';

const noteSchema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, math: MathBlock },
  inlineContentSpecs: { ...defaultInlineContentSpecs, inlineMath: InlineMath },
});

const RAIL_KEY = 'notes.railCollapsed';

// Компактная дата для списка.
function shortDate(iso) {
  if (!iso) return '';
  const d = dayjs(iso);
  if (d.isSame(dayjs(), 'day')) return d.format('HH:mm');
  if (d.isSame(dayjs().subtract(1, 'day'), 'day')) return 'вчера';
  if (d.isSame(dayjs(), 'year')) return d.format('DD.MM');
  return d.format('DD.MM.YY');
}

// Стартовый шаблон тела по типу заметки (для split-button «Новая заметка»).
function starterBody(type) {
  if (type === 'plan') {
    return [
      { type: 'heading', props: { level: 3 }, content: 'План' },
      { type: 'checkListItem', props: { checked: false }, content: 'Первый пункт' },
    ];
  }
  if (type === 'call') {
    return [
      { type: 'heading', props: { level: 3 }, content: 'Кому' },
      { type: 'paragraph', content: '' },
      { type: 'heading', props: { level: 3 }, content: 'Итог' },
      { type: 'paragraph', content: '' },
    ];
  }
  return undefined;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

// ── Редактор одной заметки (BlockNote) + тулбар форматирования. ──
const NoteEditor = forwardRef(function NoteEditor(
  { note, onSaveBody, editable, onTagStudents, wordCount, readMin }, ref,
) {
  const { message } = App.useApp();
  const [studentsModalOpen, setStudentsModalOpen] = useState(false);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const initialContent = useMemo(
    () => (Array.isArray(note.body) && note.body.length ? note.body : undefined),
    [note.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const editor = useCreateBlockNote({
    schema: noteSchema,
    initialContent,
    dictionary: bnRu,
    uploadFile: async (file) => {
      if (!materialsApi.isConnected()) {
        message.warning('Хранилище не подключено — войдите в «Библиотеку материалов», чтобы вставлять файлы');
        throw new Error('pb-files not connected');
      }
      const rec = await materialsApi.uploadMaterial({
        file, title: file.name.replace(/\.[^.]+$/, ''), category: 'other',
      });
      return materialsApi.fileUrl(rec);
    },
  });

  const handleChange = () => {
    onSaveBody(note.id, editor.document);
  };

  // Вставка/конвертация блока по позиции курсора.
  const insert = (spec, convertIfEmpty = true) => {
    if (!editor) return;
    const cur = editor.getTextCursorPosition().block;
    const isEmpty = cur.type === 'paragraph'
      && (!cur.content || (Array.isArray(cur.content) && cur.content.length === 0));
    if (convertIfEmpty && isEmpty) editor.updateBlock(cur, spec);
    else editor.insertBlocks([spec], cur, 'after');
    editor.focus();
  };

  const insertStudents = (selected) => {
    setStudentsModalOpen(false);
    if (!selected.length) return;
    const blocks = [];
    selected.forEach((s) => {
      blocks.push({ type: 'heading', props: { level: 3 }, content: s.name || s.username });
      blocks.push({ type: 'paragraph', content: '' });
    });
    const doc = editor.document;
    const refBlock = doc[doc.length - 1];
    editor.insertBlocks(blocks, refBlock, 'after');
    onSaveBody(note.id, editor.document);
    onTagStudents?.(selected);
    message.success(`Добавлено учеников: ${selected.length}`);
  };

  // API наружу — для контекст-панели (отметить учеников) и шапки (экспорт PDF).
  useImperativeHandle(ref, () => ({
    requestInsertStudents: () => setStudentsModalOpen(true),
    getBody: () => editor.document,
    toggleCheck: (blockId) => {
      const block = editor.getBlock(blockId);
      if (block?.type === 'checkListItem') editor.updateBlock(block, { props: { checked: !block.props.checked } });
    },
    exportPdf: async () => {
      try {
        const html = await editor.blocksToHTMLLossy(editor.document);
        const wrap = document.createElement('div');
        wrap.style.cssText = 'padding:24px;max-width:780px;font-family:Geist,system-ui,sans-serif;color:#0D1321';
        wrap.innerHTML = `<h1 style="font-size:24px">${escapeHtml(note.title || 'Заметка')}</h1>${html}`;
        const mod = await import('html2pdf.js');
        const html2pdf = mod.default || mod;
        await html2pdf().set({
          margin: 12,
          filename: `${(note.title || 'note').slice(0, 40) || 'note'}.pdf`,
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        }).from(wrap).save();
      } catch {
        message.error('Не удалось экспортировать заметку');
      }
    },
  }), [editor, note.title]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <InlineMathEditContext.Provider value={editable}>
    <div className="note-editor-wrap">
      {editable && (
        <div className="note-editor-toolbar">
          <Tooltip title="Подзаголовок">
            <Button size="small" type="text" icon={<FontSizeOutlined />}
              onClick={() => insert({ type: 'heading', props: { level: 2 } })} />
          </Tooltip>
          <Tooltip title="Жирный">
            <Button size="small" type="text" icon={<BoldOutlined />}
              onClick={() => { editor.toggleStyles({ bold: true }); editor.focus(); }} />
          </Tooltip>
          <Tooltip title="Список">
            <Button size="small" type="text" icon={<UnorderedListOutlined />}
              onClick={() => insert({ type: 'bulletListItem' })} />
          </Tooltip>
          <Tooltip title="Чек-лист">
            <Button size="small" type="text" icon={<CheckSquareOutlined />}
              onClick={() => insert({ type: 'checkListItem', props: { checked: false } })} />
          </Tooltip>
          <Tooltip title="Формула в строке">
            <Button size="small" type="text" onClick={() => setFormulaOpen(true)}>∑ в строке</Button>
          </Tooltip>
          <Tooltip title="Блок-формула (LaTeX)">
            <Button size="small" type="text" icon={<FunctionOutlined />}
              onClick={() => { insertOrUpdateBlock(editor, { type: 'math', props: { formula: '' } }); editor.focus(); }} />
          </Tooltip>
          <Tooltip title="Изображение">
            <Button size="small" type="text" icon={<PictureOutlined />}
              onClick={() => insert({ type: 'image' })} />
          </Tooltip>
          <Tooltip title="Таблица">
            <Button size="small" type="text" icon={<TableOutlined />}
              onClick={() => insert({
                type: 'table',
                content: { type: 'tableContent', rows: [{ cells: [[], []] }, { cells: [[], []] }] },
              }, false)} />
          </Tooltip>
          <span className="note-editor-toolbar__sep" />
          <Tooltip title={note.group ? 'Разделы по ученикам группы' : 'У заметки не указана группа'}>
            <Button size="small" type="text" icon={<TeamOutlined />} disabled={!note.group}
              onClick={() => setStudentsModalOpen(true)}>
              Ученики
            </Button>
          </Tooltip>
          <span className="note-editor-toolbar__count">
            {wordCount} слов · ~{readMin} мин · «/» команды
          </span>
        </div>
      )}
      <BlockNoteView
        editor={editor}
        editable={editable}
        onChange={editable ? handleChange : undefined}
        slashMenu={false}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(
              [...getDefaultReactSlashMenuItems(editor), mathSlashItem(editor), {
                title: 'Формула в строке', subtext: 'LaTeX внутри предложения',
                aliases: ['inline', 'latex', 'math', 'формула', 'строка'], group: 'Дополнительно',
                onItemClick: () => setFormulaOpen(true),
              }],
              query,
            )
          }
        />
      </BlockNoteView>
      <InlineFormulaDialog open={formulaOpen} onCancel={() => setFormulaOpen(false)}
        onConfirm={(formula) => {
          if (!editable) return;
          const block = editor.getTextCursorPosition().block;
          if (!Array.isArray(block.content) && block.type !== 'table') {
            const [paragraph] = editor.insertBlocks([{ type: 'paragraph' }], block, 'after');
            editor.setTextCursorPosition(paragraph, 'start');
          }
          editor.insertInlineContent([{ type: 'inlineMath', props: { formula } }, ' '], { updateSelection: true });
          setFormulaOpen(false);
          editor.focus();
        }} />
      <InsertStudentsModal
        open={studentsModalOpen}
        groupId={note.group}
        onCancel={() => setStudentsModalOpen(false)}
        onConfirm={insertStudents}
      />
    </div>
    </InlineMathEditContext.Provider>
  );
});

export default function NotesWorkspace() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { teacher, canEdit, canDelete } = useAuth();

  const [searchParams] = useSearchParams();
  const [notes, setNotes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState('all'); // all | inbox | archive
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [groupFilter, setGroupFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saveStates, setSaveStates] = useState({});
  const [draftRevision, setDraftRevision] = useState(0);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [lessonFiles, setLessonFiles] = useState([]);
  const [lessonObj, setLessonObj] = useState(null);
  const [backlinks, setBacklinks] = useState([]);
  const [quickDraft, setQuickDraft] = useState('');
  const [flashId, setFlashId] = useState(null);
  const [editorRev, setEditorRev] = useState(0);
  const [railCollapsed, setRailCollapsed] = useState(
    () => { try { return localStorage.getItem(RAIL_KEY) === '1'; } catch { return false; } },
  );
  const editorRef = useRef(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const draftStore = useMemo(() => createNoteDraftStore({
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
  }, teacher?.id || ''), [teacher?.id]);
  const saveQueue = useMemo(() => createNoteSaveQueue({
    store: draftStore,
    save: (id, patch) => {
      if (!teacher?.id || currentTeacher()?.id !== teacher.id) {
        throw Object.assign(new Error('Войдите под автором черновика'), { status: 401 });
      }
      return api.updateNote(id, patch);
    },
    onState: (id, state) => setSaveStates((prev) => ({ ...prev, [id]: state })),
    onSaved: (id, record) => setNotes((prev) => prev.map((n) => (
      n.id === id ? { ...n, updated: record?.updated || n.updated } : n
    ))),
  }), [draftStore, teacher?.id]);

  useEffect(() => {
    saveQueue.resume();
    const retry = () => saveQueue.flushAll();
    const leave = (e) => {
      if (saveQueue.pending()) { e.preventDefault(); e.returnValue = ''; }
    };
    const hide = () => { if (document.visibilityState === 'hidden') saveQueue.flushAll(); };
    window.addEventListener('online', retry);
    window.addEventListener('beforeunload', leave);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('online', retry);
      window.removeEventListener('beforeunload', leave);
      document.removeEventListener('visibilitychange', hide);
      saveQueue.stop();
    };
  }, [saveQueue]);

  useEffect(() => { saveQueue.flushAll(); }, [activeId, saveQueue]);

  const toggleRail = () => setRailCollapsed((v) => {
    const next = !v;
    try { localStorage.setItem(RAIL_KEY, next ? '1' : '0'); } catch { /* Панель работает и без storage. */ }
    return next;
  });

  const load = useCallback(async (selectId) => {
    setLoading(true);
    try {
      // Заметки живут дольше учебного года — классы берём за все годы.
      const [list, g] = await Promise.all([api.getNotes(), api.getTeachingGroups({ allYears: true })]);
      setNotes(list);
      setGroups(g);
      const wanted = selectId || searchParams.get('note');
      if (wanted && list.some((n) => n.id === wanted)) setActiveId(wanted);
      else if (!activeId && list.length) setActiveId(list.find((n) => !n.is_archived)?.id || null);
    } catch {
      message.error('Не удалось загрузить заметки');
    } finally {
      setLoading(false);
    }
  }, [activeId, message, searchParams]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const appliedNoteParam = useRef(null);
  useEffect(() => {
    const wanted = searchParams.get('note');
    if (!wanted) appliedNoteParam.current = null;
    else if (appliedNoteParam.current !== wanted && notes.some((n) => n.id === wanted)) {
      appliedNoteParam.current = wanted;
      setActiveId(wanted);
    }
  }, [searchParams, notes]);

  const groupName = (n) => n?.expand?.group?.name;

  const { textIndex, snippets } = useMemo(() => {
    const idx = new Map();
    const snip = new Map();
    notes.forEach((n) => {
      const body = extractNoteText(n.body);
      idx.set(n.id, `${n.title || ''} ${body}`.toLowerCase());
      snip.set(n.id, body.slice(0, 160));
    });
    return { textIndex: idx, snippets: snip };
  }, [notes]);

  const inboxCount = useMemo(
    () => notes.filter((n) => !n.is_archived && n.is_inbox).length,
    [notes],
  );

  const visibleNotes = useMemo(() => {
    let list = notes;
    if (view === 'archive') list = list.filter((n) => n.is_archived);
    else {
      list = list.filter((n) => !n.is_archived);
      if (view === 'inbox') list = list.filter((n) => n.is_inbox);
    }
    if (groupFilter) list = list.filter((n) => n.group === groupFilter);
    if (typeFilter !== 'all') list = list.filter((n) => noteTypeMeta(n).value === typeFilter);
    const q = searchQ.trim().toLowerCase();
    if (q) list = list.filter((n) => (textIndex.get(n.id) || '').includes(q));
    return list;
  }, [notes, view, groupFilter, typeFilter, searchQ, textIndex]);

  const sections = useMemo(() => {
    if (view === 'archive') return visibleNotes.length ? [{ key: 'arch', title: null, items: visibleNotes }] : [];
    const out = [];
    const pinned = visibleNotes.filter((n) => n.is_pinned);
    const rest = visibleNotes.filter((n) => !n.is_pinned);
    if (pinned.length) out.push({ key: 'pinned', title: 'Закреплённые', items: pinned });
    if (rest.length) out.push({ key: 'rest', title: pinned.length ? 'Недавние' : null, items: rest });
    return out;
  }, [visibleNotes, view]);

  const flatList = useMemo(
    () => sections.flatMap((s) => [
      ...(s.title ? [{ __section: s.title, id: `__s_${s.key}` }] : []),
      ...s.items,
    ]),
    [sections],
  );

  const active = useMemo(() => notes.find((n) => n.id === activeId) || null, [notes, activeId]);
  const recoveredDraft = useMemo(() => (
    activeId && !saveQueue.has(activeId) ? draftStore.read(activeId) : null
  ), [activeId, draftStore, saveQueue, draftRevision]);
  const editable = canEdit && !recoveredDraft;
  const saveState = saveStates[activeId];

  const checkItems = useMemo(() => extractCheckItems(active?.body), [active?.body]);
  const wordCount = useMemo(() => {
    const t = extractNoteText(active?.body);
    return t ? t.split(/\s+/).filter(Boolean).length : 0;
  }, [active?.body]);
  const readMin = Math.max(1, Math.round(wordCount / 180));

  // Файлы + объект привязанного урока (для контекст-панели).
  useEffect(() => {
    let cancelled = false;
    const lessonId = active?.lesson;
    if (!lessonId) { setLessonFiles([]); setLessonObj(null); return undefined; }
    api.getLesson(lessonId)
      .then((l) => {
        if (cancelled) return;
        const mats = Array.isArray(l.materials) ? l.materials.filter((m) => m.type === 'material') : [];
        setLessonFiles(mats);
        setLessonObj({ ...l, _groupName: groups.find((g) => g.id === l.group)?.name });
      })
      .catch(() => { if (!cancelled) { setLessonFiles([]); setLessonObj(null); } });
    return () => { cancelled = true; };
  }, [active?.lesson, groups]);

  // Бэклинки активной заметки.
  useEffect(() => {
    let cancelled = false;
    if (!activeId) { setBacklinks([]); return undefined; }
    api.getNoteBacklinks(activeId)
      .then((b) => { if (!cancelled) setBacklinks(b); })
      .catch(() => { if (!cancelled) setBacklinks([]); });
    return () => { cancelled = true; };
  }, [activeId]);

  const handleNew = async (type) => {
    try {
      const rec = await api.createNote({
        title: '',
        is_inbox: type === 'idea' ? true : view === 'inbox',
        ...(type ? { type, body: starterBody(type) } : {}),
      });
      setNotes((prev) => [rec, ...prev]);
      setActiveId(rec.id);
      if (view === 'archive') setView('all');
    } catch {
      message.error('Не удалось создать заметку');
    }
  };

  const selectCreated = (rec) => {
    setNotes((prev) => [rec, ...prev]);
    setActiveId(rec.id);
    setView('all');
    setTypeFilter('all');
    setGroupFilter(null);
    setSearchQ('');
  };

  const handleFromTemplate = async (template) => {
    try {
      const rec = await api.createNote(noteFromTemplate(template));
      selectCreated(rec);
      setTemplatesOpen(false);
    } catch { message.error('Не удалось создать заметку из шаблона'); }
  };

  const handleDuplicate = async () => {
    if (!active || !editable) return;
    try {
      const rec = await api.createNote(duplicateNoteData({ ...active, body: editorRef.current?.getBody() || active.body }));
      selectCreated(rec);
      message.success('Копия создана. Выберите дату и при необходимости другую группу.');
    } catch { message.error('Не удалось создать копию'); }
  };

  const handleSaveTemplate = async (title) => {
    if (!active || !editable) return;
    try {
      await api.createNoteTemplate({
        title, type: noteTypeMeta(active).value,
        body: freshNoteBody(editorRef.current?.getBody() || active.body, { resetChecks: true }),
      });
      setSaveTemplateOpen(false);
      message.success('Шаблон сохранён');
    } catch { message.error('Не удалось сохранить шаблон'); }
  };

  const handleQuickCapture = async () => {
    const text = quickDraft.trim();
    if (!text) return;
    try {
      const rec = await api.createNote({ title: text, type: 'idea', is_inbox: true });
      setNotes((prev) => [rec, ...prev]);
      setQuickDraft('');
      setFlashId(rec.id);
      setTimeout(() => setFlashId((id) => (id === rec.id ? null : id)), 1600);
    } catch {
      message.error('Не удалось записать мысль');
    }
  };

  const patchNote = useCallback((id, patch) => {
    if (!canEdit) return false;
    if (!saveQueue.has(id) && draftStore.read(id)) {
      message.warning('Сначала восстановите или отклоните черновик этой заметки');
      return false;
    }
    const note = notesRef.current.find((n) => n.id === id);
    saveQueue.enqueue(id, patch, note?.updated);
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    return true;
  }, [canEdit, draftStore, saveQueue, message]);

  const togglePin = (n) => patchNote(n.id, { is_pinned: !n.is_pinned });

  const archiveNote = (n, archived = true) => {
    if (patchNote(n.id, { is_archived: archived }) && archived && activeId === n.id && view !== 'archive') setActiveId(null);
  };

  const handleDeleteForever = async (id) => {
    try {
      await saveQueue.flush(id);
      if (!saveQueue.forget(id)) {
        message.error('Дождитесь завершения сохранения перед удалением');
        return;
      }
      await api.deleteNote(id);
      const draft = draftStore.read(id);
      if (draft) draftStore.remove(id, draft.token);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (activeId === id) setActiveId(null);
    } catch {
      message.error('Не удалось удалить');
    }
  };

  const saveBody = useCallback((id, body) => patchNote(id, { body }), [patchNote]);

  const restoreDraft = () => {
    if (!active || !recoveredDraft || !canEdit) return;
    saveQueue.enqueue(active.id, recoveredDraft.patch, active.updated);
    setNotes((prev) => prev.map((n) => (n.id === active.id ? { ...n, ...recoveredDraft.patch } : n)));
    setDraftRevision((v) => v + 1);
    setEditorRev((v) => v + 1);
  };

  const discardDraft = () => {
    if (!active || !recoveredDraft) return;
    draftStore.remove(active.id, recoveredDraft.token);
    setDraftRevision((v) => v + 1);
  };

  const tagStudents = useCallback((students) => {
    if (!active) return;
    const existing = Array.isArray(active.links) ? active.links : [];
    const seen = new Set(existing.filter((l) => l.type === 'student').map((l) => l.id));
    const additions = students
      .filter((s) => !seen.has(s.id))
      .map((s) => ({ type: 'student', id: s.id, name: s.name || s.username }));
    if (!additions.length) return;
    patchNote(active.id, { links: [...existing, ...additions] });
  }, [active, patchNote]);

  // Меняем через живой редактор: это сохраняет курсор и ещё не отправленный текст.
  const toggleCheck = useCallback((blockId) => {
    if (editable) editorRef.current?.toggleCheck(blockId);
  }, [editable]);

  const exportTasks = useCallback(async () => {
    if (!active) return;
    const open = extractCheckItems(active.body).filter((c) => !c.checked);
    if (!open.length) return;
    try {
      const created = await api.exportNoteTasks(active, open);
      message.success(created.length ? `В «Дела» добавлено: ${created.length}` : 'Все пункты уже выгружены');
    } catch {
      message.error('Не удалось выгрузить в «Дела»');
    }
  }, [active, message]);

  const handleTitleChange = (e) => {
    patchNote(activeId, { title: e.target.value });
  };

  const patchActive = (patch, optimisticExtra = {}) => {
    if (!active) return;
    setNotes((prev) => prev.map((n) => (n.id === active.id ? { ...n, ...optimisticExtra } : n)));
    patchNote(active.id, patch);
  };

  const changeGroup = (gid) => {
    const g = groups.find((x) => x.id === gid);
    patchActive({ group: gid || '' }, { expand: { ...(active?.expand || {}), group: g || undefined } });
  };
  const changeDate = (d) => patchActive({ note_date: d ? d.toISOString() : '' });

  const hasFiles = (n) => Array.isArray(n.links) && n.links.some((l) => l.type === 'material');

  const renderNoteItem = (n) => {
    if (n.__section) {
      return <div key={n.id} className="notes-section-header">{n.__section}</div>;
    }
    const title = n.title?.trim();
    const snippet = snippets.get(n.id);
    const m = noteTypeMeta(n);
    const actions = view === 'archive'
      ? [
        ...(canEdit ? [
          <Tooltip key="r" title="Вернуть из архива">
            <Button size="small" type="text" icon={<UndoOutlined />}
              onClick={(e) => { e.stopPropagation(); archiveNote(n, false); }} />
          </Tooltip>,
        ] : []),
        ...(canDelete ? [
          <Popconfirm key="d" title="Удалить заметку навсегда?" okText="Удалить" cancelText="Отмена"
            okButtonProps={{ danger: true }}
            onConfirm={(e) => { e?.stopPropagation?.(); handleDeleteForever(n.id); }}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
          </Popconfirm>,
        ] : []),
      ]
      : (canEdit ? [
        <Tooltip key="p" title={n.is_pinned ? 'Открепить' : 'Закрепить'}>
          <Button size="small" type="text"
            icon={n.is_pinned ? <PushpinFilled style={{ color: 'var(--c-amber)' }} /> : <PushpinOutlined />}
            onClick={(e) => { e.stopPropagation(); togglePin(n); }} />
        </Tooltip>,
        <Tooltip key="a" title="В архив">
          <Button size="small" type="text" icon={<ContainerOutlined />}
            onClick={(e) => { e.stopPropagation(); archiveNote(n); }} />
        </Tooltip>,
      ] : []);

    return (
      <div
        key={n.id}
        className={`notes-item ${n.id === activeId ? 'notes-item--active' : ''}${n.id === flashId ? ' notes-item--flash' : ''}`}
        onClick={() => setActiveId(n.id)}
      >
        <div className="notes-item__titlerow">
          <m.Icon className="notes-item__typeicon" style={{ color: `var(--c-${m.tone})` }} />
          {n.is_pinned && view !== 'archive' && <PushpinFilled className="notes-item__flag" />}
          {n.is_inbox && !n.is_archived && <InboxOutlined className="notes-item__flag" />}
          <span className={`notes-item__title${title ? '' : ' notes-item__title--untitled'}`}>
            {title || 'Без названия'}
          </span>
          {hasFiles(n) && <PaperClipOutlined className="notes-item__clip" />}
        </div>
        {snippet && <div className="notes-item__snippet">{snippet}</div>}
        <div className="notes-item__meta">
          <Chip tone={m.tone} dot={false}>{m.label}</Chip>
          {groupName(n) && <GroupChip id={n.group} name={groupName(n)} />}
          <span className="notes-item__date">
            {n.note_date ? dayjs(n.note_date).format('DD.MM.YY') : shortDate(n.updated)}
          </span>
        </div>
        {actions.length > 0 && <div className="notes-item__actions">{actions}</div>}
      </div>
    );
  };

  const allLinks = Array.isArray(active?.links) ? active.links : [];
  const noteFiles = allLinks.filter((l) => l.type === 'material');

  const segmentedOptions = [
    { value: 'all', label: 'Все' },
    {
      value: 'inbox',
      label: (
        <span>
          Инбокс
          {inboxCount > 0 && <span className="notes-seg-count">{inboxCount}</span>}
        </span>
      ),
    },
    { value: 'archive', label: 'Архив' },
  ];

  const typeChips = [{ value: 'all', label: 'Все', tone: 'neutral' }, ...NOTE_TYPES];

  const newMenuItems = [
    { key: 'template', label: 'Из шаблона…' }, { type: 'divider' },
    ...NOTE_TYPES.map((t) => ({ key: t.value, icon: <t.Icon />, label: `${t.label}` })),
  ];

  const activeMeta = active ? noteTypeMeta(active) : null;

  return (
    <div className="notes-page">
      <WorkspacePageHeader
        icon={<FileTextOutlined />}
        accent="amber"
        title="Заметки"
        subtitle="Быстрые мысли, планы и заметки уроков — с формулами и вложениями"
        extra={canEdit && (
          <Dropdown.Button
            type="primary"
            trigger={['click']}
            icon={<DownOutlined aria-label="Способы создания заметки" />}
            onClick={() => handleNew()}
            menu={{ items: newMenuItems, onClick: ({ key }) => key === 'template' ? setTemplatesOpen(true) : handleNew(key) }}
          >
            <PlusOutlined /> Новая заметка
          </Dropdown.Button>
        )}
      />

      <div className="notes-workspace">
        {/* ── Панель 1 — список ── */}
        <div className="notes-sidebar">
          <div className="notes-sidebar__tools">
            {canEdit && (
              <div className="notes-quick">
                <ThunderboltOutlined className="notes-quick__icon" />
                <Input
                  variant="borderless"
                  className="notes-quick__input"
                  placeholder="Быстро записать мысль…"
                  value={quickDraft}
                  onChange={(e) => setQuickDraft(e.target.value)}
                  onPressEnter={handleQuickCapture}
                />
                <span className="notes-quick__hint">↵ инбокс</span>
              </div>
            )}
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: 'var(--ink-4)' }} />}
              placeholder="Поиск по заметкам"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            <Segmented block size="small" value={view} onChange={setView} options={segmentedOptions} />
            <div className="notes-typechips">
              {typeChips.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`notes-typechip${typeFilter === t.value ? ' notes-typechip--active' : ''}`}
                  onClick={() => setTypeFilter(t.value)}
                >
                  {t.value !== 'all' && <span className="notes-typechip__dot" style={{ background: `var(--c-${t.tone})` }} />}
                  {t.label}
                </button>
              ))}
            </div>
            {groups.length > 0 && (
              <Select
                allowClear
                size="small"
                style={{ width: '100%' }}
                placeholder="Все классы"
                value={groupFilter}
                onChange={setGroupFilter}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
              />
            )}
          </div>

          <div className="notes-sidebar__list">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
            ) : flatList.length === 0 ? (
              <div className="notes-sidebar__empty">
                {view === 'archive'
                  ? <EmptyState title="Архив пуст" description="Сюда попадают заметки вместо удаления" />
                  : (
                    <EmptyState
                      title="Нет заметок"
                      description={canEdit ? 'Создайте первую — она появится здесь' : undefined}
                      cta={canEdit ? 'Новая заметка' : undefined}
                      ctaIcon={<PlusOutlined />}
                      onCta={() => handleNew()}
                    />
                  )}
              </div>
            ) : (
              flatList.map(renderNoteItem)
            )}
          </div>
        </div>

        {/* ── Панель 2 — редактор ── */}
        <div className="notes-editor">
          {!active ? (
            <div className="notes-empty">
              <EmptyState
                title="Ничего не выбрано"
                description="Выберите заметку слева или создайте новую"
                cta={canEdit ? 'Новая заметка' : undefined}
                ctaIcon={<PlusOutlined />}
                onCta={() => handleNew()}
              />
            </div>
          ) : (
            <>
              <div className="notes-editor__header">
                <Input
                  variant="borderless"
                  className="notes-title-input"
                  placeholder="Заголовок заметки"
                  value={active.title}
                  onChange={handleTitleChange}
                  disabled={!editable}
                  maxLength={200}
                />
                <div className="notes-editor__tools">
                  {saveState && <span className={`notes-save-state notes-save-state--${saveState.phase}`} role="status">
                    {saveState.phase === 'saved' ? '✓ Сохранено'
                      : saveState.phase === 'saving' ? 'Сохраняется…'
                        : saveState.phase === 'error' ? 'Не сохранено'
                          : 'Есть изменения'}
                  </span>}
                  {canEdit && <Dropdown trigger={['click']} menu={{
                    items: [{ key: 'copy', label: 'Дублировать заметку', disabled: !editable },
                      { key: 'template', label: 'Сохранить как шаблон…', disabled: !editable }],
                    onClick: ({ key }) => key === 'copy' ? handleDuplicate() : setSaveTemplateOpen(true),
                  }}>
                    <Button type="text" aria-label="Действия с заметкой" icon={<MoreOutlined />} />
                  </Dropdown>}
                  <Tooltip title={active.is_pinned ? 'Открепить' : 'Закрепить сверху'}>
                    <Button type="text"
                      icon={active.is_pinned ? <PushpinFilled style={{ color: 'var(--c-amber)' }} /> : <PushpinOutlined />}
                      onClick={() => togglePin(active)} disabled={!editable} />
                  </Tooltip>
                  <Tooltip title={active.is_inbox ? 'Убрать из инбокса' : 'В инбокс'}>
                    <Button type="text"
                      icon={<InboxOutlined style={active.is_inbox ? { color: 'var(--c-amber)' } : undefined} />}
                      onClick={() => patchActive({ is_inbox: !active.is_inbox })} disabled={!editable} />
                  </Tooltip>
                  <Tooltip title="Экспорт в PDF">
                    <Button type="text" aria-label="Экспорт в PDF" icon={<ExportOutlined />}
                      onClick={() => editorRef.current?.exportPdf()} />
                  </Tooltip>
                  <Tooltip title={active.is_archived ? 'Вернуть из архива' : 'В архив'}>
                    <Button type="text"
                      icon={active.is_archived ? <UndoOutlined /> : <ContainerOutlined />}
                      onClick={() => archiveNote(active, !active.is_archived)} disabled={!editable} />
                  </Tooltip>
                  <Tooltip title={railCollapsed ? 'Показать контекст' : 'Скрыть контекст'}>
                    <Button type="text"
                      icon={railCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                      onClick={toggleRail} />
                  </Tooltip>
                </div>
              </div>
              <div className="notes-editor__meta">
                {activeMeta && (
                  <Dropdown
                    trigger={['click']}
                    disabled={!editable}
                    menu={{
                      items: NOTE_TYPES.map((t) => ({ key: t.value, icon: <t.Icon />, label: t.label })),
                      onClick: ({ key }) => patchActive({ type: key }),
                    }}
                  >
                    <button type="button" className="notes-type-pill" data-tone={activeMeta.tone} disabled={!editable}>
                      <activeMeta.Icon /> {activeMeta.label} <DownOutlined style={{ fontSize: 9 }} />
                    </button>
                  </Dropdown>
                )}
                <Select
                  allowClear size="small" style={{ minWidth: 160 }}
                  placeholder="Класс / группа"
                  value={active.group || undefined}
                  onChange={changeGroup} disabled={!editable}
                  options={groups.map((g) => ({ value: g.id, label: g.name }))}
                />
                <DatePicker
                  size="small" format="DD.MM.YYYY" placeholder="Дата"
                  value={active.note_date ? dayjs(active.note_date) : null}
                  onChange={changeDate} disabled={!editable}
                />
                {active.is_archived && <Chip tone="neutral" dot={false}>в архиве</Chip>}
              </div>
              {canEdit && recoveredDraft && <Alert className="notes-draft-alert" type="warning" showIcon
                message="Найден несохранённый черновик в этом браузере"
                description={recoveredDraft.baseUpdated && recoveredDraft.baseUpdated !== active.updated
                  ? 'На сервере заметка изменилась после создания черновика. Восстановление заменит соответствующие поля вашей локальной версией.'
                  : 'Можно восстановить текст и продолжить сохранение либо оставить версию с сервера.'}
                action={<div className="notes-draft-actions">
                  <Button size="small" type="primary" onClick={restoreDraft}>Восстановить</Button>
                  <Popconfirm title="Удалить локальный черновик и оставить серверную версию?"
                    okText="Оставить серверную" cancelText="Отмена" onConfirm={discardDraft}>
                    <Button size="small">Оставить серверную</Button>
                  </Popconfirm>
                </div>} />}
              {saveState && saveState.phase !== 'saved' && (saveState.phase === 'error' || !saveState.persisted) && (
                <Alert className="notes-draft-alert" type="warning" showIcon
                  message={saveState.phase === 'error' ? 'Изменения ещё не сохранены на сервере' : 'Не удалось сохранить черновик в браузере'}
                  description={saveState.persisted
                    ? 'Черновик сохранён в этом браузере. Повторим отправку при восстановлении связи.'
                    : 'Текст пока хранится только в открытой странице. Не закрывайте её до успешного сохранения.'}
                  action={<Button size="small" onClick={() => saveQueue.flush(active.id)}>Повторить</Button>} />
              )}
              <div className="notes-editor__body">
                <NoteEditor
                  key={`${active.id}:${editorRev}`}
                  ref={editorRef}
                  note={active}
                  onSaveBody={saveBody}
                  editable={editable}
                  onTagStudents={tagStudents}
                  wordCount={wordCount}
                  readMin={readMin}
                />
              </div>
            </>
          )}
        </div>

        {/* ── Панель 3 — контекст ── */}
        {active && !railCollapsed && (
          <NoteContextPanel
            note={active}
            lesson={lessonObj}
            lessonFiles={lessonFiles}
            noteFiles={noteFiles}
            backlinks={backlinks}
            checkItems={checkItems}
            canEdit={editable}
            wordCount={wordCount}
            readMin={readMin}
            onCollapse={toggleRail}
            onOpenLesson={() => navigate('/app/calendar')}
            onAddStudents={() => editorRef.current?.requestInsertStudents()}
            onToggleCheck={toggleCheck}
            onExportTasks={exportTasks}
            onSaveAttachments={(next) => patchActive({ links: [...allLinks.filter((l) => l.type !== 'material'), ...next] })}
            onOpenNote={(id) => setActiveId(id)}
          />
        )}
      </div>
      {canEdit && <>
        <NoteTemplatesDialog open={templatesOpen} onCancel={() => setTemplatesOpen(false)}
          onSelect={handleFromTemplate} canDelete={canDelete} />
        <SaveNoteTemplateDialog open={saveTemplateOpen} defaultTitle={active?.title}
          onCancel={() => setSaveTemplateOpen(false)} onSave={handleSaveTemplate} />
      </>}
    </div>
  );
}
