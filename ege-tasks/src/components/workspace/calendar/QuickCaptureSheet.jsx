import { useEffect, useState } from 'react';
import { App, Button, Drawer, Input } from 'antd';
import dayjs from 'dayjs';
import { api } from '../../../shared/services/pocketbase';
import { groupHex } from '../ui';
import useIsMobile from '../../../hooks/useIsMobile';
import './mobile.css';

/**
 * Быстрая запись без формы: дело (название + срок + класс) или мысль в инбокс
 * заметок. mode: 'todo' | 'idea' | null (закрыто). day — предложенный срок дела.
 */
export default function QuickCaptureSheet({ mode, day, groups = [], onClose, onCreated }) {
  const isMobile = useIsMobile();
  const { message } = App.useApp();
  const [text, setText] = useState('');
  const [due, setDue] = useState('today');
  const [group, setGroup] = useState(null);
  const [saving, setSaving] = useState(false);

  const base = day ? dayjs(day) : dayjs();
  const dayIsOther = !base.isSame(dayjs(), 'day') && !base.isSame(dayjs().add(1, 'day'), 'day');

  useEffect(() => {
    if (!mode) return;
    setText('');
    setGroup(null);
    setDue(dayIsOther ? 'day' : 'today');
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const dueDate = () => {
    if (due === 'today') return dayjs().startOf('day');
    if (due === 'tomorrow') return dayjs().add(1, 'day').startOf('day');
    if (due === 'day') return base.startOf('day');
    return null;
  };

  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    setSaving(true);
    try {
      if (mode === 'todo') {
        const d = dueDate();
        const rec = await api.createTodo({ title: value, group: group || '', due_date: d ? d.toISOString() : '' });
        message.success('Дело добавлено');
        onCreated?.('todo', rec);
      } else {
        // Первая строка — заголовок мысли, остальное — текст заметки.
        const [first, ...rest] = value.split('\n');
        const body = rest.map((t) => t.trim()).filter(Boolean)
          .map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t, styles: {} }] }));
        const rec = await api.createNote({
          title: first.trim().slice(0, 200), type: 'idea', is_inbox: true, ...(body.length ? { body } : {}),
        });
        message.success('Мысль в инбоксе заметок');
        onCreated?.('idea', rec);
      }
      onClose();
    } catch {
      message.error('Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const dueOptions = [
    { value: 'today', label: 'Сегодня' },
    { value: 'tomorrow', label: 'Завтра' },
    ...(dayIsOther ? [{ value: 'day', label: base.format('D MMMM') }] : []),
    { value: 'none', label: 'Без срока' },
  ];

  return (
    <Drawer
      open={!!mode}
      onClose={onClose}
      placement={isMobile ? 'bottom' : 'right'}
      height={isMobile ? 'auto' : undefined}
      width={isMobile ? undefined : 420}
      closable={false}
      destroyOnHidden
      rootClassName={`lesson-sheet${isMobile ? ' lesson-sheet--mobile' : ''}`}
      styles={{ body: { padding: '8px 16px 16px' } }}
    >
      {isMobile && <div className="ls-grab" onClick={onClose} role="presentation" />}
      <div className="qc-title">{mode === 'todo' ? 'Новое дело' : 'Мысль в инбокс'}</div>
      {mode === 'todo' ? (
        <Input
          size="large" autoFocus value={text} maxLength={500}
          placeholder="Что нужно сделать"
          onChange={(e) => setText(e.target.value)} onPressEnter={submit}
        />
      ) : (
        <Input.TextArea
          autoFocus value={text} maxLength={4000} autoSize={{ minRows: 3, maxRows: 8 }}
          placeholder="Первая строка станет заголовком"
          onChange={(e) => setText(e.target.value)}
        />
      )}
      {mode === 'todo' && (
        <>
          <div className="qc-label">Срок</div>
          <div className="qc-pills">
            {dueOptions.map((o) => (
              <button type="button" key={o.value} className={`mc-pill${due === o.value ? ' is-on' : ''}`}
                onClick={() => setDue(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          {groups.length > 0 && (
            <>
              <div className="qc-label">Класс</div>
              <div className="qc-pills">
                {groups.map((g) => {
                  const on = group === g.id;
                  const hex = groupHex(g);
                  return (
                    <button type="button" key={g.id} className={`mc-pill${on ? ' is-on' : ''}`}
                      style={on ? { background: hex.base, borderColor: hex.base, color: '#fff' } : { color: hex.ink || hex.base }}
                      onClick={() => setGroup(on ? null : g.id)}>
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
      <Button type="primary" size="large" block className="qc-submit" loading={saving}
        disabled={!text.trim()} onClick={submit}>
        {mode === 'todo' ? 'Добавить дело' : 'Записать'}
      </Button>
    </Drawer>
  );
}
