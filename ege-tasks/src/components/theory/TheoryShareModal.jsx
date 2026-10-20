import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Modal, Popover, Space, Switch, Tooltip, Typography,
} from 'antd';
import { CopyOutlined, ExportOutlined, QrcodeOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../services/pocketbase';
import { articleLink } from '../../utils/theoryLink';

const { Text } = Typography;

/**
 * «Поделиться»: открыть статью. Открытая статья видна коллегам в «Теории»
 * (только для чтения) и читается по ссылке student.oipav.ru/t/<id> — без
 * входа, с компьютера и телефона. Закрытая — личная: её видит только автор.
 * Переключатель сохраняется сразу, мимо «Сохранить» редактора.
 */
export default function TheoryShareModal({ open, onClose, articleId, isPublic, onChange, dirty = false }) {
  const { message } = App.useApp();
  const [value, setValue] = useState(!!isPublic);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setValue(!!isPublic); }, [open, isPublic]);

  const link = articleLink(articleId);
  const closed = !value;

  const toggle = async (next) => {
    setValue(next);
    setSaving(true);
    try {
      await api.setTheoryArticlePublic(articleId, next);
      onChange?.(next);
    } catch (e) {
      message.error(`Не удалось сохранить: ${e?.message || 'ошибка'}`);
      setValue(!next);
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.full);
      message.success('Ссылка скопирована');
    } catch {
      message.info(link.full);
    }
  };

  return (
    <Modal title="Доступ к статье" open={open} onCancel={onClose} footer={null} width={560} destroyOnHidden>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Space align="center">
          <Switch checked={value} loading={saving} onChange={toggle} aria-label="Открыть статью" />
          <Text strong>{value ? 'Открыта коллегам и по ссылке' : 'Личная — видите только вы'}</Text>
        </Space>
        <Text type="secondary">
          Открытую статью коллеги видят в «Теории» (править её можете только вы),
          а по ссылке её прочитает любой: ученики, родители. Вход не нужен,
          страница одинаково удобна на компьютере и на телефоне.
        </Text>
        {dirty && (
          <Alert type="warning" showIcon message="В статье есть несохранённые изменения — коллеги и читатели по ссылке видят последнюю сохранённую версию" />
        )}

        <div className="theory-share-link">
          <Text code className="theory-share-link__url" disabled={closed}>{link.short}</Text>
          <Space size={4}>
            <Tooltip title="Скопировать ссылку">
              <Button size="small" icon={<CopyOutlined />} onClick={copy} disabled={closed} aria-label="Скопировать ссылку" />
            </Tooltip>
            <Popover
              trigger="click"
              content={<QRCodeSVG value={link.full} size={180} marginSize={2} />}
              title="QR-код статьи"
            >
              <Button size="small" icon={<QrcodeOutlined />} disabled={closed} aria-label="QR-код" />
            </Popover>
            <Tooltip title="Открыть, как увидит читатель">
              <Button
                size="small"
                icon={<ExportOutlined />}
                href={link.full}
                target="_blank"
                rel="noopener noreferrer"
                disabled={closed}
                aria-label="Открыть по ссылке"
              />
            </Tooltip>
          </Space>
        </div>
        {closed && <Text type="secondary">Ссылка заработает, когда статья будет открыта.</Text>}
      </Space>
    </Modal>
  );
}
