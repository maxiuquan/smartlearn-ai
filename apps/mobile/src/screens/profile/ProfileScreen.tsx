import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, useTheme, Card, Button, Avatar, Divider, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from 'react-native-vector-icons';
import { ProgressBar, RadarChart, AchievementPopup } from '../../components';
import { useAuthStore, useStudyStore } from '../../stores';
import { theme, spacing, borderRadius } from '../../utils/theme';

export const ProfileScreen: React.FC = () => {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { achievements, streak, totalStudyTime } = useStudyStore();

  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [showAchievement, setShowAchievement] = useState(false);

  const abilityData = [
    { label: '计算', value: 85 },
    { label: '概念', value: 72 },
    { label: '推理', value: 68 },
    { label: '应用', value: 55 },
    { label: '记忆', value: 78 },
  ];

  const recentAchievements = [
    { id: '1', name: '初学者', icon: 'star', unlocked: true },
    { id: '2', name: '坚持7天', icon: 'fire', unlocked: true },
    { id: '3', name: '百题斩', icon: 'sword-cross', unlocked: true },
    { id: '4', name: '单词达人', icon: 'book-open-variant', unlocked: false },
    { id: '5', name: '完美主义', icon: 'check-decagram', unlocked: false },
  ];

  const menuItems = [
    {
      section: '学习',
      items: [
        { icon: 'chart-bar', label: '学习报告', onPress: () => {} },
        { icon: 'trophy', label: '成就中心', onPress: () => {} },
        { icon: 'history', label: '学习历史', onPress: () => {} },
      ],
    },
    {
      section: '设置',
      items: [
        {
          icon: 'bell',
          label: '消息通知',
          right: (
            <Switch
              value={notifications}
              onValueChange={setNotifications}
            />
          ),
        },
        {
          icon: 'theme-light-dark',
          label: '深色模式',
          right: (
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
            />
          ),
        },
        { icon: 'cog', label: '账号设置', onPress: () => {} },
        { icon: 'help-circle', label: '帮助与反馈', onPress: () => {} },
      ],
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <Card style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Avatar.Text
            size={64}
            label={user?.username?.slice(0, 2).toUpperCase() || 'U'}
            style={{ backgroundColor: theme.colors.primary }}
          />
          <View style={styles.profileInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {user?.username || '用户'}
            </Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
              {user?.email || 'user@example.com'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => {}}>
            <MaterialCommunityIcons
              name="pencil"
              size={20}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.primary }]}>
              {streak}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              连续学习
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.secondary }]}>
              {Math.round(totalStudyTime / 60)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              学习小时
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.tertiary }]}>
              {achievements.filter((a) => a.unlockedAt).length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              成就解锁
            </Text>
          </View>
        </View>
      </Card>

      {/* Ability Radar */}
      <Card style={styles.abilityCard}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          能力分析
        </Text>
        <View style={styles.radarWrapper}>
          <RadarChart data={abilityData} size={200} />
        </View>
      </Card>

      {/* Achievements */}
      <Card style={styles.achievementCard}>
        <View style={styles.achievementHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            最近成就
          </Text>
          <Button mode="text" compact onPress={() => {}}>
            查看全部
          </Button>
        </View>
        <View style={styles.achievementList}>
          {recentAchievements.map((achievement) => (
            <TouchableOpacity
              key={achievement.id}
              style={[
                styles.achievementItem,
                !achievement.unlocked && { opacity: 0.4 },
              ]}
              onPress={() => achievement.unlocked && setShowAchievement(true)}
            >
              <View
                style={[
                  styles.achievementIcon,
                  {
                    backgroundColor: achievement.unlocked
                      ? `${theme.colors.warning}15`
                      : colors.surfaceVariant,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={achievement.icon}
                  size={24}
                  color={
                    achievement.unlocked
                      ? theme.colors.warning
                      : colors.textSecondary
                  }
                />
              </View>
              <Text
                style={[
                  styles.achievementName,
                  { color: colors.text },
                ]}
              >
                {achievement.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Menu Items */}
      {menuItems.map((section, sectionIndex) => (
        <View key={sectionIndex} style={styles.menuSection}>
          <Text style={[styles.menuSectionTitle, { color: colors.textSecondary }]}>
            {section.section}
          </Text>
          <Card style={styles.menuCard}>
            {section.items.map((item, itemIndex) => (
              <View key={itemIndex}>
                <TouchableOpacity style={styles.menuItem} onPress={item.onPress}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={24}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.menuLabel, { color: colors.text }]}>
                    {item.label}
                  </Text>
                  {item.right || (
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={colors.textSecondary}
                    />
                  )}
                </TouchableOpacity>
                {itemIndex < section.items.length - 1 && (
                  <Divider style={styles.menuDivider} />
                )}
              </View>
            ))}
          </Card>
        </View>
      ))}

      {/* Logout */}
      <Button
        mode="outlined"
        onPress={logout}
        style={styles.logoutButton}
        textColor={theme.colors.error}
      >
        退出登录
      </Button>

      {/* Achievement Popup */}
      <AchievementPopup
        visible={showAchievement}
        achievement={{
          name: '初学者',
          description: '完成第一次学习',
          icon: 'star',
        }}
        onDismiss={() => setShowAchievement(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  profileCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  userEmail: {
    fontSize: 14,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.border,
  },
  abilityCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  radarWrapper: {
    alignItems: 'center',
  },
  achievementCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  achievementList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  achievementItem: {
    alignItems: 'center',
    width: 60,
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  achievementName: {
    fontSize: 10,
    textAlign: 'center',
  },
  menuSection: {
    gap: spacing.sm,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuCard: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
  },
  menuDivider: {
    marginLeft: 48 + spacing.md,
  },
  logoutButton: {
    marginTop: spacing.md,
    borderColor: theme.colors.error,
  },
});
