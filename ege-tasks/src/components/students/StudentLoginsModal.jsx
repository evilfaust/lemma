import { useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Checkbox, Collapse, Input, Modal, Space, Tag, Tooltip, Typography,
} from 'antd';
import { CopyOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import {
  isMachineLogin, isValidLogin, simplePassword, suggestLogins,
} from '../../utils/studentLogins';
import { credentialsText, printCredentialCards } from '../../utils/credentialCards';

const { Text } = Typography;

/**
 * «Логины и пароли» группы (v3.9.294): человекочитаемый логин (ivanov.p) и
 * простой пароль (sova274) каждому отмеченному ученику, затем карточки для
 * раздачи. При первом входе ученик придумывает свой пароль.
 *
 * Ученику «без аккаунта» логин выдаётся на ТУ ЖЕ запись (хук
 * issue-credentials) — отметки журнала, посещаемость и заметки остаются.
 * По умолчанию отмечены ученики без аккаунта и с машинным логином (st_…,
 * ext_…). Новых учеников (которых нет в группе) можно дописать списком.
 *
 * students — состав группы; taken — логины, известные учителю (свои и ничьи
 * ученики); сервер всё равно проверит занятость среди всех и добавит цифру.
 */
export default function StudentLoginsModal({ open, onClose, group, students = [], taken = [], onDone }) {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [newText, setNewText] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null); // [{ name, username, password, error? }]

  // Строки таблицы собираются при открытии и больше не пересчитываются сами:
  // учитель мог поправить логин руками.
  useEffect(() => {
    if (!open) return;
    setResults(null);
    setNewText('');
    const list = students.filter((s) => s.status !== 'graduated' && s.status !== 'left');
    const marked = list.filter((s) => s.external || isMachineLogin(s.username) || !s.username);
    const own = new Set(marked.map((s) => s.username));
    const logins = suggestLogins(marked, taken.filter((u) => !own.has(u)));
    setRows(list.map((s) => {
      const on = logins.has(s.id);
      return {
        key: s.id,
        id: s.id,
        name: s.name || s.username || 'Ученик',
        current: s.external ? '' : s.username,
        external: !!s.external,
        on,
        username: on ? logins.get(s.id) : (s.username || ''),
        password: simplePassword(),
      };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const patch = (key, p) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)));

  // Отметили ученика: человеческий логин остаётся (выдаётся только новый
  // пароль), машинный или пустой — заменяется предложенным.
  const toggle = (row, on) => {
    if (!on) { patch(row.key, { on, username: row.current || row.username }); return; }
    if (row.current && !isMachineLogin(row.current)) { patch(row.key, { on, username: row.current }); return; }
    const busyLogins = rows.filter((r) => r.key !== row.key && r.on).map((r) => r.username);
    const login = suggestLogins([{ id: row.key, name: row.name }], [...taken, ...busyLogins]).get(row.key);
    patch(row.key, { on, username: login });
  };

  const addNew = () => {
    const names = newText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    const busyLogins = [...taken, ...rows.filter((r) => r.on).map((r) => r.username)];
    const items = names.map((name, i) => ({ id: `new-${Date.now()}-${i}`, name }));
    const logins = suggestLogins(items, busyLogins);
    setRows((prev) => [...prev, ...items.map((it) => ({
      key: it.id, id: null, name: it.name, current: '', external: false, isNew: true, on: true,
      username: logins.get(it.id), password: simplePassword(),
    }))]);
    setNewText('');
  };

  const picked = rows.filter((r) => r.on);
  const problems = useMemo(() => {
    const seen = new Map();
    const out = new Map();
    for (const r of picked) {
      const u = (r.username || '').toLowerCase();
      if (!isValidLogin(u)) out.set(r.key, 'латиница, цифры, точка, дефис; от 3 символов');
      else if (seen.has(u)) out.set(r.key, 'такой логин уже в списке');
      else if ((r.password || '').length < 6) out.set(r.key, 'пароль от 6 символов');
      seen.set(u, r.key);
    }
    return out;
  }, [picked]);

  const apply = async () => {
    setBusy(true);
    const done = [];
    for (const r of picked) {
      const username = r.username.trim().toLowerCase();
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = r.isNew
          ? await api.createStudentAccount({
            name: r.name, groupId: group?.id, studentClass: group?.name || '', groupYear: group?.year,
            username, password: r.password,
          })
          : await api.issueStudentCredentials(r.id, { username, password: r.password });
        done.push({ name: r.name, username: res.username, password: res.password });
      } catch (e) {
        done.push({ name: r.name, username, password: '', error: e?.message || 'ошибка' });
      }
    }
    setBusy(false);
    setResults(done);
    const failed = done.filter((d) => d.error).length;
    if (failed) message.error(`Не удалось: ${failed}`);
    else message.success(`Выдано: ${done.length}`);
    onDone?.();
  };

  const ok = (results || []).filter((r) => !r.error);
  const print = () => {
    if (!printCredentialCards(ok, { title: group?.name })) message.error('Браузер заблокировал окно печати');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(credentialsText(ok));
      message.success('Скопировано');
    } catch {
      message.error('Не удалось скопировать');
    }
  };

  return (
    <Modal
      open={open}
      title="Логины и пароли учеников"
      onCancel={onClose}
      width={820}
      destroyOnHidden
      footer={results ? (
        <Space>
          <Button icon={<CopyOutlined />} onClick={copy} disabled={!ok.length}>Скопировать список</Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={print} disabled={!ok.length}>Печать карточек</Button>
          <Button onClick={onClose}>Готово</Button>
        </Space>
      ) : (
        <Space>
          <Button onClick={onClose}>Отмена</Button>
          <Button type="primary" loading={busy} disabled={!picked.length || problems.size > 0} onClick={apply}>
            Выдать ({picked.length})
          </Button>
        </Space>
      )}
    >
      {!results ? (
        <>
          <Text type="secondary" style={{ display: 'block', marginBottom: 10 }}>
            Отмеченным ученикам выдаётся логин из фамилии и простой пароль. При первом входе
            ученик придумает свой пароль. У ученика «без аккаунта» сохраняются все отметки в
            журнале — аккаунт выдаётся на ту же запись. Старый логин и пароль отмеченных
            перестанут работать.
          </Text>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="slm-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#888' }}>
                  <th style={{ width: 28 }} />
                  <th style={{ padding: '4px 6px' }}>Ученик</th>
                  <th style={{ padding: '4px 6px', width: 200 }}>Логин</th>
                  <th style={{ padding: '4px 6px', width: 170 }}>Пароль</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} style={{ borderTop: '1px solid #f0f0f0', opacity: r.on ? 1 : 0.6 }}>
                    <td style={{ padding: '4px 6px' }}>
                      <Checkbox checked={r.on} onChange={(e) => toggle(r, e.target.checked)} aria-label={`Выдать: ${r.name}`} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      {r.name}{' '}
                      {r.isNew && <Tag color="blue">новый</Tag>}
                      {r.external && <Tag color="orange">без аккаунта</Tag>}
                      {!r.external && !r.isNew && r.current && (
                        <Text type="secondary" style={{ fontSize: 11 }}>сейчас: {r.current}</Text>
                      )}
                      {problems.has(r.key) && <div><Text type="danger" style={{ fontSize: 11 }}>{problems.get(r.key)}</Text></div>}
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      {r.on ? (
                        <Input size="small" value={r.username} style={{ fontFamily: 'monospace' }}
                          onChange={(e) => patch(r.key, { username: e.target.value.trim().toLowerCase() })} />
                      ) : <Text type="secondary" style={{ fontFamily: 'monospace' }}>{r.current || '—'}</Text>}
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      {r.on && (
                        <Space.Compact style={{ width: '100%' }}>
                          <Input size="small" value={r.password} style={{ fontFamily: 'monospace' }}
                            onChange={(e) => patch(r.key, { password: e.target.value.trim() })} />
                          <Tooltip title="Другой пароль">
                            <Button size="small" icon={<ReloadOutlined />} aria-label="Другой пароль"
                              onClick={() => patch(r.key, { password: simplePassword() })} />
                          </Tooltip>
                        </Space.Compact>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Collapse
            ghost
            style={{ marginTop: 8 }}
            items={[{
              key: 'new',
              label: 'Новые ученики (которых ещё нет в группе)',
              children: (
                <>
                  <Input.TextArea value={newText} onChange={(e) => setNewText(e.target.value)}
                    autoSize={{ minRows: 3, maxRows: 10 }} placeholder={'Фамилия Имя — по одному на строку\nИванов Иван'} />
                  <Button size="small" style={{ marginTop: 6 }} onClick={addNew} disabled={!newText.trim()}>
                    Добавить в таблицу
                  </Button>
                </>
              ),
            }]}
          />
        </>
      ) : (
        <>
          <Alert type="warning" showIcon style={{ marginBottom: 12 }}
            message="Пароли показываются один раз — распечатайте карточки или скопируйте список." />
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#888' }}>
                <th style={{ padding: '4px 8px' }}>Ученик</th>
                <th style={{ padding: '4px 8px' }}>Логин</th>
                <th style={{ padding: '4px 8px' }}>Пароль</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '4px 8px' }}>{r.name}</td>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{r.username}</td>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>
                    {r.error ? <Text type="danger">{r.error}</Text> : r.password}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  );
}
