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
  Divider,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { getPastExam } from '@/services/pastexamService';
import { getQuestion } from '@/services/questionService';
import { PastExam, Question } from '@/types';
import dayjs from 'dayjs';

const PastExamDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<PastExam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    if (id) {
      fetchExam();
    }
  }, [id]);

  const fetchExam = async () => {
    setLoading(true);
    try {
      const examRes = await getPastExam(id!);
      setExam(examRes);

      // 获取题目详情
      if (examRes.questions && examRes.questions.length > 0) {
        const questionPromises = examRes.questions.map((qId) => getQuestion(qId));
        const questionResults = await Promise.all(questionPromises);
        setQuestions(questionResults);
      }
    } catch (error) {
      message.error('获取真题信息失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!exam) {
    return <div>真题不存在</div>;
  }

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/pastexam')}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      <Card title="真题信息">
        <Descriptions bordered column={2}>
          <Descriptions.Item label="标题">{exam.title}</Descriptions.Item>
          <Descriptions.Item label="学科">{exam.subject}</Descriptions.Item>
          <Descriptions.Item label="年份">{exam.year}</Descriptions.Item>
          <Descriptions.Item label="省份">{exam.province || '-'}</Descriptions.Item>
          <Descriptions.Item label="考试类型">{exam.examType}</Descriptions.Item>
          <Descriptions.Item label="总分">{exam.totalScore}</Descriptions.Item>
          <Descriptions.Item label="考试时长">{exam.duration}分钟</Descriptions.Item>
          <Descriptions.Item label="难度">{exam.difficulty}星</Descriptions.Item>
          <Descriptions.Item label="题目数量">{exam.questions?.length || 0}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={exam.status ? 'green' : 'default'}>
              {exam.status ? '已发布' : '草稿'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(exam.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="题目列表" style={{ marginTop: 16 }}>
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
              title: '分值',
              dataIndex: 'score',
              render: (score: number) => score || '-',
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default PastExamDetail;
