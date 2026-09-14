import { Space, Tooltip, Typography } from 'antd';

const { Text } = Typography;

/**
 * Строка панели настроек печатного листа: подпись (с подсказкой) + контрол.
 * Общая для отрезного листа и листа карточек — панели должны выглядеть
 * одинаково, учитель ходит между ними.
 */
export default function SettingRow({ label, hint, children }) {
  const text = <Text style={{ fontSize: 13 }}>{label}</Text>;
  return (
    <Space size={6}>
      {hint ? <Tooltip title={hint}>{text}</Tooltip> : text}
      {children}
    </Space>
  );
}
