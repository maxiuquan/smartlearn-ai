import React, { useState } from 'react';
import {
  Card,
  Upload,
  Button,
  Table,
  message,
  Space,
  Alert,
  Divider,
  Select,
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { importQuestions } from '@/services/questionService';
import { FileUpload } from '@/components';

const { Dragger } = Upload;

const QuestionImport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const handleUpload = async (file: File) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await importQuestions(file);
      setResult(res);
      if (res.success > 0) {
        message.success(`成功导入 ${res.success} 条题目`);
      }
    } catch (error) {
      message.error('导入失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    // 下载模板逻辑
    message.info('模板下载功能待实现');
  };

  return (
    <div>
      <Card title="批量导入题目">
        <Alert
          message="导入说明"
          description={
            <div>
              <p>1. 请先下载导入模板，按照模板格式填写题目数据</p>
              <p>2. 支持的文件格式：Excel (.xlsx, .xls)、CSV</p>
              <p>3. 单次最多导入 1000 条题目</p>
              <p>4. 导入完成后会显示导入结果</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Button
          icon={<DownloadOutlined />}
          onClick={handleDownloadTemplate}
          style={{ marginBottom: 16 }}
        >
          下载导入模板
        </Button>

        <Divider />

        <Dragger
          name="file"
          accept=".xlsx,.xls,.csv"
          beforeUpload={(file) => {
            handleUpload(file);
            return false;
          }}
          showUploadList={false}
          disabled={loading}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 Excel (.xlsx, .xls) 或 CSV 格式文件
          </p>
        </Dragger>

        {result && (
          <div style={{ marginTop: 24 }}>
            <Alert
              message={`导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`}
              type={result.failed === 0 ? 'success' : 'warning'}
              showIcon
            />

            {result.errors && result.errors.length > 0 && (
              <Table
                style={{ marginTop: 16 }}
                title={() => '错误详情'}
                dataSource={result.errors.map((error, index) => ({
                  key: index,
                  error,
                }))}
                columns={[
                  {
                    title: '行号',
                    dataIndex: 'key',
                    render: (key) => key + 1,
                  },
                  {
                    title: '错误信息',
                    dataIndex: 'error',
                  },
                ]}
                pagination={false}
                size="small"
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default QuestionImport;
