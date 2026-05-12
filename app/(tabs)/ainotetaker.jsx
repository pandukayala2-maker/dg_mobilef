import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  Modal,
  Alert,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Animated,
  Keyboard,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { API_BASE_URL, tokenStore } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

const BRAND = '#1b4654';
const NOTES_KEY_PREFIX = 'digcard_ai_notes';

/* ─── Helpers ─── */
function formatRelative(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 2 * 86400000) return 'Yesterday';
  return new Date(dateStr).toLocaleDateString();
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function generateSummary(transcript) {
  if (!transcript || transcript.trim().length < 5) return null;

  const clean = transcript.trim();
  const sentences = clean
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  if (sentences.length === 0) return null;

  // Title from the first meaningful sentence
  const first = sentences[0];
  const title =
    first.length > 60
      ? first.slice(0, 57) + '...'
      : first.charAt(0).toUpperCase() + first.slice(1);

  // Summary: combine first few sentences
  const summaryParts = sentences.slice(0, 3);
  const summary = summaryParts
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('. ') + (summaryParts.length > 0 ? '.' : '');

  // Next steps: extract action-like sentences
  const actionWords = ['follow', 'call', 'email', 'send', 'check', 'meet', 'review', 'update', 'schedule', 'confirm', 'share', 'remind', 'discuss', 'prepare', 'contact', 'setup', 'set up', 'create', 'finish', 'complete', 'ask', 'tell', 'need to', 'should', 'must', 'will'];
  const steps = sentences
    .filter((s) => actionWords.some((w) => s.toLowerCase().includes(w)))
    .slice(0, 4)
    .map((s) => `• ${s.charAt(0).toUpperCase()}${s.slice(1)}`);

  // If no action items found, create generic ones from remaining sentences
  if (steps.length === 0 && sentences.length > 1) {
    sentences.slice(1, 3).forEach((s) => {
      steps.push(`• Follow up: ${s.charAt(0).toUpperCase()}${s.slice(1)}`);
    });
  }

  return { title, summary, nextSteps: steps };
}

