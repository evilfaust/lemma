import { useEffect, useState } from 'react';
import { App, Form, Modal } from 'antd';
import { api } from '../../../shared/services/pocketbase';
import SchoolEventFields from './SchoolEventFields';
import { schoolEventFormToData, schoolEventToForm } from './calendarUtils';

/**
 * Правка школьного мероприятия (создание из сетки живёт в `CreateEventModal`).
 * Править и удалять может только автор — PB вернёт 403 остальным, поэтому
 * оркестратор открывает окно лишь владельцу.
 */
export default function SchoolEventModal({ open, initial, onClose, onSaved }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) form.setFieldsValue(schoolEventToForm(initial || {}));
  }, [open, initial, form]);

  const handleOk = async () => {
    let v;
    try { v = await form.validateFields(); } catch { return; }
    setSaving(true);
    try {
      await api.updateSchoolEvent(initial.id, schoolEventFormToData(v));
      message.success('Мероприятие обновлено');
      onSaved();
      onClose();
    } catch {
      message.error('Не удалось сохранить мероприятие');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Школьное мероприятие"
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={saving}
      okText="Сохранить"
      cancelText="Отмена"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <SchoolEventFields form={form} />
      </Form>
    </Modal>
  );
}
