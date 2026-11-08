import { useEffect, useState } from 'react';
import { App, Alert, Button, Modal, Select, Space, Typography } from 'antd';
import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';
import { generateEgeBaseTask, generatorsForTopic } from '../../utils/egeBaseGeneratedTasks';

/** Предпросмотр не пишет в банк. Сохраняем только выбранную учителем задачу. */
export default function EgeBaseTaskGeneratorModal({ target, topic, subtopics, usedStatements, onApply, onCancel }) {
  const { message } = App.useApp();
  const [generatorId, setGeneratorId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const available = generatorsForTopic(topic, subtopics);
  useEffect(() => {
    const source = target?.task.source || '';
    setGeneratorId(available.find(g => source.endsWith(` · ${g.id}`))?.id || available[0]?.id || null);
    setDraft(null);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  const preview = async () => {
    setBusy(true);
    try {
      setDraft(await generateEgeBaseTask({ topic, subtopics, generatorId, used: new Set([...usedStatements, ...(draft ? [draft.statement_md] : [])]) }));
    } catch (error) { message.error(error.message); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const record = await api.createTask(draft);
      onApply(record);
      message.success(`Задача ${record.code} сохранена в тему и подтему`);
    } catch { message.error('Не удалось сохранить задачу в банк. Попробуйте ещё раз.'); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={!!target} title={`Новая задача · ЕГЭ база №${topic?.ege_number || ''}`} onCancel={busy ? undefined : onCancel}
      closable={!busy} maskClosable={!busy} keyboard={!busy} width={760}
      footer={<Space><Button disabled={busy} onClick={onCancel}>Отмена</Button><Button loading={busy} disabled={!draft} type="primary" onClick={save}>Сохранить в банк и подставить</Button></Space>}>
      <Alert type="info" showIcon message="Только прототипы базового ЕГЭ, уровень «как на экзамене». После сохранения задача попадёт в указанную подтему." style={{ marginBottom: 12 }} />
      <Select aria-label="Тип новой задачи" style={{ width: '100%' }} value={generatorId} disabled={busy} showSearch optionFilterProp="label"
        options={available.map(g => ({ value: g.id, label: `${g.subtopic} · ${g.label}` }))}
        onChange={value => { setGeneratorId(value); setDraft(null); }} />
      <Button onClick={preview} disabled={!generatorId} loading={busy} style={{ margin: '12px 0' }}>Сгенерировать{draft ? ' другую' : ''}</Button>
      {draft && <><MathRenderer text={draft.statement_md} /><Typography.Paragraph><strong>Ответ:</strong> {draft.answer}</Typography.Paragraph></>}
    </Modal>
  );
}
