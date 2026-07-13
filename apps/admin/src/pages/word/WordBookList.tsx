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
  Switch,
  message,
  Popconfirm,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import ProTable from '@ant-design/pro-table';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import {
  getWordBookList,
  createWordBook,
  updateWordBook,
  deleteWordBook,
  toggleWordBook,
  getWordBookStats,
} from '@/services/wordService';
import { WordBook } from '@/types';
import dayjs from 'dayjs';

const WordBookList: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentBook, setCurrentBook] = useState<WordBook | null>(null);
  const [form] = Form.useForm();

  // 表格列定义
  const columns: ProColumns<WordBook>[] = [
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
      title: '级别',
      dataIndex: 'level',
      width: 100,
    },
    {
      title: '单词数',
      dataIndex: 'wordCount',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      renderText: (status: boolean) => (
        <Tag color={status ? 'green' : 'red'}>
          {status ? '启用' : '禁用'}
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
      render: (_: any, record: WordBook) => (
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
            title="确定删除该词书吗？"
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
    const result = await getWordBookList({
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

  // 编辑词书
  const handleEdit = (book: WordBook) => {
    setCurrentBook(book);
    form.setFieldsValue(book);
    setEditModalVisible(true);
  };

  // 切换状态
  const handleToggle = async (book: WordBook) => {
    try {
      await toggleWordBook(book.id, !book.status);
      message.success(`词书已${book.status ? '禁用' : '启用'}`);
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 删除词书
  const handleDelete = async (book: WordBook) => {
    try {
      await deleteWordBook(book.id);
      message.success('词书已删除');
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      if (currentBook) {
        await updateWordBook(currentBook.id, values);
        message.success('词书更新成功');
      } else {
        await createWordBook(values);
        message.success('词书创建成功');
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
      <ProTable<WordBook>
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
              setCurrentBook(null);
              form.resetFields();
              setEditModalVisible(true);
            }}
          >
            新建词书
          </Button>,
        ]}
        search={{
          labelWidth: 'auto',
        }}
      />

      {/* 编辑弹窗 */}
      <Modal
        title={currentBook ? '编辑词书' : '新建词书'}
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
            <Input placeholder="请输入词书名称" />
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
              <Select.Option value="english">英语</Select.Option>
              <Select.Option value="chinese">语文</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="level"
            label="级别"
            rules={[{ required: true, message: '请选择级别' }]}
          >
            <Select placeholder="请选择级别">
              <Select.Option value="primary">小学</Select.Option>
              <Select.Option value="junior">初中</Select.Option>
              <Select.Option value="senior">高中</Select.Option>
              <Select.Option value="cet4">四级</Select.Option>
              <Select.Option value="cet6">六级</Select.Option>
              <Select.Option value="toefl">托福</Select.Option>
              <Select.Option value="ielts">雅思</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WordBookList;
