import { useState } from 'react';
import { App, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';

const { Title, Text } = Typography;

/**
 * Первый вход с паролем от учителя (v3.9.294): ученик придумывает свой.
 * Показывается, пока у ученика `must_change_password`; «Позже» откладывает
 * до следующего входа (флаг в sessionStorage, его держит StudentApp).
 * PocketBase меняет пароль только со старым — его ученик берёт с карточки.
 */
export default function StudentPasswordChange({ student, onDone, onLater }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  const submit = async ({ oldPassword, password }) => {
    setBusy(true);
    try {
      const rec = await api.changeOwnStudentPassword(oldPassword, password);
      message.success('Готово! Теперь входи с новым паролем');
      onDone(rec);
    } catch (e) {
      const oldWrong = e?.data?.data?.oldPassword || e?.status === 400;
      message.error(oldWrong ? 'Пароль с карточки не подходит — проверь буквы и цифры' : 'Не удалось сменить пароль, попробуй ещё раз');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="student-auth">
      <div className="student-auth-header">
        <div className="student-auth-icon"><SafetyOutlined /></div>
        <Title level={3} className="student-auth-title">Придумай свой пароль</Title>
        <Text className="student-auth-subtitle">
          {student?.name ? `${student.name}, пароль` : 'Пароль'} с карточки знает учитель.
          Замени его на свой — его будешь знать только ты.
        </Text>
      </div>
      <Card className="student-auth-card">
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Твой логин: <Text code>{student?.username}</Text> — он не меняется.
        </Text>
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item name="oldPassword" label="Пароль с карточки"
            rules={[{ required: true, message: 'Введи пароль с карточки' }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="password" label="Новый пароль"
            rules={[
              { required: true, message: 'Придумай пароль' },
              { min: 6, message: 'Минимум 6 символов' },
            ]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="confirm" label="Новый пароль ещё раз" dependencies={['password']}
            rules={[
              { required: true, message: 'Повтори пароль' },
              ({ getFieldValue }) => ({
                validator: (_, v) => (!v || v === getFieldValue('password')
                  ? Promise.resolve()
                  : Promise.reject(new Error('Пароли не совпадают'))),
              }),
            ]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={busy}>
            Сохранить пароль
          </Button>
          <Button type="link" block style={{ marginTop: 8 }} onClick={onLater}>
            Позже
          </Button>
        </Form>
      </Card>
    </div>
  );
}
