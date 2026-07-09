import React, { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  Spin,
  InputNumber,
  Divider,
} from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import {
  getQuestion,
  createQuestion,
  updateQuestion,
} from '@/services/questionService';
import { getAllSubjects } from '@/services/subjectService';
import { getKnowledgeTree } from '@/services/knowledgeService';
import { Question, QuestionType, Subject, KnowledgePoint } from '@/types';
import { KnowledgeTreeSelect } from '@/components';

const { TextArea } = Input;

const QuestionEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [knowledgeTree, setKnowledgeTree] = useState<KnowledgePoint[]>([]);
  const [knowledgeModalVisible, setKnowledgeModalVisible] = useState(false);
  const [selectedKnowledge, setSelectedKnowledge] = useState<string[]>([]);

  const isEdit = !!id;

  useEffect(() => {
    fetchInitData();
    if (isEdit) {
      fetchQuestion();
    }
  }, [id]);

  const fetchInitData = async () => {
    try {
      const [subjectsRes, knowledgeRes] = await Promise.all([
        getAllSubjects(),
        getKnowledgeTree(),
      ]);
      setSubjects(subjectsRes);
      setKnowledgeTree(knowledgeRes);
    } catch (error) {
      message.error('获取初始数据失败');
    }
  };

  const fetchQuestion = async () => {
    setLoading(true);
    try {
      const question = await getQuestion(id!);
      form.setFieldsValue(question);
      // 后端返回 knowledge_points（snake_case），前端用 knowledgePoints
      setSelectedKnowledge(question.knowledgePoints ?? question.knowledge_points ?? []);
    } catch (error) {
      message.error('获取题目信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const data = {
        ...values,
        knowledgePoints: selectedKnowledge,
      };

      if (isEdit) {
        await updateQuestion(id!, data);
        message.success('题目更新成功');
      } else {
        await createQuestion(data);
        message.success('题目创建成功');
      }
      navigate('/question');
    } catch (error) {
      // 错误已处理
    } finally {
      setSubmitting(false);
    }
  };

  // 题型选项
  const typeOptions = [
    { label: '选择题', value: 'choice' },
    { label: '填空题', value: 'fill' },
    { label: '计算题', value: 'calculate' },
    { label: '简答题', value: 'essay' },
  ];

  // 难度选项
  const difficultyOptions = [
    { label: '1星 - 非常简单', value: 1 },
    { label: '2星 - 简单', value: 2 },
    { label: '3星 - 中等', value: 3 },
    { label: '4星 - 困难', value: 4 },
    { label: '5星 - 非常困难', value: 5 },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/question')}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      <Card title={isEdit ? '编辑题目' : '新建题目'}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            type: 'choice',
            difficulty: 3,
            status: 'draft',
          }}
        >
          <Form.Item
            name="type"
            label="题型"
            rules={[{ required: true, message: '请选择题型' }]}
          >
            <Select options={typeOptions} />
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

          <Form.Item
            name="content"
            label="题目内容"
            rules={[{ required: true, message: '请输入题目内容' }]}
          >
            <TextArea rows={4} placeholder="请输入题目内容" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.type !== curr.type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              if (type === 'choice') {
                return (
                  <Form.Item name="options" label="选项">
                    <TextArea
                      rows={6}
                      placeholder="每行一个选项，格式：A. 选项内容"
                    />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item
            name="answer"
            label="答案"
            rules={[{ required: true, message: '请输入答案' }]}
          >
            <TextArea rows={2} placeholder="请输入答案" />
          </Form.Item>

          <Form.Item name="analysis" label="解析">
            <TextArea rows={4} placeholder="请输入解析" />
          </Form.Item>

          <Form.Item
            name="difficulty"
            label="难度"
            rules={[{ required: true, message: '请选择难度' }]}
          >
            <Select options={difficultyOptions} />
          </Form.Item>

          <Form.Item label="知识点">
            <Space>
              <Button onClick={() => setKnowledgeModalVisible(true)}>
                选择知识点 ({selectedKnowledge.length})
              </Button>
              {selectedKnowledge.length > 0 && (
                <Button
                  type="link"
                  danger
                  onClick={() => setSelectedKnowledge([])}
                >
                  清空
                </Button>
              )}
            </Space>
          </Form.Item>

          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后按回车添加" />
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="published">已发布</Select.Option>
              <Select.Option value="archived">已归档</Select.Option>
            </Select>
          </Form.Item>

          <Divider />

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={submitting}
              >
                保存
              </Button>
              <Button onClick={() => navigate('/question')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 知识点选择弹窗 */}
      <KnowledgeTreeSelect
        visible={knowledgeModalVisible}
        onCancel={() => setKnowledgeModalVisible(false)}
        onOk={(keys) => {
          setSelectedKnowledge(keys);
          setKnowledgeModalVisible(false);
        }}
        treeData={knowledgeTree}
        selectedKeys={selectedKnowledge}
      />
    </div>
  );
};

export default QuestionEdit;
