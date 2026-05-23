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
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/services/api';

const BRAND = '#1b4654';

export default function LoginScreen() {
  const router = useRouter();
  const { setToken, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const passwordRef = useRef(null);

  const toggleShowPass = () => {
    setShowPass((v) => !v);
    setTimeout(() => {
      passwordRef.current?.focus();
    }, 50);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password || !tenantSlug.trim()) {
      Alert.alert('Missing fields', 'Please enter your email, password, and workspace ID.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.login({
        email: email.trim().toLowerCase(),
        password,
        tenantSlug: tenantSlug.trim().toLowerCase(),
      });
      await setToken(data.token);
      setUser(data.user ?? data);
      router.replace('/(tabs)/mycard');
    } catch (err) {
      Alert.alert('Login Failed', err?.response?.data?.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

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
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image
              source={require('../../assets/appicon.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
            <Text style={styles.appName}>ANSOFTT DC</Text>
            <Text style={styles.tagline}>Your digital business card</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>Workspace ID</Text>
            <TextInput
              style={styles.input}
              placeholder="your-workspace"
              placeholderTextColor="#BBBBBB"
              autoCapitalize="none"
              returnKeyType="next"
              value={tenantSlug}
              onChangeText={setTenantSlug}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@company.com"
              placeholderTextColor="#BBBBBB"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainerRow}>
              <TextInput
                ref={passwordRef}
                style={styles.inputField}
                placeholder="••••••••"
                placeholderTextColor="#BBBBBB"
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity style={styles.eyeIconBtn} onPress={toggleShowPass}>
                <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color="#888" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Sign in</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 40 },
  logoWrap: { alignItems: 'center', marginBottom: 44 },
  logoImg: {
    width: 80,
    height: 80,
    marginBottom: 14,
  },
  appName: { fontSize: 26, fontWeight: '700', color: '#1A1A1A' },
  tagline: { fontSize: 14, color: '#999', marginTop: 4 },
  form: { width: '100%' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  inputContainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  inputField: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1A1A1A',
  },
  eyeIconBtn: {
    padding: 8,
  },
  btn: {
    backgroundColor: BRAND,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkRow: { alignItems: 'center', marginTop: 8 },
  linkText: { color: '#888', fontSize: 14 },
  linkBold: { color: BRAND, fontWeight: '700' },
});
