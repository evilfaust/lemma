import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, App, Button, Checkbox, Dropdown, Input, Modal, Segmented, Select, Space, Spin, Typography,
} from 'antd';
import {
  ClearOutlined, CopyOutlined, DeleteOutlined, DownOutlined, DownloadOutlined, EditOutlined,
  ExportOutlined, EyeInvisibleOutlined, EyeOutlined, FormatPainterOutlined, MobileOutlined,
  MoreOutlined, PlusOutlined, SettingOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '../../../shared/services/pocketbase';
import { useAuth } from '../../../contexts/AuthContext';
import useIsMobile from '../../../hooks/useIsMobile';
import { currentAcademicYear } from '../../../utils/academicYear';
import {
  buildGrid, collectOnline, columnMonths, columnScale, indexMarks, inPeriod, journalStudents,
  journalTable, markKey, mergeColumns, parseCellInput, parseClipboard, planPaste, SCALE_LABELS,
  suggestNextTitle, toCsv, toStoredDate, toTsv, yearWindow, formatNumber,
} from '../../../utils/classJournal';
import { EmptyState } from '../ui';
import JournalGrid from './JournalGrid';
import JournalColumnModal from './JournalColumnModal';
import JournalColumnEntry from './JournalColumnEntry';
import WorkColumnModal from './WorkColumnModal';
import './journal.css';

const { Text } = Typography;

const LS_GROUP = 'journal.groupId';
const LS_MODE = 'journal.mode';
const readLS = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } };

