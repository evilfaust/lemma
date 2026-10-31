import { Alert, Checkbox, Modal, Radio, Segmented } from 'antd';
import { DELIVERIES, deliveryChoices } from '../../utils/lessonItems';
import { ITEM_MODES, requiredOf } from '../../utils/homework';
import '../workspace/calendar/lessonMaterials.css';
import './WorkLessonLinks.css';

/** Только что выбранная работа: как её получат ученики. */
export default function DeliveryModal({ pending, setPending, busy, onOk, notice }) {
  if (!pending) return null;
  const choices = deliveryChoices({ type: pending.type });
  const draft = { type: pending.type, deliver: pending.deliver === 'none' ? undefined : pending.deliver, role: pending.mode === 'class' ? 'class' : 'homework' };
  const required = typeof pending.required === 'boolean' ? pending.required : requiredOf(draft);
  const showWhen = pending.deliver !== 'paper' && pending.deliver !== 'none';
  return (
    <Modal
      className="work-delivery-modal"
      open
      title={`Как ученики получат «${pending.title || ({ mc_test: 'Тест', geometry_work: 'Геометрия', work: 'Работа' }[pending.type] || 'Работа')}»?`}
      okText="Добавить в урок"
      cancelText="Отмена"
      onOk={onOk}
      confirmLoading={busy}
      onCancel={() => { if (!busy) setPending(null); }}
      cancelButtonProps={{ disabled: busy }}
      closable={!busy}
      maskClosable={!busy}
      width={480}
    >
      {notice && <Alert type="info" showIcon message={notice} style={{ marginBottom: 12 }} />}
      <Radio.Group
        className="lm-choice"
        disabled={busy}
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
            disabled={busy}
            options={ITEM_MODES}
            onChange={(v) => setPending((p) => ({ ...p, mode: v }))}
          />
          <Checkbox disabled={busy} checked={required} onChange={(e) => setPending((p) => ({ ...p, required: e.target.checked }))}>
            обязательно сделать
          </Checkbox>
        </div>
      )}
    </Modal>
  );
}
