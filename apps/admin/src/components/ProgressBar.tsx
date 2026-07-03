import React from 'react';
import { Progress, Tooltip } from 'antd';

interface ProgressBarProps {
  value: number;
  max?: number;
  showInfo?: boolean;
  size?: 'small' | 'default';
  status?: 'success' | 'exception' | 'normal' | 'active';
  tooltip?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  showInfo = true,
  size = 'default',
  status,
  tooltip,
}) => {
  const percent = Math.min((value / max) * 100, 100);

  const progress = (
    <Progress
      percent={percent}
      size={size === 'small' ? 'small' : undefined}
      showInfo={showInfo}
      status={status}
      strokeColor={{
        '0%': '#108ee9',
        '100%': '#87d068',
      }}
    />
  );

  if (tooltip) {
    return <Tooltip title={tooltip}>{progress}</Tooltip>;
  }

  return progress;
};

export default ProgressBar;
