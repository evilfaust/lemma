import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Modal, Upload, Select, Input, Button, Table, Tag, Alert, Space, Spin,
  Typography, App, DatePicker, Tooltip,
} from 'antd';
import {
  CameraOutlined, CheckCircleFilled, CloseCircleFilled, MinusCircleOutlined,
  ThunderboltOutlined, SaveOutlined, RedoOutlined, EditOutlined, FileDoneOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../services/pocketbase';
import { checkAnswer } from '../../utils/answerChecker';
import { compressImage } from '../../utils/imageProcessing';
import { toStoredDate } from '../../utils/classJournal';
import MathRenderer from '../MathRenderer';

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

const readGroup = () => {
  try { return localStorage.getItem(GROUP_KEY) || null; } catch { return null; }
};
const writeGroup = (id) => {
  try {
    if (id) localStorage.setItem(GROUP_KEY, id);
    else localStorage.removeItem(GROUP_KEY);
  } catch { /* нет хранилища — не страшно */ }
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
 */
const ScanBlankModal = ({ open, work, onClose, onRecorded, scanEnabled = true }) => {
  const { message, modal } = App.useApp();

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

  const [photo, setPhoto] = useState(null);       // dataURL сжатого фото
  const [manual, setManual] = useState(false);    // ответы вписываются руками, без фото
  const [scanning, setScanning] = useState(false);
  const [scanMeta, setScanMeta] = useState(null); // { replacements, uncertain }
  const [answers, setAnswers] = useState(null);   // { [номер]: строка } — после распознавания, редактируемые
  const [overrides, setOverrides] = useState({}); // { [номер]: bool } — верно/неверно решил учитель
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const journalReady = useRef(new Set());         // классы, у которых колонка работы уже есть
  const inputRefs = useRef([]);
  const saveRef = useRef(null);

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
      setGroupId(grps.some(g => g.id === saved) ? saved : null);
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
    setPhoto(null);
    setScanMeta(null);
    setOverrides({});
    setAnswers(keepManual ? {} : null);
    if (!keepManual) setManual(false);
  }, []);

  const startManual = () => {
    setManual(true);
    setPhoto(null);
    setScanMeta(null);
    setOverrides({});
    setAnswers({});
    focusInput(0);
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
    onClose?.();
  };

  const handlePhoto = async (file) => {
    try {
      const dataUrl = await compressImage(file);
      setPhoto(dataUrl);
      setManual(false);
      setAnswers(null);
      setScanMeta(null);
      setOverrides({});
    } catch {
      message.error('Не удалось прочитать изображение');
    }
    return false; // не грузить через Upload
  };

  const handleScan = async () => {
    if (!photo) return;
    setScanning(true);
    try {
      const res = await api.scanBlank({ imageBase64: photo, tasksCount: tasks.length });
      const next = {};
      tasks.forEach((t, i) => {
        const n = i + 1;
        next[n] = res.fields?.[n] ?? res.fields?.[String(n)] ?? '';
      });
      setAnswers(next);
      setScanMeta({
        replacements: res.replacements || [],
        uncertain: (res.uncertain || []).map(Number),
      });
    } catch (err) {
      message.error(err.message || 'Ошибка распознавания');
    }
    setScanning(false);
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
      if (wasManual) focusInput(0);
      onRecorded?.();
    } catch (err) {
      console.error('Error saving scanned attempt:', err);
      message.error('Не удалось записать результат: ' + (err?.message || ''));
    }
    setSaving(false);
  };

  const columns = [
    { title: '№', dataIndex: 'n', width: 46, align: 'center' },
    {
      title: manual ? 'Ответ ученика' : 'Распознано (можно править)',
      dataIndex: 'raw',
      render: (_, r) => (
        <Input
          size="small"
          ref={el => { inputRefs.current[r.n - 1] = el; }}
          value={r.raw}
          status={r.uncertain && !r.isCorrect ? 'warning' : undefined}
          onChange={e => setAnswers(prev => ({ ...prev, [r.n]: e.target.value }))}
          onPressEnter={() => {
            if (r.n < tasks.length) focusInput(r.n);
            else saveRef.current?.focus();
          }}
          style={{ maxWidth: 140, fontFamily: 'monospace' }}
        />
      ),
    },
    {
      title: 'Эталон',
      width: 160,
      render: (_, r) => <MathRenderer text={r.task.answer || '—'} />,
    },
    {
      title: '',
      width: 120,
      align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title={r.isCorrect ? 'Засчитано. Клик — не засчитывать' : 'Не засчитано. Клик — засчитать'}>
            <span style={{ cursor: 'pointer' }} onClick={() => toggleCorrect(r)}>
              {r.empty && !r.forced
                ? <MinusCircleOutlined style={{ color: 'var(--ink-4, #999)' }} />
                : r.isCorrect
                  ? <CheckCircleFilled style={{ color: '#52c41a' }} />
                  : <CloseCircleFilled style={{ color: '#ff4d4f' }} />}
            </span>
          </Tooltip>
          {r.forced && <Tag style={{ margin: 0 }}>вручную</Tag>}
          {r.replaced && <Tag color="blue" style={{ margin: 0 }}>замена</Tag>}
          {r.uncertain && <Tag color="orange" style={{ margin: 0 }}>?</Tag>}
        </Space>
      ),
    },
  ];

  const enteredInGroup = groupId ? groupStudents.filter(s => done.has(s.id)).length : 0;

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={<span><FileDoneOutlined /> Результаты бумажной работы — {work?.title || 'работа'}</span>}
      width={780}
      footer={null}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : !variants.length ? (
        <Alert type="warning" message="В работе нет вариантов" />
      ) : (
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
              onChange={(id) => {
                setGroupId(id || null);
                writeGroup(id || null);
                setStudentId(null);
                setStudentName('');
              }}
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
              onChange={v => { setVariantId(v); resetScan(manual); if (manual) focusInput(0); }}
              options={variants.map((v, i) => ({
                value: v.id,
                label: `Вариант ${v.number || i + 1} (${(v.expand?.tasks || []).length} зад.)`,
              }))}
            />
            <Select
              style={{ minWidth: 260 }}
              showSearch
              allowClear
              placeholder={groupId ? 'Ученик класса' : 'Ученик из списка'}
              optionFilterProp="search"
              value={studentId}
              onChange={pickStudent}
              options={pickList.map(s => ({
                value: s.id,
                search: s.name,
                label: `${done.has(s.id) ? '✓ ' : ''}${s.name}${!groupId && s.student_class ? ` (${s.student_class})` : ''}`,
              }))}
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
                  beforeUpload={handlePhoto}
                >
                  <p style={{ fontSize: 32, margin: 0 }}><CameraOutlined /></p>
                  <p>…или сфотографируйте/перетащите заполненный бланк ответов №1</p>
                  <p style={{ color: 'var(--ink-3, #888)', fontSize: 12 }}>
                    Бланк целиком, при хорошем свете, без сильного наклона
                  </p>
                </Upload.Dragger>
              )}
            </Space>
          )}
          {photo && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <img
                src={photo}
                alt="бланк"
                style={{ width: 180, borderRadius: 8, border: '1px solid var(--line-2, #eee)' }}
              />
              <Space direction="vertical">
                {!answers && (
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    loading={scanning}
                    onClick={handleScan}
                  >
                    {scanning ? 'Распознаю…' : 'Распознать ответы'}
                  </Button>
                )}
                <Button icon={<RedoOutlined />} onClick={() => resetScan()} disabled={scanning}>
                  Другое фото
                </Button>
                {scanning && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Обычно 5–10 секунд
                  </Text>
                )}
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
              {scanMeta?.uncertain?.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  message={`Модель не уверена в полях: ${scanMeta.uncertain.join(', ')} — проверьте их по фото`}
                />
              )}
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
      )}
    </Modal>
  );
};

export default ScanBlankModal;
