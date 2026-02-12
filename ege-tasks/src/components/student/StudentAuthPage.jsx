import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Tabs, Space, Alert, App } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined, UserAddOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';

const { Title, Text } = Typography;

/**
 * Страница регистрации/входа для студентов
 */
const StudentAuthPage = ({ onAuthSuccess, sessionTitle }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const authData = await api.loginStudent(values.username, values.password);
      message.success(`Добро пожаловать, ${authData.record.username}!`);
      onAuthSuccess(authData.record);
    } catch (err) {
      console.error('Login error:', err);
      message.error('Неверное имя пользователя или пароль');
    }
    setLoading(false);
  };

  const handleRegister = async (values) => {
    if (values.password !== values.passwordConfirm) {
      message.error('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      const student = await api.registerStudent({
        username: values.username,
        password: values.password,
        passwordConfirm: values.passwordConfirm,
        name: values.name || values.username,
      });

      // Автоматический вход после регистрации
      const authData = await api.loginStudent(values.username, values.password);
      message.success(`Регистрация успешна! Добро пожаловать, ${student.username}!`);
      onAuthSuccess(authData.record);
    } catch (err) {
      console.error('Register error:', err);
      if (err.response?.data?.username) {
        message.error('Это имя пользователя уже занято');
      } else {
        message.error('Ошибка регистрации. Попробуйте другое имя пользователя.');
      }
    }
    setLoading(false);
  };

  const loginTab = (
    <Form
      form={loginForm}
      layout="vertical"
      onFinish={handleLogin}
      size="large"
    >
      <Form.Item
        name="username"
        label="Имя пользователя"
        rules={[{ required: true, message: 'Введите имя пользователя' }]}
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="Ваше имя пользователя"
          autoComplete="username"
        />
      </Form.Item>

      <Form.Item
        name="password"
        label="Пароль"
        rules={[{ required: true, message: 'Введите пароль' }]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="Ваш пароль"
          autoComplete="current-password"
        />
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          icon={<LoginOutlined />}
          loading={loading}
        >
          Войти
        </Button>
      </Form.Item>

      <div style={{ textAlign: 'center' }}>
        <Text type="secondary">
          Нет аккаунта?{' '}
          <Button type="link" onClick={() => setActiveTab('register')} style={{ padding: 0 }}>
            Зарегистрироваться
          </Button>
        </Text>
      </div>
    </Form>
  );

  const registerTab = (
    <Form
      form={registerForm}
      layout="vertical"
      onFinish={handleRegister}
      size="large"
    >
      <Form.Item
        name="username"
        label="Имя пользователя"
        rules={[
          { required: true, message: 'Введите имя пользователя' },
          { min: 3, message: 'Минимум 3 символа' },
          { pattern: /^[\w][\w.-]*$/, message: 'Только буквы, цифры, точки и дефисы' }
        ]}
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="Придумайте имя пользователя"
          autoComplete="username"
        />
      </Form.Item>

      <Form.Item
        name="name"
        label="Ваше имя (опционально)"
      >
        <Input
          placeholder="Как вас зовут?"
        />
      </Form.Item>

      <Form.Item
        name="password"
        label="Пароль"
        rules={[
          { required: true, message: 'Введите пароль' },
          { min: 4, message: 'Минимум 4 символа' }
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="Придумайте пароль"
          autoComplete="new-password"
        />
      </Form.Item>

      <Form.Item
        name="passwordConfirm"
        label="Подтвердите пароль"
        dependencies={['password']}
        rules={[
          { required: true, message: 'Подтвердите пароль' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('Пароли не совпадают'));
            },
          }),
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="Повторите пароль"
          autoComplete="new-password"
        />
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          icon={<UserAddOutlined />}
          loading={loading}
        >
          Зарегистрироваться
        </Button>
      </Form.Item>

      <div style={{ textAlign: 'center' }}>
        <Text type="secondary">
          Уже есть аккаунт?{' '}
          <Button type="link" onClick={() => setActiveTab('login')} style={{ padding: 0 }}>
            Войти
          </Button>
        </Text>
      </div>
    </Form>
  );

  return (
    <div style={{ padding: '40px 16px', maxWidth: 450, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={3} style={{ marginBottom: 8 }}>
          {sessionTitle || 'Тест'}
        </Title>
        <Text type="secondary">
          Войдите или создайте аккаунт, чтобы сохранить свои достижения
        </Text>
      </div>

      <Alert
        message="Зачем нужна регистрация?"
        description="Ваши достижения и результаты будут сохранены в личном кабинете. Вы сможете просматривать их с любого устройства."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            {
              key: 'login',
              label: (
                <Space>
                  <LoginOutlined />
                  Вход
                </Space>
              ),
              children: loginTab
            },
            {
              key: 'register',
              label: (
                <Space>
                  <UserAddOutlined />
                  Регистрация
                </Space>
              ),
              children: registerTab
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default StudentAuthPage;
