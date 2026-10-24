import { useEffect, useRef, useState } from 'react';
import { Modal, Select, Space, Typography } from 'antd';
import { useGeometryRefs } from '../../hooks/useGeometryRefs';
import { TOPIC_SELECT } from '../shared/topicSelect';

const { Text } = Typography;
const STORE = 'geometry.toMine.v1';

function readLast() {
  try { return JSON.parse(localStorage.getItem(STORE) || 'null') || {}; } catch { return {}; }
}
function writeLast(v) {
  try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* приватный режим */ }
}

/**
 * «В мои задачи»: задачи генератора становятся своими — код GEO-N, тема и
 * подтема (по желанию), область «Мои» банка. Выбор темы помнится между
 * открытиями (по умолчанию — тема «Стереометрия», если она есть).
 *
 * @param {number} count — сколько задач уходит
 * @param {string} [note] — пояснение под заголовком
 * @param {function} onConfirm — async ({ topic, subtopic }) => void
 */
export default function ToMineModal({ open, count, note, onCancel, onConfirm }) {
  const { topics, subtopics, loading } = useGeometryRefs(['topics', 'subtopics']);
  const [topic, setTopic] = useState(null);
  const [subtopic, setSubtopic] = useState(null);
  const [busy, setBusy] = useState(false);
  // Умолчание ставится один раз за открытие — догрузка справочника не
  // перетирает выбор учителя.
  const inited = useRef(false);

  useEffect(() => {
    if (!open) { inited.current = false; return; }
    if (inited.current || !topics.length) return;
    inited.current = true;
    const last = readLast();
    const known = (id) => topics.some((t) => t.id === id);
    const fallback = topics.find((t) => /стереометр/i.test(t.title))?.id || null;
    const t = last.topic && known(last.topic) ? last.topic : fallback;
    setTopic(t);
    setSubtopic(t && t === last.topic && subtopics.some((s) => s.id === last.subtopic && s.topic === t) ? last.subtopic : null);
  }, [open, topics, subtopics]);

  const ok = async () => {
    setBusy(true);
    try {
      writeLast({ topic, subtopic });
      await onConfirm({ topic, subtopic });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={count === 1 ? 'В мои задачи' : `В мои задачи: ${count}`}
      open={open}
      onCancel={onCancel}
      onOk={ok}
      okText="Сохранить в мои"
      cancelText="Отмена"
      confirmLoading={busy}
      okButtonProps={{ disabled: !count }}
      zIndex={1200}
      destroyOnHidden
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Text type="secondary">
          {note || 'Задачи получат код GEO-…, появятся в банке в области «Мои» — их можно править и брать в любые работы.'}
        </Text>
        <Select
          aria-label="Тема"
          placeholder="Тема (необязательно)…"
          value={topic}
          onChange={(v) => { setTopic(v ?? null); setSubtopic(null); }}
          style={{ width: '100%' }}
          options={topics.map((t) => ({ label: t.title, value: t.id }))}
          loading={loading.topics}
          showSearch
          optionFilterProp="label"
          allowClear
          {...TOPIC_SELECT}
        />
        <Select
          aria-label="Подтема"
          placeholder={topic ? 'Подтема (необязательно)…' : 'Сначала тема'}
          value={subtopic}
          onChange={(v) => setSubtopic(v ?? null)}
          style={{ width: '100%' }}
          options={subtopics.filter((s) => s.topic === topic).map((s) => ({ label: s.title, value: s.id }))}
          disabled={!topic}
          showSearch
          optionFilterProp="label"
          allowClear
          {...TOPIC_SELECT}
        />
      </Space>
    </Modal>
  );
}
