import { useEffect } from 'react';
import { Alert, Button, Form, Input, Modal, Space } from 'antd';
import { SaveOutlined } from '@ant-design/icons';

const SaveGeometryPrintModal = ({
  visible,
  onCancel,
  onSave,
  saving = false,
  initialTitle = 'Лист геометрии A5',
  tasksCount = 6,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({ title: initialTitle });
    }
  }, [form, initialTitle, visible]);

  return (
    <Modal
      title={(
        <Space>
          <SaveOutlined />
          <span>Сохранить лист A5</span>
        </Space>
      )}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={520}
    >
      <Form form={form} layout="vertical" onFinish={onSave}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Будет сохранён печатный лист"
          description={`Формат: A5, задач на листе: ${tasksCount}`}
        />

        <Form.Item
          name="title"
          label="Название листа"
          rules={[{ required: true, message: 'Введите название листа' }]}
        >
          <Input placeholder="Например: Геометрия 8 класс — самостоятельная №3" maxLength={200} />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
              Сохранить
            </Button>
            <Button onClick={onCancel}>Отмена</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SaveGeometryPrintModal;
