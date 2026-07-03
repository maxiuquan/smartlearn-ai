import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme, SegmentedButtons, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from 'react-native-vector-icons';
import { KnowledgeTree, RadarChart, ProgressBar } from '../../components';
import { useKnowledgeStore } from '../../stores';
import { knowledgeService } from '../../services';
import { KnowledgePoint } from '../../types';
import { theme, spacing, borderRadius } from '../../utils/theme';

type ViewMode = 'tree' | 'heatmap' | 'path';

export const KnowledgeScreen: React.FC = () => {
  const { colors } = useTheme();
  const {
    knowledgePoints,
    selectedKnowledge,
    expandedNodes,
    selectKnowledge,
    toggleExpand,
    getAbilityHeatmap,
  } = useKnowledgeStore();

  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadKnowledgeTree();
  }, []);

  const loadKnowledgeTree = async () => {
    setIsLoading(true);
    try {
      const tree = await knowledgeService.getKnowledgeTree();
      useKnowledgeStore.getState().setKnowledgePoints(tree);
    } catch (error) {
      console.error('Failed to load knowledge tree:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const abilityData = [
    { label: '极限', value: 85 },
    { label: '导数', value: 72 },
    { label: '积分', value: 68 },
    { label: '级数', value: 55 },
    { label: '微分方程', value: 45 },
    { label: '线性代数', value: 60 },
  ];

  const learningPath = [
    {
      id: '1',
      name: '巩固基础',
      description: '完成极限与连续的基础练习',
      progress: 80,
      status: 'current',
    },
    {
      id: '2',
      name: '提升能力',
      description: '掌握导数与微分的高级应用',
      progress: 30,
      status: 'pending',
    },
    {
      id: '3',
      name: '突破难点',
      description: '攻克积分与级数的综合题型',
      progress: 0,
      status: 'locked',
    },
  ];

  const renderTreeView = () => (
    <View style={styles.treeContainer}>
      <KnowledgeTree
        nodes={knowledgePoints}
        expandedNodes={expandedNodes}
        selectedId={selectedKnowledge?.id}
        onToggleExpand={toggleExpand}
        onSelect={selectKnowledge}
      />
    </View>
  );

  const renderHeatmapView = () => (
    <View style={styles.heatmapContainer}>
      <View style={styles.radarWrapper}>
        <RadarChart data={abilityData} size={280} />
      </View>
      <View style={styles.legendContainer}>
        {abilityData.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor:
                    item.value >= 80
                      ? theme.colors.success
                      : item.value >= 60
                      ? theme.colors.warning
                      : theme.colors.error,
                },
              ]}
            />
            <Text style={[styles.legendLabel, { color: colors.text }]}>
              {item.label}
            </Text>
            <Text style={[styles.legendValue, { color: colors.textSecondary }]}>
              {item.value}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderPathView = () => (
    <View style={styles.pathContainer}>
      {learningPath.map((step, index) => (
        <View key={step.id} style={styles.pathStep}>
          <View style={styles.pathConnector}>
            <View
              style={[
                styles.pathDot,
                {
                  backgroundColor:
                    step.status === 'current'
                      ? theme.colors.primary
                      : step.status === 'pending'
                      ? theme.colors.warning
                      : colors.border,
                },
              ]}
            >
              {step.status === 'current' && (
                <MaterialCommunityIcons name="play" size={12} color="#FFFFFF" />
              )}
            </View>
            {index < learningPath.length - 1 && (
              <View
                style={[
                  styles.pathLine,
                  {
                    backgroundColor:
                      step.status === 'current' ? theme.colors.primary : colors.border,
                  },
                ]}
              />
            )}
          </View>
          <Card
            style={[
              styles.pathCard,
              step.status === 'locked' && { opacity: 0.5 },
            ]}
          >
            <Text style={[styles.pathTitle, { color: colors.text }]}>
              {step.name}
            </Text>
            <Text style={[styles.pathDescription, { color: colors.textSecondary }]}>
              {step.description}
            </Text>
            <ProgressBar progress={step.progress} showLabel />
          </Card>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>知识点</Text>
        <SegmentedButtons
          value={viewMode}
          onValueChange={(value) => setViewMode(value as ViewMode)}
          buttons={[
            { value: 'tree', label: '知识树', icon: 'file-tree' },
            { value: 'heatmap', label: '能力图', icon: 'chart-areaspline' },
            { value: 'path', label: '学习路径', icon: 'map-marker-path' },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      <ScrollView style={styles.content}>
        {viewMode === 'tree' && renderTreeView()}
        {viewMode === 'heatmap' && renderHeatmapView()}
        {viewMode === 'path' && renderPathView()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  segmentedButtons: {
    backgroundColor: theme.colors.surface,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  treeContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  heatmapContainer: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  radarWrapper: {
    padding: spacing.md,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 14,
  },
  legendValue: {
    fontSize: 12,
  },
  pathContainer: {
    gap: spacing.md,
  },
  pathStep: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pathConnector: {
    alignItems: 'center',
    width: 24,
  },
  pathDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathLine: {
    width: 2,
    flex: 1,
    minHeight: 40,
  },
  pathCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  pathTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  pathDescription: {
    fontSize: 14,
    marginBottom: spacing.md,
  },
});
