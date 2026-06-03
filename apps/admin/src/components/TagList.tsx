import React from 'react';
import { Tag, Space } from 'antd';

interface TagListProps {
  tags: string[];
  max?: number;
  color?: string;
  closable?: boolean;
  onClose?: (tag: string) => void;
}

const TagList: React.FC<TagListProps> = ({
  tags,
  max = 3,
  color,
  closable = false,
  onClose,
}) => {
  if (!tags || tags.length === 0) {
    return <span style={{ color: '#999' }}>无</span>;
  }

  const displayTags = tags.slice(0, max);
  const remaining = tags.length - max;

  return (
    <Space size={[0, 4]} wrap>
      {displayTags.map((tag) => (
        <Tag
          key={tag}
          color={color}
          closable={closable}
          onClose={(e) => {
            e.preventDefault();
            onClose?.(tag);
          }}
        >
          {tag}
        </Tag>
      ))}
      {remaining > 0 && (
        <Tag color="default">+{remaining}</Tag>
      )}
    </Space>
  );
};

export default TagList;
