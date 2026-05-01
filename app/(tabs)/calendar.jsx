import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform, Alert, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { useAppContext } from '@/context/AppContext';
import { cardsApi } from '@/services/api';
import {
  requestCalendarPermission,
  addCalendarEvent,
  listCalendars,
  removeEvent,
} from '@/services/calendarService';

const BRAND = '#1b4654';

// Show notification alert even when app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { isDark, language } = useAppContext();
  const [meetings, setMeetings]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [syncing, setSyncing]         = useState(false);
  const [lastSynced, setLastSynced]   = useState(null);
  const [notifGranted, setNotifGranted] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);
  const [calendarPermission, setCalendarPermission] = useState(false);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [deviceEventMap, setDeviceEventMap] = useState({});
  const isAR = language === 'ar';

  // ─── 1. Setup: permissions + Android channel ──────────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('calendar-reminders', {
        name: 'Calendar Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: BRAND,
        sound: true,
      });
    }

    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifGranted(status === 'granted');
    });

    // Do not request calendar permission on page open.
    // Request it only when user taps "Sync to Device Calendar".
    setCalendarPermission(false);
  }, []);

  // ─── 2. Schedule notifications whenever meetings list changes ──────────────
  const scheduleReminders = useCallback(async (list) => {
    if (Platform.OS === 'web' || !list.length) return 0;

    // Cancel any previous meeting reminders
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of existing) {
      if (n.identifier?.startsWith('meeting_')) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    let count = 0;
    for (const meeting of list) {
      try {
        const targetDate = meeting.notificationAt
          ? new Date(meeting.notificationAt)
          : new Date(new Date(meeting.time || Date.now()).getTime() - (15 * 60 * 1000));

        if (Number.isNaN(targetDate.getTime()) || targetDate.getTime() <= Date.now()) {
          continue;
        }

        await Notifications.scheduleNotificationAsync({
          identifier: `meeting_${meeting.id}`,
          content: {
            title: isAR ? '📅 تذكير باجتماع' : '📅 Meeting Reminder',
            body: meeting.title,
            sound: true,
            ...(Platform.OS === 'android' && { channelId: 'calendar-reminders' }),
          },
          trigger: targetDate,
        });
        count++;
      } catch (err) {
        console.error('[Notification] Failed to schedule:', meeting.id, err.message);
      }
    }
    return count;
  }, [isAR]);

  useEffect(() => {
    if (!notifGranted || Platform.OS === 'web' || meetings.length === 0) {
      setReminderCount(0);
      return;
    }
    scheduleReminders(meetings).then(setReminderCount);
  }, [meetings, notifGranted, scheduleReminders]);

  // ─── 3. Fetch meetings from backend ───────────────────────────────────────
  const fetchMeetings = useCallback(async (showSyncing = false) => {
    if (showSyncing) setSyncing(true);
    try {
      const { data } = await cardsApi.getMeetings();
      setMeetings(data.meetings || []);
      setLastSynced(new Date());
    } catch (err) {
      console.error('Failed to fetch meetings', err);
    } finally {
      setLoading(false);
      if (showSyncing) setSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const syncToDeviceCalendar = useCallback(async () => {
    if (!meetings.length) {
      Alert.alert('No meetings', 'No meetings available to sync.');
      return;
    }

    try {
      setCalendarSyncing(true);

      const permission = await requestCalendarPermission();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow calendar access to sync meetings.');
        return;
      }

      const calendars = await listCalendars();
      if (!calendars.length) {
        Alert.alert('No calendar found', 'No writable calendar is available on this device.');
        return;
      }

      const nextMap = { ...deviceEventMap };
      let synced = 0;

      for (const meeting of meetings) {
        if (nextMap[meeting.id]) continue;

        const startAt = meeting.startAt || meeting.time;
        const endAt = meeting.endAt || new Date(new Date(startAt).getTime() + (60 * 60 * 1000)).toISOString();

        const result = await addCalendarEvent({
          title: meeting.title,
          startDate: startAt,
          endDate: endAt,
          notes: meeting.noteText || '',
          url: meeting.googleCalendarUrl,
        });

        nextMap[meeting.id] = result.eventId;
        synced += 1;
      }

      setDeviceEventMap(nextMap);
      setCalendarPermission(true);

      Alert.alert('Synced', `${synced} meeting${synced === 1 ? '' : 's'} added to device calendar.`);
    } catch (err) {
      Alert.alert('Sync failed', err?.message || 'Could not sync calendar events.');
    } finally {
      setCalendarSyncing(false);
    }
  }, [meetings, deviceEventMap]);

  const removeFromDeviceCalendar = useCallback(async (meetingId) => {
    try {
      const eventId = deviceEventMap[meetingId];
      if (!eventId) return;

      await removeEvent(eventId);
      setDeviceEventMap((prev) => {
        const clone = { ...prev };
        delete clone[meetingId];
        return clone;
      });
    } catch (err) {
      Alert.alert('Remove failed', err?.message || 'Could not remove event.');
    }
  }, [deviceEventMap]);

  // ─── 4. Helpers ───────────────────────────────────────────────────────────
  const formatDateTime = (isoString) => {
    const d = new Date(isoString);
    const dateStr = d.toLocaleDateString(isAR ? 'ar' : 'en-US', {
      month: 'short', day: 'numeric',
    });
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return { date: dateStr, time: `${h}:${m}`, ampm };
  };

  // ─── 5. Theme tokens ──────────────────────────────────────────────────────
  const bg      = isDark ? '#0F172A' : '#F8FAFC';
  const cardBg  = isDark ? '#1E293B' : '#FFFFFF';
  const text    = isDark ? '#F8FAFC' : '#1E293B';
  const subtext = isDark ? '#94A3B8' : '#64748B';
  const divider = isDark ? '#334155' : '#E2E8F0';

  // ─── 6. Render ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 6 }]}>
        <View>
          <Text style={styles.headerTitle}>
            {isAR ? 'مزامنة التقويم' : 'Calendar Sync'}
          </Text>
          {lastSynced && (
            <Text style={styles.headerSub}>
              {isAR ? 'آخر مزامنة: ' : 'Last synced: '}
              {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>

        {/* Notification badge in header */}
        {notifGranted && reminderCount > 0 && (
          <View style={styles.headerBadge}>
            <Ionicons name="notifications" size={13} color="#fff" />
            <Text style={styles.headerBadgeText}>
              {reminderCount} {isAR ? 'تذكير' : 'reminder' + (reminderCount !== 1 ? 's' : '')}
            </Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Sync Card ── */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(77,208,225,0.12)' : '#EDF5F3' }]}>
            <Ionicons name="calendar" size={30} color={isDark ? '#4DD0E1' : BRAND} />
          </View>

          <Text style={[styles.cardTitle, { color: text }]}>
            {isAR ? 'ملاحظات الذكاء الاصطناعي ← التقويم' : 'AI Notes → Calendar'}
          </Text>
          <Text style={[styles.cardSubtitle, { color: subtext }]}>
            {isAR
              ? 'اضغط "مزامنة الآن" لجلب اجتماعاتك وجدولة إشعارات تذكير تلقائية لكل اجتماع.'
              : 'Tap Sync Now to fetch your meetings and schedule automatic reminder notifications for each one.'}
          </Text>

          {/* Sync button */}
          <TouchableOpacity
            style={[styles.syncBtn, syncing && { opacity: 0.7 }]}
            onPress={() => fetchMeetings(true)}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons
                  name="sync-circle-outline"
                  size={18}
                  color="#fff"
                  style={{ marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }}
                />
                <Text style={styles.syncBtnText}>
                  {isAR ? 'مزامنة الآن' : 'Sync Now'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.syncAltBtn, calendarSyncing && { opacity: 0.7 }]}
            onPress={syncToDeviceCalendar}
            disabled={calendarSyncing}
          >
            {calendarSyncing ? (
              <ActivityIndicator color={BRAND} size="small" />
            ) : (
              <>
                <Ionicons
                  name="calendar-outline"
                  size={17}
                  color={BRAND}
                  style={{ marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }}
                />
                <Text style={styles.syncAltBtnText}>
                  {isAR ? 'مزامنة مع تقويم الجهاز' : 'Sync to Device Calendar'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Status rows */}
          {(meetings.length > 0 || (Platform.OS !== 'web' && !notifGranted)) && (
            <View style={[styles.statusBlock, { borderTopColor: divider }]}>

              {meetings.length > 0 && (
                <View style={styles.statusRow}>
                  <Ionicons name="checkmark-circle" size={15} color="#22C55E" />
                  <Text style={[styles.statusText, { color: '#22C55E' }]}>
                    {meetings.length}{' '}
                    {isAR
                      ? 'اجتماع متزامن'
                      : `meeting${meetings.length !== 1 ? 's' : ''} synced`}
                  </Text>
                </View>
              )}

              {notifGranted && reminderCount > 0 && (
                <View style={styles.statusRow}>
                  <Ionicons name="notifications" size={15} color="#F59E0B" />
                  <Text style={[styles.statusText, { color: '#F59E0B' }]}>
                    {isAR
                      ? `${reminderCount} إشعار مجدول لغداً الساعة 9 ص`
                      : `${reminderCount} reminder${reminderCount !== 1 ? 's' : ''} scheduled for tomorrow 9 AM`}
                  </Text>
                </View>
              )}

              {!notifGranted && Platform.OS !== 'web' && (
                <View style={styles.statusRow}>
                  <Ionicons name="notifications-off-outline" size={15} color="#94A3B8" />
                  <Text style={[styles.statusText, { color: '#94A3B8' }]}>
                    {isAR
                      ? 'فعّل الإشعارات للحصول على تذكيرات تلقائية'
                      : 'Enable notifications to receive automatic reminders'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── How it works strip ── */}
        <View style={[styles.howItWorks, { backgroundColor: cardBg, borderColor: divider }]}>
          {[
            { icon: 'mic-outline',          label: isAR ? 'سجّل ملاحظة صوتية' : 'Record a voice note' },
            { icon: 'arrow-forward-outline', label: '' },
            { icon: 'calendar-outline',     label: isAR ? 'يُضاف للتقويم' : 'Added to calendar' },
            { icon: 'arrow-forward-outline', label: '' },
            { icon: 'notifications-outline', label: isAR ? 'تذكير تلقائي' : 'Auto reminder' },
          ].map((item, i) => (
            item.label
              ? (
                <View key={i} style={styles.howStep}>
                  <Ionicons name={item.icon} size={18} color={isDark ? '#4DD0E1' : BRAND} />
                  <Text style={[styles.howLabel, { color: subtext }]}>{item.label}</Text>
                </View>
              )
              : <Ionicons key={i} name={item.icon} size={14} color={divider} />
          ))}
        </View>

        {/* ── Section header ── */}
        <View style={[styles.sectionHeader, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.sectionTitle, { color: text }]}>
            {isAR ? 'الاجتماعات القادمة' : 'Upcoming Meetings'}
          </Text>
          {meetings.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <Text style={[styles.countText, { color: subtext }]}>{meetings.length}</Text>
            </View>
          )}
        </View>

        {/* ── List ── */}
        {loading ? (
          <ActivityIndicator size="large" color={BRAND} style={{ marginTop: 40 }} />

        ) : meetings.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: cardBg }]}>
            <Ionicons name="calendar-outline" size={44} color={isDark ? '#334155' : '#CBD5E1'} />
            <Text style={[styles.emptyTitle, { color: text }]}>
              {isAR ? 'لا توجد اجتماعات بعد' : 'No meetings yet'}
            </Text>
            <Text style={[styles.emptySub, { color: subtext }]}>
              {isAR
                ? 'سجّل ملاحظات صوتية في تبويب "ملاحظات الذكاء الاصطناعي" ثم امزامن.'
                : 'Record voice notes in the AI Notetaker tab, then tap Sync Now.'}
            </Text>
          </View>

        ) : (
          meetings.map((meeting) => {
            const { date, time, ampm } = formatDateTime(meeting.time);
            return (
              <View
                key={meeting.id}
                style={[
                  styles.meetingRow,
                  {
                    backgroundColor: cardBg,
                    flexDirection: isAR ? 'row-reverse' : 'row',
                  },
                ]}
              >
                {/* Time block */}
                <View style={[
                  styles.timeBlock,
                  {
                    borderRightWidth: isAR ? 0 : 1,
                    borderLeftWidth:  isAR ? 1 : 0,
                    borderColor:      divider,
                    marginRight:  isAR ? 0  : 14,
                    marginLeft:   isAR ? 14 : 0,
                    paddingRight: isAR ? 0  : 14,
                    paddingLeft:  isAR ? 14 : 0,
                  },
                ]}>
                  <Text style={[styles.meetingDate, { color: subtext }]}>{date}</Text>
                  <Text style={[styles.meetingTime, { color: text }]}>{time}</Text>
                  <Text style={[styles.meetingAmpm, { color: subtext }]}>{ampm}</Text>
                </View>

                {/* Info */}
                <View style={[styles.meetingInfo, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
                  <Text
                    style={[styles.meetingTitle, { color: text, textAlign: isAR ? 'right' : 'left' }]}
                    numberOfLines={2}
                  >
                    {meeting.title}
                  </Text>
                  {!!meeting.noteText && (
                    <Text
                      style={[styles.meetingNote, { color: subtext, textAlign: isAR ? 'right' : 'left' }]}
                      numberOfLines={2}
                    >
                      {meeting.noteText}
                    </Text>
                  )}
                </View>

                {/* Notification bell per meeting */}
                {notifGranted && (
                  <Ionicons
                    name="notifications"
                    size={16}
                    color="#F59E0B"
                    style={{ marginLeft: isAR ? 0 : 8, marginRight: isAR ? 8 : 0 }}
                  />
                )}

                {deviceEventMap[meeting.id] && (
                  <TouchableOpacity
                    onPress={() => removeFromDeviceCalendar(meeting.id)}
                    style={{ marginLeft: 8, marginRight: 4 }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}

                {!deviceEventMap[meeting.id] && meeting.googleCalendarUrl && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(meeting.googleCalendarUrl)}
                    style={{ marginLeft: 8, marginRight: 4 }}
                  >
                    <Ionicons name="logo-google" size={16} color="#4285F4" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: BRAND,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    gap: 4,
  },
  headerBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  content: { padding: 16, paddingBottom: 40 },

  // Sync card
  card: {
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle:    { fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  cardSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  syncBtn: {
    backgroundColor: BRAND,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
  },
  syncBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  syncAltBtn: {
    marginTop: 10,
    backgroundColor: '#E6F2EE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
  },
  syncAltBtnText: { color: BRAND, fontSize: 14, fontWeight: '600' },

  statusBlock: {
    width: '100%',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 8,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusText: { fontSize: 12, fontWeight: '600', flex: 1 },

  // How it works strip
  howItWorks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginBottom: 20,
    gap: 6,
    flexWrap: 'wrap',
  },
  howStep:  { alignItems: 'center', gap: 4 },
  howLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center', maxWidth: 70 },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  countBadge: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 10 },
  countText:  { fontSize: 12, fontWeight: '600' },

  // Empty state
  emptyBox: {
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  emptySub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Meeting rows
  meetingRow: {
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  timeBlock: {
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetingDate:  { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  meetingTime:  { fontSize: 15, fontWeight: '700' },
  meetingAmpm:  { fontSize: 11, fontWeight: '600' },
  meetingInfo:  { flex: 1 },
  meetingTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4, lineHeight: 20 },
  meetingNote:  { fontSize: 12, lineHeight: 17 },
});
