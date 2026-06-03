import React, { useState } from 'react';
import { Modal, Tree, Input, Button, Space, message } from 'antd';
import { SearchOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { TreeProps } from 'antd';
import { KnowledgePoint } from '@/types';

interface KnowledgeTreeSelectProps {
  visible: boolean;
  onCancel: () => void;
  onOk: (selectedKeys: string[]) => void;
  treeData: KnowledgePoint[];
  title?: string;
  multiple?: boolean;
  selectedKeys?: string[];
}

const KnowledgeTreeSelect: React.FC<KnowledgeTreeSelectProps> = ({
  visible,
  onCancel,
  onOk,
  treeData,
  title = '选择知识点',
  multiple = true,
  selectedKeys: defaultSelectedKeys = [],
}) => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(defaultSelectedKeys);
  const [searchValue, setSearchValue] = useState('');

  // 转换为Ant Design Tree格式
  const convertToTreeData = (data: KnowledgePoint[]): TreeProps['treeData'] => {
    return data.map((item) => ({
      key: item.id,
      title: item.name,
      children: item.children ? convertToTreeData(item.children) : undefined,
    }));
  };

  // 过滤树节点
  const filterTreeData = (
    data: TreeProps['treeData'] = [],
    search: string
  ): TreeProps['treeData'] => {
    return data
      .map((item: any) => {
        const matchTitle = item.title.toLowerCase().includes(search.toLowerCase());
        const filteredChildren = item.children
          ? filterTreeData(item.children, search)
          : [];

        if (matchTitle || filteredChildren.length > 0) {
          return {
            ...item,
            children: filteredChildren.length > 0 ? filteredChildren : item.children,
          };
        }
        return null;
      })
      .filter(Boolean) as TreeProps['treeData'];
  };

  const treeDataConverted = convertToTreeData(treeData);
  const filteredTreeData = searchValue
    ? filterTreeData(treeDataConverted, searchValue)
    : treeDataConverted;

  const handleOk = () => {
    if (selectedKeys.length === 0) {
      message.warning('请选择至少一个知识点');
      return;
    }
    onOk(selectedKeys);
    setSelectedKeys([]);
    setSearchValue('');
  };

  const handleCancel = () => {
    setSelectedKeys([]);
    setSearchValue('');
    onCancel();
  };

  return (
    <Modal
      title={title}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={500}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Input
          placeholder="搜索知识点"
          prefix={<SearchOutlined />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          allowClear
        />
        <Tree
          checkable={multiple}
          selectable={!multiple}
          checkedKeys={selectedKeys}
          selectedKeys={multiple ? [] : selectedKeys}
          onCheck={(keys) => setSelectedKeys(keys as string[])}
          onSelect={(keys) => setSelectedKeys(keys as string[])}
          treeData={filteredTreeData}
          style={{ maxHeight: 400, overflow: 'auto' }}
        />
      </Space>
    </Modal>
  );
};

export default KnowledgeTreeSelect;
