import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { useAuthStore } from '../stores/authStore';
import { theme } from '../utils/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * LoadingScreen displayed while auth state is being restored from SecureStore.
 * Shows a spinner centered on the app's primary color background.
 */
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

export function RootNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Restore authentication state on app startup.
  // checkAuth() reads the token from SecureStore and calls getCurrentUser
  // to validate it. This ensures the user stays logged in across app restarts.
  useEffect(() => {
    useAuthStore.getState().checkAuth();
  }, []);

  // While auth state is being restored, show a loading/splash screen
  // to prevent flickering between Auth and Main navigators.
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
});
