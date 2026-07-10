import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Avatar,
  Space,
  Button,
  Tabs,
  Table,
  Progress,
  message,
  Spin,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CrownOutlined,
  KeyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  getUser,
  getUserStats,
  banUser,
  enableUser,
  updateUserRole,
  updateUserVip,
  resetPassword,
} from '@/services/userService';
import { User, UserStats, UserRole, UserStatus } from '@/types';
import { StatCard } from '@/components';
import dayjs from 'dayjs';

const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [vipModalVisible, setVipModalVisible] = useState(false);
  const [resetPwdModalVisible, setResetPwdModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roleForm] = Form.useForm();
  const [vipForm] = Form.useForm();
  const [resetPwdForm] = Form.useForm();

  useEffect(() => {
    if (id) {
      fetchUser();
    }
  }, [id]);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const userRes = await getUser(id!);
      setUser(userRes);
      // stats 已嵌入在 user 响应中，也可从单独端点获取
      if (userRes.stats) {
        setStats(userRes.stats);
      } else {
        try {
          const statsRes = await getUserStats(id!);
          setStats(statsRes);
        } catch {
          // 统计获取失败不阻塞
        }
      }
    } catch (error) {
      message.error('获取用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 状态颜色映射
  const statusColorMap: Record<UserStatus, string> = {
    active: 'green',
    banned: 'red',
  };

  const statusTextMap: Record<UserStatus, string> = {
    active: '正常',
    banned: '已禁用',
  };

  const roleColorMap: Record<UserRole, string> = {
    user: 'blue',
    teacher: 'orange',
    admin: 'purple',
    super_admin: 'red',
  };

  const roleTextMap: Record<UserRole, string> = {
    user: '用户',
    teacher: '教师',
    admin: '管理员',
    super_admin: '超级管理员',
  };

  const handleBan = async () => {
    try {
      await banUser(id!, '管理员禁用');
      message.success('用户已禁用');
      fetchUser();
    } catch (error) {
      // 错误已处理
    }
  };

  const handleEnable = async () => {
    try {
      await enableUser(id!);
      message.success('用户已启用');
      fetchUser();
    } catch (error) {
      // 错误已处理
    }
  };

  // 打开修改角色弹窗
  const openRoleModal = () => {
    roleForm.setFieldsValue({ role: user?.role });
    setRoleModalVisible(true);
  };

  // 提交修改角色
  const handleRoleSubmit = async (values: { role: UserRole }) => {
    setSubmitting(true);
    try {
      await updateUserRole(id!, values.role);
      message.success('角色修改成功');
      setRoleModalVisible(false);
      fetchUser();
    } catch (error) {
      // 错误已处理
    } finally {
      setSubmitting(false);
    }
  };

  // 打开修改 VIP 弹窗
  const openVipModal = () => {
    vipForm.setFieldsValue({
      vip_level: user?.vip_level ?? 0,
      vip_expire_at: user?.vip_expire_at ? dayjs(user.vip_expire_at) : undefined,
      ai_quota_daily_override: user?.ai_quota_daily_override,
    });
    setVipModalVisible(true);
  };

  // 提交修改 VIP
  const handleVipSubmit = async (values: {
    vip_level: number;
    vip_expire_at?: dayjs.Dayjs;
    ai_quota_daily_override?: number;
  }) => {
    setSubmitting(true);
    try {
      await updateUserVip(id!, {
        vip_level: values.vip_level,
        vip_expire_at: values.vip_expire_at ? values.vip_expire_at.toISOString() : undefined,
        ai_quota_daily_override: values.ai_quota_daily_override,
      });
      message.success('VIP 信息修改成功');
      setVipModalVisible(false);
      fetchUser();
    } catch (error) {
      // 错误已处理
    } finally {
      setSubmitting(false);
    }
  };

  // 提交重置密码
  const handleResetPwdSubmit = async (values: { new_password: string }) => {
    setSubmitting(true);
    try {
      await resetPassword(id!, values.new_password);
      message.success('密码重置成功');
      setResetPwdModalVisible(false);
      resetPwdForm.resetFields();
    } catch (error) {
      // 错误已处理
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <div>用户不存在</div>;
  }

  return (
    <div>
      {/* 返回按钮 */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/user')}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      {/* 用户基本信息 */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
          <Avatar src={user.avatar} size={80} />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, marginBottom: 8 }}>
              {user.nickname || user.email || user.phone || `用户${user.id}`}
            </h2>
            <Space>
              <Tag color={roleColorMap[user.role]}>{roleTextMap[user.role]}</Tag>
              <Tag color={statusColorMap[user.status]}>
                {statusTextMap[user.status]}
              </Tag>
            </Space>
          </div>
          <Space wrap>
            {user.status === 'banned' ? (
              <Button icon={<CheckCircleOutlined />} onClick={handleEnable}>
                启用用户
              </Button>
            ) : (
              <Button danger icon={<StopOutlined />} onClick={handleBan}>
                禁用用户
              </Button>
            )}
            <Button icon={<UserOutlined />} onClick={openRoleModal}>
              修改角色
            </Button>
            <Button icon={<CrownOutlined />} onClick={openVipModal}>
              修改 VIP
            </Button>
            <Button icon={<KeyOutlined />} onClick={() => setResetPwdModalVisible(true)}>
              重置密码
            </Button>
          </Space>
        </div>
      </Card>

      {/* 统计数据 */}
      <div style={{ marginTop: 16 }}>
        <Space size="large" wrap>
          <StatCard title="学习天数" value={stats?.study_days || 0} />
          <StatCard title="完成题目" value={stats?.question_count || 0} />
          <StatCard title="学习单词" value={stats?.word_count || 0} />
          <StatCard title="游戏场次" value={stats?.game_count || 0} />
          <StatCard title="AI对话数" value={stats?.ai_conversation_count || 0} />
        </Space>
      </div>

      {/* 详细信息 */}
      <Card style={{ marginTop: 16 }}>
        <Tabs
          items={[
            {
              key: 'info',
              label: '基本信息',
              children: (
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="用户ID">{user.id}</Descriptions.Item>
                  <Descriptions.Item label="邮箱">{user.email || '-'}</Descriptions.Item>
                  <Descriptions.Item label="手机">{user.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="昵称">{user.nickname || '-'}</Descriptions.Item>
                  <Descriptions.Item label="角色">
                    <Tag color={roleColorMap[user.role]}>{roleTextMap[user.role]}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={statusColorMap[user.status]}>
                      {statusTextMap[user.status]}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="注册时间">
                    {dayjs(user.created_at).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                  <Descriptions.Item label="最后登录">
                    {user.last_login_at
                      ? dayjs(user.last_login_at).format('YYYY-MM-DD HH:mm:ss')
                      : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="微信OpenID">
                    {user.wechat_openid || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="订阅计划">
                    {user.subscription?.plan || 'free'}
                  </Descriptions.Item>
                  <Descriptions.Item label="VIP 等级">
                    {user.vip_level ?? 0}
                  </Descriptions.Item>
                  <Descriptions.Item label="VIP 到期">
                    {user.vip_expire_at
                      ? dayjs(user.vip_expire_at).format('YYYY-MM-DD HH:mm:ss')
                      : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="AI 配额覆盖">
                    {user.ai_quota_daily_override ?? '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="每日AI配额">
                    {user.subscription?.ai_quota_daily ?? 10}
                  </Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'knowledge',
              label: '知识点掌握',
              children: (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                  <p>知识点掌握详情功能开发中</p>
                  <p style={{ fontSize: 13 }}>
                    完成题目：{stats?.question_count || 0} ·
                    学习单词：{stats?.word_count || 0} ·
                    游戏场次：{stats?.game_count || 0} ·
                    AI对话：{stats?.ai_conversation_count || 0}
                  </p>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* 修改角色弹窗 */}
      <Modal
        title="修改角色"
        open={roleModalVisible}
        onCancel={() => setRoleModalVisible(false)}
        onOk={() => roleForm.submit()}
        confirmLoading={submitting}
      >
        <Form form={roleForm} onFinish={handleRoleSubmit} layout="vertical">
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Select.Option value="user">用户</Select.Option>
              <Select.Option value="teacher">教师</Select.Option>
              <Select.Option value="admin">管理员</Select.Option>
              <Select.Option value="super_admin">超级管理员</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改 VIP 弹窗 */}
      <Modal
        title="修改 VIP"
        open={vipModalVisible}
        onCancel={() => setVipModalVisible(false)}
        onOk={() => vipForm.submit()}
        confirmLoading={submitting}
      >
        <Form form={vipForm} onFinish={handleVipSubmit} layout="vertical">
          <Form.Item
            name="vip_level"
            label="VIP 等级"
            rules={[{ required: true, message: '请输入 VIP 等级' }]}
          >
            <InputNumber min={0} max={3} style={{ width: '100%' }} placeholder="0-3" />
          </Form.Item>
          <Form.Item name="vip_expire_at" label="VIP 到期时间">
            <DatePicker showTime style={{ width: '100%' }} placeholder="选择到期时间" />
          </Form.Item>
          <Form.Item name="ai_quota_daily_override" label="每日 AI 配额覆盖（可空）">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="留空则使用默认配额" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码弹窗 */}
      <Modal
        title="重置密码"
        open={resetPwdModalVisible}
        onCancel={() => {
          setResetPwdModalVisible(false);
          resetPwdForm.resetFields();
        }}
        onOk={() => resetPwdForm.submit()}
        confirmLoading={submitting}
      >
        <Form form={resetPwdForm} onFinish={handleResetPwdSubmit} layout="vertical">
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少 6 位' },
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少 6 位）" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserDetail;
