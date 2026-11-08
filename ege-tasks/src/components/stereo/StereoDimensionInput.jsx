import { Input } from 'antd';
import { dimensionValue } from '../../utils/stereo/dimensions';

export const DIMENSION_HINT = 'Можно вводить 2√3, 2*sqrt(3), √(5/2), (1+√5)/2, π. Размеры должны быть больше нуля.';

export function dimensionRules({ optional = false } = {}) {
  return [{
    validator: (_, value) => {
      if (optional && (value == null || value === '')) return Promise.resolve();
      const n = dimensionValue(value);
      if (!Number.isFinite(n)) return Promise.reject(new Error('Введите число или выражение, например 2√3'));
      if (optional ? n < 0 : n <= 0) return Promise.reject(new Error(optional ? 'Размер не может быть отрицательным' : 'Размер должен быть больше нуля'));
      return Promise.resolve();
    },
  }];
}

export default function StereoDimensionInput(props) {
  return <Input autoComplete="off" spellCheck={false} maxLength={256} style={{ width: 170 }} {...props} />;
}
