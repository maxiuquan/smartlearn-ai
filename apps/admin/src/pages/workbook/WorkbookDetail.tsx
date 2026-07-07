import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Table,
  message,
  Spin,
  Modal,
  Transfer,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  getWorkbook,
  addQuestions,
  removeQuestions,
} from '@/services/workbookService';
import { getQuestionList, getQuestion } from '@/services/questionService';
import { Workbook, Question } from '@/types';
import dayjs from 'dayjs';

const WorkbookDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (id) {
      fetchWorkbook();
    }
  }, [id]);

  const fetchWorkbook = async () => {
    setLoading(true);
    try {
      const workbookRes = await getWorkbook(id!);
      setWorkbook(workbookRes);

      // 获取题目详情
      if (workbookRes.questions && workbookRes.questions.length > 0) {
        const questionPromises = workbookRes.questions.map((qId: string) =>
          getQuestion(qId)
        );
        const questionResults = await Promise.all(questionPromises);
        setQuestions(questionResults.filter(Boolean));
      }
    } catch (error) {
      message.error('获取习题册信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestions = () => {
    setAddModalVisible(true);
    fetchAllQuestions();
  };

  const fetchAllQuestions = async () => {
    try {
      const res = await getQuestionList({ pageSize: 100 });
      setAllQuestions(res.list);
    } catch (error) {
      // 错误已处理
    }
  };

  const handleSaveQuestions = async () => {
    try {
      await addQuestions(id!, selectedKeys);
      message.success('题目添加成功');
      setAddModalVisible(false);
      setSelectedKeys([]);
      fetchWorkbook();
    } catch (error) {
      // 错误已处理
    }
  };

  const handleRemoveQuestion = async (questionId: string) => {
    try {
      await removeQuestions(id!, [questionId]);
      message.success('题目移除成功');
      fetchWorkbook();
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

  if (!workbook) {
    return <div>习题册不存在</div>;
  }

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/workbook')}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      <Card title="习题册信息">
        <Descriptions bordered column={2}>
          <Descriptions.Item label="名称">{workbook.name}</Descriptions.Item>
          <Descriptions.Item label="学科">{workbook.subject}</Descriptions.Item>
          <Descriptions.Item label="难度">{workbook.difficulty}星</Descriptions.Item>
          <Descriptions.Item label="题目数量">{workbook.questions?.length || 0}</Descriptions.Item>
          <Descriptions.Item label="公开">
            <Tag color={workbook.isPublic ? 'blue' : 'default'}>
              {workbook.isPublic ? '公开' : '私有'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={workbook.status ? 'green' : 'default'}>
              {workbook.status ? '已发布' : '草稿'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {workbook.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(workbook.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="题目列表"
        style={{ marginTop: 16 }}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddQuestions}>
            添加题目
          </Button>
        }
      >
        <Table
          dataSource={questions}
          rowKey="id"
          pagination={false}
          columns={[
            {
              title: '序号',
              key: 'index',
              render: (_: any, __: any, index: number) => index + 1,
              width: 60,
            },
            {
              title: '题型',
              dataIndex: 'type',
              render: (type: string) => {
                const typeMap: Record<string, string> = {
                  choice: '选择题',
                  fill: '填空题',
                  calculate: '计算题',
                  essay: '简答题',
                };
                return <Tag>{typeMap[type] || type}</Tag>;
              },
            },
            {
              title: '内容',
              dataIndex: 'content',
              ellipsis: true,
            },
            {
              title: '难度',
              dataIndex: 'difficulty',
              render: (d: number) => `${d}星`,
            },
            {
              title: '操作',
              key: 'action',
              render: (_: any, record: Question) => (
                <Button type="link" danger onClick={() => handleRemoveQuestion(record.id)}>
                  移除
                </Button>
              ),
            },
          ]}
        />
      </Card>

      {/* 添加题目弹窗 */}
      <Modal
        title="添加题目"
        open={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          setSelectedKeys([]);
        }}
        onOk={handleSaveQuestions}
        width={800}
      >
        <Transfer
          dataSource={allQuestions.map((q) => ({
            key: q.id,
            title: q.content?.substring(0, 50) || q.id,
          }))}
          titles={['可选题目', '已选题目']}
          targetKeys={selectedKeys}
          onChange={(keys) => setSelectedKeys(keys as string[])}
          render={(item) => item.title}
          listStyle={{ width: 300, height: 400 }}
        />
      </Modal>
    </div>
  );
};

export default WorkbookDetail;
