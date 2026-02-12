import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Space, App } from 'antd';
import { UserOutlined, UserAddOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';

const { Title, Text } = Typography;

/**
 * Страница обязательной регистрации для студентов
 */
const StudentAuthPage = ({ onAuthSuccess, sessionTitle }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      // Генерируем уникальный username из имени и случайного числа
      const timestamp = Date.now().toString().slice(-6);
      const randomNum = Math.floor(Math.random() * 1000);
      const username = `student_${timestamp}_${randomNum}`;

      // Простой пароль - комбинация из фамилии и случайного числа
      const password = `${values.lastName.toLowerCase()}${randomNum}`;

      // Полное имя для отображения
      const fullName = `${values.firstName} ${values.lastName}`;

      // Регистрируем студента
      await api.registerStudent({
        username,
        password,
        passwordConfirm: password,
        name: fullName,
      });

      // Автоматический вход
      const authData = await api.loginStudent(username, password);
      message.success(`Добро пожаловать, ${fullName}!`);
      onAuthSuccess(authData.record);
    } catch (err) {
      console.error('Register error:', err);
      // Если username занят (маловероятно), пробуем еще раз
      message.error('Ошибка регистрации. Попробуйте еще раз.');
    }
    setLoading(false);
  };


  return (
    <div style={{ padding: '40px 16px', maxWidth: 450, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={3} style={{ marginBottom: 8 }}>
          {sessionTitle || 'Тест'}
        </Title>
        <Text type="secondary">
          Представьтесь, пожалуйста
        </Text>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
          autoComplete="off"
        >
          <Form.Item
            name="firstName"
            label="Имя"
            rules={[
              { required: true, message: 'Введите ваше имя' },
              { min: 2, message: 'Минимум 2 символа' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Иван"
              autoFocus
            />
          </Form.Item>

          <Form.Item
            name="lastName"
            label="Фамилия"
            rules={[
              { required: true, message: 'Введите вашу фамилию' },
              { min: 2, message: 'Минимум 2 символа' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Иванов"
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              icon={<UserAddOutlined />}
              loading={loading}
              size="large"
            >
              Начать тест
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Ваши результаты и достижения будут сохранены
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default StudentAuthPage;
