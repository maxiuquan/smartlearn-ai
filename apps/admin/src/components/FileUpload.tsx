import React, { useRef } from 'react';
import { Upload, Button, message, UploadProps } from 'antd';
import { UploadOutlined, InboxOutlined } from '@ant-design/icons';

interface FileUploadProps {
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  drag?: boolean;
  onUpload: (file: File) => Promise<void>;
  buttonText?: string;
  loading?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  maxSize = 10,
  multiple = false,
  drag = false,
  onUpload,
  buttonText = '上传文件',
  loading = false,
}) => {
  const uploadRef = useRef<any>(null);

  const handleBeforeUpload: UploadProps['beforeUpload'] = async (file) => {
    // 检查文件大小
    const isLtMaxSize = file.size / 1024 / 1024 < maxSize;
    if (!isLtMaxSize) {
      message.error(`文件大小不能超过 ${maxSize}MB`);
      return false;
    }

    try {
      await onUpload(file);
      message.success('上传成功');
    } catch (error) {
      message.error('上传失败');
    }

    return false;
  };

  if (drag) {
    return (
      <Upload.Dragger
        accept={accept}
        multiple={multiple}
        beforeUpload={handleBeforeUpload}
        showUploadList={false}
        disabled={loading}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          支持单个或批量上传，文件大小不超过 {maxSize}MB
        </p>
      </Upload.Dragger>
    );
  }

  return (
    <Upload
      ref={uploadRef}
      accept={accept}
      multiple={multiple}
      beforeUpload={handleBeforeUpload}
      showUploadList={false}
      disabled={loading}
    >
      <Button icon={<UploadOutlined />} loading={loading}>
        {buttonText}
      </Button>
    </Upload>
  );
};

export default FileUpload;
