import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Form, Input, Modal, Select, Space, Tooltip,
} from 'antd';
import {
  AimOutlined, CopyOutlined, DeleteOutlined, DownOutlined, EyeOutlined,
  PauseCircleOutlined, PlayCircleOutlined, PlusOutlined, RightOutlined, WifiOutlined,
} from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import { roomCodeFromName, normalizeRoomCode, roomLink } from '../../utils/stereo/room';
import StereoGroupsSelect from './StereoGroupsSelect';

const COLLAPSED_KEY = 'lemma.stereo.liveCollapsed';

const readCollapsed = () => {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
};

/**
 * Панель «Эфир» редактора: комната класса, классы трансляции (у их учеников
 * идущий эфир виден в личном кабинете), ссылка для доски, старт/стоп,
 * «Смотрите отсюда» (разово) и «Все смотрят сюда» (ученики следят за каждым
 * поворотом учителя и сами не крутят). Состояние — хук useStereoLive
 * (передаётся целиком). Панель сворачивается в одну строку (чтобы влезли
 * инструменты): в ней остаются старт/стоп и «Все смотрят сюда».
 */
export default function StereoLivePanel({ live, camera }) {
  const { message, modal } = App.useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = () => setCollapsed((v) => {
    try { localStorage.setItem(COLLAPSED_KEY, v ? '0' : '1'); } catch { /* приватное окно */ }
    return !v;
  });

  if (live.rooms === undefined) return null;
  if (live.rooms === null) {
    return (
      <Alert
        type="info"
        showIcon
        message="Эфир на телефоны учеников появится после обновления базы"
      />
    );
  }

  const { room } = live;
  const link = room ? roomLink(room.code) : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.full);
      message.success('Ссылка скопирована');
    } catch {
      message.info(link.full);
    }
  };

  const saveGroups = async (groups) => {
    try {
      await live.setGroups(groups);
    } catch (e) {
      message.error(e?.message || 'Не удалось сохранить классы');
    }
  };

  const remove = () => modal.confirm({
    title: `Удалить комнату ${room.code}?`,
    content: 'Ссылка перестанет работать. Чертёж в редакторе останется.',
    okText: 'Удалить',
    okButtonProps: { danger: true },
    cancelText: 'Отмена',
    onOk: () => live.deleteRoom(room.id),
  });

  return (
    <div className={`stereo-live${live.isLive ? ' is-live' : ''}${collapsed ? ' is-collapsed' : ''}`}>
      <div className="stereo-live__head">
        <button
          type="button"
          className="stereo-live__toggle"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? 'Развернуть панель эфира' : 'Свернуть в одну строку'}
        >
          {collapsed ? <RightOutlined /> : <DownOutlined />}
          <strong><WifiOutlined /> Эфир</strong>
          {collapsed && room && <span className="stereo-live__code">{room.code}</span>}
        </button>
        {live.isLive && (
          <span className="stereo-live__dot" title="в эфире">{collapsed ? '' : 'в эфире'}</span>
        )}
        {collapsed && (
          <Space size={4} className="stereo-live__mini">
            <Tooltip title={!room ? 'Сначала создайте комнату' : live.isLive ? 'Остановить эфир' : 'Начать эфир'}>
              <Button
                size="small"
                aria-label={live.isLive ? 'Остановить эфир' : 'Начать эфир'}
                type={live.isLive ? 'default' : 'primary'}
                danger={live.isLive}
                disabled={!room}
                icon={live.isLive ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => (live.isLive ? live.stop() : live.start(camera))}
              />
            </Tooltip>
            <Tooltip
              title={!live.isLive
                ? '«Все смотрят сюда» — во время эфира'
                : live.isLeading ? 'Все смотрят сюда · отпустить' : 'Все смотрят сюда'}
            >
              <Button
                size="small"
                aria-label="Все смотрят сюда"
                aria-pressed={live.isLeading}
                type={live.isLeading ? 'primary' : 'default'}
                className={live.isLeading ? 'stereo-live__lead is-on' : 'stereo-live__lead'}
                disabled={!live.isLive}
                icon={<EyeOutlined />}
                onClick={() => live.setLead(!live.isLeading, camera)}
              />
            </Tooltip>
          </Space>
        )}
      </div>

      {collapsed ? null : !room ? (
        <Button block icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Создать комнату класса
        </Button>
      ) : (
        <>
          <Space.Compact style={{ width: '100%' }}>
            <Select
              style={{ flex: 1, minWidth: 0 }}
              value={room.id}
              onChange={live.selectRoom}
              disabled={live.isLive}
              options={live.rooms.map((r) => ({ value: r.id, label: r.title ? `${r.title} · ${r.code}` : r.code }))}
            />
            <Tooltip title="Новая комната">
              <Button icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} disabled={live.isLive} />
            </Tooltip>
            <Tooltip title="Удалить комнату">
              <Button icon={<DeleteOutlined />} onClick={remove} disabled={live.isLive} />
            </Tooltip>
          </Space.Compact>

          {/* Поля groups нет до миграции 1787500000 — тогда и выбора нет. */}
          {Array.isArray(room.groups) && (
            <div className="stereo-live__groups">
              <StereoGroupsSelect
                value={room.groups}
                onChange={saveGroups}
                placeholder="Для каких классов"
              />
              <div className="stereo-cmd-help">
                {room.groups.length
                  ? 'Пока идёт эфир, ученики этих классов видят его в личном кабинете. По ссылке смотреть может любой.'
                  : 'Выберите классы — эфир появится у их учеников в личном кабинете. По ссылке смотреть может любой.'}
              </div>
            </div>
          )}

          <div className="stereo-live__link">
            <span>{link.short}</span>
            <Tooltip title="Скопировать ссылку">
              <Button size="small" type="text" icon={<CopyOutlined />} onClick={copy} />
            </Tooltip>
          </div>

          {live.isLive ? (
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              <Space.Compact style={{ width: '100%' }}>
                <Button
                  icon={<AimOutlined />}
                  style={{ flex: 1 }}
                  onClick={() => { live.pushCamera(camera); message.success('Ракурс отправлен ученикам'); }}
                >
                  Смотрите отсюда
                </Button>
                <Button danger onClick={live.stop}>Стоп</Button>
              </Space.Compact>
              <Button
                block
                icon={<EyeOutlined />}
                type={live.isLeading ? 'primary' : 'default'}
                className={live.isLeading ? 'stereo-live__lead is-on' : 'stereo-live__lead'}
                aria-pressed={live.isLeading}
                onClick={() => live.setLead(!live.isLeading, camera)}
              >
                {live.isLeading ? 'Все смотрят сюда · отпустить' : 'Все смотрят сюда'}
              </Button>
              <div className="stereo-cmd-help">
                {live.isLeading
                  ? 'Ученики видят каждый ваш поворот и сами чертёж не крутят. Нажмите ещё раз — отпустить.'
                  : 'Каждый шаг сразу появляется у учеников. «Внимание» (W) — мигнуть точкой или прямой у всех.'}
              </div>
            </Space>
          ) : (
            <Button type="primary" block onClick={() => live.start(camera)}>
              ▶ Начать эфир
            </Button>
          )}
        </>
      )}
      {live.error && <div className="stereo-cmd-error">{live.error}</div>}

      <CreateRoomModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (values) => {
          await live.createRoom(values);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function CreateRoomModal({ open, onClose, onCreate }) {
  const [form] = Form.useForm();
  const [groups, setGroups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setErr('');
    api.getTeachingGroups()
      .then((list) => setGroups(Array.isArray(list) ? list : []))
      .catch(() => setGroups([]));
  }, [open]);

  const onGroup = (id) => {
    const g = groups.find((x) => x.id === id);
    if (!g) return;
    form.setFieldsValue({ code: roomCodeFromName(g.name), title: g.name });
  };

  const submit = async () => {
    const v = await form.validateFields();
    setBusy(true);
    setErr('');
    try {
      await onCreate({ code: normalizeRoomCode(v.code), title: v.title || '', group: v.group || null });
      form.resetFields();
    } catch (e) {
      setErr(e?.message || 'Не удалось создать комнату');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Комната для эфира"
      open={open}
      onOk={submit}
      onCancel={onClose}
      okText="Создать"
      cancelText="Отмена"
      confirmLoading={busy}
      destroyOnHidden
    >
      <p className="stereo-cmd-help" style={{ marginTop: 0 }}>
        Комната постоянная: один раз запишите ссылку на доске — ученики
        сохранят её и будут открывать сами, когда вы начнёте эфир.
      </p>
      <Form form={form} layout="vertical">
        <Form.Item name="group" label="Класс">
          <Select
            allowClear
            placeholder="Выберите класс — код подставится сам"
            onChange={onGroup}
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
          />
        </Form.Item>
        <Form.Item
          name="code"
          label="Код ссылки"
          rules={[{ required: true, message: 'Нужен код, например 10a' }]}
          normalize={(v) => String(v || '').toLowerCase().replace(/\s+/g, '-')}
          extra={(
            <Form.Item noStyle shouldUpdate>
              {() => {
                const c = form.getFieldValue('code');
                return c ? `Ссылка: ${roomLink(normalizeRoomCode(c)).short}` : 'Латиница, цифры и дефис';
              }}
            </Form.Item>
          )}
        >
          <Input placeholder="10a" maxLength={24} />
        </Form.Item>
        <Form.Item name="title" label="Название">
          <Input placeholder="10 А" maxLength={200} />
        </Form.Item>
      </Form>
      {err && <Alert type="error" showIcon message={err} />}
    </Modal>
  );
}
