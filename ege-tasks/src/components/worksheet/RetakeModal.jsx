import { useEffect, useMemo, useState } from 'react';
import { Modal, InputNumber, Table, Typography, Space, Alert, Tag } from 'antd';
import { retakeCandidates } from '../../utils/attemptRetake';

const STORE_KEY = 'results.retakeThreshold';

const readThreshold = () => {
  try {
    const v = Number(localStorage.getItem(STORE_KEY));
    return v > 0 && v <= 100 ? v : 50;
  } catch { return 50; }
};

/**
 * «Ещё попытка тем, кто ниже порога» (v3.9.380): методический сценарий
 * «класс провалил устный счёт — слабым даю переписать». Каждому отмеченному
 * создаётся новая начатая попытка (другой вариант) в той же выдаче —
 * остальным ничего не меняется, «Несколько попыток» не включается.
 * Ученик увидит её на главной («Продолжить») и в уроке
 * («Учитель дал ещё попытку»), а по ссылке выдачи попадёт сразу в неё.
 */
export default function RetakeModal({ open, onClose, attempts, onIssue, closed = false }) {
  const [threshold, setThreshold] = useState(readThreshold);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => retakeCandidates(attempts, threshold), [attempts, threshold]);
  const rowKeys = rows.map((r) => r.key).join('|');
  useEffect(() => { if (open) setSelected(rows.map((r) => r.key)); }, [open, rowKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeThreshold = (v) => {
    const n = Math.max(1, Math.min(100, Math.round(Number(v) || 50)));
    setThreshold(n);
    try { localStorage.setItem(STORE_KEY, String(n)); } catch { /* не важно */ }
  };

  const handleOk = async () => {
    const chosen = rows.filter((r) => selected.includes(r.key));
    if (!chosen.length) return;
    setBusy(true);
    try {
      await onIssue(chosen.map((r) => r.attempt));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText={selected.length ? `Дать попытку (${selected.length})` : 'Дать попытку'}
      okButtonProps={{ disabled: !selected.length }}
      cancelText="Отмена"
      confirmLoading={busy}
      title="Ещё попытка тем, кто написал слабо"
      width={560}
      destroyOnHidden
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space size={8} wrap>
          <Typography.Text>Лучший результат ниже</Typography.Text>
          <InputNumber min={1} max={100} value={threshold} onChange={changeThreshold} addonAfter="%" style={{ width: 110 }} aria-label="Порог" />
        </Space>
        {closed && (
          <Alert
            type="warning"
            showIcon
            message="Приём по этой выдаче закрыт: на главной ученик попытку не увидит, откроет только по ссылке. Включите «Приём» во вкладке «Выдача»."
          />
        )}
        {rows.length === 0 ? (
          <Alert type="success" showIcon message="Все, кто сдал, написали не ниже порога — или им уже выдана попытка." />
        ) : (
          <Table
            size="small"
            rowKey="key"
            pagination={false}
            dataSource={rows}
            scroll={{ y: 320 }}
            rowSelection={{ selectedRowKeys: selected, onChange: setSelected }}
            columns={[
              { title: 'Ученик', dataIndex: 'name' },
              {
                title: 'Лучший',
                dataIndex: 'bestPct',
                width: 90,
                render: (v) => <Tag color={v < 40 ? 'red' : 'orange'}>{v}%</Tag>,
              },
              { title: 'Попыток', dataIndex: 'count', width: 80 },
            ]}
          />
        )}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Каждому — новая попытка с другим вариантом в той же выдаче. Ученик увидит её
          на главной («Продолжить») и в карточке урока; в журнал и Excel идёт лучшая попытка.
          Остальным ничего не меняется.
        </Typography.Text>
      </Space>
    </Modal>
  );
}
