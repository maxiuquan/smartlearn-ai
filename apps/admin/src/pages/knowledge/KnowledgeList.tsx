import React, { useRef, useState, useEffect } from 'react';
import {
  Card,
  Tree,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Dropdown,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  MoreOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import ProTable from '@ant-design/pro-table';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import type { TreeProps } from 'antd';
import {
  getKnowledgeList,
  getKnowledgeTree,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  moveKnowledge,
} from '@/services/knowledgeService';
import { getAllSubjects } from '@/services/subjectService';
import { KnowledgePoint, Subject } from '@/types';
import dayjs from 'dayjs';

const KnowledgeList: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [treeData, setTreeData] = useState<KnowledgePoint[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentKnowledge, setCurrentKnowledge] = useState<KnowledgePoint | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const res = await getAllSubjects();
      setSubjects(res);
    } catch (error) {
      // 错误已处理
    }
  };

  // 表格列定义
  const columns: ProColumns<KnowledgePoint>[] = [
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
    },
    {
      title: '层级',
      dataIndex: 'level',
      width: 80,
    },
    {
      title: '排序',
      dataIndex: 'order',
      width: 80,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      renderText: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: KnowledgePoint) => (
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
            icon={<PlusOutlined />}
            onClick={() => handleAddChild(record)}
          >
            添加子节点
          </Button>
          <Popconfirm
            title="确定删除该知识点吗？"
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
    const result = await getKnowledgeList({
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

  // 编辑知识点
  const handleEdit = (knowledge: KnowledgePoint) => {
    setCurrentKnowledge(knowledge);
    form.setFieldsValue(knowledge);
    setEditModalVisible(true);
  };

  // 添加子节点
  const handleAddChild = (parent: KnowledgePoint) => {
    setCurrentKnowledge(null);
    form.setFieldsValue({
      parentId: parent.id,
      subject: parent.subject,
      level: parent.level + 1,
    });
    setEditModalVisible(true);
  };

  // 新建知识点
  const handleAdd = () => {
    setCurrentKnowledge(null);
    form.resetFields();
    setEditModalVisible(true);
  };

  // 删除知识点
  const handleDelete = async (knowledge: KnowledgePoint) => {
    try {
      await deleteKnowledge(knowledge.id);
      message.success('知识点已删除');
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      if (currentKnowledge) {
        await updateKnowledge(currentKnowledge.id, values);
        message.success('知识点更新成功');
      } else {
        await createKnowledge(values);
        message.success('知识点创建成功');
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
      <ProTable<KnowledgePoint>
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
            onClick={handleAdd}
          >
            新建知识点
          </Button>,
        ]}
        search={{
          labelWidth: 'auto',
        }}
      />

      {/* 编辑弹窗 */}
      <Modal
        title={currentKnowledge ? '编辑知识点' : '新建知识点'}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="请输入知识点名称" />
          </Form.Item>

          <Form.Item
            name="subject"
            label="学科"
            rules={[{ required: true, message: '请选择学科' }]}
          >
            <Select>
              {subjects.map((s) => (
                <Select.Option key={s.id} value={s.id}>
                  {s.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="parentId" label="父节点">
            <Input disabled placeholder="自动获取" />
          </Form.Item>

          <Form.Item name="level" label="层级">
            <InputNumber disabled />
          </Form.Item>

          <Form.Item name="order" label="排序">
            <InputNumber min={0} />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KnowledgeList;
