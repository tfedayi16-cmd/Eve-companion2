import { Tabs } from 'expo-router';
import { MessageCircle, Phone, Settings, Users } from 'lucide-react-native';
import { theme } from '@/constants/theme';

export default function TabLayout() {
  const iconColor = (color: unknown) => color as string;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary[400],
        tabBarInactiveTintColor: theme.colors.neutral[400],
        tabBarStyle: {
          backgroundColor: theme.colors.neutral[900],
          borderTopColor: theme.colors.neutral[800],
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.medium,
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarIcon: ({ size, color }) => (
            <MessageCircle size={size} color={iconColor(color)} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="call"
        options={{
          title: 'Call',
          tabBarIcon: ({ size, color }) => (
            <Phone size={size} color={iconColor(color)} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="characters"
        options={{
          title: 'Companions',
          tabBarIcon: ({ size, color }) => (
            <Users size={size} color={iconColor(color)} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ size, color }) => (
            <Settings size={size} color={iconColor(color)} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}
