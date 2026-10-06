import { useEffect, useState } from 'react';
import { Alert, App, Space, Switch, Typography } from 'antd';
import { api } from '../../services/pocketbase';
import StereoGroupsSelect from '../stereo/StereoGroupsSelect';
import ShareLinkRow from '../shared/ShareLinkRow';
import { showLink } from '../../utils/workShowLink';

const { Text, Paragraph } = Typography;

export const showSharingOf = (work) => ({
  open: !!work?.show_open,
  groups: Array.isArray(work?.show_groups) ? work.show_groups : [],
});

/**
 * «Показ условий» (v3.9.306) — работа ученикам без выдачи: только условия,
 * без поля ответа и без результатов. Для разбора в классе или как ДЗ —
 * решают в тетради. Общая ссылка — выбор варианта, ссылка варианта — сразу
 * его задания; классы — работа появится в их кабинете. Сохраняется сразу.
 * Выдачи (вкладка «Выдача») этот режим не трогает.
 */
export default function WorkShowPanel({ work, canEdit, onChange }) {
  const { message } = App.useApp();
  const [state, setState] = useState(() => showSharingOf(work));
  const [saving, setSaving] = useState(false);
  const [numbers, setNumbers] = useState(null);

  useEffect(() => { setState(showSharingOf(work)); }, [work?.id, work?.show_open, work?.show_groups]);

  useEffect(() => {
    let alive = true;
    api.getVariantsByWorks([work.id], { fields: 'id,number' })
      .then((list) => { if (alive) setNumbers(list.map((v) => v.number).sort((a, b) => a - b)); })
      .catch(() => { if (alive) setNumbers([]); });
    return () => { alive = false; };
  }, [work.id]);

  const apply = async (patch) => {
    const prev = state;
    const next = { ...state, ...patch };
    setState(next);
    setSaving(true);
    try {
      const rec = await api.setWorkShowSharing(work.id, next);
      onChange?.({ show_open: rec.show_open, show_groups: rec.show_groups });
    } catch (e) {
      message.error(`Не удалось сохранить: ${e?.message || 'ошибка'}`);
      setState(prev);
    } finally {
      setSaving(false);
    }
  };

  const closed = !state.open;
  const many = (numbers?.length || 0) > 1;

  return (
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      <Space align="center">
        <Switch
          checked={state.open}
          loading={saving}
          disabled={!canEdit}
          onChange={(v) => apply({ open: v })}
          aria-label="Условия открыты ученикам"
        />
        <Text strong>{state.open ? 'Условия открыты ученикам' : 'Закрыто'}</Text>
      </Space>
      <Paragraph type="secondary" style={{ margin: 0 }}>
        Это не выдача: ученик видит только условия — без ответов и решений, ответы не
        вводит, результатов нет. Для разбора в классе или как домашняя работа — решают
        в тетради. Вход не нужен.
      </Paragraph>

      <div>
        <Text>Классы — работа появится в их личном кабинете</Text>
        <StereoGroupsSelect
          value={state.groups}
          onChange={(v) => apply({ groups: v })}
          disabled={saving || !canEdit}
          placeholder="Классы (необязательно — ссылка работает и без них)"
        />
      </div>

      {numbers?.length === 0 ? (
        <Alert type="info" showIcon message="В работе нет вариантов — показывать нечего" />
      ) : (
        <div className="share-links">
          <ShareLinkRow label={many ? 'Общая (выбор варианта)' : 'Ссылка'} link={showLink(work.id)} disabled={closed} />
          {many && numbers.map((n) => (
            <ShareLinkRow key={n} label={`Вариант ${n}`} link={showLink(work.id, n)} disabled={closed} />
          ))}
        </div>
      )}
      {closed && <Text type="secondary">Ссылки заработают, когда условия будут открыты.</Text>}
      <Text type="secondary" style={{ fontSize: 12 }}>
        Задать к уроку: календарь → урок → «Задания-ссылки» → «Только условия».
      </Text>
    </Space>
  );
}
