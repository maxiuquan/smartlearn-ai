import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { ProLayout, PageContainer } from '@ant-design/pro-layout';
import {
  DashboardOutlined,
  UserOutlined,
  FileTextOutlined,
  BranchesOutlined,
  BookOutlined,
  ReadOutlined,
  FileSearchOutlined,
  FolderOutlined,
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown, Space, Button, theme } from 'antd';
import { useAuthStore } from '@/stores/authStore';
import { logout as logoutService } from '@/services/authService';

const BasicLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [pathname, setPathname] = useState('/dashboard');
  const navigate = useNavigate();
  const location = useLocation();
  const { token: { colorBgContainer } } = theme.useToken();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    setPathname(location.pathname);
  }, [location.pathname]);

  // 菜单配置
  const menuData = [
    {
      path: '/dashboard',
      name: '仪表盘',
      icon: <DashboardOutlined />,
    },
    {
      path: '/user',
      name: '用户管理',
      icon: <UserOutlined />,
      children: [
        { path: '/user', name: '用户列表' },
      ],
    },
    {
      path: '/question',
      name: '题目管理',
      icon: <FileTextOutlined />,
      children: [
        { path: '/question', name: '题目列表' },
        { path: '/question/import', name: '批量导入' },
      ],
    },
    {
      path: '/knowledge',
      name: '知识点管理',
      icon: <BranchesOutlined />,
      children: [
        { path: '/knowledge', name: '知识点列表' },
        { path: '/knowledge/tree', name: '知识点树' },
      ],
    },
    {
      path: '/subject',
      name: '学科管理',
      icon: <BookOutlined />,
    },
    {
      path: '/word',
      name: '单词管理',
      icon: <ReadOutlined />,
      children: [
        { path: '/word', name: '单词列表' },
        { path: '/word/book', name: '词书管理' },
      ],
    },
    {
      path: '/pastexam',
      name: '真题管理',
      icon: <FileSearchOutlined />,
    },
    {
      path: '/workbook',
      name: '习题册管理',
      icon: <FolderOutlined />,
    },
    {
      path: '/statistics',
      name: '数据统计',
      icon: <BarChartOutlined />,
      children: [
        { path: '/statistics', name: '学习报告' },
        { path: '/statistics/user', name: '用户分析' },
      ],
    },
    {
      path: '/system',
      name: '系统设置',
      icon: <SettingOutlined />,
    },
  ];

  // 处理菜单点击
  const handleMenuClick = (path: string) => {
    navigate(path);
  };

  // 退出登录
  const handleLogout = async () => {
    try {
      await logoutService();
    } catch (error) {
      // 忽略错误
    }
    logout();
    navigate('/login');
  };

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => navigate('/profile'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <ProLayout
      title="SmartLearn AI"
      logo={<DashboardOutlined style={{ fontSize: 24 }} />}
      layout="mix"
      collapsed={collapsed}
      onCollapse={setCollapsed}
      menu={{ locale: false }}
      route={{ path: '/', routes: menuData }}
      menuItemRender={(item, dom) => (
        // P0 修复: ProLayout 7.22.3 中 <div onClick> 包裹不触发导航,
        // 改用 Link 组件确保可靠跳转 (React Router 拦截点击并 navigate)
        item.path ? <Link to={item.path} style={{ display: 'block' }}>{dom}</Link> : <div>{dom}</div>
      )}
      actionsRender={() => [
        <Button
          key="collapse"
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setCollapsed(!collapsed)}
        />,
        <Dropdown key="user" menu={{ items: userMenuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <Avatar
              src={user?.avatar}
              icon={!user?.avatar && <UserOutlined />}
              size="small"
            />
            <span>{user?.nickname || user?.email || '管理员'}</span>
          </Space>
        </Dropdown>,
      ]}
      contentStyle={{
        margin: 0,
      }}
    >
      <PageContainer
        header={{
          title: null,
          breadcrumb: {},
        }}
      >
        <Outlet />
      </PageContainer>
    </ProLayout>
  );
};

export default BasicLayout;
