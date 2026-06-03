import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import BiometricGate from '@/components/BiometricGate';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokenStore, API_BASE_URL } from '@/services/api';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

try {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error('[Background Location Error]', error);
      return;
    }
    if (data) {
      const { locations } = data;
      if (locations && locations.length > 0) {
        const location = locations[0];
        try {
          const token = await tokenStore.get('auth_token');
          if (token) {
            const adminSelectedCardId = await AsyncStorage.getItem('admin_selected_card_id');
            const payload = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              is_tracking: true
            };
            if (adminSelectedCardId) {
              payload.cardId = adminSelectedCardId;
            }
            await fetch(`${API_BASE_URL}/cards/owner/my-card/location`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(payload)
            });
          }
        } catch (err) {
          console.error('[Background Location Update Error]', err);
        }
      }
    }
  });
} catch (e) {
  console.warn('[TaskManager Define Error]', e.message);
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <AuthProvider>
          <BiometricGate>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </BiometricGate>
        </AuthProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
