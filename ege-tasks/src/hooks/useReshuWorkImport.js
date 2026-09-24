/**
 * Работа по номерам «Решу ЕГЭ/ОГЭ» (вкладка мастера «Импорт работы»).
 *
 * `resolve` — из текста/ссылок/распознанного скриншота получаем номера, ищем
 * задачи в банке по `tasks.sdamgia_id`; каких нет — разбираем с Решу (в базу
 * пока ничего не пишется, учитель видит превью и тему).
 * `runImport` — создаёт недостающие задачи в их темах и работу с одним
 * вариантом в заданном порядке.
 *
 * Чистая логика — utils/reshuTaskList.js (под тестами).
 */

import { useCallback, useState } from 'react';
import { api } from '../services/pocketbase';
import {
  RESHU_EXAMS,
  extractReshuIds,
  extractVariantUrls,
  reshuProblemUrl,
  topicForReshuType,
  pickBankTask,
  mainTopicOf,
  moveItem,
} from '../utils/reshuTaskList';
import { fetchSdamgiaProblems, createTaskFromSdamgia } from '../utils/importReshuProblem';
import { taskCodePrefix, nextCodeFromCodes } from '../utils/taskCodeGenerator';

// Решу режет частые запросы — задачи тянем по несколько за раз
const FETCH_CONCURRENCY = 3;

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

let rowSeq = 0;
const newKey = () => `r${++rowSeq}`;

/**
 * Строка плана:
 * - `status: 'bank'`    — задача уже в Лемме (`bankTask`), берётся как есть;
 * - `status: 'reshu'`   — будет добавлена с Решу (`problem`) в тему `topicId`;
 * - `status: 'missing'` — не нашлась ни в банке, ни на Решу (в работу не идёт).
 */
