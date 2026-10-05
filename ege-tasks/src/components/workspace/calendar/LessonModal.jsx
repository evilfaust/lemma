import { useEffect, useMemo, useState } from 'react';
import {
  Button, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Switch, Tag, Tooltip, Typography,
} from 'antd';
import {
  FileTextOutlined, LinkOutlined, PaperClipOutlined, DeleteOutlined, DownloadOutlined,
  EyeOutlined, EyeInvisibleOutlined, VideoCameraOutlined, PlusOutlined, ReadOutlined, RetweetOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import MaterialPickerModal from '../MaterialPickerModal';
import AttendanceRoster from '../AttendanceRoster';
import LessonJournalBlock from './LessonJournalBlock';
import { Chip, GroupColorPicker } from '../ui';
import { PAIRS, guessSlot, slotRangeFromCode, lessonStart } from '../lessonTime';
import { groupOptions, resolveGroup } from './calendarUtils';
import LessonAccessBar from './LessonAccessBar';
import DateTimeField from './DateTimeField';
import useIsMobile from '../../../hooks/useIsMobile';
import { api } from '../../../shared/services/pocketbase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  ITEM_MODES, itemMode, withMode, materialVisible, isNextDue, nextLessonFor, incomingFor,
  studentFacing as groupFacesStudents,
} from '../../../utils/homework';
import { testOption, isTestOption, testIdOf } from '../../../utils/lessonMaterials';

const dayLabel = (l) => (l?.date_plan ? dayjs(l.date_plan).format('D MMM, dd') : '');
const itemTitle = (m) => m.title || m.text || 'Задание';

/**
 * Полная форма урока (создание/правка) + посещаемость + материалы + заметка.
 * Вынесена из TeacherCalendar без изменения поведения (редизайн календаря v3.9.108).
 */
