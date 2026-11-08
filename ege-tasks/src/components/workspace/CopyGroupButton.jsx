import { useState } from 'react';
import { App, Button, Input, Modal } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import { copyText } from '../../utils/copyText';
import { groupRosterText } from '../../utils/groupTests';

export default function CopyGroupButton({ group, students, iconOnly = false }) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const copy = async (e) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const roster = students ?? await (group.kind === 'course'
        ? api.getCourseStudents(group.id, { strict: true }) : api.getStudentsByGroup(group.id));
      if (!roster.length) { message.info('В группе пока нет учеников'); return; }
      const text = groupRosterText(group, roster);
      if (await copyText(text)) message.success('Список группы скопирован');
      else setManual(text);
    } catch {
      message.error('Не удалось загрузить список группы');
    } finally {
      setBusy(false);
    }
  };
  return <>
    <Button size="small" type={iconOnly ? 'text' : 'default'} icon={<CopyOutlined />}
      title="Копировать список группы" aria-label="Копировать список группы" loading={busy} onClick={copy}>
      {!iconOnly && 'Копировать список'}
    </Button>
    <Modal open={!!manual} title="Список группы" footer={null} onCancel={() => setManual('')}>
      <p>Выделите текст и скопируйте его.</p>
      <Input.TextArea readOnly value={manual} autoSize={{ minRows: 5, maxRows: 20 }} onFocus={(e) => e.target.select()} />
    </Modal>
  </>;
}
