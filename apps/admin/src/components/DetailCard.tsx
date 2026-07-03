import React from 'react';
import { Descriptions, Card, Avatar, Tag, Space, Button } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface DetailCardProps {
  title: string;
  data: Record<string, any>;
  fields: {
    key: string;
    label: string;
    render?: (value: any, data: Record<string, any>) => React.ReactNode;
    span?: number;
  }[];
  loading?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  extra?: React.ReactNode;
}

const DetailCard: React.FC<DetailCardProps> = ({
  title,
  data,
  fields,
  loading,
  onEdit,
  onDelete,
  extra,
}) => {
  const defaultRender = (value: any) => {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'boolean') {
      return value ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>;
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : '-';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  };

  return (
    <Card
      title={title}
      loading={loading}
      extra={
        <Space>
          {extra}
          {onEdit && (
            <Button type="link" icon={<EditOutlined />} onClick={onEdit}>
              编辑
            </Button>
          )}
          {onDelete && (
            <Button type="link" danger icon={<DeleteOutlined />} onClick={onDelete}>
              删除
            </Button>
          )}
        </Space>
      }
    >
      <Descriptions column={2} bordered>
        {fields.map((field) => (
          <Descriptions.Item key={field.key} label={field.label} span={field.span || 1}>
            {field.render
              ? field.render(data[field.key], data)
              : defaultRender(data[field.key])}
          </Descriptions.Item>
        ))}
      </Descriptions>
    </Card>
  );
};

export default DetailCard;
