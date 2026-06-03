# SmartLearn AI - Mobile App

一个基于 React Native + Expo 的智能学习助手移动应用，支持考研数学等学科的学习、练习和进度跟踪。

## 技术栈

- **React Native** - 跨平台移动应用框架
- **Expo** - React Native 开发工具链
- **TypeScript** - 类型安全
- **React Navigation** - 导航系统
- **React Native Paper** - Material Design UI 组件库
- **React Native Skia** - 高性能图形渲染（画板、图表）
- **Zustand** - 轻量级状态管理
- **Axios** - HTTP 客户端

## 项目结构

```
apps/mobile/
├── App.tsx                    # 应用入口
├── app.json                   # Expo 配置
├── package.json               # 依赖配置
├── tsconfig.json              # TypeScript 配置
└── src/
    ├── navigation/            # 导航系统
    │   ├── RootNavigator.tsx  # 根导航
    │   ├── AuthNavigator.tsx  # 认证导航
    │   └── MainNavigator.tsx  # 主导航（底部Tab）
    ├── screens/               # 页面组件
    │   ├── auth/              # 认证页面
    │   │   ├── LoginScreen.tsx
    │   │   ├── RegisterScreen.tsx
    │   │   └── ForgotPasswordScreen.tsx
    │   ├── home/              # 首页
    │   │   └── HomeScreen.tsx
    │   ├── learn/             # 学习页面
    │   │   └── LearnScreen.tsx
    │   ├── knowledge/         # 知识点页面
    │   │   ├── KnowledgeScreen.tsx
    │   │   ├── PastExamScreen.tsx
    │   │   └── WorkbookScreen.tsx
    │   ├── word/              # 单词页面
    │   │   ├── WordScreen.tsx
    │   │   └── PlanScreen.tsx
    │   └── profile/           # 个人中心
    │       └── ProfileScreen.tsx
    ├── components/            # 公共组件
    │   ├── common/            # 通用组件
    │   │   ├── ProgressBar.tsx
    │   │   ├── Countdown.tsx
    │   │   ├── QuickAction.tsx
    │   │   ├── StatCard.tsx
    │   │   ├── RadarChart.tsx
    │   │   ├── DrawingBoard.tsx
    │   │   ├── KnowledgeTree.tsx
    │   │   └── AchievementPopup.tsx
    │   ├── question/          # 答题组件
    │   │   ├── ChoiceQuestion.tsx
    │   │   ├── FillQuestion.tsx
    │   │   ├── CalculateQuestion.tsx
    │   │   └── QuestionRenderer.tsx
    │   └── word/              # 单词组件
    │       ├── WordCard.tsx
    │       ├── MatchGame.tsx
    │       ├── SpellGame.tsx
    │       └── WordRainGame.tsx
    ├── services/              # API 服务
    │   ├── apiClient.ts
    │   ├── authService.ts
    │   ├── questionService.ts
    │   ├── wordService.ts
    │   ├── knowledgeService.ts
    │   └── studyService.ts
    ├── stores/                # 状态管理
    │   ├── authStore.ts
    │   ├── questionStore.ts
    │   ├── wordStore.ts
    │   ├── knowledgeStore.ts
    │   └── studyStore.ts
    ├── utils/                 # 工具函数
    │   ├── theme.ts
    │   ├── dateUtils.ts
    │   ├── calculations.ts
    │   ├── validation.ts
    │   └── helpers.ts
    └── types/                 # 类型定义
        └── index.ts
```

## 功能特性

### 页面功能

1. **认证模块**
   - 登录/注册/忘记密码
   - JWT Token 认证
   - 安全存储

2. **首页**
   - 今日计划概览
   - 学习进度统计
   - 快速入口
   - 考试倒计时

3. **学习模块**
   - 多种题型支持（选择、填空、计算、证明）
   - 手写画板（支持触控笔）
   - 答案解析展示
   - 进度跟踪

4. **知识点模块**
   - 知识点树形结构
   - 能力热力图（雷达图）
   - 学习路径规划
   - 掌握度追踪

5. **真题模块**
   - 历年真题选择
   - 模拟考试
   - 成绩记录

6. **习题册模块**
   - 660、880等习题册
   - 进度跟踪
   - 难度分类

7. **单词模块**
   - 单词卡片学习
   - 趣味游戏（配对、拼写、单词雨）
   - 复习提醒
   - 掌握度追踪

8. **规划模块**
   - 考试倒计时
   - 每日计划
   - 周视图
   - 学习统计

9. **个人中心**
   - 个人信息
   - 学习报告
   - 成就徽章
   - 能力分析
   - 设置

### 核心组件

- **答题组件**: 支持选择题、填空题、计算题
- **手写画板**: 基于 Skia 的高性能画板
- **进度条**: 可配置的进度展示
- **能力雷达图**: 多维度能力可视化
- **倒计时组件**: 考试倒计时
- **知识点树**: 可展开的树形结构
- **单词游戏**: 配对、拼写、单词雨
- **成就弹窗**: 解锁成就展示

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
# 启动 Expo
npm start

# iOS
npm run ios

# Android
npm run android

# Web
npm run web
```

### 构建生产版本

```bash
# 构建 iOS
npx expo build:ios

# 构建 Android
npx expo build:android
```

## 配置说明

### API 配置

在 `src/services/apiClient.ts` 中修改 API 基础 URL:

```typescript
const BASE_URL = 'https://api.smartlearn.ai/v1';
```

### 主题配置

在 `src/utils/theme.ts` 中自定义主题颜色:

```typescript
const customColors = {
  primary: '#4F46E5',
  secondary: '#10B981',
  // ...
};
```

## 开发指南

### 添加新页面

1. 在 `src/screens/` 下创建页面组件
2. 在 `src/navigation/` 中添加路由
3. 在 `src/types/index.ts` 中添加导航类型

### 添加新组件

1. 在 `src/components/` 下创建组件
2. 导出组件到 `index.ts`

### 添加新 API

1. 在 `src/services/` 中创建服务
2. 使用 `apiClient` 进行 HTTP 请求

### 状态管理

使用 Zustand 创建 store:

```typescript
import { create } from 'zustand';

interface MyStore {
  value: string;
  setValue: (value: string) => void;
}

export const useMyStore = create<MyStore>((set) => ({
  value: '',
  setValue: (value) => set({ value }),
}));
```

## 许可证

MIT
