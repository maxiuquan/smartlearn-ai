import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, message, Card } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { login, getCurrentUser } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';
import styles from './LoginLayout.module.css';

interface LoginForm {
  username: string;
  password: string;
  remember: boolean;
}

const LoginLayout: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    try {
      // 后端 /auth/login 返回 {access_token, refresh_token}（无 user 字段）
      // 登录后需再调 /auth/me 获取用户信息
      const tokenRes = await login({
        username: values.username,
        password: values.password,
        remember: values.remember,
      });

      // 先把 token 存入 store，以便后续请求带上 Authorization 头
      // user 暂为 null，setAuth 会把 isAuthenticated 置为 true
      // 但 isAdmin 需要等拿到 user 后才能判断，这里先用一个临时占位
      useAuthStore.getState().token = tokenRes.access_token;

      const user = await getCurrentUser();
      setAuth(tokenRes.access_token, user);

      // 如果不是管理员，拒绝登录
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        message.error('该账号无管理后台权限');
        useAuthStore.getState().logout();
        return;
      }

      message.success('登录成功');
      navigate('/dashboard');
    } catch (error) {
      // 错误已在请求拦截器中处理
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.background}>
        <div className={styles.circle1} />
        <div className={styles.circle2} />
      </div>
      
      <Card className={styles.loginCard}>
        <div className={styles.header}>
          <h1>SmartLearn AI</h1>
          <p>管理后台</p>
        </div>
        
        <Form
          name="login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <div className={styles.formExtras}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>记住我</Checkbox>
              </Form.Item>
              <a className={styles.forgot} href="#">
                忘记密码
              </a>
            </div>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>

        <div className={styles.footer}>
          <p>© 2024 SmartLearn AI. All rights reserved.</p>
        </div>
      </Card>
    </div>
  );
};

export default LoginLayout;
