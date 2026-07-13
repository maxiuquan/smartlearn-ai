import React, { useRef, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  DatePicker,
  Select,
  Input,
  Progress,
  Tag,
} from 'antd';
import { EyeOutlined, DownloadOutlined } from '@ant-design/icons';
import ProTable from '@ant-design/pro-table';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import { useNavigate } from 'react-router-dom';
import { getUserAnalysis, getUserDetailStats } from '@/services/statisticsService';
import { UserStats } from '@/types';

const { RangePicker } = DatePicker;

const UserAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>();

  // 表格列定义
  const columns: ProColumns<UserStats>[] = [
    {
      title: '用户ID',
      dataIndex: 'userId',
      width: 200,
      ellipsis: true,
    },
    {
      title: '学习天数',
      dataIndex: 'studyDays',
      width: 100,
      sorter: true,
    },
    {
      title: '学习时长',
      dataIndex: 'totalStudyTime',
      width: 120,
      renderText: (time: number) => `${Math.round(time / 60)}小时`,
      sorter: true,
    },
    {
      title: '完成题目',
      dataIndex: 'questionsCompleted',
      width: 100,
      sorter: true,
    },
    {
      title: '正确率',
      dataIndex: 'accuracy',
      width: 150,
      renderText: (accuracy: number) => (
        <Progress
          percent={Math.round(accuracy * 100)}
          size="small"
          strokeColor={{
            '0%': '#ff4d4f',
            '50%': '#faad14',
            '100%': '#52c41a',
          }}
        />
      ),
      sorter: true,
    },
    {
      title: '学习单词',
      dataIndex: 'wordsLearned',
      width: 100,
      sorter: true,
    },
    {
      title: '知识点掌握',
      dataIndex: 'knowledgePoints',
      width: 200,
      renderText: (points: any[]) => {
        if (!points || points.length === 0) return '-';
        const avgProgress = points.reduce((sum, p) => sum + p.progress, 0) / points.length;
        return (
          <Progress
            percent={Math.round(avgProgress * 100)}
            size="small"
          />
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: UserStats) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/user/${(record as any).userId}`)}
        >
          详情
        </Button>
      ),
    },
  ];

  // 获取数据
  const fetchData = async (params: any) => {
    const { current, pageSize, ...rest } = params;
    const result = await getUserAnalysis({
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

  return (
    <div>
      <ProTable<UserStats>
        columns={columns}
        actionRef={actionRef}
        request={fetchData}
        rowKey="userId"
        pagination={{
          pageSize: 20,
        }}
        toolBarRender={() => [
          <Button key="export" icon={<DownloadOutlined />}>
            导出报告
          </Button>,
        ]}
        search={{
          labelWidth: 'auto',
        }}
      />
    </div>
  );
};

export default UserAnalysis;
