import React from 'react';
import { View, StyleSheet, Modal, TouchableWithoutFeedback } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from 'react-native-vector-icons';
import LottieView from 'lottie-react-native';
import { theme, spacing, borderRadius } from '../../utils/theme';

interface AchievementPopupProps {
  visible: boolean;
  achievement: {
    name: string;
    description: string;
    icon: string;
  };
  onDismiss: () => void;
}

export const AchievementPopup: React.FC<AchievementPopupProps> = ({
  visible,
  achievement,
  onDismiss,
}) => {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.container, { backgroundColor: colors.surface }]}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name={achievement.icon}
                  size={64}
                  color={theme.colors.warning}
                />
                <View style={styles.glow} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                成就解锁!
              </Text>
              <Text style={[styles.achievementName, { color: theme.colors.primary }]}>
                {achievement.name}
              </Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {achievement.description}
              </Text>
              <Button
                mode="contained"
                onPress={onDismiss}
                style={styles.button}
              >
                太棒了!
              </Button>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: 300,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  glow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${theme.colors.warning}20`,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  achievementName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    width: '100%',
  },
});
