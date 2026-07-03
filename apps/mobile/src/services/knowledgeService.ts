import { apiClient } from './apiClient';
import { KnowledgePoint, AbilityProfile } from '../types';

class KnowledgeService {
  async getKnowledgeTree(): Promise<KnowledgePoint[]> {
    const response = await apiClient.get<KnowledgePoint[]>('/knowledge/tree');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get knowledge tree');
    }
    return response.data;
  }

  async getKnowledgePoint(id: string): Promise<KnowledgePoint> {
    const response = await apiClient.get<KnowledgePoint>(`/knowledge/${id}`);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get knowledge point');
    }
    return response.data;
  }

  async getAbilityProfile(): Promise<AbilityProfile[]> {
    const response = await apiClient.get<AbilityProfile[]>('/knowledge/ability');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get ability profile');
    }
    return response.data;
  }

  async getLearningPath(): Promise<{
    currentLevel: string;
    nextGoals: string[];
    recommendedQuestions: string[];
  }> {
    const response = await apiClient.get('/knowledge/learning-path');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get learning path');
    }
    return response.data;
  }

  async updateMastery(pointId: string, masteryLevel: number): Promise<void> {
    const response = await apiClient.put(`/knowledge/${pointId}/mastery`, { masteryLevel });
    if (!response.success) {
      throw new Error(response.error || 'Failed to update mastery');
    }
  }
}

export const knowledgeService = new KnowledgeService();
