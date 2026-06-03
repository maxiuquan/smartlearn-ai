export const calculateAccuracy = (correct: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
};

export const calculateProgress = (current: number, total: number): number => {
  if (total === 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
};

export const calculateMasteryLevel = (
  correctCount: number,
  wrongCount: number,
  timeSpent: number,
  averageTime: number
): number => {
  const total = correctCount + wrongCount;
  if (total === 0) return 0;

  const accuracy = correctCount / total;
  const speedFactor = averageTime > 0 ? Math.min(1, averageTime / timeSpent) : 1;
  
  const mastery = (accuracy * 0.7 + speedFactor * 0.3) * 100;
  return Math.round(Math.min(100, Math.max(0, mastery)));
};

export const getGradeFromScore = (score: number): {
  grade: string;
  color: string;
} => {
  if (score >= 90) return { grade: 'A', color: '#22C55E' };
  if (score >= 80) return { grade: 'B', color: '#3B82F6' };
  if (score >= 70) return { grade: 'C', color: '#F59E0B' };
  if (score >= 60) return { grade: 'D', color: '#F97316' };
  return { grade: 'F', color: '#EF4444' };
};

export const getDifficultyLabel = (difficulty: string): string => {
  const labels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  };
  return labels[difficulty] || difficulty;
};

export const getDifficultyColor = (difficulty: string): string => {
  const colors: Record<string, string> = {
    easy: '#22C55E',
    medium: '#F59E0B',
    hard: '#EF4444',
  };
  return colors[difficulty] || '#6B7280';
};
