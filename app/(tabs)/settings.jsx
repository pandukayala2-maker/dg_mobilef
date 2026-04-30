import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { isDark, language } = useAppContext();
  const router = useRouter();

  const isAR = language === 'ar';

  const handleLogout = () => {
    const performLogout = () => {
      logout();
      router.replace('/(auth)/login');
    };

    if (Platform.OS === 'web') {
      if (window.confirm(isAR ? 'هل أنت متأكد أنك تريد تسجيل الخروج؟' : 'Are you sure you want to sign out?')) {
        performLogout();
      }
      return;
    }

    Alert.alert(
      isAR ? 'تسجيل الخروج' : 'Sign Out',
      isAR ? 'هل أنت متأكد أنك تريد تسجيل الخروج؟' : 'Are you sure you want to sign out?',
      [
        { text: isAR ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isAR ? 'تسجيل الخروج' : 'Sign Out',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    );
  };

  const bg = isDark ? '#0f172a' : '#F3F4F6';
  const cardBg = isDark ? '#1e293b' : '#fff';
  const text = isDark ? '#f8fafc' : '#111827';
  const subtext = isDark ? '#94a3b8' : '#64748b';
  const border = isDark ? '#334155' : '#E2E8F0';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.title, { color: text, textAlign: isAR ? 'right' : 'left' }]}>{isAR ? 'الإعدادات' : 'Settings'}</Text>

      <View style={[styles.section, { backgroundColor: cardBg, borderColor: border }]}>
        <Text style={[styles.sectionTitle, { color: subtext, textAlign: isAR ? 'right' : 'left' }]}>{isAR ? 'الحساب' : 'Account'}</Text>
        <View style={[styles.item, { borderColor: border, flexDirection: isAR ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.label, { color: subtext }]}>{isAR ? 'الاسم' : 'Name'}</Text>
          <Text style={[styles.value, { color: text }]}>{user?.name ?? '—'}</Text>
        </View>
        <View style={[styles.item, { borderColor: border, flexDirection: isAR ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.label, { color: subtext }]}>{isAR ? 'البريد الإلكتروني' : 'Email'}</Text>
          <Text style={[styles.value, { color: text }]}>{user?.email ?? '—'}</Text>
        </View>
        <View style={[styles.item, { borderBottomWidth: 0, flexDirection: isAR ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.label, { color: subtext }]}>{isAR ? 'الدور' : 'Role'}</Text>
          <Text style={[styles.value, { color: text }]}>{user?.role ?? '—'}</Text>
        </View>
      </View>

      <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: isDark ? '#7f1d1d' : '#FEE2E2' }]} onPress={handleLogout}>
        <Text style={[styles.logoutText, { color: isDark ? '#fca5a5' : '#EF4444' }]}>{isAR ? 'تسجيل الخروج' : 'Sign Out'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '700', color: '#f8fafc', marginBottom: 32 },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  sectionTitle: { fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  label: { color: '#94a3b8', fontSize: 15 },
  value: { color: '#f8fafc', fontSize: 15, fontWeight: '500' },
  logoutBtn: {
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  logoutText: { color: '#fca5a5', fontWeight: '700', fontSize: 16 },
});
