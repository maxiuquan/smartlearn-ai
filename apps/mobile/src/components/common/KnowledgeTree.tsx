import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from 'react-native-vector-icons';
import { KnowledgePoint } from '../../types';
import { theme, spacing, borderRadius } from '../../utils/theme';

interface KnowledgeTreeProps {
  nodes: KnowledgePoint[];
  expandedNodes: Set<string>;
  selectedId?: string;
  onToggleExpand: (nodeId: string) => void;
  onSelect: (node: KnowledgePoint) => void;
  level?: number;
}

export const KnowledgeTree: React.FC<KnowledgeTreeProps> = ({
  nodes,
  expandedNodes,
  selectedId,
  onToggleExpand,
  onSelect,
  level = 0,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {nodes.map((node) => {
        const isExpanded = expandedNodes.has(node.id);
        const isSelected = selectedId === node.id;
        const hasChildren = node.children && node.children.length > 0;

        return (
          <View key={node.id}>
            <TouchableOpacity
              style={[
                styles.node,
                { paddingLeft: spacing.md + level * 20 },
                isSelected && { backgroundColor: `${theme.colors.primary}10` },
              ]}
              onPress={() => onSelect(node)}
              onLongPress={() => hasChildren && onToggleExpand(node.id)}
            >
              <View style={styles.nodeContent}>
                {hasChildren && (
                  <TouchableOpacity
                    style={styles.expandButton}
                    onPress={() => onToggleExpand(node.id)}
                  >
                    <MaterialCommunityIcons
                      name={isExpanded ? 'chevron-down' : 'chevron-right'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                )}
                {!hasChildren && <View style={styles.expandPlaceholder} />}
                <View
                  style={[
                    styles.masteryIndicator,
                    {
                      backgroundColor: getMasteryColor(node.masteryLevel),
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.nodeLabel,
                    { color: isSelected ? theme.colors.primary : colors.text },
                  ]}
                >
                  {node.name}
                </Text>
                <Text style={[styles.masteryText, { color: colors.textSecondary }]}>
                  {node.masteryLevel}%
                </Text>
              </View>
            </TouchableOpacity>
            {isExpanded && node.children && (
              <KnowledgeTree
                nodes={node.children}
                expandedNodes={expandedNodes}
                selectedId={selectedId}
                onToggleExpand={onToggleExpand}
                onSelect={onSelect}
                level={level + 1}
              />
            )}
          </View>
        );
      })}
    </View>
  );
};

const getMasteryColor = (level: number): string => {
  if (level >= 80) return theme.colors.success;
  if (level >= 60) return theme.colors.primary;
  if (level >= 40) return theme.colors.warning;
  return theme.colors.error;
};

const styles = StyleSheet.create({
  container: {},
  node: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  nodeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  expandButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandPlaceholder: {
    width: 24,
  },
  masteryIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nodeLabel: {
    flex: 1,
    fontSize: 14,
  },
  masteryText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
