import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Platform, ActivityIndicator, Animated, AppState,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';

const BRAND = '#1b4654';

/**
 * Wraps the entire app.
 * – Shows biometric lock screen once on app launch if user is logged in and biometric is enrolled.
 * – Skipped automatically right after an interactive login (consumeSkipNextBiometric).
 * – Re-locks when returning from background so opening from app icon requires phone security.
 */
export default function BiometricGate({ children }) {
  const { token, loading, consumeSkipNextBiometric } = useAuth();

  const [ready,   setReady]   = useState(false);
  const [locked,  setLocked]  = useState(false);
  const [bioType, setBioType] = useState('fingerprint'); // 'fingerprint' | 'face'
  const [status,  setStatus]  = useState('idle');        // 'idle' | 'checking' | 'failed'

  const bioAvailable  = useRef(false);
  const inProgress    = useRef(false);
  const appStateRef   = useRef(AppState.currentState);
  const backgroundAtRef = useRef(0);
  const pulseAnim     = useRef(new Animated.Value(1)).current;
  const pulseLoopRef  = useRef(null);

  // ── Pulse animation ────────────────────────────────────────────────────────
  const startPulse = () => {
    pulseLoopRef.current?.stop();
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current.start();
  };

  const stopPulse = () => {
    pulseLoopRef.current?.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const scheduleAuth = () => {
    if (Platform.OS === 'web') return;
    if (AppState.currentState !== 'active') return;

    const run = () => {
      setTimeout(() => {
        if (AppState.currentState === 'active') {
          triggerAuth();
        }
      }, 250);
    };

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run);
      return;
    }

    run();
  };

  // ── Biometric authentication ───────────────────────────────────────────────
  const triggerAuth = async () => {
    if (inProgress.current) return;
    inProgress.current = true;
    setStatus('checking');
    startPulse();

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:         'Verify your identity to continue',
        fallbackLabel:         'Use PIN',
        cancelLabel:           'Cancel',
        disableDeviceFallback: false,
      });

      stopPulse();

      if (result.success) {
        setStatus('idle');
        setLocked(false);
      } else {
        setStatus('failed');
      }
    } catch (error) {
      stopPulse();
      const msg = String(error?.message || '').toLowerCase();

      if (msg.includes('current activity is no longer available')) {
        // Activity can be briefly unavailable during app startup/reload.
        setStatus('idle');
        setTimeout(() => {
          if (AppState.currentState === 'active') {
            triggerAuth();
          }
        }, 700);
      } else {
        setStatus('failed');
      }
    } finally {
      inProgress.current = false;
    }
  };

  // ── Boot: check hardware + enrollment once auth loads ─────────────────────
  useEffect(() => {
    if (loading) return;

    // Not logged in or web → never lock
    if (!token || Platform.OS === 'web') {
      setReady(true);
      return;
    }

    // Skip lock once right after interactive login.
    if (consumeSkipNextBiometric?.()) {
      setReady(true);
      setLocked(false);
      return;
    }

    (async () => {
      try {
        const [hasHW, enrolled, types] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ]);

        if (hasHW && enrolled) {
          bioAvailable.current = true;

          const isFace = types.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
          );
          setBioType(isFace ? 'face' : 'fingerprint');
          setLocked(true);
          setReady(true);

          // Trigger only when the activity is ready to avoid startup race conditions.
          scheduleAuth();
        } else {
          // Hardware unavailable or no biometric enrolled → pass through
          setReady(true);
        }
      } catch {
        // Never block app rendering if biometric availability check fails.
        setReady(true);
        setLocked(false);
      }
    })();
  }, [loading, token, consumeSkipNextBiometric]);

  // Re-lock whenever app comes back to foreground.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background') {
        backgroundAtRef.current = Date.now();
      }

      if (!token || !bioAvailable.current) return;

      const cameFromBackground = prevState === 'background';

      if (cameFromBackground && nextState === 'active') {
        // Ignore very short app-state bounces (permission overlays/system transitions).
        const elapsed = Date.now() - (backgroundAtRef.current || 0);
        if (elapsed < 1200) return;

        setLocked(true);
        setStatus('idle');
        scheduleAuth();
      }
    });

    return () => subscription.remove();
  }, [token]);


  // ── Render ─────────────────────────────────────────────────────────────────
  if (!ready)  return null; // SplashScreen is still visible
  if (!locked) return children;

  const bioIcon  = bioType === 'face' ? 'scan-circle-outline' : 'finger-print-outline';
  const bioLabel = bioType === 'face' ? 'Face ID' : 'Fingerprint';

  const statusLabel =
    status === 'checking' ? 'Verifying identity...' :
    status === 'failed'   ? 'Authentication failed' :
    `Unlock with ${bioLabel}`;

  return (
    <View style={styles.screen}>

      {/* ── Top: logo + name ── */}
      <View style={styles.top}>
        <Image
          source={require('../../assets/appicon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>ANSOFTT DC</Text>
        <Text style={styles.appSub}>Digital Business Card</Text>
      </View>

      {/* ── Center: biometric icon ── */}
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.iconRing,
            status === 'failed' && styles.iconRingFailed,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Ionicons name={bioIcon} size={72} color="#fff" />
        </Animated.View>

        <Text style={styles.statusLabel}>{statusLabel}</Text>

        {status === 'failed' && (
          <Text style={styles.errorHint}>
            Biometric not recognised. Please try again.
          </Text>
        )}
      </View>

      {/* ── Bottom: action button ── */}
      <View style={styles.bottom}>
        <TouchableOpacity
          style={[styles.btn, status === 'checking' && styles.btnDisabled]}
          onPress={triggerAuth}
          disabled={status === 'checking'}
          activeOpacity={0.8}
        >
          {status === 'checking' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons
                name={bioType === 'face' ? 'scan-outline' : 'finger-print'}
                size={20}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.btnText}>
                {status === 'failed' ? 'Try Again' : `Use ${bioLabel}`}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Your identity is verified locally on this device.
        </Text>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 50,
    paddingHorizontal: 32,
  },

  // Top section
  top: { alignItems: 'center' },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 16,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  appSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },

  // Center section
  center: { alignItems: 'center' },
  iconRing: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  iconRingFailed: {
    borderColor: '#FF8A80',
    backgroundColor: 'rgba(255,100,80,0.12)',
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 13,
    color: '#FF8A80',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Bottom section
  bottom: { alignItems: 'center', gap: 16 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 44,
    width: '100%',
  },
  btnDisabled: { opacity: 0.55 },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
});
