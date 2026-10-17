import { useEffect, useRef, useState } from 'react';
import { Switch, InputNumber, Space, Typography, Tooltip, App } from 'antd';
import { api } from '../../services/pocketbase';
import { attemptsSettingOf, maxAttemptsValue } from '../../utils/attemptRetake';

/**
 * «Несколько попыток» у выдачи (v3.9.380) — один выключатель на все места,
 * где учитель видит работу: панель выдачи, «Результаты», строка урока.
 * Раньше настройка жила только во вкладке «Выдача», а результаты смотрят
 * в другой — включить пересдачу «прямо здесь» было нельзя.
 *
 * `sessions` — записи выдач (id, max_attempts); несколько — правка уходит
 * во все сразу. `onSaved(list)` получает обновлённые записи.
 * Число попыток сохраняется по Enter, уходу из поля или стрелкам — не на
 * каждую цифру (иначе «5» успевало записаться как «2»).
 */
export default function AttemptsSetting({ sessions = [], onSaved, disabled = false, compact = false }) {
  const { message } = App.useApp();
  const { limit, mixed } = attemptsSettingOf(sessions);
  const on = limit >= 2;
  const [draft, setDraft] = useState(limit);
  const [saving, setSaving] = useState(false);
  // Последнее отправленное значение: Enter и уход из поля приходят подряд
  const sentRef = useRef(null);
  useEffect(() => { setDraft(limit); sentRef.current = null; }, [limit]);

  const ids = sessions.map((s) => s?.id).filter(Boolean);

  const save = async (nextLimit, note) => {
    const value = maxAttemptsValue(nextLimit);
    if (!ids.length || (!mixed && value === maxAttemptsValue(limit)) || sentRef.current === value) return;
    sentRef.current = value;
    setSaving(true);
    try {
      const updated = await api.setSessionsMaxAttempts(ids, value);
      onSaved?.(updated);
      message.success(note || (value ? `Попыток: ${value}` : 'Одна попытка'));
    } catch (err) {
      console.error('Error saving max_attempts:', err);
      message.error('Не удалось изменить число попыток');
      setDraft(limit);
      sentRef.current = null;
    }
    setSaving(false);
  };

  const commit = (v = draft) => {
    const n = Math.max(2, Math.min(20, Math.round(Number(v) || 2)));
    setDraft(n);
    save(n);
  };

  return (
    <Space size={6} wrap className="attempts-setting">
      {!compact && <Typography.Text type="secondary" style={{ fontSize: 13 }}>Несколько попыток</Typography.Text>}
      <Tooltip title="Ученик после сдачи увидит «Пройти ещё раз» (новый вариант), а на главной — «Можно пересдать». В зачёт идёт лучшая попытка.">
        <Switch
          size="small"
          checked={on}
          loading={saving}
          disabled={disabled || !ids.length}
          onChange={(checked) => save(
            checked ? Math.max(2, limit) : 1,
            checked ? 'Ученики могут пройти ещё раз' : 'Снова одна попытка',
          )}
          checkedChildren={compact ? 'попытки' : 'Вкл'}
          unCheckedChildren={compact ? '1 попытка' : 'Выкл'}
          aria-label="Несколько попыток"
        />
      </Tooltip>
      {on && (
        <InputNumber
          size="small"
          min={2}
          max={20}
          value={draft}
          disabled={disabled || saving}
          onChange={(v) => setDraft(v)}
          onBlur={() => commit()}
          onPressEnter={() => commit()}
          onStep={(v) => commit(v)}
          addonAfter="всего"
          style={{ width: 110 }}
          aria-label="Сколько попыток"
        />
      )}
      {mixed && <Typography.Text type="secondary" style={{ fontSize: 12 }}>в выдачах по-разному</Typography.Text>}
    </Space>
  );
}
