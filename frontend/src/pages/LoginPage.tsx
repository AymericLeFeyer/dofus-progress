import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined, TrophyOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AxiosError } from 'axios';

const { Title, Text } = Typography;

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      setError('');
      await login(values.email, values.password);
      navigate('/dashboard');
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : 'Erreur de connexion';
      setError(msg || 'Erreur de connexion');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <TrophyOutlined style={{ fontSize: 48, color: '#c0902b' }} />
            <Title level={2} style={{ margin: '8px 0 0', color: '#c0902b' }}>Dofus Progress</Title>
            <Text type="secondary">Suivez votre progression</Text>
          </div>

          {error && <Alert message={error} type="error" showIcon />}

          <Form layout="vertical" onFinish={onFinish} style={{ textAlign: 'left' }}>
            <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Email invalide' }]}>
              <Input prefix={<UserOutlined />} placeholder="Email" size="large" />
            </Form.Item>

            <Form.Item name="password" rules={[{ required: true, message: 'Mot de passe requis' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Mot de passe" size="large" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={isLoading} style={{ background: '#c0902b', borderColor: '#c0902b' }}>
                Se connecter
              </Button>
            </Form.Item>
          </Form>

          <Text>Pas encore de compte ? <Link to="/register">S'inscrire</Link></Text>
        </Space>
      </Card>
    </div>
  );
}
