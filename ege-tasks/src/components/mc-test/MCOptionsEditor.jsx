import { Input, Button, Radio, Tooltip, Space } from 'antd';
import { ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const MCOptionsEditor = ({
  options,
  onUpdateOption,
  onSetCorrect,
  onReorder,
  onRegenerate,
}) => {
  return (
    <div style={{ marginTop: 8 }}>
      <Space style={{ marginBottom: 8 }}>
        <Tooltip title="Перегенерировать варианты ответов из правильного">
          <Button size="small" icon={<ReloadOutlined />} onClick={onRegenerate}>
            Перегенерировать
          </Button>
        </Tooltip>
      </Space>

      {options.map((opt, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: 6,
            padding: 6,
            border: '1px solid #f0f0f0',
            borderRadius: 4,
            background: opt.is_correct ? '#f6ffed' : '#fafafa',
          }}
        >
          <Radio
            checked={opt.is_correct}
            onChange={() => onSetCorrect(idx)}
            style={{ marginTop: 4 }}
          />
          <span style={{ fontWeight: 600, minWidth: 18, marginTop: 4 }}>
            {LETTERS[idx]}.
          </span>
          <div style={{ flex: 1 }}>
            <Input.TextArea
              value={opt.text}
              onChange={(e) => onUpdateOption(idx, e.target.value)}
              autoSize={{ minRows: 1, maxRows: 4 }}
              placeholder={opt.is_correct ? 'Правильный ответ' : 'Неправильный ответ'}
            />
            {opt.text && (
              <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                <MathRenderer text={opt.text} />
              </div>
            )}
          </div>
          <Space.Compact direction="vertical">
            <Button
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={idx === 0}
              onClick={() => onReorder(idx, idx - 1)}
            />
            <Button
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={idx === options.length - 1}
              onClick={() => onReorder(idx, idx + 1)}
            />
          </Space.Compact>
        </div>
      ))}
    </div>
  );
};

export default MCOptionsEditor;
