import React, { useState, useEffect } from 'react';
import {
  Card,
  Tree,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Dropdown,
  Menu,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  MoreOutlined,
  BranchesOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import type { TreeProps } from 'antd';
import {
  getKnowledgeTree,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  moveKnowledge,
  setDependencies,
  getDependencyGraph,
} from '@/services/knowledgeService';
import { getAllSubjects } from '@/services/subjectService';
import { KnowledgePoint, Subject } from '@/types';
import { Chart } from '@/components';
import type { EChartsOption } from 'echarts';

const KnowledgeTree: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [treeData, setTreeData] = useState<KnowledgePoint[]>([]);
  const [selectedNode, setSelectedNode] = useState<KnowledgePoint | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [depModalVisible, setDepModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [depForm] = Form.useForm();

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      fetchTree();
    }
  }, [selectedSubject]);

  const fetchSubjects = async () => {
    try {
      const res = await getAllSubjects();
      setSubjects(res);
      if (res.length > 0) {
        setSelectedSubject(res[0].id);
      }
    } catch (error) {
      // 错误已处理
    }
  };

  const fetchTree = async () => {
    try {
      const res = await getKnowledgeTree(selectedSubject);
      setTreeData(res);
    } catch (error) {
      // 错误已处理
    }
  };

  // 转换为Ant Design Tree格式
  const convertToTreeData = (data: KnowledgePoint[]): TreeProps['treeData'] => {
    return data.map((item) => ({
      key: item.id,
      title: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{item.name}</span>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'edit',
                  icon: <EditOutlined />,
                  label: '编辑',
                  onClick: () => handleEdit(item),
                },
                {
                  key: 'addChild',
                  icon: <PlusOutlined />,
                  label: '添加子节点',
                  onClick: () => handleAddChild(item),
                },
                {
                  key: 'dependencies',
                  icon: <BranchesOutlined />,
                  label: '设置依赖',
                  onClick: () => handleSetDependencies(item),
                },
                { type: 'divider' },
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: '删除',
                  danger: true,
                  onClick: () => handleDelete(item),
                },
              ],
            }}
            trigger={['click']}
          >
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </div>
      ),
      icon: ({ expanded }: { expanded?: boolean }) =>
        expanded ? <FolderOpenOutlined /> : <FolderOutlined />,
      children: item.children ? convertToTreeData(item.children) : undefined,
    }));
  };

  // 编辑知识点
  const handleEdit = (knowledge: KnowledgePoint) => {
    setSelectedNode(knowledge);
    form.setFieldsValue(knowledge);
    setEditModalVisible(true);
  };

  // 添加子节点
  const handleAddChild = (parent: KnowledgePoint) => {
    setSelectedNode(null);
    form.setFieldsValue({
      parentId: parent.id,
      subject: selectedSubject,
      level: parent.level + 1,
    });
    setEditModalVisible(true);
  };

  // 设置依赖
  const handleSetDependencies = (knowledge: KnowledgePoint) => {
    setSelectedNode(knowledge);
    depForm.setFieldsValue({
      dependencies: knowledge.dependencies || [],
    });
    setDepModalVisible(true);
  };

  // 删除知识点
  const handleDelete = async (knowledge: KnowledgePoint) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定删除该知识点吗？删除后不可恢复。',
      onOk: async () => {
        try {
          await deleteKnowledge(knowledge.id);
          message.success('知识点已删除');
          fetchTree();
        } catch (error) {
          // 错误已处理
        }
      },
    });
  };

  // 提交编辑
  const handleSubmit = async (values: any) => {
    try {
      if (selectedNode) {
        await updateKnowledge(selectedNode.id, values);
        message.success('知识点更新成功');
      } else {
        await createKnowledge(values);
        message.success('知识点创建成功');
      }
      setEditModalVisible(false);
      form.resetFields();
      fetchTree();
    } catch (error) {
      // 错误已处理
    }
  };

  // 提交依赖设置
  const handleDepSubmit = async (values: any) => {
    if (!selectedNode) return;
    try {
      await setDependencies(selectedNode.id, values.dependencies || []);
      message.success('依赖关系设置成功');
      setDepModalVisible(false);
      fetchTree();
    } catch (error) {
      // 错误已处理
    }
  };

  return (
    <div>
      <Card
        title="知识点树"
        extra={
          <Space>
            <Select
              value={selectedSubject}
              onChange={setSelectedSubject}
              style={{ width: 150 }}
            >
              {subjects.map((s) => (
                <Select.Option key={s.id} value={s.id}>
                  {s.name}
                </Select.Option>
              ))}
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              setSelectedNode(null);
              form.resetFields();
              form.setFieldsValue({ subject: selectedSubject, level: 1 });
              setEditModalVisible(true);
            }}>
              新建根节点
            </Button>
          </Space>
        }
      >
        {treeData.length > 0 ? (
          <Tree
            showIcon
            showLine
            defaultExpandAll
            treeData={convertToTreeData(treeData)}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            暂无数据，请先添加知识点
          </div>
        )}
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title={selectedNode ? '编辑知识点' : '新建知识点'}
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

          <Form.Item name="parentId" label="父节点ID">
            <Input disabled />
          </Form.Item>

          <Form.Item name="level" label="层级">
            <Input disabled />
          </Form.Item>

          <Form.Item name="order" label="排序">
            <Input type="number" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 依赖设置弹窗 */}
      <Modal
        title="设置依赖关系"
        open={depModalVisible}
        onCancel={() => setDepModalVisible(false)}
        onOk={() => depForm.submit()}
        width={600}
      >
        <Form form={depForm} layout="vertical" onFinish={handleDepSubmit}>
          <Form.Item
            name="dependencies"
            label="依赖的知识点"
            help="该知识点需要先掌握的知识点，多个用逗号分隔"
          >
            <Select mode="tags" placeholder="输入知识点ID" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KnowledgeTree;
