import { Row, Col, Select, InputNumber, Button, Alert, Tag } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';

const { Option } = Select;

/**
 * Универсальная панель распределения задач по категориям.
 *
 * @param {Array} items - текущие элементы распределения [{keyField: value, count: number}]
 * @param {Array} options - доступные опции [{value, label, color?}]
 * @param {string} keyField - имя ключевого поля ('tag' | 'difficulty')
 * @param {Function} onAdd - добавить элемент
 * @param {Function} onRemove - удалить элемент (index) => void
 * @param {Function} onChange - обновить элемент (index, field, value) => void
 * @param {number} total - текущая сумма задач
 * @param {number} [expectedTotal] - ожидаемая общая сумма (для проверки совпадения)
 * @param {string} addButtonText - текст кнопки добавления
 * @param {string} selectPlaceholder - плейсхолдер для селекта
 * @param {boolean} [showColorTags] - отображать цветные теги в опциях
 */
const DistributionPanel = ({
  items = [],
  options = [],
  keyField,
  onAdd,
  onRemove,
  onChange,
  total = 0,
  expectedTotal,
  addButtonText = 'Добавить',
  selectPlaceholder = 'Выберите',
  showColorTags = false,
}) => {
  return (
    <>
      {items.map((item, index) => (
        <Row key={index} gutter={16} style={{ marginBottom: 8 }}>
          <Col xs={24} md={12}>
            <Select
              placeholder={selectPlaceholder}
              value={item[keyField]}
              onChange={(value) => onChange(index, keyField, value)}
              style={{ width: '100%' }}
            >
              {options.map(opt => (
                <Option key={opt.value} value={opt.value}>
                  {showColorTags && opt.color ? (
                    <>
                      <Tag color={opt.color} style={{ marginRight: 4 }}>{opt.value}</Tag>
                      {opt.label}
                    </>
                  ) : (
                    opt.label || opt.title || opt.value
                  )}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={18} md={10}>
            <InputNumber
              min={1}
              max={100}
              value={item.count}
              onChange={(value) => onChange(index, 'count', value)}
              style={{ width: '100%' }}
              placeholder="Количество задач"
            />
          </Col>
          <Col xs={6} md={2}>
            <Button
              type="text"
              danger
              icon={<MinusCircleOutlined />}
              onClick={() => onRemove(index)}
            />
          </Col>
        </Row>
      ))}

      <Button
        type="dashed"
        onClick={onAdd}
        icon={<PlusOutlined />}
        style={{ width: '100%', marginBottom: 16 }}
      >
        {addButtonText}
      </Button>

      {items.length > 0 && expectedTotal !== undefined && (
        <Alert
          message={
            <div>
              <div>Задач по распределению: <strong>{total}</strong></div>
              <div>Общее количество: <strong>{expectedTotal}</strong></div>
              {total !== expectedTotal && (
                <div style={{ color: '#ff4d4f', marginTop: 4 }}>
                  ⚠️ Суммы не совпадают!
                </div>
              )}
            </div>
          }
          type={total === expectedTotal ? 'success' : 'error'}
          style={{ marginBottom: 16 }}
        />
      )}
    </>
  );
};

export default DistributionPanel;
