import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, useTheme, Snackbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { theme, spacing } from '../../utils/theme';
import { validateEmail, validatePassword, validateUsername } from '../../utils/validation';

type NavigationProp = NativeStackNavigationProp<{
  Login: undefined;
}>;

export const RegisterScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!validateUsername(username)) {
      errors.username = '用户名至少3个字符，只能包含字母、数字和下划线';
    }

    if (!validateEmail(email)) {
      errors.email = '请输入有效的邮箱地址';
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.errors[0];
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    setError(null);

    if (!validate()) return;

    try {
      await register(username, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
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
            创建新账号
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="用户名"
            value={username}
            onChangeText={setUsername}
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            error={!!fieldErrors.username}
            style={styles.input}
          />
          {fieldErrors.username && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {fieldErrors.username}
            </Text>
          )}

          <TextInput
            label="邮箱"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={!!fieldErrors.email}
            style={styles.input}
          />
          {fieldErrors.email && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {fieldErrors.email}
            </Text>
          )}

          <TextInput
            label="密码"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            error={!!fieldErrors.password}
            style={styles.input}
          />
          {fieldErrors.password && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {fieldErrors.password}
            </Text>
          )}

          <TextInput
            label="确认密码"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry
            error={!!fieldErrors.confirmPassword}
            style={styles.input}
          />
          {fieldErrors.confirmPassword && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {fieldErrors.confirmPassword}
            </Text>
          )}

          <Button
            mode="contained"
            onPress={handleRegister}
            loading={isLoading}
            disabled={isLoading || !username || !email || !password || !confirmPassword}
            style={styles.button}
          >
            注册
          </Button>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            已有账号?
          </Text>
          <Button mode="text" onPress={() => navigation.navigate('Login')}>
            立即登录
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
    marginBottom: spacing.xl,
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
