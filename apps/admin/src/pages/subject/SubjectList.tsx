import React, { useRef, useState, useEffect } from 'react';
import {
  Card,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  Select,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import ProTable from '@ant-design/pro-table';
import type { ColumnsType, ActionType } from '@ant-design/pro-table';
import {
  getSubjectList,
  createSubject,
  updateSubject,
  deleteSubject,
  toggleSubject,
} from '@/services/subjectService';
import { Subject } from '@/types';
import dayjs from 'dayjs';

const SubjectList: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<Subject | null>(null);
  const [form] = Form.useForm();

  // 表格列定义
  const columns: ColumnsType<Subject> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      ellipsis: true,
    },
    {
      title: '名称',
      dataIndex: 'name',
    },
    {
      title: '代码',
      dataIndex: 'code',
      width: 100,
    },
    {
      title: '图标',
      dataIndex: 'icon',
      width: 80,
    },
    {
      title: '颜色',
      dataIndex: 'color',
      width: 80,
      render: (color: string) => (
        <div
          style={{
            width: 24,
            height: 24,
            backgroundColor: color,
            borderRadius: 4,
          }}
        />
      ),
    },
    {
      title: '年级范围',
      dataIndex: 'gradeRange',
      render: (grades: string[]) => (
        <Space size="small" wrap>
          {grades?.map((g) => (
            <Tag key={g}>{g}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (status: boolean) => (
        <Tag color={status ? 'green' : 'red'}>
          {status ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Subject) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={record.status ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
            onClick={() => handleToggle(record)}
          >
            {record.status ? '禁用' : '启用'}
          </Button>
          <Popconfirm
            title="确定删除该学科吗？"
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
    const result = await getSubjectList({
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

  // 编辑学科
  const handleEdit = (subject: Subject) => {
    setCurrentSubject(subject);
    form.setFieldsValue(subject);
    setEditModalVisible(true);
  };

  // 切换状态
  const handleToggle = async (subject: Subject) => {
    try {
      await toggleSubject(subject.id, !subject.status);
      message.success(`学科已${subject.status ? '禁用' : '启用'}`);
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 删除学科
  const handleDelete = async (subject: Subject) => {
    try {
      await deleteSubject(subject.id);
      message.success('学科已删除');
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      if (currentSubject) {
        await updateSubject(currentSubject.id, values);
        message.success('学科更新成功');
      } else {
        await createSubject(values);
        message.success('学科创建成功');
      }
      setEditModalVisible(false);
      form.resetFields();
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 年级选项
  const gradeOptions = [
    '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
    '初一', '初二', '初三', '高一', '高二', '高三',
  ].map((g) => ({ label: g, value: g }));

  return (
    <div>
      <ProTable<Subject>
        columns={columns}
        actionRef={actionRef}
        request={fetchData}
        rowKey="id"
        pagination={{
          pageSize: 20,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setCurrentSubject(null);
              form.resetFields();
              setEditModalVisible(true);
            }}
          >
            新建学科
          </Button>,
        ]}
        search={false}
      />

      {/* 编辑弹窗 */}
      <Modal
        title={currentSubject ? '编辑学科' : '新建学科'}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ status: true }}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="请输入学科名称" />
          </Form.Item>

          <Form.Item
            name="code"
            label="代码"
            rules={[{ required: true, message: '请输入代码' }]}
          >
            <Input placeholder="请输入学科代码" />
          </Form.Item>

          <Form.Item name="icon" label="图标">
            <Input placeholder="请输入图标名称" />
          </Form.Item>

          <Form.Item name="color" label="颜色">
            <Input type="color" placeholder="请选择颜色" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>

          <Form.Item name="gradeRange" label="年级范围">
            <Select mode="multiple" options={gradeOptions} placeholder="请选择年级范围" />
          </Form.Item>

          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SubjectList;
