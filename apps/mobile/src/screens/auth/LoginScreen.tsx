import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, useTheme, Snackbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { theme, spacing, borderRadius } from '../../utils/theme';
import { validateEmail } from '../../utils/validation';

type NavigationProp = NativeStackNavigationProp<{
  Register: undefined;
  ForgotPassword: undefined;
}>;

export const LoginScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setEmailError(null);

    if (!validateEmail(email)) {
      setEmailError('请输入有效的邮箱地址');
      return;
    }

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    }
  };

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
          <Text style={styles.logo}>SmartLearn</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            AI智能学习助手
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
            error={!!emailError}
            style={styles.input}
          />
          {emailError && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {emailError}
            </Text>
          )}

          <TextInput
            label="密码"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading || !email || !password}
            style={styles.button}
          >
            登录
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.linkButton}
          >
            忘记密码?
          </Button>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            还没有账号?
          </Text>
          <Button
            mode="text"
            onPress={() => navigation.navigate('Register')}
          >
            立即注册
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
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  subtitle: {
    fontSize: 16,
    marginTop: spacing.sm,
  },
  form: {
    gap: spacing.md,
  },
  input: {
    backgroundColor: theme.colors.surface,
  },
  errorText: {
    fontSize: 12,
    marginTop: -spacing.sm,
  },
  button: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  linkButton: {
    alignSelf: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: 14,
  },
});
