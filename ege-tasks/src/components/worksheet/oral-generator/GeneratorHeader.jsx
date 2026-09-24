import { Segmented, Button, Tooltip } from 'antd';
import { FileTextOutlined, AppstoreOutlined, FolderOpenOutlined } from '@ant-design/icons';

const OUTPUT_OPTIONS = [
  {
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
        <FileTextOutlined />
        Лист задач
      </span>
    ),
    value: 'sheet',
  },
  {
    label: (
      <Tooltip title="Несколько одинаковых работ на одном листе A4 — лист режется по пунктиру">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
          <AppstoreOutlined />
          Карточки
        </span>
      </Tooltip>
    ),
    value: 'cards',
  },
];

export default function GeneratorHeader({ outputMode, setOutputMode, onOpenLoad }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 16,
      }}
    >
      <Segmented
        size="large"
        value={outputMode}
        onChange={setOutputMode}
        options={OUTPUT_OPTIONS}
      />
      <Button icon={<FolderOpenOutlined />} onClick={onOpenLoad}>
        Мои работы
      </Button>
    </div>
  );
}
