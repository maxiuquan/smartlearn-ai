import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, useTheme, Snackbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { theme, spacing } from '../../utils/theme';
import { validateEmail } from '../../utils/validation';

type NavigationProp = NativeStackNavigationProp<{
  Login: undefined;
}>;

export const ForgotPasswordScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const forgotPassword = useAuthStore((state) => state.forgotPassword);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (!validateEmail(email)) {
      setError('请输入有效的邮箱地址');
      return;
    }

    setIsLoading(true);
    try {
      await forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.successContent}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={[styles.successTitle, { color: colors.text }]}>
            邮件已发送
          </Text>
          <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
            我们已向 {email} 发送了密码重置链接，请查收邮件并按照指引重置密码。
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Login')}
            style={styles.button}
          >
            返回登录
          </Button>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>忘记密码</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            输入您的邮箱地址，我们将发送密码重置链接
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="邮箱"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading || !email}
            style={styles.button}
          >
            发送重置链接
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('Login')}
            style={styles.linkButton}
          >
            返回登录
          </Button>
        </View>
      </ScrollView>

      <Snackbar
        visible={!!error}
        onDismiss={() => setError(null)}
        duration={3000}
        action={{
          label: '关闭',
          onPress: () => setError(null),
        }}
      >
        {error}
      </Snackbar>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    gap: spacing.md,
  },
  input: {
    backgroundColor: theme.colors.surface,
  },
  button: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  linkButton: {
    alignSelf: 'center',
  },
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  successIcon: {
    fontSize: 64,
    color: theme.colors.success,
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  successMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
});
