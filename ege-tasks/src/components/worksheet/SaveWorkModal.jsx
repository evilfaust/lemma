import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Button, Space, Alert } from 'antd';
import { SaveOutlined } from '@ant-design/icons';

/**
 * Модальное окно сохранения работы.
 *
 * @param {boolean} visible - видимость модалки
 * @param {Function} onCancel - закрытие модалки
 * @param {Function} onSave - сохранение (values) => void
 * @param {boolean} saving - индикатор сохранения
 * @param {number} variantsCount - количество вариантов
 * @param {number} tasksCount - общее количество задач
 * @param {string} initialTitle - начальное название работы
 * @param {number|null} initialTimeLimit - начальное время (мин)
 * @param {boolean} isEdit - режим редактирования
 */
const SaveWorkModal = ({
  visible,
  onCancel,
  onSave,
  saving = false,
  variantsCount = 0,
  tasksCount = 0,
  initialTitle = 'Контрольная работа',
  initialTimeLimit = null,
  isEdit = false,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        title: initialTitle,
        timeLimit: initialTimeLimit,
      });
    }
  }, [visible, initialTitle, initialTimeLimit, form]);

  return (
    <Modal
      title={
        <Space>
          <SaveOutlined />
          <span>{isEdit ? 'Сохранить изменения' : 'Сохранить работу'}</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSave}
      >
        <Alert
          message="Информация"
          description={
            isEdit
              ? `Изменения будут применены к ${variantsCount} вариант(ам) с общим количеством ${tasksCount} задач.`
              : `Будет сохранено ${variantsCount} вариант(ов) с общим количеством ${tasksCount} задач.`
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item
          name="title"
          label="Название работы"
          rules={[{ required: true, message: 'Введите название работы' }]}
        >
          <Input placeholder="Например: Контрольная - логарифмы и степени" />
        </Form.Item>

        <Form.Item name="timeLimit" label="Время на выполнение (минут)">
          <InputNumber
            min={1}
            max={300}
            style={{ width: '100%' }}
            placeholder="Например: 45"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
              Сохранить
            </Button>
            <Button onClick={onCancel}>Отмена</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SaveWorkModal;
