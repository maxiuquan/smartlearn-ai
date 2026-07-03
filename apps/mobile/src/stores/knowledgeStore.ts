import { create } from 'zustand';
import { KnowledgePoint, AbilityProfile } from '../types';

interface KnowledgeStore {
  knowledgePoints: KnowledgePoint[];
  selectedKnowledge: KnowledgePoint | null;
  abilityProfiles: Map<string, AbilityProfile>;
  expandedNodes: Set<string>;
  isLoading: boolean;
  
  // Actions
  setKnowledgePoints: (points: KnowledgePoint[]) => void;
  selectKnowledge: (point: KnowledgePoint | null) => void;
  toggleExpand: (nodeId: string) => void;
  updateMastery: (pointId: string, level: number) => void;
  getChildren: (parentId: string) => KnowledgePoint[];
  getRootPoints: () => KnowledgePoint[];
  getAbilityHeatmap: () => Map<string, number>;
}

export const useKnowledgeStore = create<KnowledgeStore>((set, get) => ({
  knowledgePoints: [],
  selectedKnowledge: null,
  abilityProfiles: new Map(),
  expandedNodes: new Set(),
  isLoading: false,

  setKnowledgePoints: (points: KnowledgePoint[]) => {
    set({ knowledgePoints: points });
  },

  selectKnowledge: (point: KnowledgePoint | null) => {
    set({ selectedKnowledge: point });
  },

  toggleExpand: (nodeId: string) => {
    const { expandedNodes } = get();
    const newExpanded = new Set(expandedNodes);
    
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    
    set({ expandedNodes: newExpanded });
  },

  updateMastery: (pointId: string, level: number) => {
    const { knowledgePoints } = get();
    
    const updatePoint = (points: KnowledgePoint[]): KnowledgePoint[] => {
      return points.map(point => {
        if (point.id === pointId) {
          return { ...point, masteryLevel: level };
        }
        if (point.children) {
          return { ...point, children: updatePoint(point.children) };
        }
        return point;
      });
    };
    
    set({ knowledgePoints: updatePoint(knowledgePoints) });
  },

  getChildren: (parentId: string) => {
    const { knowledgePoints } = get();
    
    const findChildren = (points: KnowledgePoint[]): KnowledgePoint[] => {
      for (const point of points) {
        if (point.id === parentId) {
          return point.children || [];
        }
        if (point.children) {
          const found = findChildren(point.children);
          if (found.length > 0) return found;
        }
      }
      return [];
    };
    
    return findChildren(knowledgePoints);
  },

  getRootPoints: () => {
    const { knowledgePoints } = get();
    return knowledgePoints.filter(point => point.parentId === null);
  },

  getAbilityHeatmap: () => {
    const { abilityProfiles } = get();
    const heatmap = new Map<string, number>();
    
    abilityProfiles.forEach((profile, id) => {
      const score = (profile.accuracy * 0.4 + profile.speed * 0.3 + profile.consistency * 0.3) * 100;
      heatmap.set(id, score);
    });
    
    return heatmap;
  },
}));
