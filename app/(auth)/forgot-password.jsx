import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '@/services/api';

const BRAND = '#1b4654';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // State for toggling password visibility
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // States for input focus styling
  const [focusSlug, setFocusSlug] = useState(false);
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusPass, setFocusPass] = useState(false);
  const [focusConfirm, setFocusConfirm] = useState(false);
  
  const [success, setSuccess] = useState(false);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const handleReset = async () => {
    if (!tenantSlug.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match. Please re-enter.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/card-user/direct-reset', {
        email: email.trim().toLowerCase(),
        password,
        tenantSlug: tenantSlug.trim().toLowerCase(),
      });
      setSuccess(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Unable to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#10b981" />
          </View>
          <Text style={styles.successTitle}>Password Updated!</Text>
          <Text style={styles.successSub}>
            Your password has been reset successfully. You can now sign in with your new credentials.
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.btnText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header section with brand Logo */}
          <View style={styles.logoWrap}>
            <Image
              source={require('../../assets/appicon.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Reset Password</Text>
            <Text style={styles.tagline}>Set a new password for your cardholder account</Text>
          </View>

          {/* Clean Form Card Layout */}
          <View style={styles.formCard}>
            
            {/* Workspace Input */}
            <Text style={styles.label}>Workspace ID</Text>
            <View style={[
              styles.inputWrapper,
              focusSlug && { borderColor: BRAND, borderWidth: 1.5, backgroundColor: '#FFFFFF' }
            ]}>
              <Ionicons name="briefcase-outline" size={20} color={focusSlug ? BRAND : '#888888'} style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="your-workspace"
                placeholderTextColor="#BBBBBB"
                autoCapitalize="none"
                returnKeyType="next"
                onFocus={() => setFocusSlug(true)}
                onBlur={() => setFocusSlug(false)}
                value={tenantSlug}
                onChangeText={setTenantSlug}
              />
            </View>

            {/* Email Input */}
            <Text style={styles.label}>Email Address</Text>
            <View style={[
              styles.inputWrapper,
              focusEmail && { borderColor: BRAND, borderWidth: 1.5, backgroundColor: '#FFFFFF' }
            ]}>
              <Ionicons name="mail-outline" size={20} color={focusEmail ? BRAND : '#888888'} style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="you@company.com"
                placeholderTextColor="#BBBBBB"
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                onFocus={() => setFocusEmail(true)}
                onBlur={() => setFocusEmail(false)}
                onSubmitEditing={() => passwordRef.current?.focus()}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* New Password Input */}
            <Text style={styles.label}>New Password</Text>
            <View style={[
              styles.inputWrapper,
              focusPass && { borderColor: BRAND, borderWidth: 1.5, backgroundColor: '#FFFFFF' }
            ]}>
              <Ionicons name="lock-closed-outline" size={20} color={focusPass ? BRAND : '#888888'} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={styles.inputField}
                placeholder="Enter new password (min. 6 chars)"
                placeholderTextColor="#BBBBBB"
                secureTextEntry={!showPass}
                returnKeyType="next"
                onFocus={() => setFocusPass(true)}
                onBlur={() => setFocusPass(false)}
                onSubmitEditing={() => confirmRef.current?.focus()}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity style={styles.eyeIconBtn} onPress={() => setShowPass(v => !v)} hitSlop={12}>
                <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color="#888" />
              </TouchableOpacity>
            </View>

            {/* Confirm Password Input */}
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={[
              styles.inputWrapper,
              focusConfirm && { borderColor: BRAND, borderWidth: 1.5, backgroundColor: '#FFFFFF' }
            ]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={focusConfirm ? BRAND : '#888888'} style={styles.inputIcon} />
              <TextInput
                ref={confirmRef}
                style={styles.inputField}
                placeholder="Verify new password"
                placeholderTextColor="#BBBBBB"
                secureTextEntry={!showConfirm}
                returnKeyType="done"
                onFocus={() => setFocusConfirm(true)}
                onBlur={() => setFocusConfirm(false)}
                onSubmitEditing={handleReset}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity style={styles.eyeIconBtn} onPress={() => setShowConfirm(v => !v)} hitSlop={12}>
                <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color="#888" />
              </TouchableOpacity>
            </View>

            {/* Reset Button */}
            <TouchableOpacity 
              style={[styles.btn, loading && { opacity: 0.8 }]} 
              onPress={handleReset} 
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Bottom Navigation Back to Sign In Link */}
          <TouchableOpacity style={styles.linkRow} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.linkText}>
              <Ionicons name="arrow-back" size={14} color="#888888" />{' '}
              Back to <Text style={styles.linkBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  logoWrap: { alignItems: 'center', marginBottom: 28 },
  logoImg: { width: 72, height: 72, marginBottom: 12 },
  appName: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: '#64748B', marginTop: 4, textAlign: 'center', paddingHorizontal: 16 },
  formCard: { 
    width: '100%', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 20, 
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 4,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    height: '100%',
    fontWeight: '500',
  },
  eyeIconBtn: { padding: 6 },
  btn: {
    backgroundColor: BRAND,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 26,
    marginBottom: 8,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
  linkRow: { alignItems: 'center', marginTop: 24, paddingVertical: 8 },
  linkText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  linkBold: { color: BRAND, fontWeight: '700' },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#FFFFFF',
  },
  successIcon: { marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 12, letterSpacing: -0.5 },
  successSub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
});
