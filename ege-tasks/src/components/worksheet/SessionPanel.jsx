import { useState, useEffect, useCallback, useRef } from 'react';
import { Switch, Input, Button, Space, Typography, Spin, Alert, message, Divider, Modal } from 'antd';
import { CopyOutlined, QrcodeOutlined, DownloadOutlined, LinkOutlined, FullscreenOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../services/pocketbase';
import TeacherResultsDashboard from './TeacherResultsDashboard';

const { Text, Title } = Typography;

/**
 * Панель «Выдача» для TestWorkGenerator.
 * Создаёт/загружает сессию, показывает QR-код и ссылку, управляет приёмом.
 */
const SessionPanel = ({ workId }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState(() => window.location.hostname + ':5173');
  const [qrFullscreen, setQrFullscreen] = useState(false);
  const qrRef = useRef();

  // Загрузить или создать сессию
  useEffect(() => {
    if (!workId) return;
    const init = async () => {
      setLoading(true);
      try {
        let existing = await api.getSessionByWork(workId);
        if (!existing) {
          existing = await api.createSession({
            work: workId,
            is_open: true,
            host_override: host,
          });
        } else if (existing.host_override) {
          setHost(existing.host_override);
        }
        setSession(existing);
      } catch (err) {
        console.error('Error loading session:', err);
        message.error('Ошибка загрузки сессии выдачи');
      }
      setLoading(false);
    };
    init();
  }, [workId]);

  const studentUrl = session ? `http://${host}/student/${session.id}` : '';

  const toggleOpen = async (checked) => {
    if (!session) return;
    try {
      const updated = await api.updateSession(session.id, { is_open: checked });
      setSession({ ...session, ...updated });
      message.success(checked ? 'Приём открыт' : 'Приём закрыт');
    } catch (err) {
      message.error('Ошибка обновления сессии');
    }
  };

  const handleHostChange = useCallback(async (e) => {
    const newHost = e.target.value;
    setHost(newHost);
    if (session) {
      try {
        await api.updateSession(session.id, { host_override: newHost });
      } catch (err) {
        // Тихая ошибка при обновлении host
      }
    }
  }, [session]);

  const copyLink = () => {
    navigator.clipboard.writeText(studentUrl).then(() => {
      message.success('Ссылка скопирована');
    }).catch(() => {
      message.error('Не удалось скопировать');
    });
  };

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const link = document.createElement('a');
      link.download = 'qr-code.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>;
  }

  if (!session) {
    return <Alert type="error" message="Не удалось создать сессию выдачи" />;
  }

  return (
    <div>
      {/* Управление приёмом */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong>Приём ответов:</Text>
        <Switch
          checked={session.is_open}
          onChange={toggleOpen}
          checkedChildren="Открыт"
          unCheckedChildren="Закрыт"
        />
      </div>

      {/* Host */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Host / IP адрес:</Text>
        <Input
          value={host}
          onChange={handleHostChange}
          placeholder="192.168.1.100:5173"
          addonBefore={<LinkOutlined />}
        />
      </div>

      {/* Ссылка */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Ссылка для учеников:</Text>
        <Input.Group compact>
          <Input
            value={studentUrl}
            readOnly
            style={{ width: 'calc(100% - 40px)' }}
          />
          <Button icon={<CopyOutlined />} onClick={copyLink} />
        </Input.Group>
      </div>

      {/* QR-код */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div ref={qrRef} style={{ display: 'inline-block', padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0' }}>
          <QRCodeSVG value={studentUrl} size={200} level="M" />
        </div>
        <div style={{ marginTop: 12 }}>
          <Space>
            <Button icon={<CopyOutlined />} onClick={copyLink}>Скопировать ссылку</Button>
            <Button icon={<DownloadOutlined />} onClick={downloadQR}>Скачать QR</Button>
            <Button icon={<FullscreenOutlined />} onClick={() => setQrFullscreen(true)}>На весь экран</Button>
          </Space>
        </div>
      </div>

      {/* Полноэкранный QR-код для проектора */}
      <Modal
        open={qrFullscreen}
        onCancel={() => setQrFullscreen(false)}
        footer={null}
        width="100vw"
        centered
        closable
        styles={{
          body: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '70vh',
            padding: 40,
          },
          mask: { background: 'rgba(0, 0, 0, 0.85)' },
        }}
        style={{ top: 0, maxWidth: '100vw', padding: 0 }}
      >
        <div style={{ background: '#fff', padding: 40, borderRadius: 24, display: 'inline-block' }}>
          <QRCodeSVG value={studentUrl} size={Math.min(window.innerWidth * 0.6, window.innerHeight * 0.6, 600)} level="M" />
        </div>
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Title level={3} style={{ color: '#fff', marginBottom: 8 }}>{studentUrl}</Title>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>Отсканируйте QR-код или перейдите по ссылке</Text>
        </div>
      </Modal>

      {/* Результаты */}
      <Divider>Результаты учеников</Divider>
      <TeacherResultsDashboard sessionId={session.id} />
    </div>
  );
};

export default SessionPanel;
