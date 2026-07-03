import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';
import { useAuthStore } from '@/stores/authStore';
import { ApiResponse, PaginatedResponse } from '@/types';

// 创建axios实例
const request: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const { data } = response;
    
    if (data.code === 0) {
      return response;
    }
    
    // 业务错误
    message.error(data.message || '请求失败');
    return Promise.reject(new Error(data.message));
  },
  (error) => {
    if (error.response) {
      const { status } = error.response;
      
      switch (status) {
        case 401:
          message.error('登录已过期，请重新登录');
          useAuthStore.getState().logout();
          window.location.href = '/login';
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
          message.error(error.message || '请求失败');
      }
    } else {
      message.error('网络错误，请检查网络连接');
    }
    
    return Promise.reject(error);
  }
);

// 封装请求方法
export const api = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return request.get(url, config).then((res) => res.data.data);
  },

  post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return request.post(url, data, config).then((res) => res.data.data);
  },

  put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return request.put(url, data, config).then((res) => res.data.data);
  },

  patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return request.patch(url, data, config).then((res) => res.data.data);
  },

  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return request.delete(url, config).then((res) => res.data.data);
  },
};

// 分页请求参数
export interface PageParams {
  page?: number;
  pageSize?: number;
  [key: string]: any;
}

// 分页请求方法
export const pageApi = {
  get<T>(url: string, params?: PageParams): Promise<PaginatedResponse<T>> {
    return request.get(url, { params }).then((res) => res.data.data);
  },
};

export default request;
