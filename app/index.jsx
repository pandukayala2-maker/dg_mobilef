import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { View, ActivityIndicator, Text } from 'react-native';

export default function Index() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator color="#1b4654" size="large" />
        <Text style={{ marginTop: 20, color: '#1b4654', fontWeight: '600' }}>Loading ANSOFTT DC...</Text>
      </View>
    );
  }

  return token ? <Redirect href="/(tabs)/mycard" /> : <Redirect href="/(auth)/login" />;
}