export default function LessonModal({
  open, initial, groups, works, onSave, onDelete, onCancel, onOpenNote, onOpenMaterial, onRepeat, saving, canEdit,
}) {
  const [form] = Form.useForm();
  const isMobile = useIsMobile();
  const materialIds = Form.useWatch('materials', form) || [];
  const watchedGroup = Form.useWatch('group', form);
  const worksMap = useMemo(() => new Map((works || []).map((w) => [w.id, w.title])), [works]);
  const selectedGroup = useMemo(
    // Группа прошлого года в списки пикеров не попадает — берём из самой записи.
    () => resolveGroup(groups, watchedGroup, initial?.expand?.group),
    [groups, watchedGroup, initial],
  );
  const isCourse = selectedGroup?.kind === 'course';
  // Урок видят ученики: курс — пока не завершён, класс — если учитель открыл
  // ему расписание (teaching_groups.student_schedule, v3.9.291).
  const studentFacing = groupFacesStudents(selectedGroup);
  const courseDone = isCourse && !!selectedGroup?.completed;
  const { teacher } = useAuth();
  const watchedDate = Form.useWatch('date_plan', form);
  const watchedStatus = Form.useWatch('status', form);
  const [fileMaterials, setFileMaterials] = useState([]);
  const [sessionItems, setSessionItems] = useState([]); // ДЗ/тесты: ссылки на выданные сессии
  const [textItems, setTextItems] = useState([]);        // текстовые задания/объявления
  const [geoItems, setGeoItems] = useState([]);          // работы раздела «Геометрия»
  const [visibleToStudents, setVisibleToStudents] = useState(true);
  const [neighbours, setNeighbours] = useState([]); // уроки класса вокруг — для ДЗ «к след.»
  const [newText, setNewText] = useState('');
  const [textMode, setTextMode] = useState('hw');
  // Пикер ДЗ-работы: работы с выданными сессиями.
  const [workSessions, setWorkSessions] = useState({}); // workId -> sessions[]
  // Тесты (из генераторов и с выбором ответа, v3.9.299) — наравне с работами:
  // материал урока для учителя и задание-ссылка для учеников
  const [mcTests, setMcTests] = useState([]);
  const [testSessions, setTestSessions] = useState({}); // testId -> sessions[]
  const [hw, setHw] = useState({ work: undefined, test: undefined, session: undefined, title: '', mode: 'hw' });
  const testsMap = useMemo(() => new Map(mcTests.map((t) => [t.id, t.title || 'Тест'])), [mcTests]);
  // Название теста, пока список тестов ещё грузится, — из самого урока
  const savedTitle = (id) => (initial?.materials || []).find((m) => m.type === 'mc_test' && m.id === id)?.title || '';
  const workAndTestOptions = useMemo(() => {
    const workOpts = (works || []).map((w) => ({ value: w.id, label: w.title }));
    if (!mcTests.length) return workOpts;
    return [
      { label: 'Работы', options: workOpts },
      { label: 'Тесты', options: mcTests.map((t) => ({ value: testOption(t.id), label: t.title || 'Тест' })) },
    ];
  }, [works, mcTests]);
  const [hwBusy, setHwBusy] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [newLink, setNewLink] = useState({ title: '', code: '', mode: 'hw' });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noteFiles, setNoteFiles] = useState([]);
  const [mode, setMode] = useState('single');
  const [pair, setPair] = useState(null);
  const [part, setPart] = useState('full');
  const [endPair, setEndPair] = useState(null);

  useEffect(() => {
    if (open) {
      const all = Array.isArray(initial?.materials) ? initial.materials : [];
      const startDate = initial?.date_plan ? dayjs(lessonStart(initial))
        : (initial?.slotDate ? dayjs(initial.slotDate) : dayjs());
      form.setFieldsValue({
        title: initial?.title || '',
        group: initial?.group || undefined,
        color: initial?.color || '',
        date_plan: startDate,
        status: initial?.status || 'planned',
        conference_url: initial?.conference_url || '',
        materials: [
          ...all.filter((m) => m.type === 'work').map((m) => m.id),
          ...all.filter((m) => m.type === 'mc_test').map((m) => testOption(m.id)),
        ],
      });
      setFileMaterials(all.filter((m) => m.type === 'material'));
      setSessionItems(all.filter((m) => m.type === 'session'));
      setTextItems(all.filter((m) => m.type === 'text'));
      setGeoItems(all.filter((m) => m.type === 'geometry_work'));
      const ts = initial?.time_slot || '';
      const inten = /^(\d)-(\d)$/.exec(ts);
      const half = /^(\d)([ab])$/.exec(ts);
      if (inten) { setMode('intensive'); setPair(inten[1]); setEndPair(inten[2]); setPart('full'); }
      else if (half) { setMode('single'); setPair(half[1]); setPart(half[2] === 'a' ? '1' : '2'); setEndPair(null); }
      else if (ts && PAIRS.some((p) => p.key === ts)) { setMode('single'); setPair(ts); setPart('full'); setEndPair(null); }
      else if (initial?.slotPair) { setMode('single'); setPair(initial.slotPair); setPart('full'); setEndPair(null); }
      else { const g = guessSlot(startDate.toDate()); setMode('single'); setPair(g.pair); setPart(g.part); setEndPair(null); }
    }
  }, [open, initial, form]);

  // Флаг «показывать ученикам» живёт в самом уроке (до v3.9.291 — в витрине курса).
  useEffect(() => {
    if (!open) return;
    setVisibleToStudents(!initial?.hidden_from_students);
    setNewLink({ title: '', code: '', mode: 'hw' });
    setNewText('');
    setTextMode('hw');
    setHw({ work: undefined, test: undefined, session: undefined, title: '', mode: 'hw' });
    setManualMode(false);
  }, [open, initial]);

  useEffect(() => {
    let cancelled = false;
    if (!open) return undefined;
    api.getMCTestsLight()
      .then((list) => { if (!cancelled) setMcTests(list); })
      .catch(() => { if (!cancelled) setMcTests([]); });
    return () => { cancelled = true; };
  }, [open]);

  // Уроки того же класса вокруг этого: куда уйдёт ДЗ «к следующему» и что
  // задали к этому уроку раньше. Окно — от даты урока при открытии.
  const groupId = selectedGroup?.id;
  useEffect(() => {
    let cancelled = false;
    if (!open || !groupId || !studentFacing) { setNeighbours([]); return undefined; }
    const base = initial?.date_plan ? dayjs(initial.date_plan) : dayjs();
    api.getLessons({
      groupId,
      from: base.subtract(60, 'day').toISOString(),
      to: base.add(120, 'day').toISOString(),
    })
      .then((list) => { if (!cancelled) setNeighbours(list); })
      .catch(() => { if (!cancelled) setNeighbours([]); });
    return () => { cancelled = true; };
  }, [open, groupId, studentFacing, initial?.date_plan]);

  // Сессии работ — для пикера ДЗ (только работы с выданной сессией можно дать ученику).
  useEffect(() => {
    let cancelled = false;
    if (!open || !studentFacing || !(works || []).length) { setWorkSessions({}); return undefined; }
    api.getSessionsByWorks(works.map((w) => w.id))
      .then((sess) => {
        if (cancelled) return;
        const map = {};
        sess.forEach((s) => { (map[s.work] ||= []).push(s); });
        setWorkSessions(map);
      })
      .catch(() => { if (!cancelled) setWorkSessions({}); });
    return () => { cancelled = true; };
  }, [open, studentFacing, works]);

  // Выдачи тестов — для пикера задания ученикам (как сессии работ выше)
  useEffect(() => {
    let cancelled = false;
    if (!open || !studentFacing || !mcTests.length) { setTestSessions({}); return undefined; }
    api.getSessionsByMCTests(mcTests.map((t) => t.id))
      .then((sess) => {
        if (cancelled) return;
        const map = {};
        sess.forEach((x) => { (map[x.mc_test] ||= []).push(x); });
        setTestSessions(map);
      })
      .catch(() => { if (!cancelled) setTestSessions({}); });
    return () => { cancelled = true; };
  }, [open, studentFacing, mcTests]);

  useEffect(() => {
    let cancelled = false;
    if (!open || !initial?.id) { setNoteFiles([]); return undefined; }
    api.getLessonNote(initial.id)
      .then((note) => {
        if (cancelled) return;
        const links = Array.isArray(note?.links) ? note.links : [];
        setNoteFiles(links.filter((l) => l.type === 'material'));
      })
      .catch(() => { if (!cancelled) setNoteFiles([]); });
    return () => { cancelled = true; };
  }, [open, initial?.id]);

  const setStartTime = (str) => {
    const [h, m] = str.split(':').map(Number);
    const cur = form.getFieldValue('date_plan') || dayjs();
    form.setFieldsValue({ date_plan: dayjs(cur).hour(h).minute(m).second(0).millisecond(0) });
  };

  const applySlot = (p, prt) => {
    setPair(p);
    setPart(prt);
    if (!p) return;
    const def = PAIRS.find((x) => x.key === p);
    if (def) setStartTime((p === '0' || prt === 'full') ? def.full[0] : (prt === '1' ? def.halves[0][0] : def.halves[1][0]));
  };

  const applyIntensive = (s, e) => {
    setPair(s);
    setEndPair(e);
    if (!s) return;
    const def = PAIRS.find((x) => x.key === s);
    if (def) setStartTime(def.full[0]);
  };

  const currentSlotCode = () => {
    if (mode === 'intensive') {
      if (!pair || !endPair || Number(endPair) <= Number(pair)) return '';
      return `${pair}-${endPair}`;
    }
    if (!pair) return '';
    if (pair === '0' || part === 'full') return pair;
    return pair + (part === '1' ? 'a' : 'b');
  };

  const slotRange = slotRangeFromCode(currentSlotCode());
  const intensiveCount = (mode === 'intensive' && pair && endPair && Number(endPair) > Number(pair))
    ? Number(endPair) - Number(pair) + 1 : 0;

  const handleFinish = (v) => {
    onSave({
      title: v.title,
      group: v.group || '',
      // Свой цвет — только у урока без класса: с классом урок красится им.
      color: v.group ? '' : (v.color || ''),
      date_plan: v.date_plan ? v.date_plan.toISOString() : dayjs().toISOString(),
      status: v.status || 'planned',
      time_slot: currentSlotCode(),
      conference_url: (v.conference_url || '').trim(),
      hidden_from_students: !visibleToStudents,
      materials: [
        ...(v.materials || []).map((id) => (isTestOption(id)
          ? { type: 'mc_test', id: testIdOf(id), title: testsMap.get(testIdOf(id)) || savedTitle(testIdOf(id)) }
          : { type: 'work', id, title: worksMap.get(id) || '' })),
        ...fileMaterials,
        ...sessionItems,
        ...textItems,
        ...geoItems,
      ],
    });
  };

  // Извлечь код сессии из ссылки или взять как есть (15-символьный id).
  const parseSessionCode = (raw) => {
    const s = (raw || '').trim();
    const m = s.match(/\/student\/([a-z0-9]{6,})/i);
    return m ? m[1] : s;
  };
  const addSessionItem = () => {
    const id = parseSessionCode(newLink.code);
    if (!id) return;
    setSessionItems((prev) => [
      ...prev,
      withMode({ type: 'session', id, title: (newLink.title || '').trim() || 'Домашняя работа', visible: true }, newLink.mode),
    ]);
    setNewLink({ title: '', code: '', mode: 'hw' });
  };
  const addTextItem = () => {
    const text = (newText || '').trim();
    if (!text) return;
    setTextItems((prev) => [...prev, withMode({ type: 'text', text, visible: true }, textMode)]);
    setNewText('');
  };
  // Выбор работы из списка. Если у работы уже есть сессия — берём её; иначе
  // сессия будет выдана при нажатии «Добавить».
  const selectHwWork = (value) => {
    if (isTestOption(value)) {
      const testId = testIdOf(value);
      const sess = testSessions[testId] || [];
      setHw((s) => ({ ...s, work: undefined, test: testId, session: sess[0]?.id, title: testsMap.get(testId) || '' }));
      return;
    }
    const sess = workSessions[value] || [];
    setHw((s) => ({ ...s, work: value, test: undefined, session: sess[0]?.id, title: worksMap.get(value) || '' }));
  };
  const hwValue = hw.test ? testOption(hw.test) : hw.work;
  const hwSessions = hw.test ? (testSessions[hw.test] || []) : (workSessions[hw.work] || []);
  const hwSourceTitle = hw.test ? testsMap.get(hw.test) : worksMap.get(hw.work);
  const addHwFromWork = async () => {
    if (!hw.work && !hw.test) return;
    setHwBusy(true);
    try {
      let sessionId = hw.session;
      // Нет выданной сессии → выдаём работу (тест) ученикам (открытая сессия).
      if (!sessionId) {
        const title = (hw.title || '').trim() || hwSourceTitle || 'Домашняя работа';
        if (hw.test) {
          const rec = await api.createMCTestSession(hw.test, { student_title: title });
          sessionId = rec.id;
          setTestSessions((prev) => ({ ...prev, [hw.test]: [rec, ...(prev[hw.test] || [])] }));
        } else {
          const rec = await api.createSession({ work: hw.work, is_open: true, student_title: title });
          sessionId = rec.id;
          setWorkSessions((prev) => ({ ...prev, [hw.work]: [rec, ...(prev[hw.work] || [])] }));
        }
      }
      setSessionItems((prev) => [
        ...prev,
        withMode({ type: 'session', id: sessionId, title: (hw.title || '').trim() || hwSourceTitle || 'Работа', visible: true }, hw.mode),
      ]);
      setHw({ work: undefined, test: undefined, session: undefined, title: '', mode: 'hw' });
    } catch (e) {
      console.error('addHwFromWork', e?.message);
    } finally {
      setHwBusy(false);
    }
  };
  // Перенести файл из заметки в «Файлы из Библиотеки» (там есть глаз/роль → публикуется).
  const showNoteFileToStudents = (m) => {
    setFileMaterials((prev) => (prev.some((x) => x.id === m.id)
      ? prev
      : [...prev, { type: 'material', id: m.id, title: m.title, url: m.url, visible: true, role: 'class' }]));
  };
  // Переключатели видимости/роли для файла из Библиотеки.
  const patchFile = (id, patch) => setFileMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const setFileMode = (id, mode) => setFileMaterials((prev) => prev.map((m) => (m.id === id ? withMode(m, mode) : m)));

  // ДЗ «к следующему уроку»: куда уйдёт и что пришло к этому уроку.
  const owner = initial?.owner || teacher?.id || '';
  const draft = watchedDate && groupId
    ? { id: initial?.id, group: groupId, owner, date_plan: dayjs(watchedDate).toISOString(), status: watchedStatus }
    : null;
  const hasNextHw = [...fileMaterials, ...sessionItems, ...textItems].some(isNextDue);
  const nextLesson = studentFacing && draft && hasNextHw ? nextLessonFor(draft, neighbours) : null;
  const incoming = studentFacing && draft
    // Скрытый от учеников урок своих ДЗ ученикам не показывает — и здесь их нет.
    ? incomingFor(draft, neighbours, (l) => (l.hidden_from_students ? [] : (l.materials || []).filter((m) => materialVisible(m, isCourse))))
    : [];

  const editingExisting = initial?.id;

  return (
    <Modal
      open={open}
      title={editingExisting ? 'Урок' : 'Новый урок'}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Сохранить"
      cancelText="Отмена"
      okButtonProps={{ disabled: !canEdit }}
      width={studentFacing ? 720 : 560}
      destroyOnHidden
      style={isMobile ? { top: 12 } : undefined}
      footer={(_, { OkBtn, CancelBtn }) => (
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space>
            {editingExisting && canEdit && (
              <Popconfirm title="Удалить урок?" okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }} onConfirm={onDelete}>
                <Button danger>Удалить</Button>
              </Popconfirm>
            )}
            {editingExisting && canEdit && onRepeat && (
              <Button icon={<RetweetOutlined />} onClick={() => onRepeat(initial)} title="Запланировать серию занятий по расписанию">
                Повторить серию
              </Button>
            )}
          </Space>
          <Space><CancelBtn /><OkBtn /></Space>
        </Space>
      )}
    >
      <LessonAccessBar lesson={initial} canEdit={canEdit} onShared={() => {}} />

      <Form form={form} layout="vertical" onFinish={handleFinish} style={{ marginTop: 8 }} disabled={!canEdit}>
        <Form.Item name="title" label="Тема урока" rules={[{ required: true, message: 'Введите тему' }]}>
          {/* Открыли существующий урок — клавиатура на телефоне не нужна */}
          <Input placeholder="Тема урока" maxLength={500} autoFocus={!initial?.id} />
        </Form.Item>
        <Space size="large" style={{ display: 'flex' }} wrap={isMobile}>
          <Form.Item name="group" label="Группа" style={{ flex: 1, minWidth: isMobile ? 200 : undefined }}>
            <Select allowClear placeholder="Группа" options={groupOptions(groups, initial?.expand?.group)} />
          </Form.Item>
          <Form.Item name="status" label="Статус" style={{ flex: 1 }}>
            <Select options={[
              { value: 'planned', label: 'Запланирован' },
              { value: 'done', label: 'Проведён' },
              { value: 'cancelled', label: 'Отменён' },
            ]} />
          </Form.Item>
        </Space>
        <LessonColorField form={form} />
        <Form.Item label="Время по расписанию" style={{ marginBottom: 8 }}>
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Segmented value={mode}
              onChange={(m) => {
                setMode(m);
                if (m === 'intensive') { if (pair) applyIntensive(pair, endPair); }
                else if (pair) applySlot(pair, part);
              }}
              options={[
                { value: 'single', label: 'Пара' },
                { value: 'intensive', label: 'Интенсив (2–4 пары)' },
              ]} />
            {mode === 'single' ? (
              <Space wrap>
                <Select allowClear placeholder="— своё время —" style={{ width: 150 }}
                  value={pair ?? undefined}
                  onChange={(v) => applySlot(v ?? null, v === '0' ? 'full' : part)}
                  options={PAIRS.map((p) => ({ value: p.key, label: p.label }))} />
                <Segmented value={part} disabled={!pair || pair === '0'}
                  onChange={(v) => applySlot(pair, v)}
                  options={[
                    { value: 'full', label: 'Вся пара' },
                    { value: '1', label: '1-я пол.' },
                    { value: '2', label: '2-я пол.' },
                  ]} />
                {slotRange && <Chip tone="blue" dot={false}>{slotRange[0]}–{slotRange[1]}</Chip>}
              </Space>
            ) : (
              <Space wrap>
                <Select placeholder="с пары" style={{ width: 130 }} value={pair ?? undefined}
                  onChange={(v) => applyIntensive(v ?? null, endPair)}
                  options={PAIRS.map((p) => ({ value: p.key, label: p.label }))} />
                <span>→</span>
                <Select placeholder="по пару" style={{ width: 130 }} value={endPair ?? undefined}
                  onChange={(v) => applyIntensive(pair, v ?? null)}
                  options={PAIRS.map((p) => ({ value: p.key, label: p.label }))} />
                {slotRange && (
                  <Chip tone="violet" dot={false}>{slotRange[0]}–{slotRange[1]} · {intensiveCount} пары</Chip>
                )}
                {pair && endPair && Number(endPair) <= Number(pair) && (
                  <Typography.Text type="danger" style={{ fontSize: 12 }}>конец должен быть позже начала</Typography.Text>
                )}
              </Space>
            )}
          </Space>
        </Form.Item>
        <Form.Item name="date_plan" label="Дата и время" rules={[{ required: true }]}>
          <DateTimeField
            onChange={(d) => { if (d) { const g = guessSlot(d.toDate()); setPair(g.pair); setPart(g.part); } }} />
        </Form.Item>
        <Form.Item name="materials" label="Материалы урока (работы и тесты)">
          <Select
            mode="multiple"
            allowClear
            placeholder="Привязать работы и тесты к уроку"
            optionFilterProp="label"
            options={workAndTestOptions}
          />
        </Form.Item>
        {geoItems.length > 0 && (
          <Form.Item label="Работы по геометрии" tooltip="Прикрепляются из редактора геометрической работы">
            <Space wrap size={4}>
              {geoItems.map((m) => (
                <Tag
                  key={m.id}
                  color="geekblue"
                  closable={canEdit}
                  onClose={(e) => { e.preventDefault(); setGeoItems((list) => list.filter((x) => x.id !== m.id)); }}
                  style={{ cursor: 'pointer', margin: 0 }}
                  onClick={() => onOpenMaterial?.(m.id, m.type)}
                >
                  {m.title || 'Работа по геометрии'}
                </Tag>
              ))}
            </Space>
          </Form.Item>
        )}
        {isCourse && (
          <Form.Item
            name="conference_url"
            label="Ссылка на конференцию (этого занятия)"
            tooltip="Пусто → используется постоянная комната курса. Видна ученикам курса."
          >
            <Input
              prefix={<VideoCameraOutlined />}
              allowClear
              placeholder={selectedGroup?.conference_url ? `по умолчанию: ${selectedGroup.conference_url}` : 'https://telemost.yandex.ru/j/...'}
              maxLength={1000}
            />
          </Form.Item>
        )}
      </Form>

      <div style={{ margin: '4px 0 12px', paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
        {editingExisting ? (
          <AttendanceRoster lessonId={initial.id} groupId={watchedGroup} canEdit={canEdit} isCourse={isCourse} />
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Сохраните урок, чтобы отметить посещаемость.
          </Typography.Text>
        )}
      </div>

      {editingExisting && initial.group && (
        <div style={{ margin: '0 0 12px', paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
          {/* Сохранённый класс урока, а не значение формы: журнал ведётся по нему. */}
          <LessonJournalBlock lessonId={initial.id} groupId={initial.group} canEdit={canEdit} />
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 4 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            <PaperClipOutlined /> Файлы из Библиотеки
          </Typography.Text>
          {canEdit && (
            <Button size="small" icon={<PaperClipOutlined />} onClick={() => setPickerOpen(true)}>
              Прикрепить
            </Button>
          )}
        </Space>
        {fileMaterials.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Нет прикреплённых файлов</Typography.Text>
        ) : (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            {fileMaterials.map((m) => (
              <Space key={m.id} style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                <a href={m.url} target="_blank" rel="noreferrer">
                  <DownloadOutlined /> {m.title}
                </a>
                <Space size={4}>
                  {studentFacing && canEdit && (
                    <>
                      <Segmented
                        size="small"
                        value={itemMode(m)}
                        onChange={(v) => setFileMode(m.id, v)}
                        options={ITEM_MODES}
                      />
                      <Tooltip title={materialVisible(m, isCourse) ? 'Виден ученикам' : 'Скрыт от учеников'}>
                        <Button
                          size="small"
                          type="text"
                          icon={materialVisible(m, isCourse) ? <EyeOutlined style={{ color: '#52c41a' }} /> : <EyeInvisibleOutlined />}
                          onClick={() => patchFile(m.id, { visible: !materialVisible(m, isCourse) })}
                        />
                      </Tooltip>
                    </>
                  )}
                  {canEdit && (
                    <Button size="small" type="text" danger icon={<DeleteOutlined />}
                      onClick={() => setFileMaterials((prev) => prev.filter((x) => x.id !== m.id))} />
                  )}
                </Space>
              </Space>
            ))}
          </Space>
        )}
      </div>

      {courseDone && (
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '0 0 12px' }}>
          <ReadOutlined /> Курс завершён — ученики больше не видят его уроки и ДЗ.
        </Typography.Paragraph>
      )}
      {selectedGroup && !studentFacing && !courseDone && (
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '0 0 12px' }}>
          <ReadOutlined /> Ученики этого класса не видят уроки и ДЗ. Включить — «Расписание и ДЗ
          для учеников» в настройках класса (Мои классы → ✏️).
        </Typography.Paragraph>
      )}

      {studentFacing && (
        <div style={{ margin: '4px 0 12px', padding: '10px 12px', borderRadius: 8, background: 'rgba(114,46,209,0.06)', border: '1px solid rgba(114,46,209,0.18)' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }} wrap>
            <Typography.Text strong style={{ fontSize: 13 }}>
              <ReadOutlined /> Для учеников {isCourse ? 'курса' : 'класса'}
            </Typography.Text>
            <Space size={6}>
              <Typography.Text style={{ fontSize: 12 }}>Показывать ученикам</Typography.Text>
              <Switch size="small" checked={visibleToStudents} onChange={setVisibleToStudents} disabled={!canEdit} />
            </Space>
          </Space>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 10 }}>
            Ученики увидят тему, время{isCourse ? ', ссылку на конференцию' : ''} и отмеченные материалы.
            Файлы из Библиотеки помечайте <EyeOutlined style={{ color: '#52c41a' }} /> (виден)
            {isCourse ? '' : ' — в классе файл по умолчанию скрыт'}. «ДЗ» — к этому уроку,
            «ДЗ к след.» — ученики увидят его у следующего урока, даже если его ещё нет в календаре.
          </Typography.Paragraph>

          {incoming.length > 0 && (
            <div style={{ marginBottom: 10, padding: '6px 8px', borderRadius: 6, background: '#fff7e6' }}>
              <Typography.Text strong style={{ fontSize: 12 }}>📌 К этому уроку задано</Typography.Text>
              {incoming.map(({ item, from }, i) => (
                <div key={i} style={{ fontSize: 13 }}>
                  {itemTitle(item)}{' '}
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>— на уроке {dayLabel(from)}</Typography.Text>
                </div>
              ))}
            </div>
          )}
          {hasNextHw && (
            <Typography.Paragraph style={{ fontSize: 12, marginBottom: 10 }}>
              {nextLesson
                ? <>→ «ДЗ к след.» ученики увидят у урока <b>{dayLabel(nextLesson)}</b>{nextLesson.title ? ` («${nextLesson.title}»)` : ''}.</>
                : <>→ Следующего урока в календаре пока нет — «ДЗ к след.» прикрепится к нему, когда урок появится.</>}
            </Typography.Paragraph>
          )}

          {/* ДЗ / тесты — ссылки на выданные сессии */}
          <Typography.Text strong style={{ fontSize: 12 }}>Задания-ссылки (ДЗ / тесты)</Typography.Text>
          {sessionItems.length > 0 && (
            <Space direction="vertical" size={2} style={{ width: '100%', margin: '4px 0' }}>
              {sessionItems.map((it, idx) => (
                <Space key={`${it.id}-${idx}`} style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                  <span>
                    <LinkOutlined /> {it.title}{' '}
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>/student/{it.id}</Typography.Text>
                  </span>
                  <Space size={4}>
                    <Segmented size="small" value={itemMode(it)} options={ITEM_MODES} disabled={!canEdit}
                      onChange={(v) => setSessionItems((prev) => prev.map((x, i) => (i === idx ? withMode(x, v) : x)))} />
                    {canEdit && (
                      <Button size="small" type="text" danger icon={<DeleteOutlined />}
                        onClick={() => setSessionItems((prev) => prev.filter((_, i) => i !== idx))} />
                    )}
                  </Space>
                </Space>
              ))}
            </Space>
          )}
          {canEdit && !manualMode && (
            <div style={{ marginTop: 6 }}>
              <Space.Compact style={{ width: '100%' }}>
                <Select
                  showSearch
                  style={{ flex: 1 }}
                  placeholder="Выберите работу или тест…"
                  optionFilterProp="label"
                  value={hwValue}
                  onChange={selectHwWork}
                  notFoundContent="Нет работ"
                  options={workAndTestOptions}
                />
                <Select
                  style={{ width: 120 }}
                  value={hw.mode}
                  onChange={(v) => setHw((s) => ({ ...s, mode: v }))}
                  options={ITEM_MODES}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={addHwFromWork} disabled={!hw.work && !hw.test} loading={hwBusy}>
                  Добавить
                </Button>
              </Space.Compact>
              {hwValue && hwSessions.length > 1 && (
                <Select
                  size="small"
                  style={{ width: '100%', marginTop: 6 }}
                  value={hw.session}
                  onChange={(v) => setHw((s) => ({ ...s, session: v }))}
                  options={hwSessions.map((sess) => ({
                    value: sess.id,
                    label: `выдача от ${dayjs(sess.created).format('DD.MM.YYYY')}${sess.is_open ? ' · открыта' : ''}`,
                  }))}
                />
              )}
              {hwValue && !hwSessions.length && (
                <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                  {hw.test ? 'У этого теста' : 'У этой работы'} ещё нет выдачи — при добавлении она будет автоматически выдана (откроется доступ по ссылке).
                </Typography.Text>
              )}
              <Typography.Link style={{ fontSize: 11 }} onClick={() => setManualMode(true)}>
                или вставить код сессии вручную
              </Typography.Link>
            </div>
          )}
          {canEdit && manualMode && (
            <div style={{ marginTop: 6 }}>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  style={{ width: '40%' }}
                  placeholder="Название (напр. ДЗ №3)"
                  value={newLink.title}
                  onChange={(e) => setNewLink((s) => ({ ...s, title: e.target.value }))}
                />
                <Input
                  style={{ width: '36%' }}
                  placeholder="Код сессии или /student/..."
                  value={newLink.code}
                  onChange={(e) => setNewLink((s) => ({ ...s, code: e.target.value }))}
                  onPressEnter={addSessionItem}
                />
                <Select
                  style={{ width: 120 }}
                  value={newLink.mode}
                  onChange={(v) => setNewLink((s) => ({ ...s, mode: v }))}
                  options={ITEM_MODES}
                />
                <Button icon={<PlusOutlined />} onClick={addSessionItem} disabled={!newLink.code.trim()} />
              </Space.Compact>
              <Typography.Link style={{ fontSize: 11 }} onClick={() => setManualMode(false)}>
                ← выбрать работу из списка
              </Typography.Link>
            </div>
          )}

          {/* Текстовые задания / объявления */}
          <div style={{ marginTop: 12 }}>
            <Typography.Text strong style={{ fontSize: 12 }}>Текст для учеников</Typography.Text>
            {textItems.length > 0 && (
              <Space direction="vertical" size={2} style={{ width: '100%', margin: '4px 0' }}>
                {textItems.map((it, idx) => (
                  <Space key={idx} style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                    <span style={{ fontSize: 13 }}>📝 {it.text}</span>
                    <Space size={4}>
                      <Segmented size="small" value={itemMode(it)} options={ITEM_MODES} disabled={!canEdit}
                        onChange={(v) => setTextItems((prev) => prev.map((x, i) => (i === idx ? withMode(x, v) : x)))} />
                      {canEdit && (
                        <Button size="small" type="text" danger icon={<DeleteOutlined />}
                          onClick={() => setTextItems((prev) => prev.filter((_, i) => i !== idx))} />
                      )}
                    </Space>
                  </Space>
                ))}
              </Space>
            )}
            {canEdit && (
              <Space.Compact style={{ width: '100%', marginTop: 4 }}>
                <Input
                  placeholder="Напр.: повторить формулы сокращённого умножения"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  onPressEnter={addTextItem}
                />
                <Select style={{ width: 120 }} value={textMode} onChange={setTextMode} options={ITEM_MODES} />
                <Button icon={<PlusOutlined />} onClick={addTextItem} disabled={!newText.trim()} />
              </Space.Compact>
            )}
          </div>
        </div>
      )}

      {noteFiles.filter((m) => !fileMaterials.some((fm) => fm.id === m.id)).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            <FileTextOutlined /> Файлы заметки урока
          </Typography.Text>
          <Space direction="vertical" size={2} style={{ width: '100%', marginTop: 4 }}>
            {noteFiles.filter((m) => !fileMaterials.some((fm) => fm.id === m.id)).map((m) => (
              <Space key={m.id} style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                <a href={m.url} target="_blank" rel="noreferrer">
                  <DownloadOutlined /> {m.title}
                </a>
                <Space size={4}>
                  {studentFacing && canEdit && (
                    <Button size="small" icon={<EyeOutlined style={{ color: '#52c41a' }} />} onClick={() => showNoteFileToStudents(m)}>
                      Показать ученикам
                    </Button>
                  )}
                  <Chip tone="violet" dot={false}>из заметки</Chip>
                </Space>
              </Space>
            ))}
          </Space>
        </div>
      )}

      <MaterialPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        existingIds={fileMaterials.map((m) => m.id)}
        onPick={(picked) => setFileMaterials((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...picked.filter((p) => !seen.has(p.id))];
        })}
      />

      {materialIds.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Открыть материал (выдача · результаты · работа над ошибками):</Typography.Text>
          <div style={{ marginTop: 4 }}>
            {materialIds.map((id) => (
              <Button key={id} size="small" type="link" icon={<LinkOutlined />} style={{ paddingLeft: 0 }} onClick={() => onOpenMaterial(id)}>
                {worksMap.get(id) || 'Работа'}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        {editingExisting ? (
          <Button icon={<FileTextOutlined />} onClick={() => onOpenNote(initial)} block>
            Открыть заметку урока (формулы, блоки)
          </Button>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Сохраните урок, чтобы добавить заметку с формулами.
          </Typography.Text>
        )}
      </div>
    </Modal>
  );
}

/**
 * Цвет урока без класса (v3.9.228). С выбранным классом поле прячется: урок
 * красится цветом класса, и второй источник цвета только запутал бы.
 * Значение при этом держится в форме — снял класс, и выбор вернулся.
 */
export function LessonColorField({ form }) {
  const group = Form.useWatch('group', form);
  return (
    <Form.Item name="color" label="Цвет" hidden={!!group}
      tooltip="Урок без класса. С классом урок красится цветом класса">
      <GroupColorPicker />
    </Form.Item>
  );
}
