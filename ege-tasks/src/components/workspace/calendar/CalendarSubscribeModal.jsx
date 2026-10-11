import { useCallback, useEffect, useState } from 'react';
import {
  Alert, App, Button, Modal, Popconfirm, Segmented, Space, Spin, Typography,
} from 'antd';
import { CopyOutlined, GoogleOutlined, ReloadOutlined, AppleOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../../shared/services/pocketbase';
import { PB_BASE_URL } from '../../../shared/services/pocketbaseUrl';
import { calendarFeedLinks } from '../../../utils/calendarFeedLink';
import useIsMobile from '../../../hooks/useIsMobile';

const { Text, Paragraph } = Typography;

const APPS = [
  { value: 'apple', label: 'iPhone и Mac' },
  { value: 'google', label: 'Google' },
  { value: 'yandex', label: 'Яндекс' },
];

/**
 * «Календарь на телефоне» (v3.9.352): подписка на ленту .ics — уроки,
 * школьные события и дела со сроком появляются в календаре телефона и
 * обновляются сами. Только в одну сторону: правки делаются в Lemma.
 * Токен выдаёт хук calendar_feed.pb.js при первом открытии окна.
 */
export default function CalendarSubscribeModal({ open, onClose }) {
  const { message } = App.useApp();
  const isMobile = useIsMobile();
  const [token, setToken] = useState(null);
  const [state, setState] = useState('idle'); // idle | loading | ready | error
  const [resetting, setResetting] = useState(false);
  const [app, setApp] = useState('apple');

  const load = useCallback(async () => {
    setState('loading');
    const t = await api.getCalendarFeedToken();
    setToken(t);
    setState(t ? 'ready' : 'error');
  }, []);

  useEffect(() => { if (open && !token) load(); }, [open, token, load]);

  const links = calendarFeedLinks(PB_BASE_URL, token);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(links.https);
      message.success('Ссылка скопирована');
    } catch {
      message.info(links.https);
    }
  };

  const reset = async () => {
    setResetting(true);
    try {
      const t = await api.resetCalendarFeedToken();
      setToken(t);
      message.success('Ссылка заменена — старая больше не работает');
    } catch {
      message.error('Не удалось сменить ссылку');
    } finally {
      setResetting(false);
    }
  };

  return (
    <Modal
      title="Календарь на телефоне"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnHidden
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Text type="secondary">
          Уроки, школьные мероприятия и дела со сроком появятся в обычном календаре
          телефона и будут обновляться сами. Синхронизация в одну сторону: перенести
          урок можно только здесь, в Lemma.
        </Text>

        {state === 'loading' && <Spin />}
        {state === 'error' && (
          <Alert
            type="error"
            showIcon
            message="Не удалось получить ссылку"
            description="Попробуйте ещё раз. Если не поможет — выйдите и войдите заново."
            action={<Button size="small" onClick={load}>Повторить</Button>}
          />
        )}

        {links && (
          <>
            <Segmented block options={APPS} value={app} onChange={setApp} />

            {app === 'apple' && (
              <div className="cal-sub-apple">
                {isMobile ? (
                  <Button type="primary" size="large" block icon={<AppleOutlined />} href={links.webcal}>
                    Подписаться в Календаре
                  </Button>
                ) : (
                  <div className="cal-sub-qr">
                    <QRCodeSVG value={links.webcal} size={168} marginSize={2} />
                    <Text type="secondary">
                      Наведите камеру iPhone на код и нажмите на ссылку — откроется окно
                      «Подписаться на календарь».
                    </Text>
                  </div>
                )}
                <Paragraph type="secondary" style={{ margin: 0 }}>
                  Вручную: Настройки → (Приложения →) Календарь → Учётные записи →
                  Новая учётная запись → Другое → «Подписной календарь», вставьте
                  ссылку ниже.
                </Paragraph>
                <Paragraph type="secondary" style={{ margin: 0 }}>
                  На Mac: Календарь → Файл → «Новая подписка на календарь». Если выбрать
                  место «iCloud», календарь сам появится на iPhone и iPad. Как часто
                  обновлять — там же, удобно «Каждый час».
                </Paragraph>
              </div>
            )}

            {app === 'google' && (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Button icon={<GoogleOutlined />} href={links.google} target="_blank" rel="noopener noreferrer">
                  Добавить в Google Календарь
                </Button>
                <Text type="secondary">
                  Google перечитывает подписки редко — перенос урока может дойти только
                  через несколько часов, иногда к следующему дню. На iPhone быстрее
                  подписаться напрямую (вкладка «iPhone и Mac»).
                </Text>
              </Space>
            )}

            {app === 'yandex' && (
              <Text type="secondary">
                В Яндекс Календаре на компьютере добавьте подписку по ссылке (раздел
                «Подписки» в левой панели) и вставьте ссылку ниже. На iPhone быстрее
                подписаться напрямую — вкладка «iPhone и Mac».
              </Text>
            )}

            <div className="cal-sub-link">
              <Text code className="cal-sub-link__url" ellipsis>{links.https}</Text>
              <Button size="small" icon={<CopyOutlined />} onClick={copy}>Скопировать</Button>
            </div>

            <Alert
              type="info"
              showIcon
              message="Ссылка личная"
              description="По ней ваш календарь виден без входа в Lemma. Не публикуйте её; если она попала не туда — смените."
              action={(
                <Popconfirm
                  title="Сменить ссылку?"
                  description="Старая перестанет работать — подписку на всех устройствах придётся добавить заново."
                  okText="Сменить"
                  cancelText="Отмена"
                  onConfirm={reset}
                >
                  <Button size="small" icon={<ReloadOutlined />} loading={resetting}>Сменить</Button>
                </Popconfirm>
              )}
            />
          </>
        )}
      </Space>
    </Modal>
  );
}