// Не больше N запросов разом: вставка столбца на 30 учеников — это 30 записей.
async function runLimited(tasks, limit = 6) {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const task = tasks[next];
      next += 1;
      await task();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

const sameOnline = (a, b) => (a.workId && a.workId === (b.work || b.workId))
  || (a.sessionId && a.sessionId === (b.session || b.sessionId));

/**
 * Журнал класса (v3.9.236): ученики × колонки — ручные отметки за бумажные
 * работы и онлайн-работы Lemma в одной таблице. Логика — `utils/classJournal.js`,
 * сеть — `pb/journal.js`, сетка — `JournalGrid`.
 */
export default function ClassJournal() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { teacher, isSuperAdmin, canEdit, canDelete } = useAuth();
  const currentYear = currentAcademicYear();

  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupId, setGroupId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(() => (readLS(LS_MODE) === 'grade' ? 'grade' : 'raw'));
  const [period, setPeriod] = useState('all');
  const [showHidden, setShowHidden] = useState(false);
  const [pending, setPending] = useState(0);
  const [colModal, setColModal] = useState(null); // { column } — null-колонка = новая
  const [colSaving, setColSaving] = useState(false);
  const [workModal, setWorkModal] = useState(false);
  const [entryKey, setEntryKey] = useState(null);
  const [fill, setFill] = useState(null); // { column, text, error }

  const dataRef = useRef(null);
  dataRef.current = data;
  const loadSeq = useRef(0);
  // Очередь записи по клеткам: правки одной клетки уходят строго по порядку,
  // а на экран ложится ответ только на последнюю — иначе быстрые «5 → 4»
  // могли вернуться с сервера наоборот.
  const serverIds = useRef(new Map());
  const versions = useRef(new Map());
  const queues = useRef(new Map());
  const materializing = useRef(new Map());

  // ── Классы ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Журнал — и исторический экран: прошлогодний (архивный) класс открывается.
        const list = await api.getTeachingGroups({ allYears: true, includeArchived: true });
        if (!alive) return;
        const sorted = [...list.filter((g) => !g.archived), ...list.filter((g) => g.archived)];
        setGroups(sorted);
        const saved = readLS(LS_GROUP);
        const pick = sorted.find((g) => g.id === saved)
          || sorted.find((g) => g.year === currentYear && !g.archived)
          || sorted[0];
        setGroupId(pick?.id || null);
      } catch {
        message.error('Не удалось загрузить классы');
      } finally {
        if (alive) setGroupsLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Загрузка журнала класса ───────────────────────────────────────────────
  const load = useCallback(async (gid) => {
    const group = groups.find((g) => g.id === gid) || null;
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      let missing = false;
      const soft404 = (e) => {
        if (e?.status === 404) { missing = true; return []; }
        throw e;
      };
      const rosterPromise = group?.kind === 'course'
        ? api.getCourseMembers(gid).then((ms) => ms
          .filter((m) => m.active !== false && m.expand?.student)
          .map((m) => m.expand.student)
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru')))
        : api.getStudentsByGroup(gid);
      const [roster, stored, marks] = await Promise.all([
        rosterPromise,
        api.getJournalColumns(gid).catch(soft404),
        api.getJournalMarks(gid).catch(soft404),
      ]);

      // Выбывшие из класса с отметками в журнале остаются строкой «выбыл».
      const inRoster = new Set(roster.map((s) => s.id));
      const formerIds = [...new Set(marks.map((m) => m.student))].filter((id) => !inRoster.has(id));
      const former = formerIds.length ? await api.getJournalStudentsByIds(formerIds).catch(() => []) : [];
      const students = journalStudents(roster, former);

      let onlineFailed = false;
      const withAccount = students.filter((s) => !s.external).map((s) => s.id);
      const assignedWorks = stored.filter((c) => c.source === 'work' && c.work).map((c) => c.work);
      const [attempts, deadlines] = await Promise.all([
        api.getJournalAttempts(withAccount, yearWindow(group?.year))
          .catch(() => { onlineFailed = true; return []; }),
        api.getJournalWorkDeadlines(assignedWorks).catch(() => new Map()),
      ]);
      if (seq !== loadSeq.current) return;

      serverIds.current = new Map(marks.map((m) => [markKey(m.col, m.student), m.id]));
      versions.current = new Map();
      queues.current = new Map();
      materializing.current = new Map();
      setData({ groupId: gid, group, students, columns: stored, marks, attempts, deadlines, missing });
      if (onlineFailed) message.warning('Онлайн-результаты не загрузились — показаны только ручные колонки');
    } catch (e) {
      if (seq === loadSeq.current) {
        console.error('journal load failed', e);
        message.error('Не удалось загрузить журнал');
        setData(null);
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [groups, message]);

  useEffect(() => {
    if (groupId) load(groupId);
  }, [groupId, load]);

  // Незаписанные отметки — не отпускаем со страницы молча.
  useEffect(() => {
    if (!pending) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);

  // ── Производные ───────────────────────────────────────────────────────────
  const online = useMemo(() => collectOnline(data?.attempts || []), [data?.attempts]);
  const allColumns = useMemo(
    () => mergeColumns(data?.columns || [], online.columns, { sessionDeadlines: data?.deadlines || new Map() }),
    [data?.columns, data?.deadlines, online],
  );
  const hiddenCount = useMemo(() => allColumns.filter((c) => c.hidden).length, [allColumns]);
  const months = useMemo(
    () => columnMonths(allColumns.filter((c) => showHidden || !c.hidden)),
    [allColumns, showHidden],
  );
  useEffect(() => {
    if (period !== 'all' && !months.some((m) => m.key === period)) setPeriod('all');
  }, [months, period]);
  const columns = useMemo(
    () => allColumns.filter((c) => (showHidden || !c.hidden) && inPeriod(c, period)),
    [allColumns, showHidden, period],
  );
  const marksIndex = useMemo(() => indexMarks(data?.marks || []), [data?.marks]);
  const grid = useMemo(
    () => buildGrid(data?.students || [], columns, marksIndex, online.cells, { mode }),
    [data?.students, columns, marksIndex, online, mode],
  );
  const group = data?.group || groups.find((g) => g.id === groupId) || null;

  // ── Запись клеток ─────────────────────────────────────────────────────────
  const patchData = useCallback((gid, fn) => {
    setData((d) => (d && d.groupId === gid ? fn(d) : d));
  }, []);

  const applyLocal = useCallback((entries) => {
    setData((d) => {
      if (!d) return d;
      const byKey = new Map(d.marks.map((m) => [markKey(m.col, m.student), m]));
      for (const e of entries) {
        const key = markKey(e.colId, e.studentId);
        if (!e.value && !e.comment) byKey.delete(key);
        else {
          const prev = byKey.get(key) || { id: `tmp:${key}`, col: e.colId, student: e.studentId };
          byKey.set(key, { ...prev, value: e.value, comment: e.comment });
        }
      }
      return { ...d, marks: [...byKey.values()] };
    });
  }, []);

  const settle = useCallback((colId, studentId, rec) => {
    setData((d) => {
      if (!d) return d;
      const key = markKey(colId, studentId);
      const rest = d.marks.filter((m) => markKey(m.col, m.student) !== key);
      return { ...d, marks: rec ? [...rest, rec] : rest };
    });
  }, []);

  const saveCell = useCallback((entry) => {
    const key = markKey(entry.colId, entry.studentId);
    const ver = (versions.current.get(key) || 0) + 1;
    versions.current.set(key, ver);
    const prev = queues.current.get(key) || Promise.resolve();
    const run = prev.then(async () => {
      const rec = await api.saveJournalMark(entry, serverIds.current.get(key) || null);
      if (rec) serverIds.current.set(key, rec.id);
      else serverIds.current.delete(key);
      if (versions.current.get(key) === ver) settle(entry.colId, entry.studentId, rec);
    });
    queues.current.set(key, run.catch(() => {}));
    return run;
  }, [settle]);

  const reloadMarks = useCallback(async () => {
    const gid = dataRef.current?.groupId;
    if (!gid) return;
    try {
      const marks = await api.getJournalMarks(gid);
      serverIds.current = new Map(marks.map((m) => [markKey(m.col, m.student), m.id]));
      patchData(gid, (d) => ({ ...d, marks }));
    } catch { /* сеть — оставим как есть */ }
  }, [patchData]);

  const persist = useCallback(async (entries) => {
    if (!entries.length) return;
    applyLocal(entries);
    setPending((n) => n + entries.length);
    let failed = 0;
    await runLimited(entries.map((e) => () => saveCell(e).catch((err) => {
      console.error('journal mark save failed', err);
      failed += 1;
    })));
    setPending((n) => n - entries.length);
    if (failed) {
      message.error(`Не сохранилось отметок: ${failed}. Журнал перечитан с сервера — проверьте клетки.`);
      reloadMarks();
    }
  }, [applyLocal, saveCell, reloadMarks, message]);

  // Найденная по попыткам онлайн-колонка записи в БД не имеет — заводим её
  // при первой правке (клетки, настроек, «скрыть»).
  const ensureColumnId = useCallback(async (col) => {
    if (col.id) return col.id;
    const known = dataRef.current?.columns.find((c) => sameOnline(col, c));
    if (known) return known.id;
    if (materializing.current.has(col.key)) return materializing.current.get(col.key);
    const gid = dataRef.current?.groupId;
    const job = (async () => {
      try {
        const rec = await api.createJournalColumn({
          group: gid,
          title: col.title,
          date: toStoredDate(col.day),
          source: col.source,
          ...(col.workId ? { work: col.workId } : { session: col.sessionId }),
          weight: 1,
        });
        patchData(gid, (d) => ({ ...d, columns: [...d.columns, rec] }));
        return rec.id;
      } catch (e) {
        // Уже закрепили (вторая вкладка, со-учитель) — берём существующую.
        const list = await api.getJournalColumns(gid);
        const rec = list.find((c) => sameOnline(col, c));
        if (!rec) throw e;
        patchData(gid, (d) => ({ ...d, columns: list }));
        return rec.id;
      }
    })();
    materializing.current.set(col.key, job);
    try {
      return await job;
    } finally {
      materializing.current.delete(col.key);
    }
  }, [patchData]);

  // items: [{ col, student, value, comment }]
  const writeCells = useCallback(async (items) => {
    if (!items.length) return;
    const ids = new Map();
    try {
      const virtual = new Map(items.filter((it) => !it.col.id).map((it) => [it.col.key, it.col]));
      for (const col of virtual.values()) ids.set(col.key, await ensureColumnId(col));
    } catch (e) {
      console.error('journal column materialize failed', e);
      message.error('Не удалось закрепить онлайн-работу в журнале');
      return;
    }
    await persist(items.map((it) => ({
      colId: it.col.id || ids.get(it.col.key),
      studentId: it.student.id,
      value: it.value,
      comment: it.comment,
    })));
  }, [ensureColumnId, persist, message]);

  const commitCell = useCallback((c, r, raw) => {
    const col = columns[c];
    const row = grid.rows[r];
    if (!col || !row) return null;
    if (!canEdit) return 'Нет прав на правку журнала';
    const parsed = parseCellInput(raw, col);
    if (!parsed.ok) return parsed.error;
    const cell = row.cells[c];
    if ((cell.stored || '') === parsed.stored) return null;
    writeCells([{ col, student: row.student, value: parsed.stored, comment: cell.comment || '' }]);
    return null;
  }, [columns, grid, canEdit, writeCells]);

  const handlePaste = useCallback((r0, c0, text) => {
    if (!canEdit) return;
    const block = parseClipboard(text);
    const plan = planPaste(block, { row: r0, col: c0, rowCount: grid.rows.length, colCount: columns.length });
    const items = [];
    const errors = [];
    let skippedOnline = 0;
    for (const { r, c, raw } of plan.cells) {
      const col = columns[c];
      const row = grid.rows[r];
      if (col.online) {
        if (raw) skippedOnline += 1;
        continue;
      }
      const parsed = parseCellInput(raw, col);
      if (!parsed.ok) {
        errors.push(`${row.student.name} · ${col.title}: «${raw}»`);
        continue;
      }
      const cell = row.cells[c];
      if ((cell.stored || '') === parsed.stored) continue;
      items.push({ col, student: row.student, value: parsed.stored, comment: cell.comment || '' });
    }
    writeCells(items);

    const notes = [];
    if (items.length) notes.push(`вставлено: ${items.length}`);
    if (skippedOnline) notes.push(`пропущено в онлайн-колонках: ${skippedOnline}`);
    if (plan.clipped) notes.push(`не поместилось в таблицу: ${plan.clipped}`);
    if (errors.length) {
      modal.warning({
        title: `Не подошло к шкале колонки: ${errors.length}`,
        content: (
          <div>
            {notes.length > 0 && <p>{notes.join(' · ')}</p>}
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}
            </ul>
            {errors.length > 8 && <p style={{ marginTop: 6 }}>…и ещё {errors.length - 8}</p>}
          </div>
        ),
      });
    } else if (notes.length) {
      message.info(notes.join(' · '));
    }
  }, [canEdit, grid, columns, writeCells, modal, message]);

  // ── Колонки ───────────────────────────────────────────────────────────────
  const canManage = useCallback(
    (col) => isSuperAdmin || col.virtual || col.owner === teacher?.id || group?.owner === teacher?.id,
    [isSuperAdmin, teacher?.id, group?.owner],
  );

  const replaceColumn = (gid, rec) => patchData(gid, (d) => ({
    ...d, columns: d.columns.map((c) => (c.id === rec.id ? rec : c)),
  }));

  // Новая колонка подхватывает настройки прошлой ручной колонки класса и
  // следующий номер: «Устный счёт 3» → «Устный счёт 4».
  const newDefaults = useMemo(() => {
    const last = [...(data?.columns || [])]
      .filter((c) => (c.source || 'manual') === 'manual')
      .sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')))[0];
    if (!last) return { scale: 'points', max_score: 10 };
    return {
      title: suggestNextTitle(last.title),
      scale: last.scale || 'points',
      max_score: last.max_score,
      category: last.category,
      thresholds: last.thresholds,
      weight: last.weight,
      no_avg: last.no_avg,
    };
  }, [data?.columns]);

  const saveColumn = async (values) => {
    const col = colModal?.column;
    const gid = data?.groupId;
    if (!gid) return;
    setColSaving(true);
    try {
      if (!col) {
        const rec = await api.createJournalColumn({ ...values, group: gid, source: 'manual' });
        patchData(gid, (d) => ({ ...d, columns: [...d.columns, rec] }));
        if (period !== 'all' && !inPeriod({ day: values.date }, period)) setPeriod('all');
        message.success(`Колонка «${rec.title}» добавлена`);
      } else {
        const id = await ensureColumnId(col);
        const rec = await api.updateJournalColumn(id, values);
        replaceColumn(gid, rec);
        if (values.assigned && col.workId) {
          const dl = await api.getJournalWorkDeadlines([col.workId]).catch(() => new Map());
          patchData(gid, (d) => ({ ...d, deadlines: new Map([...(d.deadlines || []), ...dl]) }));
        }
      }
      setColModal(null);
    } catch (e) {
      console.error('journal column save failed', e);
      message.error('Не удалось сохранить колонку');
    } finally {
      setColSaving(false);
    }
  };

  const deleteColumn = async (col) => {
    const gid = data?.groupId;
    try {
      await api.deleteJournalColumn(col.id);
      patchData(gid, (d) => ({
        ...d,
        columns: d.columns.filter((c) => c.id !== col.id),
        marks: d.marks.filter((m) => m.col !== col.id),
      }));
      for (const key of [...serverIds.current.keys()]) {
        if (key.startsWith(`${col.id}|`)) serverIds.current.delete(key);
      }
      setColModal(null);
      message.success(col.online ? 'Колонка убрана из журнала' : 'Колонка удалена');
    } catch (e) {
      console.error('journal column delete failed', e);
      message.error('Не удалось удалить колонку');
    }
  };

  const setHidden = async (col, hidden) => {
    const gid = data?.groupId;
    try {
      const id = await ensureColumnId(col);
      const rec = await api.updateJournalColumn(id, { hidden });
      replaceColumn(gid, rec);
      if (hidden) message.info(`«${col.title}» скрыта — вернуть можно галочкой «Скрытые»`);
    } catch {
      message.error('Не удалось изменить колонку');
    }
  };

  const clearColumn = (col) => {
    const marks = (dataRef.current?.marks || []).filter((m) => m.col === col.id);
    if (!marks.length) {
      message.info('В колонке нет отметок');
      return;
    }
    modal.confirm({
      title: `Очистить «${col.title}»?`,
      content: `Удалятся все отметки колонки (${marks.length}) вместе с комментариями. Сама колонка останется.`,
      okText: 'Очистить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: () => persist(marks.map((m) => ({ colId: col.id, studentId: m.student, value: '', comment: '' }))),
    });
  };

  const confirmDelete = (col) => {
    modal.confirm({
      title: col.online ? `Убрать «${col.title}» из журнала?` : `Удалить колонку «${col.title}»?`,
      content: col.online
        ? 'Настройки колонки и ручные правки клеток удалятся. Если по работе есть попытки, колонка вернётся с результатами из них.'
        : 'Колонка удалится вместе со всеми отметками в ней. Отменить это нельзя.',
      okText: col.online ? 'Убрать' : 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: () => deleteColumn(col),
    });
  };

  const addWorkColumn = async (work) => {
    const gid = data?.groupId;
    try {
      const existing = dataRef.current?.columns.find((c) => c.work === work.id);
      if (existing) {
        replaceColumn(gid, await api.updateJournalColumn(existing.id, { assigned: true, hidden: false }));
      } else {
        const found = allColumns.find((c) => c.virtual && c.workId === work.id);
        const rec = await api.createJournalColumn({
          group: gid,
          title: work.title,
          date: toStoredDate(found?.day || dayjs().format('YYYY-MM-DD')),
          source: 'work',
          work: work.id,
          assigned: true,
          weight: 1,
        });
        patchData(gid, (d) => ({ ...d, columns: [...d.columns, rec] }));
      }
      const dl = await api.getJournalWorkDeadlines([work.id]).catch(() => new Map());
      patchData(gid, (d) => ({ ...d, deadlines: new Map([...(d.deadlines || []), ...dl]) }));
      setWorkModal(false);
      setPeriod('all');
      message.success(`«${work.title}» — в журнале`);
    } catch (e) {
      console.error('journal work column failed', e);
      message.error('Не удалось добавить работу');
    }
  };

  const onMenu = (key, col) => {
    switch (key) {
      case 'entry': setEntryKey(col.key); break;
      case 'edit': setColModal({ column: col }); break;
      case 'fill': setFill({ column: col, text: '', error: '' }); break;
      case 'open-work': navigate(`/app/works/${col.workId}/edit`); break;
      case 'hide': setHidden(col, true); break;
      case 'show': setHidden(col, false); break;
      case 'clear': clearColumn(col); break;
      case 'delete': confirmDelete(col); break;
      default:
    }
  };

  // Без миграции на сервере журнал только для чтения: писать некуда.
  const writable = canEdit && !data?.missing;

  const menuFor = useCallback((col) => {
    const items = [];
    const manage = writable && canManage(col);
    if (writable) items.push({ key: 'entry', icon: <UnorderedListOutlined />, label: 'Ввод списком' });
    if (manage) items.push({ key: 'edit', icon: <SettingOutlined />, label: 'Настроить колонку' });
    if (writable && !col.online) items.push({ key: 'fill', icon: <FormatPainterOutlined />, label: 'Заполнить пустые…' });
    if (col.workId) items.push({ key: 'open-work', icon: <ExportOutlined />, label: 'Открыть работу' });
    if (manage) {
      items.push(col.hidden
        ? { key: 'show', icon: <EyeOutlined />, label: 'Показать колонку' }
        : { key: 'hide', icon: <EyeInvisibleOutlined />, label: 'Скрыть колонку' });
    }
    if (manage && canDelete && !col.virtual) {
      items.push({ type: 'divider' });
      if (!col.online) items.push({ key: 'clear', icon: <ClearOutlined />, danger: true, label: 'Очистить отметки' });
      items.push({ key: 'delete', icon: <DeleteOutlined />, danger: true, label: col.online ? 'Убрать из журнала' : 'Удалить колонку' });
    }
    return items;
  }, [writable, canDelete, canManage]);

  // ── Ввод списком и «Заполнить пустые» ─────────────────────────────────────
  const entryIndex = columns.findIndex((c) => c.key === entryKey);
  const entryColumn = entryIndex >= 0 ? columns[entryIndex] : null;

  const saveFromEntry = useCallback((student, raw, comment) => {
    if (!entryColumn) return null;
    const parsed = parseCellInput(raw, entryColumn);
    if (!parsed.ok) return parsed.error;
    const row = grid.rows.find((x) => x.student.id === student.id);
    const cell = row?.cells[entryIndex];
    const note = String(comment || '').trim();
    if ((cell?.stored || '') === parsed.stored && (cell?.comment || '') === note) return null;
    writeCells([{ col: entryColumn, student, value: parsed.stored, comment: note }]);
    return null;
  }, [entryColumn, entryIndex, grid, writeCells]);

  const submitFill = () => {
    const col = fill?.column;
    if (!col) return;
    const parsed = parseCellInput(fill.text, col);
    if (!parsed.ok || !parsed.stored) {
      setFill((f) => ({ ...f, error: parsed.ok ? 'Введите значение' : parsed.error }));
      return;
    }
    const c = columns.findIndex((x) => x.key === col.key);
    const items = c < 0 ? [] : grid.rows
      .filter((row) => !row.student.former && !row.cells[c]?.stored)
      .map((row) => ({ col, student: row.student, value: parsed.stored, comment: row.cells[c]?.comment || '' }));
    writeCells(items);
    setFill(null);
    message.success(items.length ? `Заполнено клеток: ${items.length}` : 'Пустых клеток нет');
  };

  // ── Выгрузка ──────────────────────────────────────────────────────────────
  const exportName = () => `Журнал ${group?.name || ''} ${dayjs().format('YYYY-MM-DD')}`
    .replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

  const onExport = async ({ key }) => {
    const table = journalTable(grid, columns);
    if (key === 'copy') {
      try {
        await navigator.clipboard.writeText(toTsv(table));
        message.success('Таблица скопирована — вставьте её в Google Таблицы или Excel');
      } catch {
        message.error('Браузер не дал доступ к буферу обмена');
      }
      return;
    }
    const blob = new Blob([`﻿${toCsv(table)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportName()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ── Разметка ──────────────────────────────────────────────────────────────
  const groupOptions = groups.map((g) => ({
    value: g.id,
    label: g.year && g.year !== currentYear ? `${g.name} · ${g.year}` : g.name,
  }));
  const categories = useMemo(
    () => [...new Set((data?.columns || []).map((c) => c.category).filter(Boolean))],
    [data?.columns],
  );
  const hasMarksInModalColumn = !!colModal?.column?.id
    && (data?.marks || []).some((m) => m.col === colModal.column.id);
  const presentWorkIds = allColumns.filter((c) => c.workId && !c.virtual).map((c) => c.workId);
  const journalReady = !!data && data.groupId === groupId;
  const fillScaleHint = fill?.column ? (() => {
    const scale = columnScale(fill.column);
    if (scale === 'pass') return '«+» — зачёт, «−» — незачёт';
    if (scale === 'grade') return 'Оценка 1–5';
    if (scale === 'points') return `Баллы от 0 до ${formatNumber(fill.column.max_score) || '…'}`;
    return 'Проценты 0–100';
  })() : '';

  const toolbar = (
    <div className="cj-toolbar">
      <Select
        style={{ minWidth: 200 }}
        loading={groupsLoading}
        value={groupId}
        placeholder="Класс"
        showSearch
        optionFilterProp="label"
        options={groupOptions}
        onChange={(id) => {
          setGroupId(id);
          writeLS(LS_GROUP, id);
          setPeriod('all');
          setEntryKey(null);
        }}
      />
      <Select
        style={{ minWidth: 130 }}
        value={period}
        onChange={setPeriod}
        options={[{ value: 'all', label: 'Весь год' }, ...months.map((m) => ({ value: m.key, label: m.label }))]}
        aria-label="Период"
      />
      <Segmented
        value={mode}
        onChange={(v) => { setMode(v); writeLS(LS_MODE, v); }}
        options={[{ value: 'raw', label: 'Баллы' }, { value: 'grade', label: 'Оценки' }]}
      />
      {hiddenCount > 0 && (
        <Checkbox checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)}>
          Скрытые ({hiddenCount})
        </Checkbox>
      )}
      <span className="cj-toolbar__spacer" />
      {pending > 0 && <span className="cj-saving">Сохраняю…</span>}
      {journalReady && columns.length > 0 && (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'copy', icon: <CopyOutlined />, label: 'Скопировать таблицу' },
              { key: 'csv', icon: <DownloadOutlined />, label: 'Скачать CSV (Excel)' },
            ],
            onClick: onExport,
          }}
        >
          <Button icon={<MoreOutlined />} aria-label="Выгрузка журнала" />
        </Dropdown>
      )}
      {canEdit && journalReady && !data.missing && (
        <Space.Compact>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setColModal({ column: null })}>
            Колонка
          </Button>
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: [
                { key: 'manual', icon: <EditOutlined />, label: 'Ручная колонка — бумажная работа, опрос' },
                { key: 'work', icon: <MobileOutlined />, label: 'Работа Lemma — выдана всему классу' },
              ],
              onClick: ({ key }) => (key === 'work' ? setWorkModal(true) : setColModal({ column: null })),
            }}
          >
            <Button type="primary" icon={<DownOutlined />} aria-label="Какую колонку добавить" />
          </Dropdown>
        </Space.Compact>
      )}
    </div>
  );

  let body;
  if (groupsLoading || (loading && !journalReady)) {
    body = <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>;
  } else if (!groups.length) {
    body = (
      <EmptyState
        title="Нет классов"
        description="Журнал ведётся по классу — сначала создайте класс и добавьте учеников"
        cta="К классам"
        onCta={() => navigate('/app/groups')}
      />
    );
  } else if (!journalReady) {
    body = null;
  } else if (!data.students.length) {
    body = (
      <EmptyState
        title="В классе нет учеников"
        description="Добавьте учеников — и можно вести журнал"
        cta="Открыть класс"
        onCta={() => navigate(`/app/groups/${groupId}`)}
      />
    );
  } else if (!allColumns.length) {
    body = (
      <EmptyState
        title="Журнал пока пуст"
        description="Добавьте первую колонку — устный счёт, самостоятельную, опрос. Онлайн-работы Lemma появятся сами, как только ученики класса их сдадут."
        cta={canEdit && !data.missing ? 'Добавить колонку' : undefined}
        onCta={() => setColModal({ column: null })}
      />
    );
  } else if (!columns.length) {
    body = (
      <EmptyState
        title="В этом месяце колонок нет"
        description="Выберите другой месяц или весь год"
        cta="Показать весь год"
        onCta={() => setPeriod('all')}
      />
    );
  } else {
    body = (
      <Spin spinning={loading}>
        <JournalGrid
          rows={grid.rows}
          columns={columns}
          colStats={grid.colStats}
          canEdit={canEdit && !data.missing}
          menuFor={menuFor}
          onMenu={onMenu}
          onCommit={commitCell}
          onPaste={handlePaste}
          onOpenStudent={(s) => navigate(`/app/students/${s.id}`)}
        />
        <div className="cj-legend">
          <span><EditOutlined /> ввод учителем</span>
          <span><MobileOutlined /> онлайн — из попыток</span>
          <span><i className="cj-legend-flag cj-legend-flag--override" /> исправлено вручную</span>
          <span><i className="cj-legend-flag cj-legend-flag--comment" /> комментарий</span>
          <span>«н» — не был</span>
          <span>
            <span className="cj-swatch cj-swatch--teal">5</span>{' '}
            <span className="cj-swatch cj-swatch--blue">4</span>{' '}
            <span className="cj-swatch cj-swatch--amber">3</span>{' '}
            <span className="cj-swatch cj-swatch--rose">2</span>
          </span>
          {canEdit && !isMobile && (
            <span>
              <kbd>Enter</kbd> вниз · <kbd>Tab</kbd> вправо · <kbd>Ctrl</kbd>+<kbd>V</kbd> вставка столбца из таблицы
            </span>
          )}
        </div>
      </Spin>
    );
  }

  return (
    <div>
      {toolbar}
      {journalReady && data.missing && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Ручные колонки пока недоступны"
          description="На сервере ещё нет таблиц журнала (миграция 1786500000). Онлайн-работы показаны, добавлять свои колонки можно будет после её применения."
        />
      )}
      {body}

      <JournalColumnModal
        open={!!colModal}
        column={colModal?.column || null}
        defaults={newDefaults}
        categories={categories}
        hasMarks={hasMarksInModalColumn}
        canDelete={canDelete && !!colModal?.column && canManage(colModal.column)}
        saving={colSaving}
        onCancel={() => setColModal(null)}
        onSave={saveColumn}
        onDelete={() => deleteColumn(colModal.column)}
      />
      <WorkColumnModal
        open={workModal}
        presentWorkIds={presentWorkIds}
        onCancel={() => setWorkModal(false)}
        onPick={addWorkColumn}
      />
      <JournalColumnEntry
        open={!!entryColumn}
        column={entryColumn}
        colIndex={entryIndex}
        rows={grid.rows}
        canEdit={canEdit}
        isMobile={isMobile}
        onClose={() => setEntryKey(null)}
        onSave={saveFromEntry}
      />
      <Modal
        open={!!fill}
        title={fill ? `Заполнить пустые клетки: «${fill.column.title}»` : ''}
        okText="Заполнить"
        cancelText="Отмена"
        onOk={submitFill}
        onCancel={() => setFill(null)}
        destroyOnHidden
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
          Значение ляжет во все пустые клетки колонки ({SCALE_LABELS[columnScale(fill?.column)]?.toLowerCase()}).
          Заполненные не тронутся — удобно поставить всем зачёт и поправить исключения.
        </Text>
        <Input
          autoFocus
          value={fill?.text || ''}
          status={fill?.error ? 'error' : undefined}
          placeholder={fillScaleHint}
          onChange={(e) => setFill((f) => ({ ...f, text: e.target.value, error: '' }))}
          onPressEnter={submitFill}
        />
        {fill?.error && <div style={{ color: 'var(--c-rose)', fontSize: 12.5, marginTop: 6 }}>{fill.error}</div>}
      </Modal>
    </div>
  );
}
