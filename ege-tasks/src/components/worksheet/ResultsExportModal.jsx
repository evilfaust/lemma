import { useEffect, useMemo, useState } from 'react';
import { Modal, Checkbox, InputNumber, Space, Typography, App, Alert } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { DEFAULT_THRESHOLDS, normalizeThresholds } from '../../utils/classJournal';
import {
  isFinishedAttempt, pickBestAttempts, buildResultsTable, resultsSheets, resultsFileName,
} from '../../utils/resultsExport';

const { Text } = Typography;

const STORAGE_KEY = 'resultsExport.options';

function readOptions() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (raw && typeof raw === 'object') return raw;
  } catch (_) { /* приватный режим */ }
  return {};
}

function writeOptions(opts) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(opts)); } catch (_) { /* не критично */ }
}

/** Чаще всего встречающаяся дата сдачи — «дата проведения» для шапки и имени файла. */
function mainDate(rows) {
  const counts = new Map();
  rows.forEach((r) => { if (r.date) counts.set(r.date, (counts.get(r.date) || 0) + 1); });
  let best = '';
  let max = 0;
  counts.forEach((n, d) => { if (n > max) { max = n; best = d; } });
  return best;
}

/**
 * Выгрузка результатов работы в Excel (v3.9.321): для деканата — ФИО,
 * вариант, баллы, процент, оценка, задания «1/0», сводка по классу и лист
 * с ответами учеников. Логика таблицы — `utils/resultsExport.js`,
 * файл собирает `utils/xlsxWriter.js` (грузится по кнопке).
 */
const ResultsExportModal = ({ open, onClose, attempts, mcTest, sessions = [], sessionLabels = null }) => {
  const { message } = App.useApp();
  const [opts, setOpts] = useState(() => ({
    bestOnly: true, withTasks: true, withGrade: true, withAnswers: true,
    thresholds: { ...DEFAULT_THRESHOLDS },
    ...readOptions(),
  }));
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setOpts((o) => ({ ...o, ...readOptions() })); }, [open]);

  const finished = useMemo(() => (attempts || []).filter(isFinishedAttempt), [attempts]);
  const rowsCount = useMemo(
    () => (opts.bestOnly ? pickBestAttempts(finished).length : finished.length),
    [finished, opts.bestOnly],
  );

  const set = (patch) => setOpts((o) => ({ ...o, ...patch }));
  const setThreshold = (k, v) => set({ thresholds: { ...opts.thresholds, [k]: v } });

  const firstSession = sessions[0] || null;
  const work = firstSession?.expand?.work || null;
  const title = work?.title?.trim() || mcTest?.title?.trim() || firstSession?.expand?.mc_test?.title || 'Результаты работы';

  const handleExport = async () => {
    setBusy(true);
    try {
      const thresholds = normalizeThresholds(opts.thresholds);
      writeOptions({ ...opts, thresholds });
      // Писатель .xlsx (zip) — отдельным чанком, только по кнопке
      const { downloadXlsx } = await import('../../utils/xlsxWriter');

      // Ответы по заданиям нужны и для колонок «1/0», и для листа «Ответы».
      // У тренировки из генератора они лежат в самой попытке.
      const needAnswers = (opts.withTasks || opts.withAnswers)
        ? finished.filter((a) => !Array.isArray(a.drill_answers)).map((a) => a.id)
        : [];
      const answers = needAnswers.length ? await api.getAttemptAnswersForExport(needAnswers) : [];
      const answersByAttempt = {};
      answers.forEach((a) => { (answersByAttempt[a.attempt] ||= []).push(a); });

      const table = buildResultsTable({
        attempts: finished, answersByAttempt, mcTest, bestOnly: opts.bestOnly, thresholds,
      });
      if (!table.rows.length) {
        message.info('Нет сданных работ для выгрузки');
        return;
      }
      const date = mainDate(table.rows);
      const today = new Date().toLocaleDateString('ru-RU');
      const subtitle = [
        work?.class ? `Класс: ${work.class}` : null,
        date ? `Дата проведения: ${date}` : null,
        `Выгружено из Lemma ${today}`,
      ].filter(Boolean).join(' · ');

      const sheets = resultsSheets(table, { title, subtitle, sessionLabels }, {
        withTasks: opts.withTasks, withGrade: opts.withGrade, withAnswers: opts.withAnswers, thresholds,
      });
      downloadXlsx(sheets, resultsFileName({ title, groupName: work?.class ? `${work.class} класс` : '', date }));
      message.success(`Выгружено: ${table.rows.length} учеников`);
      onClose?.();
    } catch (err) {
      console.error('Results export failed:', err);
      message.error('Не удалось выгрузить: ' + (err?.message || 'ошибка'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={<Space><FileExcelOutlined style={{ color: '#1d6f42' }} /> Выгрузка в Excel</Space>}
      open={open}
      onCancel={onClose}
      onOk={handleExport}
      okText="Скачать .xlsx"
      cancelText="Отмена"
      confirmLoading={busy}
      okButtonProps={{ disabled: !finished.length }}
      destroyOnClose
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Text type="secondary">
          «{title}» · в таблице {rowsCount} {rowsCount === 1 ? 'строка' : 'строк(и)'}.
          Незаконченные попытки не выгружаются.
        </Text>
        {!finished.length && <Alert type="info" showIcon message="Пока нет ни одной сданной работы" />}

        <Checkbox checked={opts.bestOnly} onChange={(e) => set({ bestOnly: e.target.checked })}>
          Одна строка на ученика — лучшая попытка
        </Checkbox>
        <Checkbox checked={opts.withTasks} onChange={(e) => set({ withTasks: e.target.checked })}>
          Задания по столбцам (1 — верно, 0 — неверно) и «Решили, %»
        </Checkbox>
        <Checkbox checked={opts.withAnswers} onChange={(e) => set({ withAnswers: e.target.checked })}>
          Второй лист «Ответы» — что записал каждый ученик
        </Checkbox>
        <Checkbox checked={opts.withGrade} onChange={(e) => set({ withGrade: e.target.checked })}>
          Оценка, успеваемость и качество знаний
        </Checkbox>
        {opts.withGrade && (
          <Space wrap size={6} style={{ paddingLeft: 24 }}>
            {[5, 4, 3].map((k) => (
              <Space key={k} size={4}>
                <Text>«{k}» от</Text>
                <InputNumber
                  size="small"
                  min={0}
                  max={100}
                  value={opts.thresholds?.[k]}
                  onChange={(v) => setThreshold(k, v)}
                  style={{ width: 64 }}
                  aria-label={`Порог оценки ${k}, %`}
                />
                <Text>%</Text>
              </Space>
            ))}
          </Space>
        )}
      </Space>
    </Modal>
  );
};

export default ResultsExportModal;
