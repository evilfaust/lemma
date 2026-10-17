import { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Checkbox, Input, Modal, Radio, Segmented, Select, Space, Spin, Switch, Tooltip, Typography,
} from 'antd';
import {
  CheckSquareOutlined, DeleteOutlined, EditOutlined, EyeOutlined, EyeInvisibleOutlined, FileTextOutlined,
  LinkOutlined, MessageOutlined, PaperClipOutlined, PlusOutlined, ReadOutlined, BorderOuterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import MaterialPickerModal from '../MaterialPickerModal';
import LessonWorkPickerModal from './LessonWorkPickerModal';
import AttemptsSetting from '../../worksheet/AttemptsSetting';
import { api } from '../../../shared/services/pocketbase';
import {
  ITEM_MODES, itemMode, withMode, defaultItemTitle, requiredOf,
} from '../../../utils/homework';
import { isTestOption, testIdOf, isGeoOption, geoIdOf, parseStudentLink } from '../../../utils/lessonMaterials';
import { buildPickerItems } from '../../../utils/lessonWorkPicker';
import {
  DELIVERIES, deliveryChoices, deliveryOf, defaultDelivery, withDelivery, hasItem, studentPreview,
  studentSection, openTarget, pickOpenSession, resultSessionIds,
} from '../../../utils/lessonItems';
import './lessonMaterials.css';

const dayLabel = (l) => (l?.date_plan ? dayjs(l.date_plan).format('D MMM, dd') : '');
const itemTitle = (m) => m.title || m.text || 'Задание';

const TYPE_META = {
  work: { icon: <FileTextOutlined />, label: 'Работа' },
  mc_test: { icon: <CheckSquareOutlined />, label: 'Тест' },
  geometry_work: { icon: <BorderOuterOutlined />, label: 'Геометрия' },
  material: { icon: <PaperClipOutlined />, label: 'Файл' },
  text: { icon: <MessageOutlined />, label: 'Текст' },
  session: { icon: <LinkOutlined />, label: 'Выдача по ссылке' },
};

const SECTION_TONE = { required: 'is-required', materials: 'is-materials', results: 'is-results' };

const deliveryOptions = (item) => deliveryChoices(item).map((d) => ({ value: d, label: DELIVERIES[d].label }));
const optionRender = (opt) => (
  <div className="lm-opt">
    <div>{DELIVERIES[opt.value]?.label}</div>
    <div className="lm-opt-hint">{DELIVERIES[opt.value]?.hint}</div>
  </div>
);

/**
 * Материалы урока — единый список (v3.9.358). Работа, тест, работа по
 * геометрии, файл и текст добавляются сюда один раз; у строки — как её
 * получит ученик (`deliver`, utils/lessonItems.js), когда (на уроке / ДЗ /
 * ДЗ к след.) и обязательно ли. Подпись под строкой говорит, что увидит
 * ученик, — «добавил, а у ученика пусто» больше не прячется.
 *
 * Пункты держит окно урока (`items`/`setItems`), здесь — правка и всё, что
 * нужно для выдачи: выдачи работ и тестов, работы по геометрии, файлы заметки.
 */
export default function LessonMaterialsEditor({
  items, setItems, loading, lessonId, works, canEdit, onOpenMaterial,
  studentFacing, isCourse, courseDone, group,
  visibleToStudents, onVisibleChange, incoming = [], nextLesson, hasNextHw,
}) {
  const { message } = App.useApp();
  const [mcTests, setMcTests] = useState([]);
  const [geoWorks, setGeoWorks] = useState([]);
  const [programWorkIds, setProgramWorkIds] = useState(() => new Set());
  const [workSessions, setWorkSessions] = useState({}); // workId → sessions[]
  const [testSessions, setTestSessions] = useState({}); // testId → sessions[]
  const [noteFiles, setNoteFiles] = useState([]);
  const [picker, setPicker] = useState(false);
  const [filePicker, setFilePicker] = useState(false);
  const [pending, setPending] = useState(null); // выбранная работа: как выдать
  const [busy, setBusy] = useState(null);       // индекс строки, для которой идёт запрос
  const [newText, setNewText] = useState('');
  const [textMode, setTextMode] = useState('hw');
  const [linkOpen, setLinkOpen] = useState(false);
  const [newLink, setNewLink] = useState({ code: '', mode: 'class' });

  const worksMap = useMemo(() => new Map((works || []).map((w) => [w.id, w.title])), [works]);
  const testsMap = useMemo(() => new Map(mcTests.map((t) => [t.id, t.title || 'Тест'])), [mcTests]);
  const geoMap = useMemo(() => new Map(geoWorks.map((w) => [w.id, w.title || 'Работа по геометрии'])), [geoWorks]);

  useEffect(() => {
    let cancelled = false;
    api.getMCTestsLight().then((l) => { if (!cancelled) setMcTests(l || []); }).catch(() => {});
    api.getGeometryWorksLight().then((l) => { if (!cancelled) setGeoWorks(l || []); }).catch(() => {});
    api.getProgramWorkIds().then((ids) => { if (!cancelled) setProgramWorkIds(ids); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Выдачи работ и тестов: какие уже выданы (окно выбора), какую взять для
  // «Решать онлайн», закрыты ли результаты.
  useEffect(() => {
    let cancelled = false;
    if (!(works || []).length) { setWorkSessions({}); return undefined; }
    api.getSessionsByWorks(works.map((w) => w.id))
      .then((sess) => {
        if (cancelled) return;
        const map = {};
        sess.forEach((s) => { (map[s.work] ||= []).push(s); });
        setWorkSessions(map);
      })
      .catch(() => { if (!cancelled) setWorkSessions({}); });
    return () => { cancelled = true; };
  }, [works]);

  useEffect(() => {
    let cancelled = false;
    if (!mcTests.length) { setTestSessions({}); return undefined; }
    api.getSessionsByMCTests(mcTests.map((t) => t.id))
      .then((sess) => {
        if (cancelled) return;
        const map = {};
        sess.forEach((x) => { (map[x.mc_test] ||= []).push(x); });
        setTestSessions(map);
      })
      .catch(() => { if (!cancelled) setTestSessions({}); });
    return () => { cancelled = true; };
  }, [mcTests]);

  useEffect(() => {
    let cancelled = false;
    if (!lessonId) { setNoteFiles([]); return undefined; }
    api.getLessonNote(lessonId)
      .then((note) => {
        if (cancelled) return;
        const links = Array.isArray(note?.links) ? note.links : [];
        setNoteFiles(links.filter((l) => l.type === 'material'));
      })
      .catch(() => { if (!cancelled) setNoteFiles([]); });
    return () => { cancelled = true; };
  }, [lessonId]);

  const pickerItems = useMemo(() => buildPickerItems({
    works, tests: mcTests, geoWorks, workSessions, testSessions, programWorkIds,
  }), [works, mcTests, geoWorks, workSessions, testSessions, programWorkIds]);

  const sessionsOf = (item) => (item.type === 'mc_test' ? testSessions[item.id] : workSessions[item.id]) || [];
  const patch = (idx, fn) => setItems((prev) => prev.map((x, i) => (i === idx ? fn(x) : x)));
  const remove = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  // «Решать онлайн»: открытая выдача работы/теста или новая (откроется по ссылке).
  const ensureOnlineSession = async (type, id, title) => {
    const open = pickOpenSession(type === 'mc_test' ? testSessions[id] : workSessions[id]);
    if (open) return open.id;
    const studentTitle = (title || '').trim() || defaultItemTitle('class');
    if (type === 'mc_test') {
      const rec = await api.createMCTestSession(id, { student_title: studentTitle });
      setTestSessions((prev) => ({ ...prev, [id]: [rec, ...(prev[id] || [])] }));
      message.success('Тест выдан: ученики откроют его из урока');
      return rec.id;
    }
    const rec = await api.createSession({ work: id, is_open: true, student_title: studentTitle });
    setWorkSessions((prev) => ({ ...prev, [id]: [rec, ...(prev[id] || [])] }));
    message.success('Работа выдана: ученики откроют её из урока');
    return rec.id;
  };

  // «Только условия»: закрытой работе показ открывается — иначе ученик
  // увидит «Работа недоступна». Классы показа не трогаются.
  const openShowSharing = async (type, id) => {
    const geo = type === 'geometry_work';
    try {
      const w = geo ? await api.getGeometryWork(id) : await api.getWork(id);
      if (w && geo && !w.public) {
        await api.setGeometryWorkSharing(id, { public: true, groups: w.groups || [] });
        message.info('Работа по геометрии открыта ученикам по ссылке');
      } else if (w && !geo && !w.show_open) {
        await api.setWorkShowSharing(id, { open: true, groups: w.show_groups || [] });
        message.info('Условия работы открыты ученикам по ссылке');
      }
    } catch (e) {
      message.warning(`Не удалось открыть работу ученикам: ${e?.message || 'ошибка'}. Откройте её вручную (${geo ? 'редактор работы → «Ученикам»' : '«Мои работы» → «Показ условий»'}).`);
    }
  };

  // Способ выдачи → пункт (с побочными действиями выдачи).
  const deliver = async (item, d) => {
    if (d === 'online' && !item.session) {
      const session = await ensureOnlineSession(item.type, item.id, item.title);
      return withDelivery(item, d, { session });
    }
    if (d === 'show') await openShowSharing(item.type, item.id);
    return withDelivery(item, d);
  };

  const changeDelivery = async (idx, d) => {
    setBusy(idx);
    try {
      const next = await deliver({ ...items[idx], session: d === 'online' ? items[idx].session : undefined }, d);
      patch(idx, () => next);
    } catch (e) {
      message.error(`Не удалось выдать: ${e?.message || 'ошибка'}`);
    } finally {
      setBusy(null);
    }
  };

  // ── добавление ───────────────────────────────────────────────────────────
  const onPickWork = (value) => {
    let type = 'work';
    let id = value;
    let title = worksMap.get(value) || '';
    if (isGeoOption(value)) { type = 'geometry_work'; id = geoIdOf(value); title = geoMap.get(id) || ''; }
    else if (isTestOption(value)) { type = 'mc_test'; id = testIdOf(value); title = testsMap.get(id) || ''; }
    if (hasItem(items, type, id)) { message.info('Эта работа уже в уроке'); return; }
    if (!studentFacing) {
      setItems((prev) => [...prev, { type, id, title }]);
      return;
    }
    setPending({ type, id, title, deliver: defaultDelivery(type), mode: 'class', required: undefined });
  };

  const commitPending = async () => {
    if (!pending) return;
    setBusy('pending');
    try {
      let item = withMode({ type: pending.type, id: pending.id, title: pending.title }, pending.mode);
      if (pending.deliver === 'paper') item = { type: pending.type, id: pending.id, title: pending.title };
      item = await deliver(item, pending.deliver);
      if (typeof pending.required === 'boolean' && pending.deliver !== 'paper' && pending.deliver !== 'none') {
        item.required = pending.required;
      }
      setItems((prev) => [...prev, item]);
      setPending(null);
    } catch (e) {
      message.error(`Не удалось добавить: ${e?.message || 'ошибка'}`);
    } finally {
      setBusy(null);
    }
  };

  const addText = () => {
    const text = newText.trim();
    if (!text) return;
    setItems((prev) => [...prev, withMode({ type: 'text', text, visible: true }, textMode)]);
    setNewText('');
  };

  // Ссылка ученику / код выдачи вручную: работа узнаётся по выдаче.
  const addLink = async () => {
    const link = parseStudentLink(newLink.code);
    if (!link) { message.warning('Не похоже на ссылку ученику или код выдачи'); return; }
    setBusy('link');
    try {
      let item;
      if (link.type === 'work_view' || link.type === 'geometry_view') {
        const type = link.type === 'geometry_view' ? 'geometry_work' : 'work';
        if (hasItem(items, type, link.id)) { message.info('Эта работа уже в уроке'); return; }
        const w = type === 'geometry_work' ? await api.getGeometryWork(link.id) : await api.getWork(link.id);
        item = await deliver({ type, id: link.id, title: (w?.title || '').trim() }, 'show');
      } else {
        const sess = await api.getSession(link.id);
        const title = (sess?.student_title || sess?.expand?.work?.title || '').trim();
        if (sess?.work || sess?.mc_test) {
          const type = sess.work ? 'work' : 'mc_test';
          const id = sess.work || sess.mc_test;
          if (items.some((m) => m.type === type && m.id === id && m.deliver === 'online' && m.session === link.id)) {
            message.info('Эта выдача уже в уроке'); return;
          }
          item = { type, id, title, deliver: 'online', session: link.id };
        } else {
          item = { type: 'session', id: link.id, title: title || defaultItemTitle(newLink.mode), visible: true };
        }
      }
      setItems((prev) => [...prev, withMode(item, newLink.mode)]);
      setNewLink({ code: '', mode: 'class' });
      setLinkOpen(false);
    } catch (e) {
      message.error(`Не удалось добавить ссылку: ${e?.message || 'ошибка'}`);
    } finally {
      setBusy(null);
    }
  };

  const showNoteFile = (m) => setItems((prev) => (hasItem(prev, 'material', m.id) ? prev
    : [...prev, { type: 'material', id: m.id, title: m.title, url: m.url, visible: true, role: 'class' }]));

  // Результаты ученикам: выключатель на все выдачи пункта.
  const toggleResults = async (idx, item, ids, hidden) => {
    setBusy(idx);
    try {
      await api.setSessionsResultsHidden(ids, hidden);
      const upd = (list) => (list || []).map((s) => (ids.includes(s.id) ? { ...s, results_hidden: hidden } : s));
      if (item.type === 'mc_test') setTestSessions((p) => ({ ...p, [item.id]: upd(p[item.id]) }));
      else setWorkSessions((p) => ({ ...p, [item.id]: upd(p[item.id]) }));
      message.success(hidden ? 'Результаты скрыты от учеников' : 'Результаты открыты ученикам');
    } catch (e) {
      message.error(e?.code === 'NO_FIELD' ? e.message : 'Не удалось изменить видимость результатов');
    } finally {
      setBusy(null);
    }
  };

  // «Несколько попыток» у онлайн-выдачи пункта (v3.9.380) — прямо в уроке
  const attemptsSaved = (item, updated) => {
    const byId = new Map((updated || []).map((x) => [x.id, x]));
    const upd = (list) => (list || []).map((x) => (byId.has(x.id) ? { ...x, max_attempts: byId.get(x.id).max_attempts } : x));
    if (item.type === 'mc_test') setTestSessions((p) => ({ ...p, [item.id]: upd(p[item.id]) }));
    else setWorkSessions((p) => ({ ...p, [item.id]: upd(p[item.id]) }));
  };

  const extraNoteFiles = noteFiles.filter((m) => !hasItem(items, 'material', m.id));

  return (
    <div className="lm">
      <div className="lm-head">
        <Typography.Text strong className="lm-title"><PaperClipOutlined /> Материалы урока</Typography.Text>
        {studentFacing && (
          <Space size={6}>
            <Typography.Text style={{ fontSize: 12 }}>Показывать урок ученикам</Typography.Text>
            <Switch size="small" checked={visibleToStudents} onChange={onVisibleChange} disabled={!canEdit} />
          </Space>
        )}
      </div>

      {studentFacing ? (
        <Typography.Paragraph type="secondary" className="lm-note">
          Всё, что нужно к уроку, — здесь. У каждого пункта выберите, как его получат
          ученики: решать онлайн, только условия, писали на бумаге (ученик увидит балл,
          когда вы внесёте результаты), посмотреть файл — или «Только мне».
          {!visibleToStudents && <b> Урок сейчас скрыт от учеников.</b>}
        </Typography.Paragraph>
      ) : (
        <Typography.Paragraph type="secondary" className="lm-note">
          {courseDone
            ? <><ReadOutlined /> Курс завершён — ученики больше не видят его уроки и ДЗ.</>
            : group
              ? <><ReadOutlined /> Ученики этого класса не видят уроки и ДЗ — материалы только для вас. Включить — «Расписание и ДЗ для учеников» в настройках класса (Мои классы → ✏️).</>
              : 'Урок без класса — материалы только для вас.'}
        </Typography.Paragraph>
      )}

      {studentFacing && incoming.length > 0 && (
        <div className="lm-incoming">
          <Typography.Text strong style={{ fontSize: 12 }}>📌 К этому уроку задано</Typography.Text>
          {incoming.map(({ item, from }, i) => (
            <div key={i} style={{ fontSize: 13 }}>
              {itemTitle(item)}{' '}
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>— на уроке {dayLabel(from)}</Typography.Text>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="lm-empty"><Spin size="small" /></div>
      ) : items.length === 0 ? (
        <div className="lm-empty">Пока пусто — добавьте работу, тест, файл{studentFacing ? ' или текст' : ''}.</div>
      ) : (
        <div className="lm-list">
          {items.map((item, idx) => (
            <MaterialRow
              key={`${item.type}:${item.id || item.text || ''}:${idx}`}
              item={item}
              studentFacing={studentFacing}
              isCourse={isCourse}
              canEdit={canEdit}
              busy={busy === idx}
              sessions={sessionsOf(item)}
              onOpen={() => { const t = openTarget(item); if (t) onOpenMaterial?.(t.id, t.type); }}
              onRemove={() => remove(idx)}
              onDelivery={(d) => changeDelivery(idx, d)}
              onMode={(v) => patch(idx, (x) => withMode(x, v))}
              onRequired={(v) => patch(idx, (x) => ({ ...x, required: v }))}
              onSession={(sid) => patch(idx, (x) => ({ ...x, session: sid }))}
              onToggleResults={(ids, hidden) => toggleResults(idx, item, ids, hidden)}
              onAttemptsSaved={(updated) => attemptsSaved(item, updated)}
            />
          ))}
        </div>
      )}

      {studentFacing && hasNextHw && (
        <Typography.Paragraph className="lm-next">
          {nextLesson
            ? <>→ «ДЗ к след.» ученики увидят у урока <b>{dayLabel(nextLesson)}</b>{nextLesson.title ? ` («${nextLesson.title}»)` : ''}.</>
            : <>→ Следующего урока в календаре пока нет — «ДЗ к след.» прикрепится к нему, когда урок появится.</>}
        </Typography.Paragraph>
      )}

      {canEdit && (
        <div className="lm-add">
          <Space wrap size={6}>
            <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={() => setPicker(true)}>
              Работа или тест
            </Button>
            <Button size="small" icon={<PaperClipOutlined />} onClick={() => setFilePicker(true)}>Файл</Button>
            {studentFacing && (
              <Button size="small" icon={<LinkOutlined />} onClick={() => setLinkOpen((v) => !v)}>Ссылка ученику</Button>
            )}
          </Space>
          {studentFacing && linkOpen && (
            <Space.Compact style={{ width: '100%', marginTop: 6 }}>
              <Input
                placeholder="Ссылка ученику (/student/…, /r/…, /w/…) или код выдачи"
                value={newLink.code}
                onChange={(e) => setNewLink((s) => ({ ...s, code: e.target.value }))}
                onPressEnter={addLink}
              />
              <Select style={{ width: 120 }} value={newLink.mode} options={ITEM_MODES}
                onChange={(v) => setNewLink((s) => ({ ...s, mode: v }))} />
              <Button icon={<PlusOutlined />} onClick={addLink} disabled={!newLink.code.trim()} loading={busy === 'link'} />
            </Space.Compact>
          )}
          {studentFacing && (
            <Space.Compact style={{ width: '100%', marginTop: 6 }}>
              <Input
                placeholder="Текст ученикам: напр. «повторить формулы сокращённого умножения»"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onPressEnter={addText}
              />
              <Select style={{ width: 120 }} value={textMode} onChange={setTextMode} options={ITEM_MODES} />
              <Button icon={<PlusOutlined />} onClick={addText} disabled={!newText.trim()} />
            </Space.Compact>
          )}
        </div>
      )}

      {extraNoteFiles.length > 0 && (
        <div className="lm-notefiles">
          <Typography.Text strong style={{ fontSize: 12 }}><FileTextOutlined /> Файлы заметки урока</Typography.Text>
          {extraNoteFiles.map((m) => (
            <div key={m.id} className="lm-notefile">
              <a href={m.url} target="_blank" rel="noreferrer">{m.title}</a>
              {studentFacing && canEdit && (
                <Button size="small" icon={<EyeOutlined style={{ color: '#52c41a' }} />} onClick={() => showNoteFile(m)}>
                  Показать ученикам
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <LessonWorkPickerModal
        open={picker}
        onClose={() => setPicker(false)}
        items={pickerItems}
        grade={group?.grade || ''}
        title="Материал урока: выбор работы или теста"
        onPick={onPickWork}
      />

      <MaterialPickerModal
        open={filePicker}
        onClose={() => setFilePicker(false)}
        existingIds={items.filter((m) => m.type === 'material').map((m) => m.id)}
        onPick={(picked) => setItems((prev) => [
          ...prev,
          ...picked.filter((p) => !hasItem(prev, 'material', p.id)),
        ])}
      />

      <DeliveryModal
        pending={pending}
        setPending={setPending}
        busy={busy === 'pending'}
        onOk={commitPending}
      />
    </div>
  );
}

/** Строка списка: что за пункт, как выдан, что увидит ученик. */
function MaterialRow({
  item, studentFacing, isCourse, canEdit, busy, sessions,
  onOpen, onRemove, onDelivery, onMode, onRequired, onSession, onToggleResults, onAttemptsSaved,
}) {
  const meta = TYPE_META[item.type] || TYPE_META.work;
  const d = deliveryOf(item, isCourse);
  const section = studentFacing ? studentSection(item, isCourse) : null;
  const choices = deliveryOptions(item);
  const openable = !!openTarget(item);
  const isFile = item.type === 'material';
  const isText = item.type === 'text';
  const visible = !!section;
  const resultIds = resultSessionIds(item, sessions);
  const resultSessions = sessions.filter((s) => resultIds.includes(s.id));
  const resultsHidden = resultSessions.length > 0 && resultSessions.every((s) => s.results_hidden);
  const legacyOnline = item.type === 'session';
  const title = isText ? item.text : (item.title || meta.label);

  return (
    <div className={`lm-row ${section ? SECTION_TONE[section] : 'is-teacher'}`}>
      <div className="lm-row-top">
        <span className="lm-icon">{meta.icon}</span>
        <span className="lm-row-title">
          {isFile && item.url
            ? <a href={item.url} target="_blank" rel="noreferrer">{title}</a>
            : openable
              ? <button type="button" className="lm-link" onClick={onOpen} title="Открыть в редакторе">{title}</button>
              : title}
          <span className="lm-type">{meta.label}</span>
        </span>
        <Space size={2}>
          {openable && (
            <Tooltip title="Открыть: выдача · результаты · работа над ошибками">
              <Button size="small" type="text" icon={<EditOutlined />} onClick={onOpen} />
            </Tooltip>
          )}
          {canEdit && (
            <Tooltip title="Убрать из урока">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
            </Tooltip>
          )}
        </Space>
      </div>

      {studentFacing && (
        <div className="lm-row-controls">
          {choices.length > 1 ? (
            <Select
              size="small"
              className="lm-deliver"
              value={d}
              options={choices}
              optionRender={optionRender}
              popupMatchSelectWidth={260}
              onChange={onDelivery}
              disabled={!canEdit || busy}
              loading={busy}
              prefix={visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            />
          ) : (
            <span className="lm-deliver-fixed">{DELIVERIES[d]?.label || (legacyOnline ? 'Решать онлайн' : '')}</span>
          )}
          {visible && d !== 'paper' && (
            <Segmented size="small" value={itemMode(item)} options={ITEM_MODES} disabled={!canEdit} onChange={onMode} />
          )}
          {visible && d !== 'paper' && (
            <Checkbox checked={requiredOf(item)} disabled={!canEdit} onChange={(e) => onRequired(e.target.checked)}>
              обязательно
            </Checkbox>
          )}
          {d === 'online' && !legacyOnline && sessions.length > 1 && (
            <Select
              size="small"
              className="lm-session"
              value={item.session || undefined}
              onChange={onSession}
              disabled={!canEdit}
              options={sessions.map((s) => ({
                value: s.id,
                label: `выдача от ${dayjs(s.created).format('DD.MM.YYYY')}${s.is_open ? ' · открыта' : ' · закрыта'}`,
              }))}
            />
          )}
          {(d === 'online' || d === 'paper') && resultSessions.length > 0 && (
            <Space size={4} className="lm-results">
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>результаты ученикам</Typography.Text>
              <Switch
                size="small"
                checked={!resultsHidden}
                checkedChildren="видны"
                unCheckedChildren="скрыты"
                disabled={!canEdit || busy}
                onChange={(on) => onToggleResults(resultIds, !on)}
              />
            </Space>
          )}
          {d === 'online' && resultSessions.length > 0 && (
            <Space size={4} className="lm-results">
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>попытки</Typography.Text>
              <AttemptsSetting compact sessions={resultSessions} onSaved={onAttemptsSaved} disabled={!canEdit || busy} />
            </Space>
          )}
          {d === 'paper' && resultSessions.length === 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              результаты ещё не внесены («Мои работы» → 📷)
            </Typography.Text>
          )}
        </div>
      )}

      {studentFacing && (
        <div className={`lm-preview${visible ? '' : ' is-hidden'}`}>{studentPreview(item, { isCourse, studentFacing })}</div>
      )}
    </div>
  );
}

/** Только что выбранная работа: как её получат ученики. */
function DeliveryModal({ pending, setPending, busy, onOk }) {
  if (!pending) return null;
  const choices = deliveryChoices({ type: pending.type });
  const draft = { type: pending.type, deliver: pending.deliver === 'none' ? undefined : pending.deliver, role: pending.mode === 'class' ? 'class' : 'homework' };
  const required = typeof pending.required === 'boolean' ? pending.required : requiredOf(draft);
  const showWhen = pending.deliver !== 'paper' && pending.deliver !== 'none';
  return (
    <Modal
      open
      title={`Как ученики получат «${pending.title || TYPE_META[pending.type]?.label}»?`}
      okText="Добавить в урок"
      cancelText="Отмена"
      onOk={onOk}
      confirmLoading={busy}
      onCancel={() => setPending(null)}
      width={480}
    >
      <Radio.Group
        className="lm-choice"
        value={pending.deliver}
        onChange={(e) => setPending((p) => ({ ...p, deliver: e.target.value }))}
      >
        {choices.map((c) => (
          <Radio key={c} value={c} className="lm-choice-item">
            <div className="lm-choice-label">{DELIVERIES[c].label}</div>
            <div className="lm-choice-hint">
              {c === 'online' && pending.type !== 'geometry_work'
                ? 'Выдача по ссылке, ответы проверяются сразу. Нет открытой выдачи — она создастся.'
                : DELIVERIES[c].hint}
            </div>
          </Radio>
        ))}
      </Radio.Group>
      {showWhen && (
        <div className="lm-choice-when">
          <Segmented
            value={pending.mode}
            options={ITEM_MODES}
            onChange={(v) => setPending((p) => ({ ...p, mode: v }))}
          />
          <Checkbox checked={required} onChange={(e) => setPending((p) => ({ ...p, required: e.target.checked }))}>
            обязательно сделать
          </Checkbox>
        </div>
      )}
    </Modal>
  );
}
