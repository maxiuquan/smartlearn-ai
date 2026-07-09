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
import type { ColumnsType, ActionType } from '@ant-design/pro-table';
import { useNavigate } from 'react-router-dom';
import {
  getPastExamList,
  createPastExam,
  updatePastExam,
  deletePastExam,
  publishPastExam,
} from '@/services/pastexamService';
import { PastExam } from '@/types';
import dayjs from 'dayjs';

const PastExamList: React.FC = () => {
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentExam, setCurrentExam] = useState<PastExam | null>(null);
  const [form] = Form.useForm();

  // 表格列定义
  const columns: ColumnsType<PastExam> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      ellipsis: true,
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '学科',
      dataIndex: 'subject',
      width: 100,
    },
    {
      title: '年份',
      dataIndex: 'year',
      width: 80,
    },
    {
      title: '省份',
      dataIndex: 'province',
      width: 100,
    },
    {
      title: '类型',
      dataIndex: 'examType',
      width: 100,
    },
    {
      title: '题目数',
      dataIndex: 'questions',
      width: 80,
      render: (questions: string[]) => questions?.length || 0,
    },
    {
      title: '总分',
      dataIndex: 'totalScore',
      width: 80,
    },
    {
      title: '时长',
      dataIndex: 'duration',
      width: 80,
      render: (duration: number) => `${duration}分钟`,
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 80,
      render: (difficulty: number) => (
        <Tag color={difficulty <= 2 ? 'green' : difficulty <= 4 ? 'orange' : 'red'}>
          {difficulty}星
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (status: boolean) => (
        <Tag color={status ? 'green' : 'default'}>
          {status ? '已发布' : '草稿'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: PastExam) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/pastexam/${record.id}`)}
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
            title="确定删除该真题吗？"
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
    const result = await getPastExamList({
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

  // 编辑真题（API 返回 snake_case，表单字段为 camelCase，需做映射）
  const handleEdit = (exam: PastExam) => {
    setCurrentExam(exam);
    form.setFieldsValue({
      ...exam,
      examType: (exam as any).examType ?? (exam as any).exam_type,
      totalScore: (exam as any).totalScore ?? (exam as any).total_score,
    });
    setEditModalVisible(true);
  };

  // 发布真题
  const handlePublish = async (exam: PastExam) => {
    try {
      await publishPastExam(exam.id);
      message.success('真题已发布');
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 删除真题
  const handleDelete = async (exam: PastExam) => {
    try {
      await deletePastExam(exam.id);
      message.success('真题已删除');
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      if (currentExam) {
        await updatePastExam(currentExam.id, values);
        message.success('真题更新成功');
      } else {
        await createPastExam(values);
        message.success('真题创建成功');
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
      <ProTable<PastExam>
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
              setCurrentExam(null);
              form.resetFields();
              setEditModalVisible(true);
            }}
          >
            新建真题
          </Button>,
        ]}
        search={{
          labelWidth: 'auto',
        }}
      />

      {/* 编辑弹窗 */}
      <Modal
        title={currentExam ? '编辑真题' : '新建真题'}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入真题标题" />
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

          <Form.Item
            name="year"
            label="年份"
            rules={[{ required: true, message: '请输入年份' }]}
          >
            <InputNumber min={2000} max={2030} />
          </Form.Item>

          <Form.Item name="province" label="省份">
            <Input placeholder="请输入省份" />
          </Form.Item>

          <Form.Item
            name="examType"
            label="考试类型"
            rules={[{ required: true, message: '请选择考试类型' }]}
          >
            <Select placeholder="请选择考试类型">
              <Select.Option value="高考">高考</Select.Option>
              <Select.Option value="中考">中考</Select.Option>
              <Select.Option value="模拟考">模拟考</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="totalScore"
            label="总分"
            rules={[{ required: true, message: '请输入总分' }]}
          >
            <InputNumber min={0} />
          </Form.Item>

          <Form.Item
            name="duration"
            label="考试时长(分钟)"
            rules={[{ required: true, message: '请输入考试时长' }]}
          >
            <InputNumber min={0} />
          </Form.Item>

          <Form.Item name="difficulty" label="难度">
            <InputNumber min={1} max={5} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PastExamList;
