import { Row, Col, Form, Select, InputNumber } from 'antd';

const { Option } = Select;

/**
 * Компонент настроек генерации вариантов
 */
const VariantSettings = ({
  variantsCount,
  setVariantsCount,
  variantsMode,
  setVariantsMode,
  sortType,
  setSortType,
  showTasksCount = true,
  tasksPerVariant,
}) => {
  return (
    <>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item name="variantsCount" label="Количество вариантов">
            <InputNumber
              min={1}
              max={50}
              value={variantsCount}
              onChange={setVariantsCount}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={8}>
          <Form.Item name="variantsMode" label="Режим вариантов">
            <Select value={variantsMode} onChange={setVariantsMode}>
              <Option value="different">Разные задачи</Option>
              <Option value="shuffled">Одинаковые, разный порядок</Option>
              <Option value="same">Одинаковые задачи</Option>
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} md={8}>
          <Form.Item name="sortType" label="Сортировка задач">
            <Select value={sortType} onChange={setSortType}>
              <Option value="random">Случайная</Option>
              <Option value="code">По коду</Option>
              <Option value="difficulty">По сложности</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      {showTasksCount && tasksPerVariant > 0 && (
        <Row gutter={16}>
          <Col xs={24}>
            <div style={{
              padding: '12px 16px',
              background: '#f5f5f5',
              borderRadius: 6,
              border: '1px solid #d9d9d9',
            }}>
              <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
                Всего задач:
              </div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                {variantsCount * tasksPerVariant}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {variantsCount} вариант(ов) × {tasksPerVariant} задач
              </div>
            </div>
          </Col>
        </Row>
      )}
    </>
  );
};

export default VariantSettings;
