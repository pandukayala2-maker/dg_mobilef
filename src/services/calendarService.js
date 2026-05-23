import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';

const GOOGLE_HINTS = ['google', 'gmail'];

const findBestCalendar = (calendars = []) => {
  if (!calendars.length) return null;

  // On Android prefer a Google-synced calendar so events appear in Google Calendar app
  if (Platform.OS === 'android') {
    const googleCal = calendars.find((c) => {
      const name   = String(c?.title        || '').toLowerCase();
      const source = String(c?.source?.name || '').toLowerCase();
      return GOOGLE_HINTS.some((h) => name.includes(h) || source.includes(h));
    });
    if (googleCal) return googleCal;
  }

  // Fall back to any writable calendar
  return calendars.find((c) => c?.allowsModifications !== false) ?? calendars[0];
};

// ─── Permission ───────────────────────────────────────────────────────────────

export async function requestCalendarPermission() {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return { granted: status === 'granted', status };
  } catch (error) {
    throw new Error(`Calendar permission error: ${error?.message || 'Unknown'}`);
  }
}

export async function checkCalendarPermission() {
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return { granted: status === 'granted', status };
  } catch (error) {
    return { granted: false, status: 'undetermined' };
  }
}

// ─── List calendars ───────────────────────────────────────────────────────────

export async function listCalendars() {
  try {
    const perm = await requestCalendarPermission();
    if (!perm.granted) return [];

    const all = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    // Return only writable calendars
    return Array.isArray(all) ? all.filter((c) => c.allowsModifications !== false) : [];
  } catch (error) {
    throw new Error(`Failed to list calendars: ${error?.message || 'Unknown'}`);
  }
}

// ─── Ensure a writable calendar exists (Android local fallback) ───────────────

async function ensureWritableCalendar() {
  const calendars = await listCalendars();
  const best = findBestCalendar(calendars);
  if (best) return best.id;

  // Android only: create a local DigCard calendar if nothing is writable
  if (Platform.OS === 'android') {
    try {
      const newId = await Calendar.createCalendarAsync({
        title:      'DigCard',
        color:      '#1b4654',
        entityType: Calendar.EntityTypes.EVENT,
        source: {
          isLocalAccount: true,
          name:           'DigCard',
          type:           Calendar.SourceType.LOCAL,
        },
        name:        'digcard',
        ownerAccount: 'personal',
        accessLevel:  Calendar.CalendarAccessLevel.OWNER,
      });
      return newId;
    } catch {
      // Could not create — return null and let caller handle
      return null;
    }
  }

  return null;
}

// ─── Add event ────────────────────────────────────────────────────────────────

export async function addCalendarEvent({
  title,
  startDate,
  endDate,
  notes     = '',
  location  = '',
  url,
  calendarId,
}) {
  if (!title) throw new Error('Event title is required.');

  const perm = await requestCalendarPermission();
  if (!perm.granted) throw new Error('Calendar permission not granted.');

  const start = new Date(startDate);
  const end   = endDate ? new Date(endDate) : new Date(start.getTime() + 60 * 60 * 1000);

  if (Number.isNaN(start.getTime())) throw new Error('Invalid start date.');
  if (Number.isNaN(end.getTime()))   throw new Error('Invalid end date.');

  const targetId = calendarId ?? (await ensureWritableCalendar());
  if (!targetId) throw new Error('No writable calendar found on this device.');

  const eventId = await Calendar.createEventAsync(targetId, {
    title,
    startDate: start,
    endDate:   end,
    notes,
    location,
    url: url ?? undefined,
  });

  return { eventId, calendarId: targetId };
}

// ─── Remove event ─────────────────────────────────────────────────────────────

export async function removeEvent(eventId) {
  if (!eventId) throw new Error('Event ID is required.');

  const perm = await requestCalendarPermission();
  if (!perm.granted) throw new Error('Calendar permission not granted.');

  await Calendar.deleteEventAsync(eventId);
  return { removed: true, eventId };
}

// ─── Get events from device calendars ─────────────────────────────────────────

export async function getDeviceCalendarEvents(startDate, endDate) {
  try {
    const perm = await checkCalendarPermission();
    if (!perm.granted) return [];

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (!calendars.length) return [];

    const calendarIds = calendars.map((c) => c.id);
    const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);
    return events || [];
  } catch (error) {
    console.warn('[calendarService] Failed to fetch device events:', error?.message);
    return [];
  }
}
