import { useEffect } from 'react';
import { Alert, Button, Form, Input, Modal, Space } from 'antd';
import { EditOutlined, SaveOutlined } from '@ant-design/icons';

const SaveGeometryPrintModal = ({
  visible,
  onCancel,
  onSave,
  saving = false,
  isUpdate = false,
  initialTitle = 'Лист геометрии A5',
  initialSheetTopic = '',
  initialSheetSubtopic = '',
  tasksCount = 6,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        title: initialTitle,
        sheet_topic: initialSheetTopic,
        sheet_subtopic: initialSheetSubtopic,
      });
    }
  }, [form, initialTitle, initialSheetTopic, initialSheetSubtopic, visible]);

  const Icon = isUpdate ? EditOutlined : SaveOutlined;

  return (
    <Modal
      title={(
        <Space>
          <Icon />
          <span>{isUpdate ? 'Обновить лист A5' : 'Сохранить лист A5'}</span>
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
          message={isUpdate ? 'Лист будет обновлён' : 'Будет сохранён новый печатный лист'}
          description={`Формат: A5, задач на листе: ${tasksCount}`}
        />

        <Form.Item
          name="title"
          label="Название листа (для списка работ)"
          rules={[{ required: true, message: 'Введите название листа' }]}
        >
          <Input placeholder="Например: Геометрия 8 класс — самостоятельная №3" maxLength={200} />
        </Form.Item>

        <Form.Item name="sheet_topic" label="Тема (заголовок на печатном листе)">
          <Input placeholder="Треугольники" maxLength={200} />
        </Form.Item>

        <Form.Item name="sheet_subtopic" label="Подтема (подзаголовок на печатном листе)">
          <Input placeholder="Средняя линия треугольника" maxLength={200} />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving} icon={<Icon />}>
              {isUpdate ? 'Обновить' : 'Сохранить'}
            </Button>
            <Button onClick={onCancel}>Отмена</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SaveGeometryPrintModal;
