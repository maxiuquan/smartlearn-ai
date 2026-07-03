import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from 'react-native-vector-icons';
import { HomeScreen } from '../screens/home/HomeScreen';
import { LearnScreen } from '../screens/learn/LearnScreen';
import { KnowledgeScreen } from '../screens/knowledge/KnowledgeScreen';
import { WordScreen } from '../screens/word/WordScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { theme } from '../utils/theme';

type MainTabParamList = {
  Home: undefined;
  Learn: undefined;
  Knowledge: undefined;
  Word: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Learn':
              iconName = focused ? 'book-open-page-variant' : 'book-open-variant';
              break;
            case 'Knowledge':
              iconName = focused ? 'graph' : 'graph-outline';
              break;
            case 'Word':
              iconName = focused ? 'alphabetical-variant' : 'alphabetical-variant-off';
              break;
            case 'Profile':
              iconName = focused ? 'account' : 'account-outline';
              break;
            default:
              iconName = 'help';
          }

          return (
            <MaterialCommunityIcons name={iconName} size={size} color={color} />
          );
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ tabBarLabel: '首页' }}
      />
      <Tab.Screen 
        name="Learn" 
        component={LearnScreen}
        options={{ tabBarLabel: '学习' }}
      />
      <Tab.Screen 
        name="Knowledge" 
        component={KnowledgeScreen}
        options={{ tabBarLabel: '知识点' }}
      />
      <Tab.Screen 
        name="Word" 
        component={WordScreen}
        options={{ tabBarLabel: '单词' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ tabBarLabel: '我的' }}
      />
    </Tab.Navigator>
  );
}
