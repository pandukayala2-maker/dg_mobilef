import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking, BackHandler,
} from 'react-native';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import BiometricGate from '@/components/BiometricGate';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONSENT_KEY = 'privacy_consent_v1';
const PRIVACY_URL = 'https://digicards.ansoftt.com/privacy.html';

SplashScreen.preventAutoHideAsync();

function PrivacyConsentModal({ visible, onAccept }) {
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Data & Privacy Notice</Text>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>
              Before you continue, please read how DG Cards collects and uses your data.
            </Text>

            <Text style={styles.sectionHead}>What we collect and why</Text>

            <Text style={styles.item}>
              <Text style={styles.bold}>• Location</Text> — Used to display your live location on your digital business card so contacts can find you. Location is only accessed while the app is open and only when you enable the sharing toggle.
            </Text>
            <Text style={styles.item}>
              <Text style={styles.bold}>• Contacts</Text> — Read and written when you save a received card to your phone's address book.
            </Text>
            <Text style={styles.item}>
              <Text style={styles.bold}>• Calendar</Text> — Read and written when you schedule or accept meetings through the app's CRM calendar feature.
            </Text>
            <Text style={styles.item}>
              <Text style={styles.bold}>• Camera</Text> — Used to scan QR codes on business cards and to capture a profile photo.
            </Text>
            <Text style={styles.item}>
              <Text style={styles.bold}>• Microphone</Text> — Used only for the AI Note Taker feature to record meeting audio when you start a recording session.
            </Text>
            <Text style={styles.item}>
              <Text style={styles.bold}>• Biometrics</Text> — Used optionally to lock and unlock the app with fingerprint or face recognition. Biometric data never leaves your device.
            </Text>
            <Text style={styles.item}>
              <Text style={styles.bold}>• Push Notifications</Text> — Used to send calendar reminders and contact updates.
            </Text>

            <Text style={styles.sectionHead}>Data storage</Text>
            <Text style={styles.body}>
              Your profile data is stored on our secure servers. We do not sell your personal information to third parties. You may delete your account and all associated data at any time from Settings.
            </Text>

            <Text style={styles.sectionHead}>Your privacy policy</Text>
            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
              <Text style={styles.link}>View full Privacy Policy</Text>
            </TouchableOpacity>

            <Text style={styles.body2}>
              By tapping "I Agree" you consent to the data practices described above and in the Privacy Policy.
            </Text>
          </ScrollView>

          <TouchableOpacity style={styles.agreeBtn} onPress={onAccept}>
            <Text style={styles.agreeTxt}>I Agree & Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.declineBtn} onPress={() => BackHandler.exitApp()}>
            <Text style={styles.declineTxt}>Decline & Exit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function RootLayout() {
  const [consentChecked, setConsentChecked] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    (async () => {
      const given = await AsyncStorage.getItem(CONSENT_KEY);
      if (!given) {
        setShowConsent(true);
      }
      setConsentChecked(true);
      SplashScreen.hideAsync();
    })();
  }, []);

  const handleAccept = async () => {
    await AsyncStorage.setItem(CONSENT_KEY, 'true');
    setShowConsent(false);
  };

  if (!consentChecked) return null;

  return (
    <SafeAreaProvider>
      <AppProvider>
        <AuthProvider>
          <BiometricGate>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
            <PrivacyConsentModal visible={showConsent} onAccept={handleAccept} />
          </BiometricGate>
        </AuthProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    maxHeight: '85%',
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 12,
    textAlign: 'center',
  },
  scroll: {
    maxHeight: 380,
  },
  intro: {
    fontSize: 14,
    color: '#444',
    marginBottom: 14,
    lineHeight: 20,
  },
  sectionHead: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a2e',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  item: {
    fontSize: 13,
    color: '#444',
    marginBottom: 8,
    lineHeight: 19,
  },
  bold: {
    fontWeight: '700',
    color: '#222',
  },
  body: {
    fontSize: 13,
    color: '#444',
    lineHeight: 19,
    marginBottom: 8,
  },
  body2: {
    fontSize: 12,
    color: '#666',
    lineHeight: 17,
    marginTop: 12,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  link: {
    fontSize: 13,
    color: '#0066cc',
    textDecorationLine: 'underline',
    marginBottom: 4,
  },
  agreeBtn: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  agreeTxt: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  declineBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  declineTxt: {
    color: '#888',
    fontSize: 13,
  },
});
