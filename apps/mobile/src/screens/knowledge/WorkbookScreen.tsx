import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Text, useTheme, Card, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from 'react-native-vector-icons';
import { studyService } from '../../services';
import { Workbook } from '../../types';
import { theme, spacing, borderRadius } from '../../utils/theme';

export const WorkbookScreen: React.FC = () => {
  const { colors } = useTheme();
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadWorkbooks();
  }, []);

  const loadWorkbooks = async () => {
    setIsLoading(true);
    try {
      const books = await studyService.getWorkbooks();
      setWorkbooks(books);
    } catch (error) {
      console.error('Failed to load workbooks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'easy':
        return theme.colors.success;
      case 'medium':
        return theme.colors.warning;
      case 'hard':
        return theme.colors.error;
      default:
        return theme.colors.primary;
    }
  };

  const renderWorkbook = ({ item }: { item: Workbook }) => {
    const progress = (item.completedQuestions / item.totalQuestions) * 100;

    return (
      <Card style={styles.card}>
        <TouchableOpacity style={styles.cardContent}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.text }]}>
                {item.name}
              </Text>
              <View
                style={[
                  styles.difficultyBadge,
                  { backgroundColor: `${getDifficultyColor(item.difficulty)}15` },
                ]}
              >
                <Text
                  style={[
                    styles.difficultyText,
                    { color: getDifficultyColor(item.difficulty) },
                  ]}
                >
                  {item.difficulty === 'easy' ? '基础' : item.difficulty === 'medium' ? '进阶' : '挑战'}
                </Text>
              </View>
            </View>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {item.description}
            </Text>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressInfo}>
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {item.completedQuestions}/{item.totalQuestions} 题
              </Text>
              <Text style={[styles.progressPercent, { color: theme.colors.primary }]}>
                {Math.round(progress)}%
              </Text>
            </View>
            <ProgressBar progress={progress} height={6} />
          </View>

          <View style={styles.footer}>
            <Text style={[styles.source, { color: colors.textTertiary }]}>
              来源: {item.source}
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>习题册</Text>
        <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
          系统化练习，稳步提升
        </Text>
      </View>

      <FlatList
        data={workbooks}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkbook}
        contentContainerStyle={styles.list}
        refreshing={isLoading}
        onRefresh={loadWorkbooks}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  pageHeader: {
    padding: spacing.md,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  pageSubtitle: {
    fontSize: 14,
    marginTop: spacing.xs,
  },
  list: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  cardContent: {
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressText: {
    fontSize: 12,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  source: {
    fontSize: 12,
  },
});
