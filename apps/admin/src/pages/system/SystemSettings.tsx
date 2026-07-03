import React, { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Switch,
  Select,
  InputNumber,
  Button,
  Space,
  Divider,
  message,
  Tabs,
  Table,
  Alert,
} from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  getSystemConfig,
  updateSystemConfig,
  testEmailConfig,
  testSmsConfig,
  getSystemLogs,
  clearCache,
  getSystemInfo,
} from '@/services/systemService';
import { SystemConfig } from '@/types';
import dayjs from 'dayjs';

const SystemSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const [configRes, infoRes] = await Promise.all([
        getSystemConfig(),
        getSystemInfo(),
      ]);
      setConfig(configRes);
      setSystemInfo(infoRes);
      form.setFieldsValue(configRes);
    } catch (error) {
      message.error('获取系统配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      await updateSystemConfig(values);
      message.success('配置保存成功');
      fetchConfig();
    } catch (error) {
      // 错误已处理
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    const email = form.getFieldValue('emailConfig');
    if (!email?.host) {
      message.warning('请先填写邮件配置');
      return;
    }
    try {
      const result = await testEmailConfig('test@example.com');
      if (result.success) {
        message.success('邮件配置测试成功');
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('邮件配置测试失败');
    }
  };

  const handleClearCache = async () => {
    try {
      await clearCache();
      message.success('缓存清理成功');
    } catch (error) {
      // 错误已处理
    }
  };

  return (
    <div>
      <Tabs
        items={[
          {
            key: 'basic',
            label: '基本设置',
            children: (
              <Card loading={loading}>
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSave}
                  style={{ maxWidth: 600 }}
                >
                  <Form.Item name="siteName" label="站点名称">
                    <Input placeholder="请输入站点名称" />
                  </Form.Item>

                  <Form.Item name="siteDescription" label="站点描述">
                    <Input.TextArea rows={3} placeholder="请输入站点描述" />
                  </Form.Item>

                  <Form.Item name="allowRegister" label="允许注册" valuePropName="checked">
                    <Switch checkedChildren="是" unCheckedChildren="否" />
                  </Form.Item>

                  <Form.Item name="defaultRole" label="默认角色">
                    <Select>
                      <Select.Option value="student">学生</Select.Option>
                      <Select.Option value="teacher">教师</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item name="maxUploadSize" label="最大上传大小(MB)">
                    <InputNumber min={1} max={100} />
                  </Form.Item>

                  <Form.Item name="allowedFileTypes" label="允许的文件类型">
                    <Select mode="tags" placeholder="输入文件扩展名" />
                  </Form.Item>

                  <Form.Item>
                    <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                      保存配置
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
          {
            key: 'email',
            label: '邮件配置',
            children: (
              <Card loading={loading}>
                <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 600 }}>
                  <Form.Item label="SMTP服务器">
                    <Space.Compact style={{ width: '100%' }}>
                      <Form.Item name={['emailConfig', 'host']} noStyle>
                        <Input placeholder="smtp.example.com" style={{ width: '60%' }} />
                      </Form.Item>
                      <Form.Item name={['emailConfig', 'port']} noStyle>
                        <InputNumber placeholder="端口" style={{ width: '40%' }} />
                      </Form.Item>
                    </Space.Compact>
                  </Form.Item>

                  <Form.Item name={['emailConfig', 'user']} label="用户名">
                    <Input placeholder="请输入邮箱用户名" />
                  </Form.Item>

                  <Form.Item name={['emailConfig', 'from']} label="发件人">
                    <Input placeholder="noreply@example.com" />
                  </Form.Item>

                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                        保存配置
                      </Button>
                      <Button onClick={handleTestEmail}>测试连接</Button>
                    </Space>
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
          {
            key: 'system',
            label: '系统信息',
            children: (
              <Card loading={loading}>
                {systemInfo && (
                  <>
                    <Alert
                      message={`系统版本: ${systemInfo.version}`}
                      type="info"
                      style={{ marginBottom: 16 }}
                    />
                    <Table
                      dataSource={[
                        { key: '运行时间', value: `${Math.round(systemInfo.uptime / 3600)}小时` },
                        { key: '内存使用', value: `${Math.round(systemInfo.memory.used / 1024 / 1024)}MB / ${Math.round(systemInfo.memory.total / 1024 / 1024)}MB` },
                        { key: 'CPU使用率', value: `${systemInfo.cpu}%` },
                        { key: '数据库', value: `${systemInfo.database.type} ${systemInfo.database.version}` },
                      ]}
                      columns={[
                        { title: '项目', dataIndex: 'key' },
                        { title: '值', dataIndex: 'value' },
                      ]}
                      pagination={false}
                      showHeader={false}
                    />
                    <Divider />
                    <Button icon={<ReloadOutlined />} onClick={handleClearCache} danger>
                      清理系统缓存
                    </Button>
                  </>
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default SystemSettings;
