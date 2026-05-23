import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform, Alert, Linking, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppContext } from '@/context/AppContext';
import { cardsApi } from '@/services/api';
import AddMeetingModal from '@/components/AddMeetingModal';
import {
  requestCalendarPermission,
  addCalendarEvent,
  listCalendars,
  removeEvent,
  getDeviceCalendarEvents,
  checkCalendarPermission,
} from '@/services/calendarService';

const BRAND = '#1b4654';

const deduplicateMeetings = (meetingsList) => {
  if (!Array.isArray(meetingsList)) return [];
  const unique = [];
  const seen = new Set();
  
  for (const m of meetingsList) {
    if (!m) continue;
    const titleNormalized = String(m.title || '').trim().toLowerCase();
    
    let datePart = '';
    if (m.time) {
      const d = new Date(m.time);
      if (!Number.isNaN(d.getTime())) {
        if (m.allDay) {
          datePart = d.toISOString().split('T')[0];
        } else {
          // Deduplicate timed events by grouping to the nearest minute
          datePart = String(Math.floor(d.getTime() / 60000));
        }
      }
    }
    
    // Key is combination of title and normalized date/time
    const key = `${titleNormalized}_${datePart}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
    }
  }
  return unique;
};

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
  const { isDark, language, brandColor } = useAppContext();
  const [meetings, setMeetings]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [syncing, setSyncing]         = useState(false);
  const [lastSynced, setLastSynced]   = useState(null);
  const [notifGranted, setNotifGranted] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);
  const [calendarPermission, setCalendarPermission] = useState(false);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [deviceEventMap, setDeviceEventMap] = useState({});
  const [phoneCalendarPermission, setPhoneCalendarPermission] = useState('undetermined');
  const [showPhoneEvents, setShowPhoneEvents] = useState(true);
  
  // Custom states for interactive Month Calendar
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'sync'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterMode, setFilterMode] = useState('selected'); // 'selected' | 'all'
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  
  const isAR = language === 'ar';
  const spinValue = useRef(new Animated.Value(0)).current;

  // ─── 1. Spin Animation for Header Sync Icon ───────────────────────────────
  useEffect(() => {
    if (syncing) {
      spinValue.setValue(0);
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.stopAnimation();
    }
  }, [syncing]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ─── 2. Setup: permissions + Android channel ──────────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('calendar-reminders', {
        name: 'Calendar Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: brandColor,
        sound: true,
      });
    }

    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifGranted(status === 'granted');
    });

    setCalendarPermission(false);

    const loadSettingsAndPermissions = async () => {
      try {
        const val = await AsyncStorage.getItem('mycard_show_phone_events');
        if (val !== null) {
          setShowPhoneEvents(val === 'true');
        }
        
        const perm = await checkCalendarPermission();
        setPhoneCalendarPermission(perm.status);
      } catch (err) {
        console.warn('Failed to load calendar settings:', err);
      }
    };
    loadSettingsAndPermissions();
  }, [brandColor]);

  const formatTimeOnly = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) return '';
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      if (isAR) {
        const ampm = h >= 12 ? 'م' : 'ص';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
      } else {
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
      }
    } catch {
      return '';
    }
  };

  // ─── 3. Schedule notifications whenever meetings list changes ──────────────
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

        const startTimeStr = formatTimeOnly(meeting.startAt || meeting.time);
        const endTimeStr = formatTimeOnly(meeting.endAt);
        const timeRange = endTimeStr ? `${startTimeStr} - ${endTimeStr}` : startTimeStr;
        const bodyText = timeRange ? `${meeting.title} (${timeRange})` : meeting.title;

        await Notifications.scheduleNotificationAsync({
          identifier: `meeting_${meeting.id}`,
          content: {
            title: isAR ? '📅 تذكير باجتماع' : '📅 Meeting Reminder',
            body: bodyText,
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

  // ─── 4. Fetch meetings from backend ───────────────────────────────────────
  const fetchMeetings = useCallback(async (showSyncing = false) => {
    if (showSyncing) setSyncing(true);
    try {
      // 1. Fetch backend meetings
      const { data } = await cardsApi.getMeetings();
      const backendMeetings = data.meetings || [];

      // 2. Fetch local meetings
      const localRaw = await AsyncStorage.getItem('mycard_local_meetings');
      const localMeetings = localRaw ? JSON.parse(localRaw) : [];

      // 3. Fetch device native calendar events
      let deviceMeetings = [];
      if (Platform.OS !== 'web' && showPhoneEvents) {
        try {
          const perm = await checkCalendarPermission();
          setPhoneCalendarPermission(perm.status);
          
          if (perm.status === 'granted') {
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 3);
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 6);
            const deviceEvents = await getDeviceCalendarEvents(startDate, endDate);
            deviceMeetings = deviceEvents.map(e => ({
              id: `device_${e.id}`,
              title: e.title || (isAR ? '(بدون عنوان)' : '(No Title)'),
              time: e.startDate,
              startAt: e.startDate,
              endAt: e.endDate,
              noteText: e.notes || e.location || '',
              isDeviceEvent: true,
              allDay: e.allDay,
            }));
          }
        } catch (err) {
          console.warn('Failed to fetch device calendar events', err);
        }
      }

      // Merge and deduplicate, prioritizing local/backend events
      const allMerged = [...backendMeetings, ...localMeetings, ...deviceMeetings];
      const sortedForDeduplication = [...allMerged].sort((a, b) => {
        const aDev = a.isDeviceEvent ? 1 : 0;
        const bDev = b.isDeviceEvent ? 1 : 0;
        return aDev - bDev;
      });
      setMeetings(deduplicateMeetings(sortedForDeduplication));
      setLastSynced(new Date());
    } catch (err) {
      console.error('Failed to fetch meetings', err);
      const localRaw = await AsyncStorage.getItem('mycard_local_meetings');
      const localMeetings = localRaw ? JSON.parse(localRaw) : [];

      let deviceMeetings = [];
      if (Platform.OS !== 'web' && showPhoneEvents) {
        try {
          const perm = await checkCalendarPermission();
          setPhoneCalendarPermission(perm.status);
          
          if (perm.status === 'granted') {
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 3);
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 6);
            const deviceEvents = await getDeviceCalendarEvents(startDate, endDate);
            deviceMeetings = deviceEvents.map(e => ({
              id: `device_${e.id}`,
              title: e.title || (isAR ? '(بدون عنوان)' : '(No Title)'),
              time: e.startDate,
              startAt: e.startDate,
              endAt: e.endDate,
              noteText: e.notes || e.location || '',
              isDeviceEvent: true,
              allDay: e.allDay,
            }));
          }
        } catch {}
      }
      const allMerged = [...localMeetings, ...deviceMeetings];
      const sortedForDeduplication = [...allMerged].sort((a, b) => {
        const aDev = a.isDeviceEvent ? 1 : 0;
        const bDev = b.isDeviceEvent ? 1 : 0;
        return aDev - bDev;
      });
      setMeetings(deduplicateMeetings(sortedForDeduplication));
    } finally {
      setLoading(false);
      if (showSyncing) setSyncing(false);
    }
  }, [isAR, showPhoneEvents]);

  const combineDateAndTime = (dateStr, timeStr) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;
    
    let hours = 0;
    let minutes = 0;
    
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|ص|م)?$/i);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3];
      if (ampm) {
        const lower = ampm.toLowerCase();
        if ((lower === 'pm' || lower === 'م') && hours < 12) {
          hours += 12;
        }
        if ((lower === 'am' || lower === 'ص') && hours === 12) {
          hours = 0;
        }
      }
    }
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const handleSaveMeeting = async ({ title, dateStr, startTime, endTime, noteText }) => {
    try {
      const startDateTime = combineDateAndTime(dateStr, startTime);
      const endDateTime = combineDateAndTime(dateStr, endTime);
      
      if (!startDateTime || !endDateTime) {
        Alert.alert('Error', 'Failed to parse dates and times correctly.');
        return;
      }

      const newMeeting = {
        id: `local_${Date.now()}`,
        title,
        time: startDateTime.toISOString(),
        startAt: startDateTime.toISOString(),
        endAt: endDateTime.toISOString(),
        noteText,
        isLocal: true,
      };

      const localRaw = await AsyncStorage.getItem('mycard_local_meetings');
      const localMeetings = localRaw ? JSON.parse(localRaw) : [];
      const updated = [newMeeting, ...localMeetings];

      await AsyncStorage.setItem('mycard_local_meetings', JSON.stringify(updated));
      setScheduleModalOpen(false);

      await fetchMeetings();
      Alert.alert(
        isAR ? 'تم الجدولة' : 'Scheduled',
        isAR ? 'تم حفظ التذكير وجدولته بنجاح!' : 'Reminder saved and scheduled successfully!'
      );
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not save the reminder.');
    }
  };

  const handleDeleteLocalMeeting = async (meetingId) => {
    const go = async () => {
      try {
        const localRaw = await AsyncStorage.getItem('mycard_local_meetings');
        let localMeetings = localRaw ? JSON.parse(localRaw) : [];
        localMeetings = localMeetings.filter(m => m.id !== meetingId);
        await AsyncStorage.setItem('mycard_local_meetings', JSON.stringify(localMeetings));
        
        await fetchMeetings();
      } catch (err) {
        Alert.alert('Error', 'Could not delete local meeting.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(isAR ? 'هل تريد حذف هذا التذكير؟' : 'Delete this reminder?')) {
        await go();
      }
      return;
    }

    Alert.alert(
      isAR ? 'حذف التذكير' : 'Delete Reminder',
      isAR ? 'هل أنت متأكد من حذف هذا التذكير؟' : 'Are you sure you want to delete this reminder?',
      [
        { text: isAR ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: isAR ? 'حذف' : 'Delete', style: 'destructive', onPress: go },
      ]
    );
  };

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

  const handleRequestCalendarPermission = async () => {
    if (Platform.OS === 'web') return;
    try {
      const { granted, status } = await requestCalendarPermission();
      setPhoneCalendarPermission(status);
      if (granted) {
        await fetchMeetings();
        Alert.alert(
          isAR ? 'تم منح الإذن' : 'Permission Granted',
          isAR 
            ? 'تم تفعيل الوصول إلى تقويم الهاتف بنجاح!' 
            : 'Access to phone calendar has been successfully enabled!'
        );
      } else {
        Alert.alert(
          isAR ? 'تم رفض إذن التقويم' : 'Calendar Permission Denied',
          isAR 
            ? 'يرجى تفعيل إذن الوصول للتقويم من إعدادات الهاتف لعرض أحداث تقويم الهاتف.' 
            : 'Please enable calendar access from your phone settings to display phone calendar events.',
          [
            { text: isAR ? 'إلغاء' : 'Cancel', style: 'cancel' },
            { 
              text: isAR ? 'فتح الإعدادات' : 'Open Settings', 
              onPress: () => Linking.openSettings() 
            }
          ]
        );
      }
    } catch (err) {
      Alert.alert('Error', err?.message || 'Could not request permission');
    }
  };

  const toggleShowPhoneEvents = async () => {
    try {
      const nextVal = !showPhoneEvents;
      setShowPhoneEvents(nextVal);
      await AsyncStorage.setItem('mycard_show_phone_events', String(nextVal));

      if (nextVal) {
        if (Platform.OS !== 'web') {
          const { status } = await checkCalendarPermission();
          setPhoneCalendarPermission(status);
          if (status !== 'granted') {
            const requestResult = await requestCalendarPermission();
            setPhoneCalendarPermission(requestResult.status);
            if (!requestResult.granted) {
              Alert.alert(
                isAR ? 'تفعيل التقويم' : 'Calendar Access Required',
                isAR
                  ? 'يرجى السماح بالوصول إلى تقويم الهاتف لعرض الأحداث.'
                  : 'Please allow calendar access to display phone events.'
              );
            }
          }
        }
      }
    } catch (err) {
      console.warn('Failed to toggle phone events:', err);
    }
  };

  // ─── 5. Helpers for Month Grid ────────────────────────────────────────────
  const getDaysForMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    const cells = [];

    // Prev month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, prevMonthTotalDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      cells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding days to complete 42-cell grid
    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      cells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return cells;
  };

  const changeMonth = (offset) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  
  const getMonthName = (date) => {
    return isAR ? monthNamesAr[date.getMonth()] : monthNamesEn[date.getMonth()];
  };

  const weekdaysEn = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const weekdaysAr = ['أحد', 'إثن', 'ثلا', 'أرب', 'خميس', 'جمع', 'سبت'];
  const weekdays = isAR ? weekdaysAr : weekdaysEn;

  const getMeetingLocalDate = (meeting) => {
    if (!meeting || !meeting.time) return new Date();
    const mDate = new Date(meeting.time);
    if (meeting.allDay) {
      if (typeof meeting.time === 'string' && meeting.time.includes('-')) {
        const parts = meeting.time.split('T')[0].split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          return new Date(y, m, d);
        }
      }
    }
    return mDate;
  };

  const dayHasMeetings = (date) => {
    return meetings.some(m => {
      const mDate = getMeetingLocalDate(m);
      return mDate.getFullYear() === date.getFullYear() &&
             mDate.getMonth() === date.getMonth() &&
             mDate.getDate() === date.getDate();
    });
  };

  const formatDateTime = (meeting) => {
    if (!meeting) return { date: '', time: '', ampm: '' };
    const d = getMeetingLocalDate(meeting);
    const dateStr = d.toLocaleDateString(isAR ? 'ar' : 'en-US', {
      month: 'short', day: 'numeric',
    });
    
    if (meeting.allDay) {
      return { 
        date: dateStr, 
        time: isAR ? 'طوال اليوم' : 'All Day', 
        ampm: '' 
      };
    }

    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return { date: dateStr, time: `${h}:${m}`, ampm };
  };

  // ─── 6. Theme tokens ──────────────────────────────────────────────────────
  const bg      = isDark ? '#0F172A' : '#F8FAFC';
  const cardBg  = isDark ? '#1E293B' : '#FFFFFF';
  const text    = isDark ? '#F8FAFC' : '#1E293B';
  const subtext = isDark ? '#94A3B8' : '#64748B';
  const divider = isDark ? '#334155' : '#E2E8F0';

  const brandTranslucent = brandColor + '15';
  const brandOutline = brandColor + '30';

  // ─── 7. Filtering meetings ────────────────────────────────────────────────
  const filteredMeetings = meetings.filter(m => {
    if (filterMode === 'all') return true;
    const mDate = getMeetingLocalDate(m);
    return mDate.getFullYear() === selectedDate.getFullYear() &&
           mDate.getMonth() === selectedDate.getMonth() &&
           mDate.getDate() === selectedDate.getDate();
  });

  const sortedMeetings = [...filteredMeetings].sort((a, b) => new Date(a.time) - new Date(b.time));

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={brandColor} />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 12, backgroundColor: brandColor }]}>
        <View style={{ alignItems: isAR ? 'flex-end' : 'flex-start' }}>
          <Text style={[styles.headerTitle, { textAlign: isAR ? 'right' : 'left' }]}>
            {isAR ? 'الجدول والتقويم' : 'Schedule & Calendar'}
          </Text>
          {lastSynced && (
            <Text style={[styles.headerSub, { textAlign: isAR ? 'right' : 'left' }]}>
              {isAR ? 'آخر مزامنة: ' : 'Last synced: '}
              {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Manual schedule meeting button */}
          <TouchableOpacity 
            onPress={() => setScheduleModalOpen(true)} 
            style={styles.headerActionBtn}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Header sync action with spin animation */}
          <TouchableOpacity 
            onPress={() => fetchMeetings(true)} 
            disabled={syncing}
            style={styles.headerActionBtn}
          >
            <Animated.View style={syncing && { transform: [{ rotate: spin }] }}>
              <Ionicons name="refresh" size={22} color="#fff" />
            </Animated.View>
          </TouchableOpacity>

          {notifGranted && reminderCount > 0 && (
            <View style={styles.headerBadge}>
              <Ionicons name="notifications" size={13} color="#fff" />
              <Text style={styles.headerBadgeText}>{reminderCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Segmented Tab Switcher ── */}
      <View style={[styles.tabContainer, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'schedule' && { backgroundColor: brandColor }]}
          onPress={() => setActiveTab('schedule')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'schedule' ? '#fff' : subtext }]}>
            {isAR ? 'الجدول الزمني' : 'Schedule'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'sync' && { backgroundColor: brandColor }]}
          onPress={() => setActiveTab('sync')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'sync' ? '#fff' : subtext }]}>
            {isAR ? 'إعدادات المزامنة' : 'Sync Settings'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {activeTab === 'schedule' ? (
          <>
            {/* ── Interactive Month Grid ── */}
            <View style={[styles.calendarCard, { backgroundColor: cardBg }]}>
              {/* Month Selector Header */}
              <View style={[styles.monthHeader, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                <TouchableOpacity onPress={() => changeMonth(-1)} style={[styles.monthArrow, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }]}>
                  <Ionicons name={isAR ? "chevron-forward" : "chevron-back"} size={20} color={text} />
                </TouchableOpacity>
                
                <Text style={[styles.monthLabel, { color: text }]}>
                  {getMonthName(currentMonth)} {currentMonth.getFullYear()}
                </Text>
                
                <TouchableOpacity onPress={() => changeMonth(1)} style={[styles.monthArrow, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }]}>
                  <Ionicons name={isAR ? "chevron-back" : "chevron-forward"} size={20} color={text} />
                </TouchableOpacity>
              </View>

              {/* Weekday Labels */}
              <View style={[styles.weekdaysRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                {weekdays.map((wd, i) => (
                  <Text key={i} style={[styles.weekdayText, { color: subtext }]}>
                    {wd}
                  </Text>
                ))}
              </View>

              {/* 42-day cells grid */}
              <View style={[styles.daysGrid, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                {getDaysForMonth(currentMonth).map((cell, idx) => {
                  const today = new Date();
                  const isToday = cell.date.getDate() === today.getDate() &&
                                  cell.date.getMonth() === today.getMonth() &&
                                  cell.date.getFullYear() === today.getFullYear();
                                  
                  const isSelected = cell.date.getDate() === selectedDate.getDate() &&
                                     cell.date.getMonth() === selectedDate.getMonth() &&
                                     cell.date.getFullYear() === selectedDate.getFullYear();
                                     
                  const hasMeetings = dayHasMeetings(cell.date);
                  
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={styles.dayCell}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedDate(cell.date);
                        setCurrentMonth(cell.date);
                      }}
                    >
                      <View style={[
                        styles.dayCircle,
                        isToday && [styles.dayCircleToday, { borderColor: brandColor }],
                        isSelected && [styles.dayCircleSelected, { backgroundColor: brandColor, shadowColor: brandColor }],
                      ]}>
                        <Text style={[
                          styles.dayText,
                          { color: cell.isCurrentMonth ? text : subtext },
                          !cell.isCurrentMonth && { opacity: 0.3 },
                          isToday && { color: brandColor, fontWeight: '800' },
                          isSelected && { color: '#fff', fontWeight: '800' },
                        ]}>
                          {cell.date.getDate()}
                        </Text>
                      </View>
                      {hasMeetings && (
                        <View style={[
                          styles.meetingDot, 
                          { backgroundColor: isSelected ? '#fff' : '#F59E0B' }
                        ]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Section Header with "Show All" toggle ── */}
            <View style={[styles.sectionHeader, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
              <View style={{ flexDirection: isAR ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.sectionTitle, { color: text }]}>
                  {filterMode === 'all'
                    ? (isAR ? 'كل الاجتماعات' : 'All Meetings')
                    : (isAR ? 'الاجتماعات اليومية' : 'Day\'s Meetings')}
                </Text>
                <View style={[styles.countBadge, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                  <Text style={[styles.countText, { color: subtext }]}>{sortedMeetings.length}</Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={[styles.filterToggle, { borderColor: brandOutline, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F1F5F9' }]}
                onPress={() => setFilterMode(prev => prev === 'all' ? 'selected' : 'all')}
              >
                <Text style={[styles.filterToggleText, { color: brandColor }]}>
                  {filterMode === 'all'
                    ? (isAR ? 'تصفية باليوم' : 'Filter Day')
                    : (isAR ? 'عرض الكل' : 'Show All')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── List of Meetings ── */}
            {loading ? (
              <ActivityIndicator size="large" color={brandColor} style={{ marginTop: 40 }} />
            ) : sortedMeetings.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: cardBg }]}>
                <View style={[styles.iconWrap, { backgroundColor: isDark ? '#334155' : '#F1F5F9', marginBottom: 6 }]}>
                  <Ionicons name="calendar-outline" size={30} color={isDark ? '#94A3B8' : '#64748B'} />
                </View>
                <Text style={[styles.emptyTitle, { color: text }]}>
                  {isAR ? 'لا توجد اجتماعات في هذا اليوم' : 'No meetings on this day'}
                </Text>
                <Text style={[styles.emptySub, { color: subtext }]}>
                  {isAR
                    ? 'سجّل ملاحظة صوتية في تبويب "ملاحظات الذكاء الاصطناعي" للمزامنة والجدولة.'
                    : 'Record voice notes in the AI Notetaker tab, then synchronize meetings.'}
                </Text>
              </View>
            ) : (
              sortedMeetings.map((meeting) => {
                const { date, time, ampm } = formatDateTime(meeting);
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
                    {/* Accent vertical line */}
                    <View style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: isAR ? undefined : 0,
                      right: isAR ? 0 : undefined,
                      width: 4,
                      backgroundColor: brandColor,
                      borderTopLeftRadius: isAR ? 0 : 12,
                      borderBottomLeftRadius: isAR ? 0 : 12,
                      borderTopRightRadius: isAR ? 12 : 0,
                      borderBottomRightRadius: isAR ? 12 : 0,
                    }} />

                    {/* Time Block */}
                    <View style={[
                      styles.timeBlock,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
                        borderRadius: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        marginRight: isAR ? 0 : 14,
                        marginLeft: isAR ? 14 : 0,
                        minWidth: 70,
                        alignItems: 'center',
                      }
                    ]}>
                      <Text style={[styles.meetingDate, { color: brandColor, fontWeight: '700' }]}>{date}</Text>
                      <Text style={[styles.meetingTime, { color: text, fontSize: 16, fontWeight: '800', marginTop: 2 }]}>{time}</Text>
                      <Text style={[styles.meetingAmpm, { color: subtext, fontSize: 10, fontWeight: '600' }]}>{ampm}</Text>
                    </View>

                    {/* Info */}
                    <View style={[styles.meetingInfo, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
                      <Text
                        style={[styles.meetingTitle, { color: text, textAlign: isAR ? 'right' : 'left' }]}
                        numberOfLines={1}
                      >
                        {meeting.title}
                      </Text>
                      {meeting.isDeviceEvent ? (
                        <Text style={{ fontSize: 11, color: '#4285F4', marginTop: 2, fontWeight: '600' }}>
                          {isAR ? '📱 تقويم الهاتف' : '📱 Phone Calendar'}
                        </Text>
                      ) : null}
                      {!!meeting.noteText && (
                        <Text
                          style={[styles.meetingNote, { color: subtext, textAlign: isAR ? 'right' : 'left' }]}
                          numberOfLines={2}
                        >
                          {meeting.noteText}
                        </Text>
                      )}
                    </View>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: isAR ? 0 : 8, paddingRight: isAR ? 8 : 0 }}>
                      {meeting.isLocal ? (
                        <TouchableOpacity
                          onPress={() => handleDeleteLocalMeeting(meeting.id)}
                          style={[styles.actionBtnRound, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2' }]}
                        >
                          <Ionicons name="trash-outline" size={15} color="#ef4444" />
                        </TouchableOpacity>
                      ) : (
                        <>
                          {notifGranted && (
                            <Ionicons
                              name="notifications"
                              size={15}
                              color="#F59E0B"
                            />
                          )}

                          {deviceEventMap[meeting.id] ? (
                            <TouchableOpacity
                              onPress={() => removeFromDeviceCalendar(meeting.id)}
                              style={[styles.actionBtnRound, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2' }]}
                            >
                              <Ionicons name="trash-outline" size={15} color="#ef4444" />
                            </TouchableOpacity>
                          ) : meeting.googleCalendarUrl ? (
                            <TouchableOpacity
                              onPress={() => Linking.openURL(meeting.googleCalendarUrl)}
                              style={[styles.actionBtnRound, { backgroundColor: isDark ? 'rgba(66,133,244,0.1)' : '#E8F0FE' }]}
                            >
                              <Ionicons name="logo-google" size={15} color="#4285F4" />
                            </TouchableOpacity>
                          ) : null}
                        </>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : (
          /* ─── Sync Settings Tab ─── */
          <>
            {/* Sync Card */}
            <View style={[styles.card, { backgroundColor: cardBg }]}>
              <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : brandTranslucent }]}>
                <Ionicons name="calendar" size={28} color={brandColor} />
              </View>

              <Text style={[styles.cardTitle, { color: text }]}>
                {isAR ? 'ملاحظات الذكاء الاصطناعي ← التقويم' : 'AI Notes → Calendar'}
              </Text>
              <Text style={[styles.cardSubtitle, { color: subtext }]}>
                {isAR
                  ? 'اضغط "مزامنة الآن" لجلب اجتماعاتك وجدولة إشعارات تذكير تلقائية لكل اجتماع.'
                  : 'Tap Sync Now to fetch your meetings and schedule automatic reminder notifications for each one.'}
              </Text>

              {/* Sync Button */}
              <TouchableOpacity
                style={[styles.syncBtn, { backgroundColor: brandColor, shadowColor: brandColor }, syncing && { opacity: 0.7 }]}
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
                style={[
                  styles.syncAltBtn, 
                  { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : brandTranslucent,
                    borderColor: brandOutline,
                  },
                  calendarSyncing && { opacity: 0.7 }
                ]}
                onPress={syncToDeviceCalendar}
                disabled={calendarSyncing}
              >
                {calendarSyncing ? (
                  <ActivityIndicator color={brandColor} size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="calendar-outline"
                      size={17}
                      color={brandColor}
                      style={{ marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }}
                    />
                    <Text style={[styles.syncAltBtnText, { color: brandColor }]}>
                      {isAR ? 'مزامنة مع تقويم الجهاز' : 'Sync to Device Calendar'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Status block */}
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
                          : `${reminderCount} reminder${reminderCount !== 1 ? 's' : ''} scheduled`}
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

            {/* Phone Calendar Sync Card (Mobile only) */}
            {Platform.OS !== 'web' && (
              <View style={[styles.card, { backgroundColor: cardBg, marginTop: 16 }]}>
                <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : brandTranslucent }]}>
                  <Ionicons name="phone-portrait-outline" size={28} color={brandColor} />
                </View>

                <Text style={[styles.cardTitle, { color: text }]}>
                  {isAR ? 'مزامنة تقويم الهاتف' : 'Phone Calendar Sync'}
                </Text>
                <Text style={[styles.cardSubtitle, { color: subtext }]}>
                  {isAR
                    ? 'عرض وإدراج أحداث تقويم الهاتف الخاص بك داخل جدول التطبيق.'
                    : 'Display and list your device phone calendar events inside the app schedule.'}
                </Text>

                {/* Status and Action */}
                <View style={{ width: '100%', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: phoneCalendarPermission === 'granted' ? '#22C55E' : '#EF4444'
                    }} />
                    <Text style={{ fontSize: 13, color: text, fontWeight: '600' }}>
                      {phoneCalendarPermission === 'granted'
                        ? (isAR ? 'تم منح إذن الوصول' : 'Calendar Permission Granted')
                        : (isAR ? 'الإذن غير ممنوح' : 'Calendar Permission Not Granted')}
                    </Text>
                  </View>

                  {phoneCalendarPermission !== 'granted' && (
                    <TouchableOpacity
                      style={[styles.syncBtn, { backgroundColor: brandColor, shadowColor: brandColor }]}
                      onPress={handleRequestCalendarPermission}
                    >
                      <Ionicons name="lock-open-outline" size={17} color="#fff" style={{ marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }} />
                      <Text style={styles.syncBtnText}>
                        {isAR ? 'منح الإذن الآن' : 'Grant Permission Now'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Toggle switch for showing phone events */}
                <View style={{
                  flexDirection: isAR ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  borderTopWidth: 1,
                  borderTopColor: divider,
                  paddingTop: 14,
                  marginTop: 8
                }}>
                  <Text style={{ fontSize: 14, color: text, fontWeight: '700' }}>
                    {isAR ? 'عرض أحداث الهاتف' : 'Show Phone Events'}
                  </Text>
                  <TouchableOpacity
                    style={{
                      width: 50,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: showPhoneEvents ? brandColor : (isDark ? '#475569' : '#CBD5E1'),
                      justifyContent: 'center',
                      paddingHorizontal: 2,
                      alignItems: showPhoneEvents ? 'flex-end' : 'flex-start'
                    }}
                    onPress={toggleShowPhoneEvents}
                  >
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: '#FFF',
                      elevation: 2,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.2,
                      shadowRadius: 1.5
                    }} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* How it works strip */}
            <View style={[styles.howItWorks, { backgroundColor: cardBg, borderColor: divider }]}>
              {[
                { icon: 'mic-outline',          label: isAR ? 'سجّل ملاحظة' : 'Record note' },
                { icon: 'arrow-forward-outline', label: '' },
                { icon: 'calendar-outline',     label: isAR ? 'يُضاف للتقويم' : 'Add calendar' },
                { icon: 'arrow-forward-outline', label: '' },
                { icon: 'notifications-outline', label: isAR ? 'تذكير تلقائي' : 'Auto remind' },
              ].map((item, i) => (
                item.label
                  ? (
                    <View key={i} style={styles.howStep}>
                      <View style={[styles.howIconBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : brandTranslucent }]}>
                        <Ionicons name={item.icon} size={15} color={brandColor} />
                      </View>
                      <Text style={[styles.howLabel, { color: subtext }]} numberOfLines={1}>{item.label}</Text>
                    </View>
                  )
                  : <Ionicons key={i} name={isAR ? 'arrow-back-outline' : 'arrow-forward-outline'} size={14} color={subtext} style={{ opacity: 0.3 }} />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <AddMeetingModal
        visible={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onSave={handleSaveMeeting}
        initialDate={selectedDate}
        isAR={isAR}
        brandColor={brandColor}
        isDark={isDark}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: BRAND,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '500' },
  headerActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    width: 22,
    height: 22,
    justifyContent: 'center',
  },
  headerBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },

  content: { padding: 16, paddingBottom: 40 },

  // Interactive Calendar Card
  calendarCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  monthArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '800',
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekdayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.6,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 1,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    borderWidth: 1.5,
  },
  dayCircleSelected: {
    elevation: 3,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  meetingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    position: 'absolute',
    bottom: 3,
  },

  // Sync Card
  card: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 16,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle:    { fontSize: 16, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  cardSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  syncBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  syncAltBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  syncAltBtnText: { fontSize: 14, fontWeight: '700' },

  statusBlock: {
    width: '100%',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusText: { fontSize: 12, fontWeight: '600', flex: 1 },

  // How it works strip
  howItWorks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  howStep:  { alignItems: 'center', gap: 6, flex: 1 },
  howIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  howLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 2 },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  countBadge: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 10 },
  countText:  { fontSize: 12, fontWeight: '700' },
  filterToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterToggleText: { fontSize: 12, fontWeight: '700' },

  // Empty state
  emptyBox: {
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  emptySub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Meeting rows
  meetingRow: {
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  timeBlock: {
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetingDate:  { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  meetingTime:  { fontSize: 16, fontWeight: '800' },
  meetingAmpm:  { fontSize: 10, fontWeight: '700' },
  meetingInfo:  { flex: 1 },
  meetingTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4, lineHeight: 20 },
  meetingNote:  { fontSize: 12, lineHeight: 17 },
  actionBtnRound: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
