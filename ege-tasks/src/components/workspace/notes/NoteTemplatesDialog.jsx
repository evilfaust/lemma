import { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Popconfirm, Spin } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { api } from '../../../shared/services/pocketbase';
import { BUILTIN_NOTE_TEMPLATES } from './noteTemplates';

export function NoteTemplatesDialog({ open, onCancel, onSelect, canDelete }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getNoteTemplates().then((list) => { if (!cancelled) setTemplates(list); })
      .catch(() => { if (!cancelled) setError('Не удалось загрузить личные шаблоны. Готовые шаблоны доступны ниже.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]);
  const choose = async (template) => {
    setBusy(template.id);
    try { await onSelect(template); } finally { setBusy(null); }
  };
  const remove = async (template) => {
    try {
      await api.deleteNoteTemplate(template.id);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch { setError('Не удалось удалить шаблон'); }
  };
  return (
    <Modal open={open} title="Новая заметка из шаблона" footer={null} onCancel={onCancel}>
      {error && <Alert type="warning" message={error} showIcon />}
      <h3>Готовые шаблоны</h3>
      <div className="notes-template-list">
        {BUILTIN_NOTE_TEMPLATES.map((t) => (
          <Button key={t.id} block disabled={!!busy} loading={busy === t.id} onClick={() => choose(t)}>{t.title}</Button>
        ))}
      </div>
      <h3>Мои шаблоны</h3>
      {loading ? <Spin /> : templates.length ? (
        <div className="notes-template-list">
          {templates.map((t) => (
            <div className="notes-template-row" key={t.id}>
              <Button block disabled={!!busy} loading={busy === t.id} onClick={() => choose(t)}>{t.title}</Button>
              {canDelete && <Popconfirm title="Удалить шаблон?" okText="Удалить" cancelText="Отмена" onConfirm={() => remove(t)}>
                <Button aria-label={`Удалить шаблон ${t.title}`} icon={<DeleteOutlined />} />
              </Popconfirm>}
            </div>
          ))}
        </div>
      ) : !error && <p className="notes-dialog-hint">Сохраните любую заметку как шаблон через меню рядом с её заголовком. Личные шаблоны доступны на ваших устройствах.</p>}
    </Modal>
  );
}

export function SaveNoteTemplateDialog({ open, defaultTitle, onCancel, onSave }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setTitle(defaultTitle || 'Мой шаблон'); }, [open, defaultTitle]);
  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try { await onSave(title.trim()); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title="Сохранить как шаблон" okText="Сохранить" cancelText="Отмена"
      onCancel={onCancel} onOk={submit} confirmLoading={busy} okButtonProps={{ disabled: !title.trim() }}>
      <Input autoFocus aria-label="Название шаблона" maxLength={200} value={title}
        onChange={(e) => setTitle(e.target.value)} onPressEnter={submit} />
      <p className="notes-dialog-hint">Сохраняются текст, формулы и таблицы. Группу, дату и учеников вы выберете в новой заметке.</p>
    </Modal>
  );
}
