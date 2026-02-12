import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Tabs, App } from 'antd';
import { UserOutlined, LockOutlined, UserAddOutlined, LoginOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';

const { Title, Text } = Typography;

/**
 * Страница авторизации и регистрации для студентов
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
      message.success(`Добро пожаловать, ${authData.record.name}!`);
      onAuthSuccess(authData.record);
    } catch (err) {
      console.error('Login error:', err);
      message.error('Неверный логин или пароль');
    }
    setLoading(false);
  };

  const handleRegister = async (values) => {
    setLoading(true);
    try {
      // Регистрируем студента
      await api.registerStudent({
        username: values.username,
        password: values.password,
        passwordConfirm: values.password,
        name: values.name,
      });

      // Автоматический вход
      const authData = await api.loginStudent(values.username, values.password);
      message.success(`Добро пожаловать, ${values.name}!`);
      onAuthSuccess(authData.record);
    } catch (err) {
      console.error('Register error:', err);
      if (err.data?.data?.username?.message?.includes('already exists')) {
        message.error('Этот логин уже занят');
      } else {
        message.error('Ошибка регистрации. Проверьте данные.');
      }
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
          Войдите или зарегистрируйтесь для продолжения
        </Text>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            {
              key: 'login',
              label: 'Вход',
              children: (
                <Form
                  form={loginForm}
                  layout="vertical"
                  onFinish={handleLogin}
                  size="large"
                  autoComplete="off"
                >
                  <Form.Item
                    name="username"
                    label="Логин"
                    rules={[{ required: true, message: 'Введите логин' }]}
                  >
                    <Input
                      prefix={<UserOutlined />}
                      placeholder="Ваш логин"
                      autoFocus={activeTab === 'login'}
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
                    />
                  </Form.Item>

                  <Form.Item style={{ marginTop: 24 }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      block
                      icon={<LoginOutlined />}
                      loading={loading}
                      size="large"
                    >
                      Войти
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'register',
              label: 'Регистрация',
              children: (
                <Form
                  form={registerForm}
                  layout="vertical"
                  onFinish={handleRegister}
                  size="large"
                  autoComplete="off"
                >
                  <Form.Item
                    name="name"
                    label="Фамилия и имя"
                    rules={[
                      { required: true, message: 'Введите фамилию и имя' },
                      { min: 5, message: 'Минимум 5 символов' }
                    ]}
                  >
                    <Input
                      prefix={<UserOutlined />}
                      placeholder="Иванов Иван"
                      autoFocus={activeTab === 'register'}
                    />
                  </Form.Item>

                  <Form.Item
                    name="username"
                    label="Логин"
                    rules={[
                      { required: true, message: 'Введите логин' },
                      { min: 3, message: 'Минимум 3 символа' },
                      { pattern: /^[a-zA-Z0-9_]+$/, message: 'Только латинские буквы, цифры и _' }
                    ]}
                  >
                    <Input
                      prefix={<UserOutlined />}
                      placeholder="ivan123"
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
                      Зарегистрироваться
                    </Button>
                  </Form.Item>

                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Ваши результаты и достижения будут сохранены
                    </Text>
                  </div>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default StudentAuthPage;