export function useReshuWorkImport({ topics = [] } = {}) {
  const [rows, setRows] = useState([]);
  const [resolving, setResolving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [result, setResult] = useState(null);
  const [notes, setNotes] = useState({ duplicates: [] });

  /**
   * @param {string} text — номера / ссылки / скопированная страница Решу
   * @param {string} examType — ege_profile | ege_base | oge
   * @returns {{ total, bank, reshu, missing }}
   */
  const resolve = useCallback(async (text, examType) => {
    setResolving(true);
    setResult(null);
    try {
      const topicsById = new Map(topics.map((t) => [t.id, t]));
      const { items: parsedItems, duplicates } = extractReshuIds(text);
      const items = [...parsedItems];
      const prefetched = new Map(); // id → задача с Решу, уже разобранная

      // Ссылка на целый вариант: задачи и их порядок отдаёт сервер
      const variantUrls = extractVariantUrls(text);
      for (let i = 0; i < variantUrls.length; i++) {
        setProgress({ current: i, total: variantUrls.length, label: 'Читаю вариант с Решу' });
        const problems = await fetchSdamgiaProblems(variantUrls[i]);
        for (const p of problems) {
          if (!p.id) continue;
          prefetched.set(String(p.id), p);
          if (!items.some((it) => it.id === String(p.id))) {
            items.push({ id: String(p.id), typeLabel: p.type_label || null });
          }
        }
      }
      if (items.length === 0) {
        setRows([]);
        setNotes({ duplicates });
        return { total: 0, bank: 0, reshu: 0, missing: 0 };
      }

      // 1. Банк Лемма
      setProgress({ current: 0, total: items.length, label: 'Ищу задачи в банке' });
      const bankTasks = await api.getTasksBySdamgiaIds(items.map((it) => it.id));
      const bankById = new Map();
      bankTasks.forEach((t) => {
        const list = bankById.get(t.sdamgia_id) || [];
        list.push(t);
        bankById.set(t.sdamgia_id, list);
      });

      // 2. Чего нет в банке — разбираем с Решу
      const missingIdx = items
        .map((it, i) => (bankById.has(it.id) ? -1 : i))
        .filter((i) => i >= 0);
      const fetched = new Map();
      let done = 0;
      await mapLimit(missingIdx, FETCH_CONCURRENCY, async (i) => {
        const { id } = items[i];
        try {
          const problem = prefetched.get(id)
            || (await fetchSdamgiaProblems(reshuProblemUrl(id, examType)))
              .find((p) => String(p.id) === id);
          fetched.set(id, problem ? { problem } : { error: 'нет такой задачи на Решу' });
        } catch (e) {
          fetched.set(id, { error: e.message });
        }
        done += 1;
        setProgress({ current: done, total: missingIdx.length, label: 'Загружаю недостающие с Решу' });
      });

      const nextRows = items.map((it) => {
        const bankTask = pickBankTask(bankById.get(it.id) || [], examType, topicsById);
        if (bankTask) {
          return { key: newKey(), sdamgiaId: it.id, typeLabel: it.typeLabel, status: 'bank', bankTask, topicId: bankTask.topic };
        }
        const { problem, error } = fetched.get(it.id) || {};
        if (!problem) {
          return { key: newKey(), sdamgiaId: it.id, typeLabel: it.typeLabel, status: 'missing', error: error || 'не найдена' };
        }
        const typeLabel = problem.type_label || it.typeLabel;
        const topic = topicForReshuType(topics, examType, typeLabel);
        return {
          key: newKey(), sdamgiaId: it.id, typeLabel, status: 'reshu', problem, topicId: topic?.id || null,
        };
      });

      setRows(nextRows);
      setNotes({ duplicates });
      return {
        total: nextRows.length,
        bank: nextRows.filter((r) => r.status === 'bank').length,
        reshu: nextRows.filter((r) => r.status === 'reshu').length,
        missing: nextRows.filter((r) => r.status === 'missing').length,
      };
    } finally {
      setResolving(false);
    }
  }, [topics]);

  const updateRow = useCallback((key, patch) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  const removeRow = useCallback((key) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const moveRow = useCallback((key, delta) => {
    setRows((prev) => moveItem(prev, prev.findIndex((r) => r.key === key), delta));
  }, []);

  /**
   * @param {object} p
   * @param {object} p.workMeta — { title, classNumber, timeLimit }
   * @param {string} p.examType
   */
  const runImport = useCallback(async ({ workMeta = {}, examType = 'ege_profile' } = {}) => {
    const active = rows.filter((r) => r.status !== 'missing');
    if (active.length === 0) throw new Error('Нет задач для работы');
    const unassigned = active.filter((r) => r.status === 'reshu' && !r.topicId);
    if (unassigned.length) throw new Error(`Не выбрана тема у ${unassigned.length} задач(и) с Решу`);

    setImporting(true);
    const warnings = [];
    const stats = { created: 0, reused: 0, failed: 0 };
    const taskIds = new Map();
    const exam = RESHU_EXAMS[examType] || RESHU_EXAMS.ege_profile;

    try {
      // Коды задач: по одному запросу на тему, дальше счётчик крутится локально
      const codeState = new Map();
      const createTopicIds = [...new Set(active.filter((r) => r.status === 'reshu').map((r) => r.topicId))];
      for (const topicId of createTopicIds) {
        const topic = topics.find((t) => t.id === topicId) || await api.getTopic(topicId);
        const existing = await api.getTasksForDedup(topicId);
        codeState.set(topicId, {
          topic,
          prefix: taskCodePrefix(topic),
          codes: existing.map((t) => t.code).filter(Boolean),
        });
      }

      for (let i = 0; i < active.length; i++) {
        const row = active[i];
        setProgress({ current: i + 1, total: active.length, label: `Задача ${i + 1} (№ ${row.sdamgiaId})` });
        if (row.status === 'bank') {
          taskIds.set(row.key, row.bankTask.id);
          stats.reused += 1;
          continue;
        }
        // Задачу могли добавить в банк, пока учитель смотрел на таблицу
        const already = await api.findTaskBySdamgiaId(row.sdamgiaId).catch(() => null);
        if (already) {
          taskIds.set(row.key, already.id);
          stats.reused += 1;
          continue;
        }
        const state = codeState.get(row.topicId);
        const code = nextCodeFromCodes(state.codes, state.prefix);
        state.codes.push(code);
        try {
          const created = await createTaskFromSdamgia({
            problem: row.problem,
            topicId: row.topicId,
            code,
            sourceType: exam.sourceType,
            examPart: state.topic?.exam_part || 1,
            taskNumber: state.topic?.ege_number || '',
            fallbackUrl: reshuProblemUrl(row.sdamgiaId, examType),
          });
          taskIds.set(row.key, created.id);
          stats.created += 1;
        } catch (e) {
          console.error('[reshu-import] createTask:', e);
          warnings.push(`№ ${row.sdamgiaId}: не удалось создать задачу (${e.message})`);
          stats.failed += 1;
        }
      }

      const ordered = active.filter((r) => taskIds.has(r.key));
      if (ordered.length === 0) throw new Error('Ни одну задачу не удалось добавить');

      setProgress({ current: active.length, total: active.length, label: 'Сохраняю работу' });
      const ids = ordered.map((r) => taskIds.get(r.key));
      const work = await api.createWork({
        title: workMeta.title?.trim() || 'Работа по номерам Решу',
        class: workMeta.classNumber ?? undefined,
        topic: mainTopicOf(ordered.map((r) => r.topicId)),
        time_limit: workMeta.timeLimit ?? undefined,
        source: `Решу ${exam.label}`,
        import_meta: {
          imported_at: new Date().toISOString(),
          format: 'reshu-ids',
          exam_type: examType,
          sdamgia_ids: ordered.map((r) => r.sdamgiaId),
          tasks_created: stats.created,
          tasks_reused: stats.reused,
          tasks_failed: stats.failed,
          import_warnings: warnings.slice(0, 50),
        },
      });
      await api.createVariant({
        work: work.id,
        number: 1,
        tasks: ids,
        order: ids.map((taskId, position) => ({ taskId, position })),
      });

      const summary = { work, ...stats, warnings };
      setResult(summary);
      return summary;
    } finally {
      setImporting(false);
    }
  }, [rows, topics]);

  const reset = useCallback(() => {
    setRows([]);
    setResult(null);
    setNotes({ duplicates: [] });
    setProgress({ current: 0, total: 0, label: '' });
  }, []);

  return {
    rows, resolving, importing, progress, result, notes,
    resolve, updateRow, removeRow, moveRow, runImport, reset,
  };
}
