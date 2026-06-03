import React from 'react';
import { Card, Statistic } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import styles from './StatCard.module.css';

interface StatCardProps {
  title: string;
  value: number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  trend?: number;
  loading?: boolean;
  precision?: number;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  prefix,
  suffix,
  trend,
  loading,
  precision = 0,
  className,
}) => {
  return (
    <Card className={`${styles.card} ${className || ''}`} loading={loading}>
      <Statistic
        title={title}
        value={value}
        precision={precision}
        prefix={prefix}
        suffix={suffix}
      />
      {trend !== undefined && (
        <div className={styles.trend}>
          {trend >= 0 ? (
            <span className={styles.up}>
              <ArrowUpOutlined /> {trend}% 较上周
            </span>
          ) : (
            <span className={styles.down}>
              <ArrowDownOutlined /> {Math.abs(trend)}% 较上周
            </span>
          )}
        </div>
      )}
    </Card>
  );
};

export default StatCard;
