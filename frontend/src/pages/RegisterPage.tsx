import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, TrophyOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AxiosError } from 'axios';

const { Title, Text } = Typography;

interface FormValues {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export function RegisterPage() {
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const onFinish = async (values: FormValues) => {
    try {
      setError('');
      await register(values.email, values.username, values.password);
      navigate('/dashboard');
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : "Erreur lors de l'inscription";
      setError(msg || "Erreur lors de l'inscription");
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 420, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <TrophyOutlined style={{ fontSize: 48, color: '#c0902b' }} />
            <Title level={2} style={{ margin: '8px 0 0', color: '#c0902b' }}>Créer un compte</Title>
          </div>

          {error && <Alert message={error} type="error" showIcon />}

          <Form layout="vertical" onFinish={onFinish} style={{ textAlign: 'left' }}>
            <Form.Item name="username" label="Nom d'utilisateur" rules={[{ required: true, min: 3, max: 30, message: 'Entre 3 et 30 caractères' }]}>
              <Input prefix={<UserOutlined />} placeholder="Votre pseudo" size="large" />
            </Form.Item>

            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email invalide' }]}>
              <Input prefix={<MailOutlined />} placeholder="votre@email.com" size="large" />
            </Form.Item>

            <Form.Item name="password" label="Mot de passe" rules={[{ required: true, min: 6, message: 'Min 6 caractères' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Mot de passe" size="large" />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="Confirmer le mot de passe"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Confirmez votre mot de passe' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject(new Error('Les mots de passe ne correspondent pas'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Confirmer" size="large" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={isLoading} style={{ background: '#c0902b', borderColor: '#c0902b' }}>
                S'inscrire
              </Button>
            </Form.Item>
          </Form>

          <Text>Déjà un compte ? <Link to="/login">Se connecter</Link></Text>
        </Space>
      </Card>
    </div>
  );
}
