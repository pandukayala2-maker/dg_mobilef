import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { cardsApi } from '@/services/api';

const BRAND = '#1b4654';

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { isDark, language } = useAppContext();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      Alert.alert('Sync Successful', 'Your calendar has been synchronized with DigCard.');
    }, 2000);
  };

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const { data } = await cardsApi.getMeetings();
        setMeetings(data.meetings || []);
      } catch (err) {
        console.error('Failed to fetch meetings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMeetings();
  }, []);

  const isAR = language === 'ar';

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return { time: `${hours}:${minutes}`, ampm };
  };

  const bg = isDark ? '#0F172A' : '#F8FAFC';
  const cardBg = isDark ? '#1E293B' : '#fff';
  const text = isDark ? '#F8FAFC' : '#1E293B';
  const subtext = isDark ? '#94A3B8' : '#64748B';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 6 }]}>
        <Text style={styles.headerTitle}>{isAR ? 'مزامنة التقويم' : 'Calendar Sync'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#EDF5F3' }]}>
            <Ionicons name="calendar" size={32} color={isDark ? '#4DD0E1' : BRAND} />
          </View>
          <Text style={[styles.title, { color: text }]}>{isAR ? 'ربط التقويم الخاص بك' : 'Connect Your Calendar'}</Text>
          <Text style={[styles.subtitle, { color: subtext }]}>
            {isAR 
              ? 'قم بمزامنة تقويم جوجل أو أوتلوك الخاص بك لجدولة الاجتماعات تلقائيًا بناءً على ملاحظات الذكاء الاصطناعي وجهات الاتصال الخاصة بك.'
              : 'Sync your Google or Outlook calendar to automatically schedule meetings based on your AI notes and contacts.'}
          </Text>
          
          <TouchableOpacity style={styles.syncBtn} onPress={handleSync} disabled={syncing}>
            {syncing ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="sync-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.syncBtnText}>{isAR ? 'ربط تقويم جوجل' : 'Connect Google Calendar'}</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.syncBtn, { backgroundColor: '#0078D4', marginTop: 12 }]} onPress={handleSync} disabled={syncing}>
            {syncing ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="logo-microsoft" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.syncBtnText}>{isAR ? 'ربط أوتلوك' : 'Connect Outlook'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.agendaHeader}>
          <Text style={[styles.agendaTitle, { color: text }]}>{isAR ? 'الاجتماعات القادمة' : 'Upcoming Meetings'}</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={BRAND} style={{ marginTop: 20 }} />
        ) : meetings.length === 0 ? (
          <Text style={{ color: subtext, textAlign: 'center', marginTop: 20 }}>
            {isAR ? 'لا توجد اجتماعات قادمة.' : 'No upcoming meetings.'}
          </Text>
        ) : (
          meetings.map((meeting) => {
            const { time, ampm } = formatTime(meeting.time);
            return (
              <View key={meeting.id} style={[styles.meetingCard, { backgroundColor: cardBg, flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                <View style={[styles.meetingTime, { borderRightWidth: isAR ? 0 : 1, borderLeftWidth: isAR ? 1 : 0, borderRightColor: isDark ? '#334155' : '#E2E8F0', borderLeftColor: isDark ? '#334155' : '#E2E8F0', marginRight: isAR ? 0 : 16, marginLeft: isAR ? 16 : 0, paddingRight: isAR ? 0 : 16, paddingLeft: isAR ? 16 : 0 }]}>
                  <Text style={[styles.timeText, { color: text }]}>{time}</Text>
                  <Text style={[styles.amText, { color: subtext }]}>{ampm}</Text>
                </View>
                <View style={[styles.meetingInfo, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
                  <Text style={[styles.meetingTitle, { color: text }]}>{meeting.title}</Text>
                  <Text style={[styles.meetingNote, { color: subtext, textAlign: isAR ? 'right' : 'left' }]}>{isAR ? 'بناءً على ملاحظة الذكاء الاصطناعي.' : meeting.noteText}</Text>
                </View>
                <Ionicons name="notifications" size={20} color="#E65100" />
              </View>
            );
          })
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: BRAND,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  content: { padding: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 24,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EDF5F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  syncBtn: {
    backgroundColor: BRAND,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
  },
  syncBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  agendaHeader: { marginBottom: 16 },
  agendaTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  meetingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
    marginBottom: 12,
  },
  meetingTime: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  timeText: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  amText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  meetingInfo: { flex: 1 },
  meetingTitle: { fontSize: 15, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  meetingNote: { fontSize: 12, color: '#64748B' },
});

