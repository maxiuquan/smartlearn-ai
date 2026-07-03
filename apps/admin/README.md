# SmartLearn AI 管理后台

基于 React + TypeScript + Ant Design Pro 构建的智能学习平台管理后台。

## 技术栈

- **框架**: React 18 + TypeScript
- **UI组件**: Ant Design 5 + Ant Design Pro
- **路由**: React Router 6
- **HTTP客户端**: Axios
- **图表**: ECharts
- **状态管理**: Zustand
- **构建工具**: Vite

## 功能模块

### 1. 登录页面
- 管理员登录认证
- 记住登录状态
- Token自动刷新

### 2. 仪表盘
- 数据概览统计卡片
- 用户活跃趋势图
- 学科分布饼图
- 学习时长排行榜

### 3. 用户管理
- 用户列表（分页、搜索、筛选）
- 用户详情查看
- 用户禁用/启用
- 用户导入/导出

### 4. 题目管理
- 题目CRUD操作
- 题目批量导入
- 题目导出
- 题型分类管理

### 5. 知识点管理
- 知识点列表管理
- 知识点树形结构编辑
- 知识点依赖关系设置
- 拖拽排序

### 6. 学科管理
- 学科配置管理
- 年级范围设置
- 启用/禁用状态

### 7. 单词管理
- 单词库管理
- 词书管理
- 批量导入/导出

### 8. 真题管理
- 历年真题管理
- 真题发布
- 题目关联

### 9. 习题册管理
- 习题册配置
- 题目添加/移除
- 公开/私有设置

### 10. 数据统计
- 学习报告
- 用户分析
- 趋势图表
- 数据导出

### 11. 系统设置
- 基本配置
- 邮件配置
- 系统信息查看
- 缓存清理

## 目录结构

```
src/
├── components/          # 公共组件
│   ├── Chart.tsx        # ECharts封装
│   ├── DetailCard.tsx   # 详情卡片
│   ├── FileUpload.tsx   # 文件上传
│   ├── KnowledgeTreeSelect.tsx  # 知识点选择
│   ├── ProgressBar.tsx  # 进度条
│   ├── StatCard.tsx     # 统计卡片
│   └── TagList.tsx      # 标签列表
├── layouts/             # 布局组件
│   ├── BasicLayout.tsx  # 主布局
│   └── LoginLayout.tsx  # 登录布局
├── pages/               # 页面组件
│   ├── dashboard/       # 仪表盘
│   ├── user/            # 用户管理
│   ├── question/        # 题目管理
│   ├── knowledge/       # 知识点管理
│   ├── subject/         # 学科管理
│   ├── word/            # 单词管理
│   ├── pastexam/        # 真题管理
│   ├── workbook/        # 习题册管理
│   ├── statistics/      # 数据统计
│   └── system/          # 系统设置
├── services/            # API服务
│   ├── request.ts       # Axios封装
│   ├── authService.ts   # 认证服务
│   ├── userService.ts   # 用户服务
│   └── ...
├── stores/              # 状态管理
│   └── authStore.ts     # 认证状态
├── types/               # 类型定义
│   └── index.ts
├── utils/               # 工具函数
│   ├── dateUtils.ts     # 日期工具
│   ├── helpers.ts       # 通用工具
│   └── validation.ts    # 验证工具
├── styles/              # 样式文件
│   └── global.css
├── App.tsx              # 主应用
└── index.tsx            # 入口文件
```

## 开发指南

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 代码检查

```bash
npm run lint
```

### 代码格式化

```bash
npm run format
```

## API配置

开发环境下，API请求会代理到 `http://localhost:8000`。

可以在 `vite.config.ts` 中修改代理配置：

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
}
```

## 环境变量

创建 `.env.local` 文件配置环境变量：

```
VITE_API_BASE_URL=http://localhost:8000
```

## 权限控制

系统支持以下角色：
- `student` - 学生
- `teacher` - 教师
- `admin` - 管理员
- `super_admin` - 超级管理员

路由权限控制在 `App.tsx` 中通过 `ProtectedRoute` 组件实现。

## 注意事项

1. 所有API请求都需要携带Token
2. Token过期会自动跳转登录页
3. 文件上传大小默认限制10MB
4. 建议使用Chrome或Firefox浏览器

## License

MIT
