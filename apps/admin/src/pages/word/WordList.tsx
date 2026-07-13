import React, { useRef, useState } from 'react';
import {
  Card,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import ProTable from '@ant-design/pro-table';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import {
  getWordList,
  createWord,
  updateWord,
  deleteWord,
  exportWords,
} from '@/services/wordService';
import { getWordBookList } from '@/services/wordService';
import { Word, WordBook } from '@/types';
import dayjs from 'dayjs';

const WordList: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [wordBooks, setWordBooks] = useState<WordBook[]>([]);
  const [form] = Form.useForm();

  // 获取词书列表
  const fetchWordBooks = async () => {
    try {
      const res = await getWordBookList({ pageSize: 100 });
      setWordBooks(res.list);
    } catch (error) {
      // 错误已处理
    }
  };

  // 表格列定义
  const columns: ProColumns<Word>[] = [
    {
      title: 'ID',
      dataIndex: 'word_id',
      width: 100,
      ellipsis: true,
    },
    {
      title: '单词',
      dataIndex: 'headword',
      width: 150,
    },
    {
      title: '音标',
      dataIndex: 'phonetic',
      width: 150,
    },
    {
      title: '释义',
      dataIndex: 'meaning',
      ellipsis: true,
    },
    {
      title: '词书',
      dataIndex: 'tags',
      width: 120,
      renderText: (tags: string[] | null) =>
        tags && tags.length > 0 ? (
          <Tag color="blue">{tags.join(', ')}</Tag>
        ) : (
          '-'
        ),
    },
    {
      title: '难度',
      dataIndex: 'frequency',
      width: 80,
      renderText: (freq: number) => (
        <Tag color={freq >= 80 ? 'red' : freq >= 40 ? 'orange' : 'green'}>
          {freq || 0}
        </Tag>
      ),
    },
    {
      title: '频率',
      dataIndex: 'frequency',
      width: 80,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: Word) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该单词吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 获取数据
  const fetchData = async (params: any) => {
    const { current, pageSize, ...rest } = params;
    if (wordBooks.length === 0) {
      await fetchWordBooks();
    }
    const result = await getWordList({
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

  // 编辑单词
  const handleEdit = (word: Word) => {
    setCurrentWord(word);
    form.setFieldsValue(word);
    setEditModalVisible(true);
  };

  // 删除单词
  const handleDelete = async (word: Word) => {
    try {
      await deleteWord(word.id);
      message.success('单词已删除');
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      if (currentWord) {
        await updateWord(currentWord.id, values);
        message.success('单词更新成功');
      } else {
        await createWord(values);
        message.success('单词创建成功');
      }
      setEditModalVisible(false);
      form.resetFields();
      actionRef.current?.reload();
    } catch (error) {
      // 错误已处理
    }
  };

  return (
    <div>
      <ProTable<Word>
        columns={columns}
        actionRef={actionRef}
        request={fetchData}
        rowKey="word_id"
        pagination={{
          pageSize: 20,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setCurrentWord(null);
              form.resetFields();
              setEditModalVisible(true);
            }}
          >
            新建单词
          </Button>,
          <Button key="import" icon={<ImportOutlined />}>
            批量导入
          </Button>,
          <Button key="export" icon={<ExportOutlined />}>
            导出
          </Button>,
        ]}
        search={{
          labelWidth: 'auto',
        }}
      />

      {/* 编辑弹窗 */}
      <Modal
        title={currentWord ? '编辑单词' : '新建单词'}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="word"
            label="单词"
            rules={[{ required: true, message: '请输入单词' }]}
          >
            <Input placeholder="请输入单词" />
          </Form.Item>

          <Form.Item name="phonetic" label="音标">
            <Input placeholder="请输入音标" />
          </Form.Item>

          <Form.Item
            name="meaning"
            label="释义"
            rules={[{ required: true, message: '请输入释义' }]}
          >
            <Input.TextArea rows={2} placeholder="请输入释义" />
          </Form.Item>

          <Form.Item
            name="bookId"
            label="词书"
            rules={[{ required: true, message: '请选择词书' }]}
          >
            <Select>
              {wordBooks.map((b) => (
                <Select.Option key={b.id} value={b.id}>
                  {b.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="difficulty" label="难度">
            <InputNumber min={1} max={10} />
          </Form.Item>

          <Form.Item name="frequency" label="频率">
            <InputNumber min={0} />
          </Form.Item>

          <Form.Item name="examples" label="例句">
            <Input.TextArea rows={3} placeholder="每行一个例句" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WordList;
