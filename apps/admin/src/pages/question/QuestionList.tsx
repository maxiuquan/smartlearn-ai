import React, { useRef, useState } from 'react';
import {
  Card,
  Tag,
  Button,
  Space,
  Modal,
  message,
  Popconfirm,
  Select,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  ImportOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import ProTable from '@ant-design/pro-table';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import { useNavigate } from 'react-router-dom';
import {
  getQuestionList,
  deleteQuestion,
  batchDeleteQuestions,
  exportQuestions,
} from '@/services/questionService';
import { Question, QuestionType, QuestionStatus } from '@/types';
import { TagList } from '@/components';
import dayjs from 'dayjs';

const QuestionList: React.FC = () => {
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 题型颜色映射
  const typeColorMap: Record<QuestionType, string> = {
    choice: 'blue',
    fill: 'green',
    calculate: 'orange',
    essay: 'purple',
  };

  const typeTextMap: Record<QuestionType, string> = {
    choice: '选择题',
    fill: '填空题',
    calculate: '计算题',
    essay: '简答题',
  };

  // 状态颜色映射
  const statusColorMap: Record<QuestionStatus, string> = {
    draft: 'default',
    published: 'green',
    archived: 'red',
  };

  const statusTextMap: Record<QuestionStatus, string> = {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  };

  // 难度颜色映射
  const difficultyColorMap: Record<number, string> = {
    1: '#52c41a',
    2: '#73d13d',
    3: '#faad14',
    4: '#ff7a45',
    5: '#ff4d4f',
  };

  // 表格列定义
  const columns: ProColumns<Question>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      ellipsis: true,
    },
    {
      title: '题型',
      dataIndex: 'type',
      width: 100,
      renderText: (type: QuestionType) => (
        <Tag color={typeColorMap[type]}>{typeTextMap[type]}</Tag>
      ),
    },
    {
      title: '学科',
      dataIndex: 'subject',
      width: 100,
    },
    {
      title: '内容',
      dataIndex: 'content',
      ellipsis: true,
      width: 300,
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 80,
      renderText: (difficulty: number) => (
        <Tag color={difficultyColorMap[difficulty]}>{difficulty}星</Tag>
      ),
    },
    {
      title: '知识点',
      dataIndex: 'knowledge_points',
      width: 200,
      renderText: (points: string[]) => <TagList tags={points} max={2} />,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 150,
      renderText: (tags: string[]) => <TagList tags={tags} max={2} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      renderText: (status: QuestionStatus) => (
        <Tag color={statusColorMap[status]}>{statusTextMap[status]}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 150,
      renderText: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      sorter: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: Question) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/question/${record.id}`)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/question/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该题目吗？"
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
    const result = await getQuestionList({
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

  // 删除题目
  const handleDelete = async (question: Question) => {
    try {
      await deleteQuestion(question.id);
      message.success('题目已删除');
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的题目');
      return;
    }
    try {
      await batchDeleteQuestions(selectedRowKeys as string[]);
      message.success('批量删除成功');
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 导出题目
  const handleExport = async () => {
    try {
      const blob = await exportQuestions({});
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `questions_${dayjs().format('YYYYMMDD')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error('导出失败');
    }
  };

  return (
    <div>
      <ProTable<Question>
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
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/question/create')}
          >
            新建题目
          </Button>,
          <Button
            key="import"
            icon={<ImportOutlined />}
            onClick={() => navigate('/question/import')}
          >
            批量导入
          </Button>,
          <Button key="export" icon={<ExportOutlined />} onClick={handleExport}>
            导出
          </Button>,
          selectedRowKeys.length > 0 && (
            <Popconfirm
              key="batchDelete"
              title={`确定删除选中的 ${selectedRowKeys.length} 个题目吗？`}
              onConfirm={handleBatchDelete}
            >
              <Button danger icon={<DeleteOutlined />}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          ),
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
    </div>
  );
};

export default QuestionList;
