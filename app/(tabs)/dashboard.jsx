import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { cardsApi } from '@/services/api';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { isDark, language } = useAppContext();
  const isAR = language === 'ar';
  const router = useRouter();
  const [stats, setStats] = useState({ cards: 0, leads: 0, views: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cardsApi.getAll()
      .then(({ data }) => setStats((s) => ({ ...s, cards: data.length })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const bg = isDark ? '#0f172a' : '#F8FAFC';
  const cardBg = isDark ? '#1e293b' : '#fff';
  const text = isDark ? '#f8fafc' : '#1E293B';
  const subtext = isDark ? '#94a3b8' : '#64748B';
  const border = isDark ? '#334155' : '#E2E8F0';

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.greeting, { color: text, textAlign: isAR ? 'right' : 'left' }]}>{isAR ? `مرحباً، ${user?.name ?? ''} 👋` : `Hello, ${user?.name ?? 'there'} 👋`}</Text>
      <Text style={[styles.sub, { color: subtext, textAlign: isAR ? 'right' : 'left' }]}>{isAR ? 'إليك نظرة عامة' : "Here's your overview"}</Text>

      {loading ? (
        <ActivityIndicator color="#818cf8" style={{ marginTop: 40 }} />
      ) : (
        <View style={[styles.statsRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
          {[
            { label: isAR ? 'البطاقات' : 'Cards', value: stats.cards, route: '/(tabs)/cards' },
            { label: isAR ? 'العملاء' : 'Leads', value: stats.leads, route: '/(tabs)/leads' },
            { label: isAR ? 'المشاهدات' : 'Views', value: stats.views, route: null },
          ].map(({ label, value, route }) => (
            <TouchableOpacity
              key={label}
              style={[styles.statCard, { backgroundColor: cardBg, borderColor: border }]}
              onPress={() => route && router.push(route)}
              disabled={!route}
            >
              <Text style={styles.statValue}>{value}</Text>
              <Text style={[styles.statLabel, { color: subtext }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.cta} onPress={() => router.push('/(tabs)/cards')}>
        <Text style={styles.ctaText}>{isAR ? '+ إنشاء بطاقة جديدة' : '+ Create New Card'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  sub: { fontSize: 14, color: '#94a3b8', marginBottom: 32 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  statCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statValue: { fontSize: 28, fontWeight: '700', color: '#818cf8' },
  statLabel: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  cta: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
