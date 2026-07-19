import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';
import { useAuthStore } from '@/stores/authStore';
import { PaginatedResponse } from '@/types';

// 创建 axios 实例
// baseURL 设为 /api/v1，与后端 FastAPI 路由聚合前缀（api_router prefix="/api/v1"）对齐
// 后端直接返回业务对象（无 {code, message, data} 包装），响应拦截器直透 res.data
const request: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：注入 Authorization 头
request.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // 分页参数命名转换：前端驼峰 pageSize → 后端蛇形 page_size
    if (config.params && config.params.pageSize !== undefined) {
      config.params.page_size = config.params.pageSize;
      delete config.params.pageSize;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：直透后端原始响应，仅在 HTTP 错误时统一提示
request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      // 后端错误体通常是 {detail: string} 或 {detail: [{msg: string}]}
      const detail = data?.detail;
      let errMsg = '请求失败';
      if (typeof detail === 'string') {
        errMsg = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        errMsg = detail[0]?.msg || errMsg;
      }

      switch (status) {
        case 401:
          message.error('登录已过期，请重新登录');
          useAuthStore.getState().logout();
          // 需带上 /admin/ 前缀，与 BrowserRouter basename 一致
          window.location.href = '/admin/login';
          break;
        case 403:
          message.error('没有权限访问');
          break;
        case 404:
          message.error('请求的资源不存在');
          break;
        case 500:
          message.error('服务器错误');
          break;
        default:
          message.error(errMsg);
      }
    } else {
      message.error('网络错误，请检查网络连接');
    }
    return Promise.reject(error);
  }
);

// 封装请求方法：直透后端返回的业务对象
export const api = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return request.get(url, config).then((res) => res.data);
  },
  post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return request.post(url, data, config).then((res) => res.data);
  },
  put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return request.put(url, data, config).then((res) => res.data);
  },
  patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return request.patch(url, data, config).then((res) => res.data);
  },
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return request.delete(url, config).then((res) => res.data);
  },
};

// 分页请求参数（前端用驼峰，请求拦截器自动转为后端蛇形）
export interface PageParams {
  page?: number;
  pageSize?: number;
  [key: string]: any;
}

// 分页请求方法
// 后端分页返回 {items: T[], total: number, page: number, page_size: number}
// 这里适配为前端期望的 PaginatedResponse {list, total, page, pageSize}
export const pageApi = {
  get<T>(url: string, params?: PageParams): Promise<PaginatedResponse<T>> {
    return request.get(url, { params }).then((res) => {
      const d = res.data;
      // 兼容后端两种可能的分页结构
      if (Array.isArray(d)) {
        // 后端直接返回数组（无分页包装）
        return {
          list: d,
          total: d.length,
          page: params?.page || 1,
          pageSize: params?.pageSize || d.length,
        };
      }
      return {
        list: d.items ?? d.list ?? [],
        total: d.total ?? 0,
        page: d.page ?? params?.page ?? 1,
        pageSize: d.page_size ?? d.pageSize ?? params?.pageSize ?? 0,
      };
    });
  },
};

export default request;
