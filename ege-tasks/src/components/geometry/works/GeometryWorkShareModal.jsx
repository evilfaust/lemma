import { useEffect, useState } from 'react';
import {
  Alert, App, Modal, Space, Switch, Typography,
} from 'antd';
import { api } from '../../../shared/services/pocketbase';
import StereoGroupsSelect from '../../stereo/StereoGroupsSelect';
import LinkRow from '../../shared/ShareLinkRow';
import { workLink } from '../../../utils/geometryWorkLink';
import { variantLabel } from '../../../utils/geometryWork';

const { Text } = Typography;

/**
 * «Ученикам»: открыть работу по ссылке без входа (только условия и чертежи)
 * и выбрать классы — в их личном кабинете работа появится сама. Общая ссылка —
 * ученик выбирает вариант; ссылка варианта — сразу его задания.
 * Изменения сохраняются сразу.
 */
export default function GeometryWorkShareModal({
  open, onClose, workId, variants = 1, sharing, onChange, dirty = false,
}) {
  const { message } = App.useApp();
  const [state, setState] = useState(sharing || { public: false, groups: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setState(sharing || { public: false, groups: [] }); }, [open, sharing]);

  const apply = async (patch) => {
    const next = { ...state, ...patch };
    setState(next);
    setSaving(true);
    try {
      await api.setGeometryWorkSharing(workId, next);
      onChange?.(next);
    } catch (e) {
      message.error(`Не удалось сохранить: ${e?.message || 'ошибка'}`);
      setState(state);
    } finally {
      setSaving(false);
    }
  };

  const closed = !state.public;

  return (
    <Modal title="Работа — ученикам" open={open} onCancel={onClose} footer={null} width={620} destroyOnHidden>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Space align="center">
          <Switch checked={state.public} loading={saving} onChange={(v) => apply({ public: v })} aria-label="Открыта ученикам" />
          <Text strong>{state.public ? 'Открыта ученикам' : 'Закрыта'}</Text>
        </Space>
        <Text type="secondary">
          Ученик видит только условия и чертежи (объёмные можно крутить) — без ответов и решений.
          Решает в тетради. Вход не нужен.
        </Text>
        {dirty && (
          <Alert type="warning" showIcon message="В работе есть несохранённые изменения — ученики увидят последнюю сохранённую версию" />
        )}

        <div>
          <Text>Классы — работа появится в их личном кабинете</Text>
          <StereoGroupsSelect
            value={state.groups}
            onChange={(v) => apply({ groups: v })}
            disabled={saving}
            placeholder="Классы (необязательно — ссылка работает и без них)"
          />
        </div>

        <div className="share-links">
          <LinkRow label={variants > 1 ? 'Общая (выбор варианта)' : 'Ссылка'} link={workLink(workId)} disabled={closed} />
          {variants > 1 && Array.from({ length: variants }, (_, v) => (
            <LinkRow key={v} label={variantLabel(v)} link={workLink(workId, v)} disabled={closed} />
          ))}
        </div>
        {closed && <Text type="secondary">Ссылки заработают, когда работа будет открыта.</Text>}
      </Space>
    </Modal>
  );
}
