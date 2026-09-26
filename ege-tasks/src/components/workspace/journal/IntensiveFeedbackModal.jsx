import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, App, Button, Collapse, Input, Modal, Segmented, Select, Space, Tooltip, Typography,
} from 'antd';
import {
  CheckOutlined, ReloadOutlined, RobotOutlined, SaveOutlined,
} from '@ant-design/icons';
import { api } from '../../../shared/services/pocketbase';
import {
  DEFAULT_EXAMPLES, RATINGS, addressOf, buildFeedbackData, fillName, genderOf,
} from '../../../utils/intensiveFeedback';

const { Text } = Typography;

async function runLimited(tasks, limit = 3) {
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

/**
 * «Обратная связь» по интенсиву (v3.9.243): черновики отзывов в стиле кафедры
 * пишет LLM, учитель правит и сохраняет их комментарием к клетке «Итог».
 * 🚨 В модель не уходят ни фамилия, ни имя — только оценки, проценты и
 * описания работ из заметок колонок (`buildFeedbackData`); обращение
 * подставляется здесь (`fillName`).
 *
 * columns/rows — колонки интенсива и строки сетки по ним (`buildGrid`),
 * totalIndex — индекс колонки «Итог» в columns (-1 — сохранять некуда).
 */
export default function IntensiveFeedbackModal({
  open, block, columns = [], rows = [], totalIndex = -1, teacher, aiEnabled = true, canEdit = false,
  examples: savedExamples, onExamplesSaved, onSaveComment, onSaveAddress, onClose,
}) {
  const { message } = App.useApp();
  const [state, setState] = useState({}); // studentId → { address, gender, rating, draft, raw, busy, error, saved }
  const [examples, setExamples] = useState(DEFAULT_EXAMPLES);
  const [running, setRunning] = useState(false);
  const alive = useRef(true);

  const current = useMemo(() => rows.filter((r) => !r.student.former), [rows]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Открыли окно — собираем исходное состояние: сохранённый комментарий итога
  // и есть текущий отзыв.
  useEffect(() => {
    if (!open) return;
    const next = {};
    for (const r of current) {
      const saved = totalIndex >= 0 ? r.cells[totalIndex]?.comment || '' : '';
      next[r.student.id] = {
        address: addressOf(r.student),
        gender: genderOf(r.student),
        rating: '',
        draft: saved,
        raw: '',
        saved,
        busy: false,
        error: '',
      };
    }
    setState(next);
    setExamples(String(savedExamples || '').trim() || DEFAULT_EXAMPLES);
  // Только на открытие: иначе каждая запись клетки сбрасывала бы правки.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, block?.id]);

  const patch = (id, p) => setState((s) => ({ ...s, [id]: { ...s[id], ...p } }));

  const undescribed = useMemo(
    () => columns.filter((c) => c.role !== 'total' && c.role !== 'day'
      && !String(c.note || '').trim()).length,
    [columns],
  );

  const generate = async (row) => {
    const id = row.student.id;
    const st = state[id];
    if (!st) return;
    patch(id, { busy: true, error: '' });
    try {
      const data = buildFeedbackData(columns, rows, id, {
        gender: st.gender, rating: st.rating, title: block?.title || '',
      });
      const { text } = await api.generateIntensiveFeedback({ data, examples });
      if (!alive.current) return;
      setState((s) => {
        const cur = s[id];
        return { ...s, [id]: { ...cur, busy: false, raw: text, draft: fillName(text, cur.address) } };
      });
    } catch (e) {
      if (alive.current) patch(id, { busy: false, error: e?.message || 'Не удалось получить черновик' });
    }
  };

  const generateMany = async (list) => {
    setRunning(true);
    await runLimited(list.map((r) => () => generate(r)));
    if (alive.current) setRunning(false);
  };

  const save = async (row) => {
    const id = row.student.id;
    const text = String(state[id]?.draft || '').trim();
    try {
      await onSaveComment(row.student, text);
      patch(id, { saved: text, draft: text });
    } catch {
      message.error(`Не сохранилось: ${row.student.name}`);
    }
  };

  const changed = current.filter((r) => {
    const st = state[r.student.id];
    return st && String(st.draft || '').trim() !== String(st.saved || '').trim();
  });
  const empty = current.filter((r) => !String(state[r.student.id]?.draft || '').trim());

  const saveExamples = async () => {
    try {
      await api.saveFeedbackExamples(teacher.id, examples);
      onExamplesSaved?.(examples);
      message.success('Образцы сохранены — ими будут писаться следующие черновики');
    } catch {
      message.error('Не удалось сохранить образцы');
    }
  };

  const canSave = canEdit && totalIndex >= 0;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1100}
      style={{ maxWidth: '96vw', top: 24 }}
      destroyOnHidden
      title={`Обратная связь · интенсив «${block?.title || ''}»`}
      footer={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text type="secondary" style={{ fontSize: 12.5 }}>
            {changed.length ? `Не сохранено: ${changed.length}` : 'Все отзывы сохранены'}
          </Text>
          <span style={{ flex: 1 }} />
          <Button onClick={onClose}>Закрыть</Button>
          {canSave && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              disabled={!changed.length}
              onClick={async () => { for (const r of changed) await save(r); }}
            >
              Сохранить всё ({changed.length})
            </Button>
          )}
        </div>
      )}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Черновик пишет ИИ по оценкам интенсива — прочитайте и поправьте перед сохранением"
        description={(
          <>
            В модель уходят только оценки, проценты и описания работ — без фамилий и имён;
            обращение подставляется здесь. Отзыв всегда начинается с хорошего. Темы модель
            называет только из описаний работ (заметка колонки «Что проверяла работа»)
            {undescribed > 0 && <b> — сейчас без описания работ: {undescribed}</b>}.
            Сохраняется комментарием к клетке «Итог».
          </>
        )}
      />
      {!aiEnabled && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="ИИ-функции выключены для вашей учётной записи — черновики недоступны" />
      )}
      {totalIndex < 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="У интенсива нет колонки «Итог» — сохранить отзывы некуда. Добавьте её из меню интенсива." />
      )}

      <Space wrap style={{ marginBottom: 12 }}>
        <Button
          icon={<RobotOutlined />}
          type="primary"
          ghost
          loading={running}
          disabled={!aiEnabled || !empty.length}
          onClick={() => generateMany(empty)}
        >
          Черновики для пустых ({empty.length})
        </Button>
        <Button
          icon={<ReloadOutlined />}
          disabled={!aiEnabled || running}
          onClick={() => generateMany(current)}
        >
          Переписать все
        </Button>
      </Space>

      <Collapse
        size="small"
        style={{ marginBottom: 12 }}
        items={[{
          key: 'ex',
          label: 'Образцы стиля кафедры',
          children: (
            <>
              <Text type="secondary" style={{ display: 'block', fontSize: 12.5, marginBottom: 6 }}>
                По ним модель подстраивает тон и обороты. Имена в образцах — {'{ИМЯ}'}.
              </Text>
              <Input.TextArea
                value={examples}
                onChange={(e) => setExamples(e.target.value)}
                autoSize={{ minRows: 5, maxRows: 14 }}
                maxLength={20000}
              />
              <Space style={{ marginTop: 8 }}>
                <Button size="small" onClick={saveExamples} disabled={!teacher?.id}>Сохранить как мои образцы</Button>
                <Button size="small" type="text" onClick={() => setExamples(DEFAULT_EXAMPLES)}>Вернуть образцы по умолчанию</Button>
              </Space>
            </>
          ),
        }]}
      />

      <div className="cj-fb">
        {current.map((row) => {
          const id = row.student.id;
          const st = state[id];
          if (!st) return null;
          const total = totalIndex >= 0 ? row.cells[totalIndex] : null;
          const dirty = String(st.draft || '').trim() !== String(st.saved || '').trim();
          return (
            <div key={id} className="cj-fb__row">
              <div className="cj-fb__side">
                <div className="cj-fb__name" title={row.student.name}>{row.student.name}</div>
                <div className="cj-fb__total">
                  Итог: <b>{total?.stored ? total.text : '—'}</b>
                </div>
                <Tooltip title="Обращение в отзыве; сохраняется в карточке ученика">
                  <Input
                    size="small"
                    value={st.address}
                    onChange={(e) => {
                      const address = e.target.value;
                      setState((s) => {
                        const cur = s[id];
                        // Черновик ещё не правили — обращение меняется и в нём.
                        const untouched = cur.raw && cur.draft === fillName(cur.raw, cur.address);
                        return { ...s, [id]: { ...cur, address, draft: untouched ? fillName(cur.raw, address) : cur.draft } };
                      });
                    }}
                    onBlur={() => {
                      const v = String(st.address || '').trim();
                      if (v && v !== addressOf(row.student) && canEdit) onSaveAddress?.(row.student, v);
                    }}
                  />
                </Tooltip>
                <Space size={4} style={{ marginTop: 6 }}>
                  <Segmented
                    size="small"
                    value={st.gender}
                    onChange={(gender) => patch(id, { gender })}
                    options={[{ value: 'm', label: 'он' }, { value: 'f', label: 'она' }]}
                  />
                  <Select
                    size="small"
                    value={st.rating}
                    onChange={(rating) => patch(id, { rating })}
                    style={{ width: 92 }}
                    options={RATINGS.map((r) => ({ value: r, label: r ? `рейт. ${r}` : 'без рейт.' }))}
                  />
                </Space>
              </div>
              <div className="cj-fb__main">
                <Input.TextArea
                  value={st.draft}
                  onChange={(e) => patch(id, { draft: e.target.value })}
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  maxLength={1000}
                  placeholder={st.busy ? 'Пишу черновик…' : 'Отзыва пока нет'}
                  disabled={st.busy}
                />
                {st.error && <div className="cj-fb__err">{st.error}</div>}
                <Space size={6} style={{ marginTop: 6 }}>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    loading={st.busy}
                    disabled={!aiEnabled}
                    onClick={() => generate(row)}
                  >
                    {st.draft ? 'Переписать' : 'Черновик'}
                  </Button>
                  {canSave && (
                    <Button
                      size="small"
                      type={dirty ? 'primary' : 'default'}
                      icon={dirty ? <SaveOutlined /> : <CheckOutlined />}
                      disabled={!dirty}
                      onClick={() => save(row)}
                    >
                      {dirty ? 'Сохранить' : 'Сохранено'}
                    </Button>
                  )}
                </Space>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
