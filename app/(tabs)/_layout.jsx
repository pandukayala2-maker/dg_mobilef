
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '@/context/AppContext';

const CORAL = '#1b4654';
const YELLOW = '#FFEB3B';

function TabIcon({ name, color, size, focused }) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={focused ? name.replace('-outline', '') : name} size={size} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const { isDark, language, brandColor } = useAppContext();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPad;

  return (
    <Tabs
      key={language}
      initialRouteName="mycard"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
            borderTopColor: isDark ? '#1E293B' : '#F1F5F9',
            height: tabBarHeight,
            paddingBottom: bottomPad,
          },
        ],
        tabBarActiveTintColor: isDark ? YELLOW : brandColor,
        tabBarInactiveTintColor: isDark ? '#64748B' : '#94A3B8',
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="scan"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="mycard"
        options={{
          title: language === 'ar' ? 'بطاقتي' : 'My Card',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'card' : 'card-outline'} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: language === 'ar' ? 'جهات الاتصال' : 'Contacts',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'people' : 'people-outline'} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ainotetaker"
        options={{
          title: language === 'ar' ? 'ملاحظة AI' : 'AI Note',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'mic' : 'mic-outline'} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: language === 'ar' ? 'التقويم' : 'Calendar',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#F1F5F9',
    borderTopWidth: 1,
    paddingTop: 8,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
  },
  tabLabel: { 
    fontSize: 12, 
    fontWeight: '700',
    marginTop: 6,
  },
  tabItem: {
    paddingVertical: 4,
  },
  iconWrap: { 
    alignItems: 'center', 
    justifyContent: 'center',
    height: 30,
    width: 30,
  },
});
