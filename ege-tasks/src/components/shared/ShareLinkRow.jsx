import { App, Button, Popover, Space, Tooltip, Typography } from 'antd';
import { CopyOutlined, QrcodeOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import './shareLinkRow.css';

const { Text } = Typography;

/**
 * Строка ссылки ученику: подпись, адрес, «скопировать» и QR-код.
 * link = { full, short }. Общая для геометрической работы (/w/) и показа
 * условий обычной работы (/r/); список строк оборачивать в `.share-links`.
 */
export default function ShareLinkRow({ label, link, disabled }) {
  const { message } = App.useApp();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.full);
      message.success('Ссылка скопирована');
    } catch {
      message.info(link.full);
    }
  };
  return (
    <div className="share-link">
      <span className="share-link__label">{label}</span>
      <Text code className="share-link__url" disabled={disabled}>{link.short}</Text>
      <Space size={2}>
        <Tooltip title="Скопировать ссылку">
          <Button size="small" icon={<CopyOutlined />} onClick={copy} disabled={disabled} aria-label={`Скопировать: ${label}`} />
        </Tooltip>
        <Popover
          trigger="click"
          content={<QRCodeSVG value={link.full} size={180} marginSize={2} />}
          title={label}
        >
          <Button size="small" icon={<QrcodeOutlined />} disabled={disabled} aria-label={`QR-код: ${label}`} />
        </Popover>
      </Space>
    </div>
  );
}
