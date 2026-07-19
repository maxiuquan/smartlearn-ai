import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { ApiResponse } from '../types';

/**
 * Base URL for the SmartLearn API.
 * Reads from Expo's extra config (app.json → expo.extra.apiBaseUrl),
 * allowing different URLs per environment (dev/staging/prod) without
 * code changes. Falls back to localhost for development.
 */
const BASE_URL: string =
  Constants.expoConfig?.extra?.apiBaseUrl ||
  'http://localhost:8000/api/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          await SecureStore.deleteItemAsync('token');
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, params?: object): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get(url, { params });
      return { success: true, data: response.data };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async post<T>(url: string, data?: object): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post(url, data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async put<T>(url: string, data?: object): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put(url, data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete(url);
      return { success: true, data: response.data };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  private handleError<T>(error: unknown): ApiResponse<T> {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      return { success: false, error: message };
    }
    return { success: false, error: 'Unknown error occurred' };
  }
}

export const apiClient = new ApiClient();
