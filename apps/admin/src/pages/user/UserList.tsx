import React, { useEffect, useState, useRef } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Avatar,
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BanOutlined,
  CheckCircleOutlined,
  ExportOutlined,
  ImportOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { getUserList, banUser, enableUser, deleteUser, exportUsers } from '@/services/userService';
import { User, UserStatus, UserRole } from '@/types';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const UserList: React.FC = () => {
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [banModalVisible, setBanModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [banForm] = Form.useForm();

  // 状态颜色映射
  const statusColorMap: Record<UserStatus, string> = {
    active: 'green',
    inactive: 'default',
    banned: 'red',
  };

  // 状态文本映射
  const statusTextMap: Record<UserStatus, string> = {
    active: '正常',
    inactive: '未激活',
    banned: '已禁用',
  };

  // 角色颜色映射
  const roleColorMap: Record<UserRole, string> = {
    student: 'blue',
    teacher: 'orange',
    admin: 'purple',
    super_admin: 'red',
  };

  // 角色文本映射
  const roleTextMap: Record<UserRole, string> = {
    student: '学生',
    teacher: '教师',
    admin: '管理员',
    super_admin: '超级管理员',
  };

  // 表格列定义
  const columns: ColumnsType<User> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      ellipsis: true,
    },
    {
      title: '用户',
      dataIndex: 'username',
      render: (_: any, record: User) => (
        <Space>
          <Avatar src={record.avatar} icon={<Avatar.Icon />} size="small" />
          <span>{record.nickname || record.username}</span>
        </Space>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      ellipsis: true,
    },
    {
      title: '手机',
      dataIndex: 'phone',
    },
    {
      title: '角色',
      dataIndex: 'role',
      render: (role: UserRole) => (
        <Tag color={roleColorMap[role]}>{roleTextMap[role]}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: UserStatus) => (
        <Tag color={statusColorMap[status]}>{statusTextMap[status]}</Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      sorter: true,
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      render: (date: string) =>
        date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: User) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/user/${record.id}`)}
          >
            查看
          </Button>
          {record.status === 'banned' ? (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleEnable(record)}
            >
              启用
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              danger
              icon={<BanOutlined />}
              onClick={() => {
                setCurrentUser(record);
                setBanModalVisible(true);
              }}
            >
              禁用
            </Button>
          )}
          <Popconfirm
            title="确定删除该用户吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 获取数据
  const fetchData = async (params: any) => {
    const { current, pageSize, ...rest } = params;
    const result = await getUserList({
      page: current,
      pageSize,
      ...rest,
    });
    return {
      data: result.list,
      total: result.total,
      success: true,
    };
  };

  // 启用用户
  const handleEnable = async (user: User) => {
    try {
      await enableUser(user.id);
      message.success('用户已启用');
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 禁用用户
  const handleBan = async (values: { reason: string }) => {
    if (!currentUser) return;
    try {
      await banUser(currentUser.id, values.reason);
      message.success('用户已禁用');
      setBanModalVisible(false);
      setCurrentUser(null);
      banForm.resetFields();
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 删除用户
  const handleDelete = async (user: User) => {
    try {
      await deleteUser(user.id);
      message.success('用户已删除');
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 导出用户
  const handleExport = async () => {
    try {
      const blob = await exportUsers({});
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_${dayjs().format('YYYYMMDD')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error('导出失败');
    }
  };

  return (
    <div>
      <ProTable<User>
        columns={columns}
        actionRef={actionRef}
        request={fetchData}
        rowKey="id"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        toolBarRender={() => [
          <Button key="export" icon={<ExportOutlined />} onClick={handleExport}>
            导出
          </Button>,
          <Button key="import" icon={<ImportOutlined />}>
            导入
          </Button>,
        ]}
        search={{
          labelWidth: 'auto',
        }}
        options={{
          density: true,
          fullScreen: true,
          reload: true,
          setting: true,
        }}
      />

      {/* 禁用用户弹窗 */}
      <Modal
        title="禁用用户"
        open={banModalVisible}
        onCancel={() => {
          setBanModalVisible(false);
          setCurrentUser(null);
          banForm.resetFields();
        }}
        onOk={() => banForm.submit()}
      >
        <Form form={banForm} onFinish={handleBan} layout="vertical">
          <Form.Item
            name="reason"
            label="禁用原因"
            rules={[{ required: true, message: '请输入禁用原因' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入禁用原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserList;
