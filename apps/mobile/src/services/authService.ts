import { apiClient } from './apiClient';
import { User, ApiResponse } from '../types';

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

interface LoginResponse {
  user: User;
  token: string;
}

class AuthService {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Login failed');
    }
    return response.data;
  }

  async register(data: RegisterRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/register', data);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Registration failed');
    }
    return response.data;
  }

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  }

  async forgotPassword(data: { email: string }): Promise<void> {
    const response = await apiClient.post('/auth/forgot-password', data);
    if (!response.success) {
      throw new Error(response.error || 'Failed to send reset email');
    }
  }

  async resetPassword(data: { token: string; password: string }): Promise<void> {
    const response = await apiClient.post('/auth/reset-password', data);
    if (!response.success) {
      throw new Error(response.error || 'Failed to reset password');
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get user');
    }
    return response.data;
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await apiClient.put<User>('/auth/profile', data);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update profile');
    }
    return response.data;
  }
}

export const authService = new AuthService();
