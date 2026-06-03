import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Table, Progress, Space, Tag } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  BranchesOutlined,
  ReadOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { StatCard, Chart } from '@/components';
import {
  getDashboardStats,
  getUserActivityTrend,
  getSubjectDistribution,
  getUserRanking,
} from '@/services/statisticsService';
import { DashboardStats } from '@/types';
import type { EChartsOption } from 'echarts';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activityData, setActivityData] = useState<any>(null);
  const [subjectData, setSubjectData] = useState<any[]>([]);
  const [rankingData, setRankingData] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, activityRes, subjectRes, rankingRes] = await Promise.all([
        getDashboardStats(),
        getUserActivityTrend(30),
        getSubjectDistribution(),
        getUserRanking('study_time', 10),
      ]);

      setStats(statsRes);
      setActivityData(activityRes);
      setSubjectData(subjectRes);
      setRankingData(rankingRes);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 用户活跃趋势图配置
  const activityChartOption: EChartsOption = {
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['活跃用户', '新增用户', '登录次数'],
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: activityData?.dates || [],
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: '活跃用户',
        type: 'line',
        data: activityData?.activeUsers || [],
        smooth: true,
      },
      {
        name: '新增用户',
        type: 'line',
        data: activityData?.newUsers || [],
        smooth: true,
      },
      {
        name: '登录次数',
        type: 'line',
        data: activityData?.logins || [],
        smooth: true,
      },
    ],
  };

  // 学科分布饼图配置
  const subjectChartOption: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: '学科分布',
        type: 'pie',
        radius: ['40%', '70%'],
        data: subjectData.map((item) => ({
          name: item.subject,
          value: item.count,
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  };

  // 排行榜列配置
  const rankingColumns = [
    {
      title: '排名',
      key: 'rank',
      render: (_: any, __: any, index: number) => (
        <Tag color={index < 3 ? 'gold' : 'default'}>{index + 1}</Tag>
      ),
    },
    {
      title: '用户',
      dataIndex: 'user',
      render: (user: any) => `${user.nickname || user.id}`,
    },
    {
      title: '学习时长',
      dataIndex: 'value',
      render: (value: number) => `${Math.round(value / 60)}小时`,
    },
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="总用户数"
            value={stats?.totalUsers || 0}
            prefix={<UserOutlined />}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="活跃用户"
            value={stats?.activeUsers || 0}
            prefix={<RiseOutlined />}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="题目总数"
            value={stats?.totalQuestions || 0}
            prefix={<FileTextOutlined />}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="知识点数"
            value={stats?.totalKnowledgePoints || 0}
            prefix={<BranchesOutlined />}
            loading={loading}
          />
        </Col>
      </Row>

      {/* 今日统计 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="今日登录"
            value={stats?.todayLogins || 0}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="周活跃用户"
            value={stats?.weeklyActiveUsers || 0}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="月活跃用户"
            value={stats?.monthlyActiveUsers || 0}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="单词总数"
            value={stats?.totalWords || 0}
            prefix={<ReadOutlined />}
            loading={loading}
          />
        </Col>
      </Row>

      {/* 图表 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="用户活跃趋势">
            <Chart option={activityChartOption} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="学科分布">
            <Chart option={subjectChartOption} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>

      {/* 排行榜 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="学习时长排行">
            <Table
              columns={rankingColumns}
              dataSource={rankingData}
              rowKey={(record) => record.user.id}
              pagination={false}
              size="small"
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="系统概览">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <div style={{ marginBottom: 8 }}>用户活跃率</div>
                <Progress
                  percent={stats ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}
                  strokeColor={{ from: '#108ee9', to: '#87d068' }}
                />
              </div>
              <div>
                <div style={{ marginBottom: 8 }}>周活跃率</div>
                <Progress
                  percent={stats ? Math.round((stats.weeklyActiveUsers / stats.totalUsers) * 100) : 0}
                  strokeColor={{ from: '#108ee9', to: '#87d068' }}
                />
              </div>
              <div>
                <div style={{ marginBottom: 8 }}>月活跃率</div>
                <Progress
                  percent={stats ? Math.round((stats.monthlyActiveUsers / stats.totalUsers) * 100) : 0}
                  strokeColor={{ from: '#108ee9', to: '#87d068' }}
                />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
