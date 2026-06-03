import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
  AppState,
  Image,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BRAND = '#1b4654';

export default function BiometricGate({ children }) {
  const { token, loading, consumeSkipNextBiometric } = useAuth();
  
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'checking' | 'failed'
  const [bioType, setBioType] = useState('fingerprint'); // 'face' | 'fingerprint'

  const bioAvailable = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const backgroundAtRef = useRef(0);
  const inProgress = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  // ── Pulsing Animation for the Ring ──────────────────────────────────────────
  const startPulse = () => {
    pulseAnim.setValue(1);
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    if (pulseLoop.current) {
      pulseLoop.current.stop();
      pulseLoop.current = null;
    }
    pulseAnim.setValue(1);
  };

  // ── Trigger Biometric Auth ───────────────────────────────────────────────
  const triggerAuth = async () => {
    if (inProgress.current || !bioAvailable.current) return;
    inProgress.current = true;
    setStatus('checking');
    startPulse();

    try {
      const bioLabel = bioType === 'face' ? 'Face ID' : 'Fingerprint';
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Unlock ANSOFTT DC with ${bioLabel}`,
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
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

  // ── Boot & Authentication setup ──────────────────────────────────────────
  useEffect(() => {
    if (loading) return;

    // 1. Not logged in or Web → never lock
    if (!token || Platform.OS === 'web') {
      setLocked(false);
      setReady(true);
      return;
    }

    // 2. Just logged in interactively → skip lock screen
    if (consumeSkipNextBiometric()) {
      setLocked(false);
      setReady(true);
      return;
    }

    // 3. Otherwise, check hardware and determine if lock is needed
    (async () => {
      try {
        const skipOnce = await AsyncStorage.getItem('skip_biometric_once');
        if (skipOnce === 'true') {
          await AsyncStorage.removeItem('skip_biometric_once');
          setLocked(false);
          setReady(true);
          return;
        }

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
          
          // Auto-trigger auth prompt on startup
          setTimeout(() => {
            triggerAuth();
          }, 350);
        } else {
          // No hardware or not enrolled
          setLocked(false);
          setReady(true);
        }
      } catch (err) {
        setLocked(false);
        setReady(true);
      }
    })();
  }, [loading, token]);

  // ── Re-lock on coming from background ─────────────────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        // If biometrics are in progress, the background transition is due to the prompt.
        // We set this to 0 to signal we should ignore the transition when returning active.
        backgroundAtRef.current = inProgress.current ? 0 : Date.now();
        
        // Immediately overlay the lock screen so OS snapshots don't leak sensitive data
        if (!inProgress.current && token && bioAvailable.current) {
          setLocked(true);
        }
      }

      if (!token || !bioAvailable.current) return;

      if (prevState === 'background' && nextState === 'active') {
        const bgTime = backgroundAtRef.current;
        if (bgTime === 0) {
          // Came back from biometric prompt, ignore this transition to prevent re-locking loops
          return;
        }
        // Ignore short background transitions (e.g. key manager, system prompts) under 30 seconds
        const elapsed = Date.now() - bgTime;
        if (elapsed < 30000) {
          setLocked(false); // unlock if it was just covered for snapshot
          return;
        }

        setLocked(true);
        setStatus('idle');
        setTimeout(() => {
          triggerAuth();
        }, 350);
      }
    });

    return () => subscription.remove();
  }, [token]);

  // ── Renders ───────────────────────────────────────────────────────────────
  if (!ready) return null; // Keep Splash active

  const bioIcon = bioType === 'face' ? 'scan-outline' : 'finger-print-outline';
  const bioLabel = bioType === 'face' ? 'Face ID' : 'Fingerprint';
  let statusLabel = 'Tap to unlock';
  if (status === 'checking') statusLabel = 'Verifying...';
  if (status === 'failed') statusLabel = 'Failed';

  return (
    <View style={{ flex: 1 }}>
      {/* ALWAYS render children to preserve state and navigation history! */}
      {children}
      
      {/* Overlay the lock screen when locked */}
      {locked && (
        <View style={[StyleSheet.absoluteFill, styles.screen, { zIndex: 99999, elevation: 99999 }]}>
          {/* Top Section */}
          <View style={styles.top}>
            <Image
              source={require('../../assets/appicon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>ANSOFTT DC</Text>
            <Text style={styles.appSub}>Digital Business Card</Text>
          </View>

          {/* Center Biometric Ring */}
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
                Biometric not recognized. Please try again.
              </Text>
            )}
          </View>

          {/* Bottom Button */}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 50,
    paddingHorizontal: 32,
  },
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
