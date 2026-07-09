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
  Upload,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  StopOutlined,
  CheckCircleOutlined,
  ExportOutlined,
  ImportOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ColumnsType, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import type { UploadProps } from 'antd';
import {
  getUserList,
  banUser,
  enableUser,
  deleteUser,
  exportUsers,
  importUsers,
} from '@/services/userService';
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
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  // 状态颜色映射
  const statusColorMap: Record<UserStatus, string> = {
    active: 'green',
    banned: 'red',
  };

  // 状态文本映射
  const statusTextMap: Record<UserStatus, string> = {
    active: '正常',
    banned: '已禁用',
  };

  // 角色颜色映射
  const roleColorMap: Record<UserRole, string> = {
    user: 'blue',
    teacher: 'orange',
    admin: 'purple',
    super_admin: 'red',
  };

  // 角色文本映射
  const roleTextMap: Record<UserRole, string> = {
    user: '用户',
    teacher: '教师',
    admin: '管理员',
    super_admin: '超级管理员',
  };

  // VIP 文本映射
  const vipTextMap: Record<number, string> = {
    0: '普通',
    1: 'VIP1',
    2: 'VIP2',
    3: 'VIP3',
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
      dataIndex: 'email',
      render: (_: any, record: User) => (
        <Space>
          <Avatar src={record.avatar} icon={<UserOutlined />} size="small" />
          <span>{record.nickname || record.email}</span>
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
      title: 'VIP 等级',
      dataIndex: 'vip_level',
      render: (level: number) => (
        <Tag color={level > 0 ? 'gold' : 'default'}>
          {vipTextMap[level] ?? `VIP${level}`}
        </Tag>
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
      dataIndex: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      sorter: true,
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
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
              icon={<StopOutlined />}
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
      a.download = `users_${dayjs().format('YYYYMMDD')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error('导出失败');
    }
  };

  // 批量禁用
  const handleBatchBan = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要禁用的用户');
      return;
    }
    Modal.confirm({
      title: '批量禁用确认',
      icon: <ExclamationCircleOutlined />,
      content: `确定要禁用选中的 ${selectedRowKeys.length} 个用户吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await Promise.all(
            selectedRowKeys.map((userId) => banUser(String(userId), '批量禁用'))
          );
          message.success('批量禁用成功');
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error) {
          // 错误已处理
        }
      },
    });
  };

  // 批量启用
  const handleBatchEnable = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要启用的用户');
      return;
    }
    Modal.confirm({
      title: '批量启用确认',
      icon: <ExclamationCircleOutlined />,
      content: `确定要启用选中的 ${selectedRowKeys.length} 个用户吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await Promise.all(
            selectedRowKeys.map((userId) => enableUser(String(userId)))
          );
          message.success('批量启用成功');
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error) {
          // 错误已处理
        }
      },
    });
  };

  // 提交导入
  const handleImportSubmit = async () => {
    if (!importFile) {
      message.warning('请先选择文件');
      return;
    }
    setImporting(true);
    try {
      const result = await importUsers(importFile);
      message.success(`导入成功 ${result.success} 个，失败 ${result.failed} 个`);
      setImportModalVisible(false);
      setImportFile(null);
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    } finally {
      setImporting(false);
    }
  };

  // 上传配置
  const uploadProps: UploadProps = {
    accept: '.csv,.xlsx,.xls',
    maxCount: 1,
    beforeUpload: (file) => {
      setImportFile(file);
      return false;
    },
    onRemove: () => {
      setImportFile(null);
    },
    fileList: importFile
      ? [
          {
            uid: '-1',
            name: importFile.name,
            status: 'done',
          },
        ]
      : [],
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
          <Button
            key="batchBan"
            danger
            icon={<StopOutlined />}
            onClick={handleBatchBan}
            disabled={selectedRowKeys.length === 0}
          >
            批量禁用
          </Button>,
          <Button
            key="batchEnable"
            icon={<CheckCircleOutlined />}
            onClick={handleBatchEnable}
            disabled={selectedRowKeys.length === 0}
          >
            批量启用
          </Button>,
          <Button key="export" icon={<ExportOutlined />} onClick={handleExport}>
            导出
          </Button>,
          <Button
            key="import"
            icon={<ImportOutlined />}
            onClick={() => setImportModalVisible(true)}
          >
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

      {/* 导入用户弹窗 */}
      <Modal
        title="导入用户"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false);
          setImportFile(null);
        }}
        onOk={handleImportSubmit}
        confirmLoading={importing}
        okText="开始导入"
      >
        <div style={{ marginBottom: 8, color: '#666' }}>
          支持 CSV / Excel 格式，请确保文件包含必要的字段。
        </div>
        <Upload.Dragger {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
          <p className="ant-upload-hint">仅支持单个文件上传</p>
        </Upload.Dragger>
      </Modal>
    </div>
  );
};

export default UserList;
