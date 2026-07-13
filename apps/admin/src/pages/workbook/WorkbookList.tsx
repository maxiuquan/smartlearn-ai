import React, { useRef, useState } from 'react';
import {
  Card,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import ProTable from '@ant-design/pro-table';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import { useNavigate } from 'react-router-dom';
import {
  getWorkbookList,
  createWorkbook,
  updateWorkbook,
  deleteWorkbook,
  publishWorkbook,
} from '@/services/workbookService';
import { Workbook } from '@/types';
import dayjs from 'dayjs';

const WorkbookList: React.FC = () => {
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentWorkbook, setCurrentWorkbook] = useState<Workbook | null>(null);
  const [form] = Form.useForm();

  // 表格列定义
  const columns: ProColumns<Workbook>[] = [
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
      title: '学科',
      dataIndex: 'subject',
      width: 100,
    },
    {
      title: '题目数',
      dataIndex: 'questions',
      width: 80,
      renderText: (questions: string[]) => questions?.length || 0,
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 80,
      renderText: (difficulty: number) => (
        <Tag color={difficulty <= 2 ? 'green' : difficulty <= 4 ? 'orange' : 'red'}>
          {difficulty}星
        </Tag>
      ),
    },
    {
      title: '公开',
      dataIndex: 'isPublic',
      width: 80,
      renderText: (isPublic: boolean) => (
        <Tag color={isPublic ? 'blue' : 'default'}>
          {isPublic ? '公开' : '私有'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      renderText: (status: boolean) => (
        <Tag color={status ? 'green' : 'default'}>
          {status ? '已发布' : '草稿'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      renderText: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Workbook) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/workbook/${record.id}`)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {!record.status && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handlePublish(record)}
            >
              发布
            </Button>
          )}
          <Popconfirm
            title="确定删除该习题册吗？"
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
    const result = await getWorkbookList({
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

  // 编辑习题册
  const handleEdit = (workbook: Workbook) => {
    setCurrentWorkbook(workbook);
    form.setFieldsValue(workbook);
    setEditModalVisible(true);
  };

  // 发布习题册
  const handlePublish = async (workbook: Workbook) => {
    try {
      await publishWorkbook(workbook.id);
      message.success('习题册已发布');
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 删除习题册
  const handleDelete = async (workbook: Workbook) => {
    try {
      await deleteWorkbook(workbook.id);
      message.success('习题册已删除');
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      if (currentWorkbook) {
        await updateWorkbook(currentWorkbook.id, values);
        message.success('习题册更新成功');
      } else {
        await createWorkbook(values);
        message.success('习题册创建成功');
      }
      setEditModalVisible(false);
      form.resetFields();
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  return (
    <div>
      <ProTable<Workbook>
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
              setCurrentWorkbook(null);
              form.resetFields();
              setEditModalVisible(true);
            }}
          >
            新建习题册
          </Button>,
        ]}
        search={{
          labelWidth: 'auto',
        }}
      />

      {/* 编辑弹窗 */}
      <Modal
        title={currentWorkbook ? '编辑习题册' : '新建习题册'}
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
          initialValues={{ isPublic: false, status: false }}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="请输入习题册名称" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>

          <Form.Item
            name="subject"
            label="学科"
            rules={[{ required: true, message: '请选择学科' }]}
          >
            <Select placeholder="请选择学科">
              <Select.Option value="math">数学</Select.Option>
              <Select.Option value="chinese">语文</Select.Option>
              <Select.Option value="english">英语</Select.Option>
              <Select.Option value="physics">物理</Select.Option>
              <Select.Option value="chemistry">化学</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="difficulty" label="难度">
            <InputNumber min={1} max={5} />
          </Form.Item>

          <Form.Item name="isPublic" label="是否公开" valuePropName="checked">
            <Switch checkedChildren="公开" unCheckedChildren="私有" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkbookList;