/* ═══════════════ Note Detail Modal ═══════════════ */
function NoteDetailModal({ note, onClose }) {
  const [tab, setTab] = useState('summary');
  if (!note) return null;
  const ai = note.ai;

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={det.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        {/* Header */}
        <View style={det.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={BRAND} />
          </TouchableOpacity>
          <View style={det.headerRight}>
            <TouchableOpacity
              style={det.iconBtn}
              onPress={() => {
                const text = note.transcript || ai?.summary || '';
                if (text) {
                  import('expo-clipboard').then((Clipboard) =>
                    Clipboard.setStringAsync(text).then(() =>
                      Alert.alert('Copied', 'Note copied to clipboard.')
                    )
                  );
                }
              }}
            >
              <Ionicons name="copy-outline" size={22} color={BRAND} />
            </TouchableOpacity>
            <TouchableOpacity
              style={det.iconBtn}
              onPress={() => {
                import('react-native').then(({ Share }) =>
                  Share.share({ message: note.transcript || ai?.summary || '' })
                );
              }}
            >
              <Ionicons name="share-outline" size={22} color={BRAND} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={det.scroll}>
          <Text style={det.title}>{note.title}</Text>
          <Text style={det.meta}>
            {new Date(note.createdAt).toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
            {note.duration ? `  •  ${formatDuration(note.duration)}` : ''}
          </Text>

          {/* Tab switcher */}
          <View style={det.tabs}>
            <TouchableOpacity
              style={[det.tabBtn, tab === 'summary' && det.tabBtnActive]}
              onPress={() => setTab('summary')}
            >
              <Text style={[det.tabText, tab === 'summary' && det.tabTextActive]}>
                Summary
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[det.tabBtn, tab === 'transcript' && det.tabBtnActive]}
              onPress={() => setTab('transcript')}
            >
              <Text style={[det.tabText, tab === 'transcript' && det.tabTextActive]}>
                Transcript
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {tab === 'summary' ? (
            <View style={det.content}>
              {ai ? (
                <>
                  <View style={det.summaryCard}>
                    <View style={det.summaryBadge}>
                      <Ionicons name="sparkles" size={14} color={BRAND} />
                      <Text style={det.summaryBadgeText}>AI Summary</Text>
                    </View>
                    <Text style={det.summaryText}>{ai.summary}</Text>
                  </View>

                  {ai.nextSteps?.length > 0 && (
                    <View style={det.stepsCard}>
                      <Text style={det.stepsTitle}>Next Steps</Text>
                      {ai.nextSteps.map((step, i) => (
                        <Text key={i} style={det.stepText}>{step}</Text>
                      ))}
                    </View>
                  )}

                  <View style={det.feedbackRow}>
                    <Text style={det.feedbackQ}>Was this summary helpful?</Text>
                    <View style={det.feedbackBtns}>
                      <TouchableOpacity style={det.thumbBtn}>
                        <Ionicons name="thumbs-up-outline" size={20} color="#666" />
                      </TouchableOpacity>
                      <TouchableOpacity style={det.thumbBtn}>
                        <Ionicons name="thumbs-down-outline" size={20} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <View style={det.emptyCard}>
                  <Ionicons name="alert-circle-outline" size={32} color="#CCC" />
                  <Text style={det.noSpeech}>
                    No clear speech was detected in this recording.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={det.content}>
              {note.transcript ? (
                <View style={det.transcriptCard}>
                  <Text style={det.transcriptText}>{note.transcript}</Text>
                </View>
              ) : (
                <View style={det.emptyCard}>
                  <Ionicons name="document-text-outline" size={32} color="#CCC" />
                  <Text style={det.noSpeech}>No transcript available.</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ═══════════════ Recording Modal ═══════════════ */
async function transcribeAudioUri(uri, authToken) {
  if (!uri) return '';

  const endpoint = process.env.EXPO_PUBLIC_TRANSCRIBE_URL || `${API_BASE_URL}/ai/transcribe`;
  const token =
    authToken ||
    (await tokenStore.get('auth_token').catch(() => null)) ||
    (await tokenStore.get('token').catch(() => null));

  const ext = uri.split('.').pop()?.toLowerCase() || 'm4a';
  const mimeType = ext === 'wav' ? 'audio/wav' : 'audio/m4a';

  const form = new FormData();
  if (Platform.OS === 'web') {
    const fileResponse = await fetch(uri);
    const blob = await fileResponse.blob();
    form.append('file', blob, `voice-note.${ext}`);
  } else {
    form.append('file', { uri, name: `voice-note.${ext}`, type: mimeType });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: form,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Transcription failed ${res.status}${detail ? `: ${detail}` : ''}`);
    }

    const data = await res.json();
    const text = (
      data?.text || data?.transcript || data?.result?.text || data?.data?.text || ''
    ).trim();

    console.log('Transcription completed');
    return text;
  } catch (error) {
    clearTimeout(timeout);
    console.log('Transcription error:', error?.message || error);
    return '';
  }
}

function RecordingModal({ onSave, onClose, authToken }) {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState('starting');
  const [ending, setEnding] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef(null);

  const startPulse = () => {
    pulseLoopRef.current?.stop();
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.22, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current.start();
  };

  const stopPulse = () => {
    pulseLoopRef.current?.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setStatus('permission-denied');
        stopPulse();
        Alert.alert(
          'Microphone Permission Required',
          'Please allow microphone access in your iPhone Settings to record voice notes.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus('recording');
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (error) {
      console.log('Unable to start recording', error?.message || error);
      setStatus('permission-denied');
      stopPulse();
    }
  };

  useEffect(() => {
    startPulse();
    startRecording();

    return () => {
      clearInterval(timerRef.current);
      stopPulse();
      recorder.stop().catch(() => {});
    };
  }, []);

  const togglePause = () => {
    if (ending || status === 'permission-denied') return;

    try {
      if (paused) {
        recorder.record();
        setPaused(false);
        setStatus('recording');
        startPulse();
        timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      } else {
        recorder.pause();
        setPaused(true);
        setStatus('paused');
        clearInterval(timerRef.current);
        stopPulse();
      }
    } catch (error) {
      console.log('Pause/resume failed', error?.message || error);
    }
  };

  const handleEnd = async () => {
    if (ending) return;
    setEnding(true);
    setStatus('processing');
    clearInterval(timerRef.current);
    stopPulse();

    let uri = null;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      uri = recorder.uri;
      console.log('Recording URI:', uri);
    } catch (error) {
      console.log('Stop recording failed:', error?.message || error);
    }

    // Close modal immediately then transcribe — never hang on "Processing"
    const savedElapsed = elapsed;
    await onSave({ transcript: '', duration: savedElapsed, uri });
  };

  const isRecording = status === 'recording';

  const statusLabel = status === 'starting' ? 'Preparing microphone...'
    : status === 'recording' ? 'Recording in progress...'
    : status === 'paused' ? 'Paused'
    : status === 'processing' ? 'Generating summary...'
    : 'Microphone permission denied';

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={handleEnd}>
      <SafeAreaView style={rc.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        {/* Header */}
        <View style={rc.header}>
          <TouchableOpacity onPress={handleEnd} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#222" />
          </TouchableOpacity>
        </View>

        {/* Mic + title */}
        <View style={rc.topArea}>
          <Animated.View style={[rc.micRing, paused && rc.micRingPaused, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="mic" size={38} color={paused ? '#AAA' : '#222'} />
          </Animated.View>
          <Text style={rc.noteTitle}>New note</Text>
          <View style={rc.statusRow}>
            {isRecording && !paused && <View style={rc.redDot} />}
            <Text style={[rc.statusLabel, paused && rc.statusLabelPaused]}>{statusLabel}</Text>
          </View>
        </View>

        <ScrollView style={rc.transcriptScroll} contentContainerStyle={rc.transcriptContent} keyboardShouldPersistTaps="handled">
          <Text style={rc.emptyHint}>
            {status === 'starting'
              ? 'Preparing microphone...'
              : status === 'permission-denied'
              ? 'Enable microphone permission, then try again.'
              : paused
              ? 'Recording paused. Tap Resume to continue.'
              : 'Speak naturally. Transcription runs when you tap End.'}
          </Text>
        </ScrollView>

        {/* Controls */}
        <View style={rc.controls}>
          <TouchableOpacity
            style={[
              rc.pauseBtn,
              (ending || status === 'permission-denied') && rc.controlDisabled,
            ]}
            onPress={togglePause}
            disabled={ending || status === 'permission-denied'}
          >
            <Ionicons name={paused ? 'play' : 'pause'} size={18} color="#555" />
            <Text style={rc.pauseBtnText}>{paused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>
          <View style={rc.timerWrap}>
            <Ionicons name="bar-chart" size={15} color="#E34B4B" />
            <Text style={rc.timerText}>{formatDuration(elapsed)}</Text>
          </View>
          <TouchableOpacity style={rc.endBtn} onPress={handleEnd} disabled={ending}>
            {ending ? (
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
            ) : (
              <Ionicons name="stop-circle" size={18} color="#fff" style={{ marginRight: 5 }} />
            )}
            <Text style={rc.endBtnText}>{ending ? 'Processing...' : 'End'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/* ═══════════════════════════════ Main Screen ═══════════════════════════════ */
import { useAppContext } from '@/context/AppContext';

export default function AiNotetakerScreen() {
  const { logout, user, token } = useAuth();
  const { isDark, language } = useAppContext();
  const isAR = language === 'ar';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Per-user storage key so each person's notes are isolated
  const notesKey = `${NOTES_KEY_PREFIX}_${user?.id || 'guest'}`;
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [recording, setRecording] = useState(false);
  const [typing, setTyping] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);

  const handleLogout = () => {
    const performLogout = async () => {
      await logout();
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

  // Track if a recording save is in progress to prevent backend fetch from overwriting it
  const savingRef = useRef(false);

  useEffect(() => {
    const fetchBackendNotes = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/ai/notes`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const normalized = data.map(n => ({
            ...n,
            createdAt: n.createdAt || n.created_at,
            ai: n.summary ? { summary: n.summary, nextSteps: n.next_steps || [] } : null,
            status: 'done',
          }));
          // Only overwrite notes if we're not mid-save
          if (!savingRef.current) {
            setNotes(normalized);
            await AsyncStorage.setItem(notesKey, JSON.stringify(normalized));
          }
          return;
        }
      } catch (err) {
        console.log('Failed to fetch from backend, using cache', err.message);
      }
      // Fallback to cache
      const raw = await AsyncStorage.getItem(notesKey);
      if (raw && !savingRef.current) {
        try { setNotes(JSON.parse(raw)); } catch {}
      }
    };
    fetchBackendNotes();
  }, [notesKey, token]);

  const saveNotes = useCallback(async (updated) => {
    setNotes(updated);
    await AsyncStorage.setItem(notesKey, JSON.stringify(updated));
  }, [notesKey]);

  const handleSaveRecording = useCallback(
    async ({ duration, uri }) => {
      savingRef.current = true;
      setRecording(false);

      // Save note locally right away so user sees it instantly
      const localId = `local_${Date.now()}`;
      const createdAt = new Date().toISOString();
      const immediateNote = {
        id: localId,
        createdAt,
        title: 'Voice note recorded',
        transcript: '',
        duration,
        status: 'processing',
        ai: null,
      };
      setNotes(prev => [immediateNote, ...prev]);

      // Transcribe in background (may fail — that's OK)
      const transcript = uri ? await transcribeAudioUri(uri, token) : '';
      const ai = generateSummary(transcript);
      const title = ai?.title || (transcript ? transcript.slice(0, 50) : 'Voice note recorded');

      const finalNote = {
        id: localId,
        createdAt,
        title,
        transcript: transcript || '',
        summary: ai?.summary || '',
        next_steps: ai?.nextSteps || [],
        duration,
        status: 'done',
        ai,
        card_id: user?.card_id || null,
      };

      // Show the finished note immediately (with or without transcript)
      setNotes(prev => prev.map(n => n.id === localId ? finalNote : n));

      // Save to backend in background
      try {
        const res = await fetch(`${API_BASE_URL}/ai/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: finalNote.title,
            transcript: finalNote.transcript,
            summary: finalNote.summary,
            next_steps: finalNote.next_steps,
            duration,
            card_id: finalNote.card_id,
          }),
        });
        if (res.ok) {
          const saved = await res.json();
          const backendNote = {
            ...finalNote,
            id: saved.id || saved._id || localId,
            createdAt: saved.createdAt || saved.created_at || createdAt,
            ai: saved.summary ? { summary: saved.summary, nextSteps: saved.next_steps || [] } : ai,
            status: 'done',
          };
          setNotes(prev => prev.map(n => n.id === localId ? backendNote : n));
        }
      } catch (err) {
        console.log('Backend save failed (note kept locally):', err.message);
      }

      // Always persist locally
      setNotes(prev => {
        AsyncStorage.setItem(notesKey, JSON.stringify(prev)).catch(() => {});
        return prev;
      });
      savingRef.current = false;
    },
    [token, user, notesKey]
  );

  const handleSaveManualNote = useCallback(
    async (text) => {
      setTyping(false);
      if (!text.trim()) return;

      const ai = generateSummary(text);
      const noteData = {
        title: ai?.title || text.slice(0, 50),
        transcript: text,
        summary: ai?.summary || '',
        next_steps: ai?.nextSteps || [],
        duration: 0,
        card_id: user?.card_id || null,
      };

      try {
        const res = await fetch(`${API_BASE_URL}/ai/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(noteData),
        });

        if (res.ok) {
          const savedNote = await res.json();
          const normalized = {
            ...savedNote,
            createdAt: savedNote.createdAt || savedNote.created_at || new Date().toISOString(),
            ai: savedNote.summary ? { summary: savedNote.summary, nextSteps: savedNote.next_steps || [] } : null,
          };
          saveNotes([normalized, ...notes]);
          return;
        } else {
          const errBody = await res.text().catch(() => '');
          console.warn('[createNote manual] Backend error', res.status, errBody);
          Alert.alert('Save failed', `Note saved locally only. Server error ${res.status}.`);
        }
      } catch (err) {
        console.log('Manual note save failed', err.message);
        Alert.alert('Save failed', 'Note saved locally. Check your connection.');
      }

      // fallback
      const localNote = {
        id: `temp_${Date.now()}`,
        createdAt: new Date().toISOString(),
        status: 'done',
        ...noteData,
        ai: { summary: ai?.summary || '', nextSteps: ai?.nextSteps || [] },
      };
      saveNotes([localNote, ...notes]);
    },
    [notes, saveNotes, token, user]
  );

  const deleteNoteById = async (id) => {
    try {
      // Delete from Backend
      const res = await fetch(`${API_BASE_URL}/ai/notes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const updated = notes.filter((n) => n.id !== id);
        saveNotes(updated);
        return;
      }
    } catch (err) {
      console.log('Delete backend failed', err.message);
    }

    // Even if backend fails, update local UI if it's there
    const updated = notes.filter((n) => n.id !== id);
    saveNotes(updated);
  };

  const handleDeleteNote = async (id) => {
    // On web, use native browser confirm for reliable multi-action confirmation.
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const ok = window.confirm(isAR ? 'حذف هذه الملاحظة نهائياً؟' : 'Delete this note permanently?');
      if (!ok) return;
      await deleteNoteById(id);
      return;
    }

    Alert.alert(
      isAR ? 'حذف الملاحظة' : 'Delete Note',
      isAR ? 'حذف هذه الملاحظة نهائياً؟' : 'Delete this note permanently?',
      [
        { text: isAR ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isAR ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteNoteById(id);
          },
        },
      ]
    );
  };

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase())
  );

  const bg = isDark ? '#0f172a' : '#f8f9fa';
  const textClr = isDark ? '#f8fafc' : '#111';

  return (
    <SafeAreaView edges={['top']} style={styles.safeTop}>
      <View style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />

      {/* Header */}
      <View style={[styles.header, { flexDirection: isAR ? 'row-reverse' : 'row' }]}> 
        <View style={[styles.headerLeft, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
          <Ionicons name="mic" size={20} color="#fff" style={{ marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }} />
          <Text style={styles.headerTitle}>{isAR ? 'ملاحظات الذكاء الاصطناعي' : 'AI Notetaker'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} hitSlop={10}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#eaeaea', flexDirection: isAR ? 'row-reverse' : 'row' }]}>
        <Ionicons name="search-outline" size={18} color="#999" style={{ marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }} />
        <TextInput
          style={[styles.searchInput, { color: textClr, textAlign: isAR ? 'right' : 'left' }]}
          placeholder={isAR ? "البحث في الملاحظات..." : "Search notes..."}
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={10} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={18} color="#BBB" />
          </TouchableOpacity>
        )}
      </View>

      {/* Notes list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#1e3a47' : '#EDF5F3' }]}>
              <Ionicons name="mic-outline" size={48} color={BRAND} />
            </View>
            <Text style={[styles.emptyText, { color: isDark ? '#64748b' : '#999' }]}>No notes yet</Text>
            <Text style={[styles.emptySub, { color: isDark ? '#475569' : '#BBB' }]}>
              Tap the button below to start recording.{'\n'}
              Your speech is transcribed when recording ends.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.noteItem, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}
            onPress={() => item.status === 'done' && setSelectedNote(item)}
            activeOpacity={0.7}
          >
            <View style={[styles.noteHeader, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
              <Text style={styles.noteTime}>{formatRelative(item.createdAt)}</Text>
              <View style={[styles.noteHeaderRight, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                {item.duration ? (
                  <Text style={styles.noteDuration}>{formatDuration(item.duration)}</Text>
                ) : null}
                <TouchableOpacity
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    handleDeleteNote(item.id);
                  }}
                  onPressIn={(e) => e?.stopPropagation?.()}
                  hitSlop={8}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash-outline" size={16} color="#FF4444" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[styles.noteTitle, { color: textClr, textAlign: isAR ? 'right' : 'left' }]} numberOfLines={2}>{item.title}</Text>
            {item.transcript ? (
              <Text style={[styles.notePreview, { textAlign: isAR ? 'right' : 'left' }]} numberOfLines={2}>
                {item.transcript}
              </Text>
            ) : null}
            <View style={[styles.badgeRow, { justifyContent: isAR ? 'flex-end' : 'flex-start' }]}>
              {item.status === 'processing' ? (
                <View style={[styles.badge, { backgroundColor: isDark ? '#334155' : '#F2F2F2' }]}>
                  <ActivityIndicator size={10} color="#888" style={{ marginRight: 4 }} />
                  <Text style={styles.badgeText}>{isAR ? 'جاري المعالجة' : 'Processing'}</Text>
                </View>
              ) : item.ai ? (
                <View style={[styles.badge, styles.badgeAI, { backgroundColor: isDark ? '#1e3a47' : '#EDF5F3' }]}>
                  <Ionicons name="sparkles" size={12} color={BRAND} style={{ marginRight: isAR ? 0 : 3, marginLeft: isAR ? 3 : 0 }} />
                  <Text style={styles.badgeAIText}>{isAR ? 'ملخص الذكاء الاصطناعي' : 'AI Summary'}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: isDark ? '#1e293b' : 'transparent' }]} />}
      />

      {/* Footer */}
      <View style={[styles.footer, {
        paddingBottom: Math.max(20, insets.bottom + 10),
        flexDirection: isAR ? 'row-reverse' : 'row',
        backgroundColor: isDark ? '#0f172a' : '#fff',
        borderTopColor: isDark ? '#1e293b' : '#F1F5F9',
      }]}>
        <TouchableOpacity
          style={[styles.textNoteBtn, { backgroundColor: isDark ? '#1e293b' : '#F1F5F9' }]}
          onPress={() => setTyping(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={22} color={isDark ? '#94a3b8' : BRAND} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.takeNoteBtn, { flexDirection: isAR ? 'row-reverse' : 'row' }]} onPress={() => setRecording(true)} activeOpacity={0.85}>
          <Ionicons name="mic" size={22} color="#fff" style={{ marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }} />
          <Text style={styles.takeNoteBtnText}>{isAR ? 'تسجيل ملاحظة' : 'Record Note'}</Text>
        </TouchableOpacity>
      </View>

      {/* Manual text note modal */}
      <ManualNoteModal
        visible={typing}
        onSave={handleSaveManualNote}
        onClose={() => setTyping(false)}
      />

      {/* Recording modal */}
      {recording && (
        <RecordingModal
          onSave={handleSaveRecording}
          onClose={() => setRecording(false)}
          authToken={token}
        />
      )}
      {selectedNote && (
        <NoteDetailModal note={selectedNote} onClose={() => setSelectedNote(null)} />
      )}
      </View>
    </SafeAreaView>
  );
}

/* ═══════════════════════════ Main Styles ═══════════════════════════ */
const styles = StyleSheet.create({
  safeTop: { flex: 1, backgroundColor: BRAND },
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: BRAND,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#1A1A1A' },
  list: { paddingBottom: 150 },
  noteItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  noteHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noteDuration: { fontSize: 11, color: '#BBB' },
  deleteBtn: { padding: 2 },
  noteTime: { fontSize: 12, color: '#999' },
  noteTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 4, lineHeight: 22 },
  notePreview: { fontSize: 13, color: '#777', lineHeight: 19, marginBottom: 8 },
  badgeRow: { flexDirection: 'row' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F2F2F2',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, color: '#888' },
  badgeAI: { backgroundColor: '#EDF5F3' },
  badgeAIText: { fontSize: 11, color: BRAND, fontWeight: '600' },
  separator: { height: 2 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EDF5F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#999', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#BBB', textAlign: 'center', lineHeight: 21 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  takeNoteBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: BRAND,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    marginLeft: 12,
  },
  takeNoteBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  textNoteBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/* ═══════════════════════════ Note Detail Styles ═══════════════════════════ */
const det = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 6 },
  scroll: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 4, lineHeight: 30 },
  meta: { fontSize: 12, color: '#999', marginBottom: 20 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F2F3F5',
    borderRadius: 12,
    padding: 3,
    marginBottom: 20,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: { fontSize: 14, color: '#999', fontWeight: '600' },
  tabTextActive: { color: BRAND },
  content: {},
  summaryCard: {
    backgroundColor: '#F8FAFB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 5,
  },
  summaryBadgeText: { fontSize: 12, fontWeight: '700', color: BRAND },
  summaryText: { fontSize: 15, color: '#333', lineHeight: 23 },
  stepsCard: {
    backgroundColor: '#FAFBFC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  stepsTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 },
  stepText: { fontSize: 14, color: '#444', lineHeight: 24 },
  feedbackRow: { alignItems: 'center', marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  feedbackQ: { fontSize: 13, color: '#999', marginBottom: 10 },
  feedbackBtns: { flexDirection: 'row', gap: 16 },
  thumbBtn: { backgroundColor: '#F2F2F2', borderRadius: 24, padding: 10 },
  emptyCard: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  noSpeech: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 22 },
  transcriptCard: {
    backgroundColor: '#F8FAFB',
    borderRadius: 14,
    padding: 16,
  },
  transcriptText: { fontSize: 15, color: '#333', lineHeight: 24 },
});

/* ═══════════════════════════ Recording Modal Styles ═══════════════════════════ */
const rc = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topArea: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  micRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  micRingPaused: { backgroundColor: '#F5F5F5' },
  noteTitle: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E34B4B' },
  statusLabel: { fontSize: 14, color: '#555' },
  statusLabelPaused: { color: '#AAA' },
  transcriptScroll: { flex: 1, marginHorizontal: 20 },
  transcriptContent: { paddingBottom: 24, minHeight: 80 },
  segmentText: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 24,
    marginBottom: 14,
  },
  speakerLabel: { fontWeight: '700', color: '#111' },
  liveText: { fontSize: 15, lineHeight: 24, marginBottom: 14 },
  partialText: { color: '#999', fontStyle: 'italic' },
  emptyHint: {
    fontSize: 14,
    color: '#BBB',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  inputHint: { fontSize: 13, color: '#999', marginBottom: 10 },
  noteInput: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 24,
    minHeight: 150,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#fff',
  },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },
  controlDisabled: { opacity: 0.55 },
  pauseBtnText: { fontSize: 14, fontWeight: '600', color: '#555' },
  timerWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E34B4B',
    fontVariant: ['tabular-nums'],
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  endBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

/* ═══════════════════════════ Manual Note Modal ═══════════════════════════ */
function ManualNoteModal({ visible, onSave, onClose }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setText('');
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [visible]);

  const handleSave = () => {
    if (!text.trim()) return onClose();
    onSave(text);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={mn.safe}>
        <View style={[mn.header, { paddingTop: Math.max(8, insets.top + 2) }]}>
          <TouchableOpacity onPress={onClose} style={mn.closeBtn}>
            <Text style={mn.closeText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={mn.title}>New Note</Text>
          <TouchableOpacity onPress={handleSave} style={mn.saveBtn}>
            <Text style={mn.saveText}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <TextInput
            ref={inputRef}
            multiline
            style={mn.input}
            placeholder="Type your note here..."
            placeholderTextColor="#94A3B8"
            value={text}
            onChangeText={setText}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const mn = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 16, color: '#64748B' },
  saveBtn: { backgroundColor: BRAND, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  input: {
    flex: 1,
    padding: 20,
    fontSize: 17,
    color: '#1E293B',
    lineHeight: 26,
    minHeight: 300,
    textAlignVertical: 'top',
  },
});
