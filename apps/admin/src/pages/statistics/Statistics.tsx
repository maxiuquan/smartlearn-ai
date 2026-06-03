import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Table, DatePicker, Select, Space, Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { StatCard, Chart } from '@/components';
import {
  getDashboardStats,
  getUserActivityTrend,
  getQuestionCompletionTrend,
  getSubjectDistribution,
  getKnowledgeMastery,
  getUserRanking,
} from '@/services/statisticsService';
import type { EChartsOption } from 'echarts';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const Statistics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);
  const [stats, setStats] = useState<any>(null);
  const [activityData, setActivityData] = useState<any>(null);
  const [questionData, setQuestionData] = useState<any>(null);
  const [subjectData, setSubjectData] = useState<any[]>([]);
  const [knowledgeData, setKnowledgeData] = useState<any[]>([]);
  const [rankingData, setRankingData] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const days = dateRange[1].diff(dateRange[0], 'day');
      const [
        statsRes,
        activityRes,
        questionRes,
        subjectRes,
        knowledgeRes,
        rankingRes,
      ] = await Promise.all([
        getDashboardStats(),
        getUserActivityTrend(days),
        getQuestionCompletionTrend(days),
        getSubjectDistribution(),
        getKnowledgeMastery(),
        getUserRanking('study_time', 10),
      ]);

      setStats(statsRes);
      setActivityData(activityRes);
      setQuestionData(questionRes);
      setSubjectData(subjectRes);
      setKnowledgeData(knowledgeRes);
      setRankingData(rankingRes);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  // 用户活跃趋势图
  const activityChartOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['活跃用户', '新增用户', '登录次数'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: activityData?.dates || [] },
    yAxis: { type: 'value' },
    series: [
      { name: '活跃用户', type: 'line', data: activityData?.activeUsers || [], smooth: true },
      { name: '新增用户', type: 'line', data: activityData?.newUsers || [], smooth: true },
      { name: '登录次数', type: 'line', data: activityData?.logins || [], smooth: true },
    ],
  };

  // 题目完成趋势图
  const questionChartOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['完成题目', '正确题目'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: questionData?.dates || [] },
    yAxis: { type: 'value' },
    series: [
      { name: '完成题目', type: 'bar', data: questionData?.completed || [] },
      { name: '正确题目', type: 'bar', data: questionData?.correct || [] },
    ],
  };

  // 学科分布饼图
  const subjectChartOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        name: '学科分布',
        type: 'pie',
        radius: ['40%', '70%'],
        data: subjectData.map((item) => ({ name: item.subject, value: item.count })),
      },
    ],
  };

  // 知识点掌握分布
  const knowledgeChartOption: EChartsOption = {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        name: '掌握程度',
        type: 'pie',
        radius: '60%',
        data: knowledgeData.map((item) => ({ name: item.level, value: item.count })),
      },
    ],
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <span>时间范围：</span>
          <RangePicker
            value={dateRange}
            onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
          />
          <Button icon={<DownloadOutlined />}>导出报告</Button>
        </Space>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="总用户数" value={stats?.totalUsers || 0} loading={loading} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="活跃用户" value={stats?.activeUsers || 0} loading={loading} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="题目总数" value={stats?.totalQuestions || 0} loading={loading} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="知识点数" value={stats?.totalKnowledgePoints || 0} loading={loading} />
        </Col>
      </Row>

      {/* 趋势图 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="用户活跃趋势">
            <Chart option={activityChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="题目完成趋势">
            <Chart option={questionChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      {/* 分布图 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="学科分布">
            <Chart option={subjectChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="知识点掌握分布">
            <Chart option={knowledgeChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      {/* 排行榜 */}
      <Card title="学习时长排行" style={{ marginTop: 16 }}>
        <Table
          dataSource={rankingData}
          rowKey={(record) => record.user.id}
          loading={loading}
          columns={[
            {
              title: '排名',
              key: 'rank',
              render: (_: any, __: any, index: number) => index + 1,
            },
            { title: '用户', dataIndex: 'user', render: (user: any) => user.nickname || user.id },
            { title: '学习时长', dataIndex: 'value', render: (v: number) => `${Math.round(v / 60)}小时` },
          ]}
        />
      </Card>
    </div>
  );
};

export default Statistics;
