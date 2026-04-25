/**
 * FilterRow — горизонтальная строка фильтров над таблицей.
 * Просто flex-контейнер с правильными отступами.
 * Дочерние элементы: Input, Select, Button, Segmented — любые Antd-компоненты.
 */
export function FilterRow({ children, style }) {
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      marginBottom: 12,
      flexWrap: 'wrap',
      ...style,
    }}>
      {children}
    </div>
  );
}
