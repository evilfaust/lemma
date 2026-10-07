import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Modal, Upload, Select, Input, Button, Table, Tag, Alert, Space, Spin,
  Typography, App, DatePicker, Tooltip, Image, Segmented, Progress,
} from 'antd';
import {
  CameraOutlined, CheckCircleFilled, CloseCircleFilled, MinusCircleOutlined,
  ThunderboltOutlined, SaveOutlined, RedoOutlined, EditOutlined, FileDoneOutlined,
  PictureOutlined, DownOutlined, UpOutlined, TeamOutlined, SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../services/pocketbase';
import { checkAnswer } from '../../utils/answerChecker';
import { compressImage } from '../../utils/imageProcessing';
import { toStoredDate } from '../../utils/classJournal';
import { mergeScanReads } from '../../utils/scanBlank';
import useIsMobile from '../../hooks/useIsMobile';
import MathRenderer from '../MathRenderer';
import './scanBlank.css';

const { Text } = Typography;

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const mime = head.match(/data:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Задачи варианта в том порядке, в котором их видит ученик (= порядок в КИМ).
function orderedTasks(variant) {
  let list = variant?.expand?.tasks || [];
  if (variant?.order && Array.isArray(variant.order)) {
    const orderMap = {};
    variant.order.forEach((taskId, idx) => { orderMap[taskId] = idx; });
    list = [...list].sort((a, b) =>
      (orderMap[a.id] ?? 999) - (orderMap[b.id] ?? 999));
  }
  return list;
}

const NEW_SESSION = '__new__';
const GROUP_KEY = 'scanBlank.group';
// Вариантов до стольких — на телефоне кнопками в ряд, больше — списком
const VARIANT_BUTTONS_MAX = 4;

const readGroup = () => {
  try { return localStorage.getItem(GROUP_KEY) || null; } catch { return null; }
};
const writeGroup = (id) => {
  try {
    if (id) localStorage.setItem(GROUP_KEY, id);
    else localStorage.removeItem(GROUP_KEY);
  } catch { /* нет хранилища — не страшно */ }
};

// Поле ответа на телефоне: 16px — иначе iOS увеличивает страницу при фокусе;
// автозамена и заглавная буква в ответах ЕГЭ только мешают.
const MOBILE_INPUT_PROPS = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
};

/**
 * Результаты бумажной работы: ответы ученика → попытка (attempts.source='scan'),
 * неотличимая для статистики от ученической. Ответы либо распознаются с фото
 * бланка №1 (pdf-service /scan-blank, vision-LLM), либо вписываются вручную
 * (v3.9.311) — тогда фото не нужно.
 *
 * Выбран класс → в списке только его ученики (✓ — уже внесён в эту выдачу), а
 * при первой записи работа сама встаёт колонкой в журнал класса на дату
 * проведения: попытки журнал подтягивает по ученику, а дата колонки берётся
 * из неё, а не из дня ввода.
 *
 * v3.9.313: фото распознаётся сразу после съёмки, дважды параллельно —
 * расхождения прочтений подсвечиваются и предлагаются кнопкой «или …»
 * (`utils/scanBlank.js`). На телефоне окно во весь экран: настройки выдачи
 * сворачиваются в строку, съёмка — крупной кнопкой с камерой, ответы —
 * списком, «Записать» закреплена внизу.
 */
const ScanBlankModal = ({ open, work, onClose, onRecorded, scanEnabled = true }) => {
  const { message, modal } = App.useApp();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);

  const [groupId, setGroupId] = useState(null);
  const [groupStudents, setGroupStudents] = useState([]);
  const [day, setDay] = useState(() => dayjs());
  const [variantId, setVariantId] = useState(null);
  const [sessionId, setSessionId] = useState(NEW_SESSION);
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState('');
  const [done, setDone] = useState(() => new Set()); // ученики, уже внесённые в выбранную выдачу
  const [setupOpen, setSetupOpen] = useState(true); // телефон: класс/дата/выдача развёрнуты

  const [photo, setPhoto] = useState(null);       // dataURL сжатого фото
  const [manual, setManual] = useState(false);    // ответы вписываются руками, без фото
  const [scanning, setScanning] = useState(false);
  const [scanMeta, setScanMeta] = useState(null); // { replacements, uncertain, alternatives, reads }
  const [answers, setAnswers] = useState(null);   // { [номер]: строка } — после распознавания, редактируемые
  const [overrides, setOverrides] = useState({}); // { [номер]: bool } — верно/неверно решил учитель
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [lastSaved, setLastSaved] = useState(null); // { name, score, total } — для телефона
  const journalReady = useRef(new Set());         // классы, у которых колонка работы уже есть
  const inputRefs = useRef([]);
  const saveRef = useRef(null);
  const scanToken = useRef(0);                    // ответ устаревшего распознавания не применяем
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const variant = useMemo(
    () => variants.find(v => v.id === variantId) || null,
    [variants, variantId]
  );
  const tasks = useMemo(() => orderedTasks(variant), [variant]);

  // Справочники — при открытии
  useEffect(() => {
    if (!open || !work?.id) return;
    setLoading(true);
    journalReady.current = new Set();
    Promise.all([
      api.getVariantsByWork(work.id),
      api.getSessionsByWork(work.id),
      api.getStudents(),
      api.getTeachingGroups().catch(() => []),
    ]).then(([vars, sess, studs, grps]) => {
      setVariants(vars);
      setVariantId(vars[0]?.id || null);
      setSessions(sess);
      setSessionId(sess[0]?.id || NEW_SESSION);
      setStudents(studs.filter(s => s.name));
      setGroups(grps);
      const saved = readGroup();
      const known = grps.some(g => g.id === saved);
      setGroupId(known ? saved : null);
      // Класс уже знаком — строку настроек сворачиваем, сразу к ученику и фото
      setSetupOpen(!known);
    }).catch(() => {
      message.error('Не удалось загрузить работу');
    }).finally(() => setLoading(false));
  }, [open, work?.id, message]);

  // Состав класса — через членства (п. 15 CLAUDE.md), не по student_class
  useEffect(() => {
    if (!open || !groupId) { setGroupStudents([]); return; }
    let alive = true;
    api.getStudentsByGroup(groupId)
      .then(list => { if (alive) setGroupStudents(list.filter(s => s.name)); })
      .catch(() => { if (alive) setGroupStudents([]); });
    return () => { alive = false; };
  }, [open, groupId]);

  // Кто уже внесён в выбранную выдачу — чтобы не записать ученика дважды
  useEffect(() => {
    if (!open || !sessionId || sessionId === NEW_SESSION) { setDone(new Set()); return; }
    let alive = true;
    api.getAttemptsBySessionsWithStudent([sessionId]).then(list => {
      if (alive) setDone(new Set(list.map(a => a.student).filter(Boolean)));
    });
    return () => { alive = false; };
  }, [open, sessionId]);

  const pickList = groupId ? groupStudents : students;

  const focusInput = (i) => setTimeout(() => inputRefs.current[i]?.focus(), 0);

  const resetScan = useCallback((keepManual = false) => {
    scanToken.current += 1;
    setScanning(false);
    setPhoto(null);
    setScanMeta(null);
    setOverrides({});
    setAnswers(keepManual ? {} : null);
    if (!keepManual) setManual(false);
  }, []);

  const startManual = () => {
    scanToken.current += 1;
    setScanning(false);
    setManual(true);
    setPhoto(null);
    setScanMeta(null);
    setOverrides({});
    setAnswers({});
    // На телефоне клавиатура сама не выезжает — пусть учитель тапнет поле
    if (!isMobile) focusInput(0);
  };

  const pickStudent = (id) => {
    setStudentId(id || null);
    const s = pickList.find(x => x.id === id) || students.find(x => x.id === id);
    setStudentName(s ? s.name : '');
  };

  const handleClose = () => {
    resetScan();
    setStudentId(null);
    setStudentName('');
    setSavedCount(0);
    setLastSaved(null);
    onClose?.();
  };

  // Два прочтения параллельно; упало одно — работаем по второму
  const runScan = async (image, count = tasks.length) => {
    if (!image || !count) return;
    const token = ++scanToken.current;
    setScanning(true);
    setAnswers(null);
    setScanMeta(null);
    setOverrides({});
    const read = () => api.scanBlank({ imageBase64: image, tasksCount: count });
    const settled = await Promise.allSettled([read(), read()]);
    if (token !== scanToken.current) return; // фото сменили или окно закрыли
    const reads = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
    if (!reads.length) {
      message.error(settled[0].reason?.message || 'Ошибка распознавания');
      setScanning(false);
      return;
    }
    const merged = mergeScanReads(reads, count);
    setAnswers(merged.answers);
    setScanMeta({
      replacements: merged.replacements,
      uncertain: merged.uncertain,
      alternatives: merged.alternatives,
      reads: merged.reads,
    });
    setScanning(false);
  };

  const handlePhoto = async (file) => {
    try {
      const dataUrl = await compressImage(file);
      setPhoto(dataUrl);
      setManual(false);
      // Сразу читаем: лишний тап «Распознать» на пачке бланков — тридцать тапов
      if (scanEnabled) runScan(dataUrl);
      else { setAnswers(null); setScanMeta(null); setOverrides({}); }
    } catch {
      message.error('Не удалось прочитать изображение');
    }
  };

  const onFileInput = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // тот же файл ещё раз — снова событие
    if (file) handlePhoto(file);
  };

  // Сменили вариант: ответы привязаны к номерам полей бланка и просто
  // перепроверяются по новому эталону. Распознаём заново только если полей
  // стало больше — сервер отбросил «лишние» по числу задач.
  const changeVariant = (id) => {
    const next = variants.find(v => v.id === id);
    const nextCount = orderedTasks(next).length;
    setVariantId(id);
    setOverrides({});
    if (photo && scanEnabled && nextCount > tasks.length) runScan(photo, nextCount);
    else if (!photo && !manual) resetScan();
  };

  // Второе прочтение предложило другое — меняем местами по тапу
  const swapAlternative = (n) => {
    const alt = scanMeta?.alternatives?.[n];
    if (alt == null) return;
    const current = answers?.[n] || '';
    setAnswers(prev => ({ ...prev, [n]: alt }));
    setScanMeta(prev => {
      const alternatives = { ...prev.alternatives };
      if (current) alternatives[n] = current; else delete alternatives[n];
      return { ...prev, alternatives };
    });
  };

  // Живой пересчёт правильности по мере правок учителя
  const rows = useMemo(() => {
    if (!answers) return [];
    return tasks.map((task, i) => {
      const n = i + 1;
      const raw = answers[n] || '';
      const { isCorrect: auto, normalized } = raw
        ? checkAnswer(raw, task.answer)
        : { isCorrect: false, normalized: NaN };
      const forced = overrides[n];
      return {
        key: n, n, task, raw, normalized,
        isCorrect: forced ?? auto,
        forced: forced !== undefined,
        empty: !raw,
        uncertain: scanMeta?.uncertain?.includes(n),
        replaced: scanMeta?.replacements?.some(r => Number(r.task) === n),
        alternative: scanMeta?.alternatives?.[n],
      };
    });
  }, [answers, tasks, scanMeta, overrides]);

  const score = rows.filter(r => r.isCorrect).length;

  // Клик по значку: учитель сам решает, засчитать ли ответ (другая запись
  // верного числа, описка в эталоне). Совпало с автопроверкой — снимаем.
  const toggleCorrect = (r) => {
    const { isCorrect: auto } = r.raw ? checkAnswer(r.raw, r.task.answer) : { isCorrect: false };
    setOverrides(prev => {
      const next = { ...prev };
      if (!r.isCorrect === auto) delete next[r.n];
      else next[r.n] = !r.isCorrect;
      return next;
    });
  };

  // Работа — колонкой в журнал класса (один раз за открытие окна). Есть уже —
  // не трогаем: дату и пороги учитель мог поправить в самом журнале.
  const ensureJournalColumn = async () => {
    if (!groupId || journalReady.current.has(groupId)) return;
    try {
      const cols = await api.getJournalColumns(groupId);
      if (!cols.some(c => c.work === work.id)) {
        await api.createJournalColumn({
          group: groupId,
          title: work.title,
          date: toStoredDate(day.format('YYYY-MM-DD')),
          source: 'work',
          work: work.id,
          assigned: true,
          weight: 1,
        });
        const g = groups.find(x => x.id === groupId);
        message.info(`«${work.title}» добавлена в журнал${g ? ` класса ${g.name}` : ''}`);
      }
      journalReady.current.add(groupId);
    } catch (e) {
      console.warn('[scan-blank] колонка журнала не создалась:', e?.message);
      message.warning('Результат записан, но колонку в журнал добавить не удалось — добавьте «Работу Lemma» в журнале');
    }
  };

  const handleSave = async () => {
    if (!studentName.trim()) {
      message.warning('Укажите ученика или впишите ФИО');
      return;
    }
    if (studentId && done.has(studentId)) {
      const ok = await new Promise(resolve => modal.confirm({
        title: `${studentName.trim()} уже внесён в эту выдачу`,
        content: 'Записать ещё одну попытку? В журнал пойдёт лучшая из них.',
        okText: 'Записать',
        cancelText: 'Отмена',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      }));
      if (!ok) return;
    }
    setSaving(true);
    try {
      // 1. Сессия: существующая или новая «бумажная» выдача
      let sid = sessionId;
      if (sid === NEW_SESSION) {
        const created = await api.createSession({
          work: work.id,
          is_open: false,
          achievements_enabled: false,
          student_title: `${work.title || 'Работа'} (бумага, ${day.format('DD.MM')})`,
        });
        sid = created.id;
        setSessions(prev => [created, ...prev]);
        setSessionId(created.id);
      }

      // 2. Попытка — как в ученическом флоу, но source='scan'.
      // Время сдачи — день проведения, а не день ввода.
      const isToday = day.isSame(dayjs(), 'day');
      const attempt = await api.createAttempt({
        session: sid,
        ...(studentId ? { student: studentId } : {}),
        student_name: studentName.trim(),
        device_id: 'paper-scan',
        variant: variantId,
        status: 'submitted',
        score,
        total: tasks.length,
        submitted_at: (isToday ? dayjs() : day.hour(12).minute(0).second(0)).toISOString(),
        source: 'scan',
      });

      // 3. Ответы
      await api.batchCreateAttemptAnswers(rows.map(r => ({
        attempt: attempt.id,
        task: r.task.id,
        answer_raw: r.raw,
        answer_normalized: isNaN(r.normalized) ? 0 : r.normalized,
        is_correct: r.isCorrect,
      })));

      // 4. Фото бланка — для спорных случаев (не блокирует запись)
      if (photo) {
        try {
          const fd = new FormData();
          fd.append('blank_photo', dataUrlToBlob(photo), `blank_${attempt.id}.jpg`);
          await api.updateAttempt(attempt.id, fd);
        } catch (e) {
          console.warn('[scan-blank] фото не сохранилось:', e?.message);
        }
      }

      if (studentId) await ensureJournalColumn();

      message.success(`${studentName.trim()}: ${score} из ${tasks.length} — записано`);
      setSavedCount(c => c + 1);
      setLastSaved({ name: studentName.trim(), score, total: tasks.length });
      const nowDone = new Set(done);
      if (studentId) nowDone.add(studentId);
      setDone(nowDone);

      // Готов к следующему: та же работа/вариант/выдача, следующий ученик класса
      const wasManual = manual;
      resetScan(wasManual);
      const next = groupId
        ? pickList.find(s => !nowDone.has(s.id) && s.id !== studentId)
        : null;
      setStudentId(next?.id || null);
      setStudentName(next?.name || '');
      if (wasManual && !isMobile) focusInput(0);
      onRecorded?.();
    } catch (err) {
      console.error('Error saving scanned attempt:', err);
      message.error('Не удалось записать результат: ' + (err?.message || ''));
    }
    setSaving(false);
  };

  // ── Общие куски разметки ───────────────────────────────────────────────

  const enteredInGroup = groupId ? groupStudents.filter(s => done.has(s.id)).length : 0;
  const group = groups.find(g => g.id === groupId) || null;
  const sessionIdx = sessions.findIndex(s => s.id === sessionId);
  const sessionLabel = sessionId === NEW_SESSION
    ? 'новая выдача'
    : `выдача ${sessions.length - sessionIdx} от ${new Date(sessions[sessionIdx]?.created).toLocaleDateString('ru-RU')}`;

  const variantOptions = variants.map((v, i) => ({
    value: v.id,
    label: `Вариант ${v.number || i + 1} (${(v.expand?.tasks || []).length} зад.)`,
  }));

  const studentOptions = pickList.map(s => ({
    value: s.id,
    search: s.name,
    label: `${done.has(s.id) ? '✓ ' : ''}${s.name}${!groupId && s.student_class ? ` (${s.student_class})` : ''}`,
  }));

  const changeGroup = (id) => {
    setGroupId(id || null);
    writeGroup(id || null);
    setStudentId(null);
    setStudentName('');
  };

  const statusIcon = (r) => (
    r.empty && !r.forced
      ? <MinusCircleOutlined style={{ color: 'var(--ink-4, #999)' }} />
      : r.isCorrect
        ? <CheckCircleFilled style={{ color: '#52c41a' }} />
        : <CloseCircleFilled style={{ color: '#ff4d4f' }} />
  );

  const altChip = (r) => (r.alternative ? (
    <Tooltip title="Второе прочтение дало другое — нажмите, чтобы взять его">
      <button type="button" className="sbm-alt" onClick={() => swapAlternative(r.n)}>
        или {r.alternative}
      </button>
    </Tooltip>
  ) : null);

  const answerInput = (r, props = {}) => (
    <Input
      ref={el => { inputRefs.current[r.n - 1] = el; }}
      value={r.raw}
      status={r.uncertain && !r.isCorrect ? 'warning' : undefined}
      onChange={e => setAnswers(prev => ({ ...prev, [r.n]: e.target.value }))}
      onPressEnter={() => {
        if (r.n < tasks.length) focusInput(r.n);
        else if (isMobile) inputRefs.current[r.n - 1]?.blur();
        else saveRef.current?.focus();
      }}
      {...props}
    />
  );

  const photoPreview = (size) => (
    <Image
      src={photo}
      alt="бланк"
      width={size.width}
      height={size.height}
      className="sbm-photo"
      preview={{ mask: 'Увеличить' }}
    />
  );

  const uncertainAlert = scanMeta?.uncertain?.length > 0 && (
    <Alert
      type="warning"
      showIcon
      message={`Сверьте с фото поля: ${scanMeta.uncertain.join(', ')}`}
      description={scanMeta.reads > 1 && Object.keys(scanMeta.alternatives || {}).length > 0
        ? 'Где два прочтения разошлись, рядом есть кнопка «или …» — второй вариант.'
        : undefined}
    />
  );

  const hiddenInputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFileInput} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFileInput} />
    </>
  );

  // ── Телефон ────────────────────────────────────────────────────────────

  const renderMobile = () => (
    <div className="sbm-m">
      {hiddenInputs}

      <div className="sbm-setup">
        <button type="button" className="sbm-setup-sum" onClick={() => setSetupOpen(o => !o)}>
          <TeamOutlined />
          <span className="sbm-setup-text">
            {group ? group.name : 'Класс не выбран'} · {day.format('D MMM')} · {sessionLabel}
          </span>
          {setupOpen ? <UpOutlined /> : <DownOutlined />}
        </button>
        {setupOpen && (
          <div className="sbm-setup-fields">
            <Select
              size="large"
              allowClear
              placeholder="Класс"
              value={groupId}
              onChange={changeGroup}
              options={groups.map(g => ({ value: g.id, label: g.name }))}
            />
            <DatePicker
              size="large"
              value={day}
              onChange={d => setDay(d || dayjs())}
              format="DD.MM.YYYY"
              allowClear={false}
              inputReadOnly
              disabledDate={d => d.isAfter(dayjs(), 'day')}
              disabled={sessionId !== NEW_SESSION && savedCount > 0}
            />
            <Select
              size="large"
              value={sessionId}
              onChange={setSessionId}
              options={[
                ...sessions.map((s, i) => ({
                  value: s.id,
                  label: `Выдача ${sessions.length - i} — ${new Date(s.created).toLocaleDateString('ru-RU')}`,
                })),
                { value: NEW_SESSION, label: '➕ Новая выдача (бумага)' },
              ]}
            />
            {groupId && (
              <Text type="secondary" className="sbm-hint">
                Работа сама встанет в журнал класса колонкой на дату проведения.
              </Text>
            )}
          </div>
        )}
      </div>

      {groupId && groupStudents.length > 0 && (
        <div className="sbm-progress">
          <span>Внесено {enteredInGroup} из {groupStudents.length}</span>
          <Progress
            percent={Math.round((enteredInGroup / groupStudents.length) * 100)}
            showInfo={false}
            size="small"
          />
        </div>
      )}

      {lastSaved && !answers && !photo && (
        <div className="sbm-saved">
          <CheckCircleFilled /> {lastSaved.name}: {lastSaved.score} из {lastSaved.total} — записано
        </div>
      )}

      <div className="sbm-who">
        <Select
          size="large"
          showSearch={!groupId}
          allowClear
          placeholder={groupId ? 'Ученик класса' : 'Ученик из списка'}
          optionFilterProp="search"
          value={studentId}
          onChange={pickStudent}
          options={studentOptions}
          className="sbm-student"
        />
        {!groupId && (
          <Input
            size="large"
            placeholder="или впишите ФИО"
            value={studentName}
            onChange={e => setStudentName(e.target.value)}
          />
        )}
        {variants.length > 1 && (variants.length <= VARIANT_BUTTONS_MAX ? (
          <Segmented
            block
            size="large"
            value={variantId}
            onChange={changeVariant}
            options={variants.map((v, i) => ({ value: v.id, label: `Вар. ${v.number || i + 1}` }))}
          />
        ) : (
          <Select size="large" value={variantId} onChange={changeVariant} options={variantOptions} />
        ))}
      </div>

      {!photo && !answers && (
        <div className="sbm-capture">
          {scanEnabled && (
            <>
              <Button
                type="primary"
                size="large"
                block
                icon={<CameraOutlined />}
                className="sbm-capture-main"
                onClick={() => cameraRef.current?.click()}
              >
                Сфотографировать бланк
              </Button>
              <Button size="large" block icon={<PictureOutlined />} onClick={() => galleryRef.current?.click()}>
                Фото из галереи
              </Button>
            </>
          )}
          <Button
            size="large"
            block
            type={scanEnabled ? 'default' : 'primary'}
            icon={<EditOutlined />}
            onClick={startManual}
          >
            Ввести ответы вручную
          </Button>
          {scanEnabled && (
            <Text type="secondary" className="sbm-hint">
              Бланк целиком, при хорошем свете, без сильного наклона. Ответы прочитаются сами.
            </Text>
          )}
        </div>
      )}

      {photo && !answers && (
        <div className="sbm-reading">
          {photoPreview({ width: 120 })}
          {scanning ? (
            <div className="sbm-reading-status">
              <Spin />
              <div>Читаю бланк…</div>
              <Text type="secondary" className="sbm-hint">обычно 5–10 секунд</Text>
            </div>
          ) : (
            <div className="sbm-reading-status">
              <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => runScan(photo)}>
                Распознать ещё раз
              </Button>
              <Button icon={<RedoOutlined />} onClick={() => cameraRef.current?.click()}>
                Переснять
              </Button>
            </div>
          )}
        </div>
      )}

      {answers && (
        <>
          {photo && (
            <div className="sbm-photo-strip">
              {photoPreview({ width: 64, height: 84 })}
              <div className="sbm-photo-strip-text">
                <Text type="secondary" className="sbm-hint">Нажмите на фото, чтобы сверить</Text>
                <Space size={6} wrap>
                  <Button size="small" icon={<SyncOutlined />} onClick={() => runScan(photo)}>
                    Прочитать ещё раз
                  </Button>
                  <Button size="small" icon={<CameraOutlined />} onClick={() => cameraRef.current?.click()}>
                    Переснять
                  </Button>
                </Space>
              </div>
            </div>
          )}
          {uncertainAlert}
          <Text type="secondary" className="sbm-hint">
            Значок справа — засчитать или снять ответ вручную.
          </Text>
          <div className="sbm-rows">
            {rows.map(r => (
              <div
                key={r.n}
                className={`sbm-row${r.uncertain ? ' sbm-row--warn' : ''}${r.isCorrect ? ' sbm-row--ok' : ''}`}
              >
                <span className="sbm-row-n">{r.n}</span>
                <div className="sbm-row-main">
                  {answerInput(r, {
                    ...MOBILE_INPUT_PROPS,
                    size: 'large',
                    enterKeyHint: r.n < tasks.length ? 'next' : 'done',
                    className: 'sbm-row-input',
                  })}
                  <div className="sbm-row-sub">
                    <span className="sbm-row-key">эталон: <MathRenderer text={r.task.answer || '—'} /></span>
                    {r.replaced && <Tag color="blue">замена</Tag>}
                    {r.forced && <Tag>вручную</Tag>}
                    {altChip(r)}
                  </div>
                </div>
                <button
                  type="button"
                  className="sbm-row-mark"
                  aria-label={r.isCorrect ? 'Не засчитывать' : 'Засчитать'}
                  onClick={() => toggleCorrect(r)}
                >
                  {statusIcon(r)}
                </button>
              </div>
            ))}
          </div>
          {manual && (
            <Button type="link" onClick={() => resetScan()} className="sbm-cancel">
              Отменить ввод
            </Button>
          )}
        </>
      )}
    </div>
  );

  const mobileFooter = answers ? (
    <div className="sbm-foot">
      <div className="sbm-foot-score">
        <span className="sbm-foot-big">{score}</span> из {tasks.length}
        {studentName && <div className="sbm-foot-who">{studentName}</div>}
      </div>
      <Button
        type="primary"
        size="large"
        icon={<SaveOutlined />}
        loading={saving}
        onClick={handleSave}
      >
        Записать
      </Button>
    </div>
  ) : null;

  // ── Компьютер ──────────────────────────────────────────────────────────

  const columns = [
    { title: '№', dataIndex: 'n', width: 46, align: 'center' },
    {
      title: manual ? 'Ответ ученика' : 'Распознано (можно править)',
      dataIndex: 'raw',
      render: (_, r) => answerInput(r, {
        size: 'small',
        style: { maxWidth: 140, fontFamily: 'monospace' },
      }),
    },
    {
      title: 'Эталон',
      width: 160,
      render: (_, r) => <MathRenderer text={r.task.answer || '—'} />,
    },
    {
      title: '',
      width: 170,
      align: 'center',
      render: (_, r) => (
        <Space size={4} wrap>
          <Tooltip title={r.isCorrect ? 'Засчитано. Клик — не засчитывать' : 'Не засчитано. Клик — засчитать'}>
            <span style={{ cursor: 'pointer' }} onClick={() => toggleCorrect(r)}>
              {statusIcon(r)}
            </span>
          </Tooltip>
          {r.forced && <Tag style={{ margin: 0 }}>вручную</Tag>}
          {r.replaced && <Tag color="blue" style={{ margin: 0 }}>замена</Tag>}
          {r.uncertain && <Tag color="orange" style={{ margin: 0 }}>?</Tag>}
          {altChip(r)}
        </Space>
      ),
    },
  ];

  const renderDesktop = () => (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {savedCount > 0 && (
        <Alert
          type="success"
          showIcon
          message={`Записано: ${savedCount}${groupId ? ` · в выдаче ${enteredInGroup} из ${groupStudents.length} учеников класса` : ''}. Можно вносить следующего.`}
        />
      )}

      {/* Шаг 1: класс, дата, выдача */}
      <Space wrap>
        <Select
          style={{ minWidth: 170 }}
          allowClear
          placeholder="Класс"
          value={groupId}
          onChange={changeGroup}
          options={groups.map(g => ({ value: g.id, label: g.name }))}
        />
        <DatePicker
          value={day}
          onChange={d => setDay(d || dayjs())}
          format="DD.MM.YYYY"
          allowClear={false}
          disabledDate={d => d.isAfter(dayjs(), 'day')}
          disabled={sessionId !== NEW_SESSION && savedCount > 0}
        />
        <Select
          style={{ minWidth: 210 }}
          value={sessionId}
          onChange={setSessionId}
          options={[
            ...sessions.map((s, i) => ({
              value: s.id,
              label: `Выдача ${sessions.length - i} — ${new Date(s.created).toLocaleDateString('ru-RU')}`,
            })),
            { value: NEW_SESSION, label: '➕ Новая выдача (бумага)' },
          ]}
        />
      </Space>
      {groupId && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Работа сама встанет в журнал этого класса колонкой на дату проведения.
        </Text>
      )}

      {/* Шаг 2: вариант и ученик */}
      <Space wrap>
        <Select
          style={{ minWidth: 150 }}
          value={variantId}
          onChange={changeVariant}
          options={variantOptions}
        />
        <Select
          style={{ minWidth: 260 }}
          showSearch
          allowClear
          placeholder={groupId ? 'Ученик класса' : 'Ученик из списка'}
          optionFilterProp="search"
          value={studentId}
          onChange={pickStudent}
          options={studentOptions}
        />
        {!groupId && (
          <Input
            style={{ width: 200 }}
            placeholder="или впишите ФИО"
            value={studentName}
            onChange={e => setStudentName(e.target.value)}
          />
        )}
      </Space>
      {!groupId && studentName && !studentId && (
        <Alert
          type="info"
          showIcon
          message="Ученик не выбран из списка — результат сохранится в работе, но в журнал не попадёт"
        />
      )}

      {/* Шаг 3: ответы — с фото или вручную */}
      {!photo && !answers && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button type="primary" icon={<EditOutlined />} onClick={startManual}>
            Ввести ответы вручную
          </Button>
          {scanEnabled && (
            <Upload.Dragger
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => { handlePhoto(file); return false; }}
            >
              <p style={{ fontSize: 32, margin: 0 }}><CameraOutlined /></p>
              <p>…или сфотографируйте/перетащите заполненный бланк ответов №1</p>
              <p style={{ color: 'var(--ink-3, #888)', fontSize: 12 }}>
                Бланк целиком, при хорошем свете, без сильного наклона. Ответы прочитаются сами.
              </p>
            </Upload.Dragger>
          )}
        </Space>
      )}
      {photo && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {photoPreview({ width: 180 })}
          <Space direction="vertical">
            {!answers && !scanning && (
              <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => runScan(photo)}>
                Распознать ответы
              </Button>
            )}
            {scanning && (
              <Space>
                <Spin size="small" />
                <Text type="secondary">Распознаю… обычно 5–10 секунд</Text>
              </Space>
            )}
            {answers && (
              <Button icon={<SyncOutlined />} onClick={() => runScan(photo)}>
                Прочитать ещё раз
              </Button>
            )}
            <Button icon={<RedoOutlined />} onClick={() => resetScan()}>
              Другое фото
            </Button>
          </Space>
        </div>
      )}

      {/* Шаг 4: проверка и запись */}
      {answers && (
        <>
          {manual && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Enter — к следующему полю, после последнего — к кнопке «Записать».
              Клик по ✓/✗ — засчитать или снять ответ вручную.
            </Text>
          )}
          {uncertainAlert}
          <Table
            size="small"
            pagination={false}
            columns={columns}
            dataSource={rows}
            rowClassName={r => (r.uncertain ? 'ant-table-row-warning' : '')}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Text strong>
                Результат: {score} из {tasks.length}
              </Text>
              {manual && (
                <Button size="small" type="link" onClick={() => resetScan()}>
                  Отмена
                </Button>
              )}
            </Space>
            <Button
              ref={saveRef}
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              Записать результат
            </Button>
          </div>
        </>
      )}
    </Space>
  );

  const body = loading ? (
    <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
  ) : !variants.length ? (
    <Alert type="warning" message="В работе нет вариантов" />
  ) : isMobile ? renderMobile() : renderDesktop();

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={isMobile
        ? <span className="sbm-title"><FileDoneOutlined /> {work?.title || 'Результаты работы'}</span>
        : <span><FileDoneOutlined /> Результаты бумажной работы — {work?.title || 'работа'}</span>}
      width={isMobile ? '100%' : 780}
      rootClassName={isMobile ? 'sbm-root sbm-root--mobile' : 'sbm-root'}
      footer={isMobile && !loading && variants.length ? mobileFooter : null}
      destroyOnHidden
    >
      {body}
    </Modal>
  );
};

export default ScanBlankModal;
