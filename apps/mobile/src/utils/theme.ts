import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const customColors = {
  primary: '#4F46E5',
  primaryContainer: '#E0E7FF',
  secondary: '#10B981',
  secondaryContainer: '#D1FAE5',
  tertiary: '#F59E0B',
  tertiaryContainer: '#FEF3C7',
  error: '#EF4444',
  errorContainer: '#FEE2E2',
  success: '#22C55E',
  warning: '#F59E0B',
  info: '#3B82F6',
  background: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceVariant: '#F3F4F6',
  text: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  divider: '#F3F4F6',
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...customColors,
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#818CF8',
    primaryContainer: '#3730A3',
    secondary: '#34D399',
    secondaryContainer: '#065F46',
    tertiary: '#FBBF24',
    tertiaryContainer: '#92400E',
    error: '#F87171',
    errorContainer: '#991B1B',
    success: '#4ADE80',
    warning: '#FBBF24',
    info: '#60A5FA',
    background: '#111827',
    surface: '#1F2937',
    surfaceVariant: '#374151',
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    textTertiary: '#9CA3AF',
    border: '#4B5563',
    divider: '#374151',
  },
};

export const theme = lightTheme;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  xxxl: 32,
};
