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
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  BanOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { getUser, getUserStats, banUser, enableUser } from '@/services/userService';
import { User, UserStats, UserRole, UserStatus } from '@/types';
import { StatCard } from '@/components';
import dayjs from 'dayjs';

const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    if (id) {
      fetchUser();
    }
  }, [id]);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const [userRes, statsRes] = await Promise.all([
        getUser(id!),
        getUserStats(id!),
      ]);
      setUser(userRes);
      setStats(statsRes);
    } catch (error) {
      message.error('获取用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 状态颜色映射
  const statusColorMap: Record<UserStatus, string> = {
    active: 'green',
    inactive: 'default',
    banned: 'red',
  };

  const statusTextMap: Record<UserStatus, string> = {
    active: '正常',
    inactive: '未激活',
    banned: '已禁用',
  };

  const roleColorMap: Record<UserRole, string> = {
    student: 'blue',
    teacher: 'orange',
    admin: 'purple',
    super_admin: 'red',
  };

  const roleTextMap: Record<UserRole, string> = {
    student: '学生',
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
              {user.nickname || user.username}
            </h2>
            <Space>
              <Tag color={roleColorMap[user.role]}>{roleTextMap[user.role]}</Tag>
              <Tag color={statusColorMap[user.status]}>
                {statusTextMap[user.status]}
              </Tag>
            </Space>
          </div>
          <Space>
            {user.status === 'banned' ? (
              <Button icon={<CheckCircleOutlined />} onClick={handleEnable}>
                启用用户
              </Button>
            ) : (
              <Button danger icon={<BanOutlined />} onClick={handleBan}>
                禁用用户
              </Button>
            )}
          </Space>
        </div>
      </Card>

      {/* 统计数据 */}
      <div style={{ marginTop: 16 }}>
        <Space size="large" wrap>
          <StatCard title="学习天数" value={stats?.studyDays || 0} />
          <StatCard title="学习时长" value={stats?.totalStudyTime || 0} suffix="分钟" />
          <StatCard title="完成题目" value={stats?.questionsCompleted || 0} />
          <StatCard title="正确率" value={(stats?.accuracy || 0) * 100} precision={1} suffix="%" />
          <StatCard title="学习单词" value={stats?.wordsLearned || 0} />
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
                  <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
                  <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
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
                    {dayjs(user.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                  <Descriptions.Item label="最后登录">
                    {user.lastLoginAt
                      ? dayjs(user.lastLoginAt).format('YYYY-MM-DD HH:mm:ss')
                      : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="年级">
                    {user.profile?.grade || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="学校">
                    {user.profile?.school || '-'}
                  </Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'knowledge',
              label: '知识点掌握',
              children: (
                <Table
                  dataSource={stats?.knowledgePoints || []}
                  rowKey="id"
                  pagination={false}
                  columns={[
                    { title: '知识点', dataIndex: 'name' },
                    {
                      title: '进度',
                      dataIndex: 'progress',
                      render: (v: number) => (
                        <Progress percent={Math.round(v * 100)} size="small" />
                      ),
                    },
                    {
                      title: '掌握度',
                      dataIndex: 'mastery',
                      render: (v: number) => (
                        <Progress
                          percent={Math.round(v * 100)}
                          size="small"
                          strokeColor={{
                            '0%': '#ff4d4f',
                            '50%': '#faad14',
                            '100%': '#52c41a',
                          }}
                        />
                      ),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default UserDetail;
