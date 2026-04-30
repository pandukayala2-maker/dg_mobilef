import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  Image,
  Linking,
  Modal,
  StatusBar,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { cardsApi, authApi, API_BASE_URL, FRONTEND_BASE_URL } from '@/services/api';
import { useAppContext } from '@/context/AppContext';

const BRAND = '#1b4654';
const SCREEN_WIDTH = Dimensions.get('window').width;

/* ─── helpers ─── */
const resolveUrl = (val) => {
  if (!val) return null;
  if (val.startsWith('data:')) return val;
  const base = API_BASE_URL.replace(/\/api$/, '');
  if (val.includes('localhost') || val.includes('127.0.0.1')) {
    const match = val.match(/\/uploads\/.+/);
    return match ? `${base}${match[0]}` : null;
  }
  if (val.startsWith('http')) return val;
  return `${base}${val}`;
};

const parseDigCardPath = (value) => {
  if (!value) return null;
  const t = String(value);
  const m = t.match(/\/card\/([^/]+)\/([^/?#]+)/) || t.match(/\/c\/([^/]+)\/([^/?#]+)/);
  return m ? { tenantSlug: m[1], cardSlug: m[2] } : null;
};

/* ─── Sidebar Drawer ─── */
function SidebarDrawer({ visible, onClose, user, onLogout, avatarUrl }) {
  const translateX = useState(new Animated.Value(-SCREEN_WIDTH * 0.75))[0];
  const { isDark, toggleTheme, language, changeLanguage } = useAppContext();

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -SCREEN_WIDTH * 0.75,
      duration: 260,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible]);

  if (!visible) return null;

  const initials = (user?.name || 'U').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  const bg = isDark ? '#1E293B' : '#fff';
  const text = isDark ? '#F8FAFC' : '#1A1A1A';
  const subtext = isDark ? '#94A3B8' : '#64748B';
  const divider = isDark ? '#334155' : '#F0F0F0';

  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={sd.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[sd.panel, { transform: [{ translateX }], backgroundColor: bg }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView>
            <View style={sd.profileSection}>
              {avatarUrl
                ? <Image source={{ uri: avatarUrl }} style={sd.avatar} />
                : <View style={[sd.avatar, sd.avatarFallback]}>
                    <Text style={sd.avatarInitial}>{initials}</Text>
                  </View>}
              <Text style={sd.name} numberOfLines={1}>{user?.name || 'User'}</Text>
              <Text style={sd.email} numberOfLines={1}>{user?.email || ''}</Text>
            </View>

            <View style={[sd.divider, { backgroundColor: divider }]} />

            <View style={sd.menu}>
              <TouchableOpacity style={sd.menuItem} onPress={onClose}>
                <View style={[sd.menuIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#EDF5F3' }]}>
                  <Text style={{ fontSize: 16 }}>💳</Text>
                </View>
                <Text style={[sd.menuLabel, { color: text }]}>{language === 'ar' ? 'بطاقتي' : 'My Card'}</Text>
              </TouchableOpacity>

              <View style={sd.menuItem}>
                <View style={[sd.menuIcon, { backgroundColor: isDark ? 'rgba(0,96,100,0.2)' : '#E0F7FA' }]}>
                  <Ionicons name="language-outline" size={20} color={isDark ? '#4DD0E1' : '#006064'} />
                </View>
                <Text style={[sd.menuLabel, { flex: 1, color: text }]}>{language === 'ar' ? 'اللغة' : 'Language'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#334155' : '#F1F5F9', borderRadius: 20, padding: 4 }}>
                  <TouchableOpacity
                    onPress={() => changeLanguage('en')}
                    style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: language === 'en' ? (isDark ? '#1E293B' : '#fff') : 'transparent', borderRadius: 16 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: language === 'en' ? (isDark ? '#fff' : BRAND) : subtext }}>EN</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => changeLanguage('ar')}
                    style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: language === 'ar' ? (isDark ? '#1E293B' : '#fff') : 'transparent', borderRadius: 16 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: language === 'ar' ? (isDark ? '#fff' : BRAND) : subtext }}>ع</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={sd.menuItem}>
                <View style={[sd.menuIcon, { backgroundColor: isDark ? 'rgba(74,20,140,0.3)' : '#F3E5F5' }]}>
                  <Ionicons name="moon-outline" size={20} color={isDark ? '#E1BEE7' : '#4A148C'} />
                </View>
                <Text style={[sd.menuLabel, { flex: 1, color: text }]}>{language === 'ar' ? 'الوضع الداكن' : 'Dark Mode'}</Text>
                <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#CBD5E1', true: BRAND }} />
              </View>

              <TouchableOpacity 
                style={sd.menuItem} 
                onPress={() => Linking.openURL('mailto:anintl.ind@gmail.com?subject=DigCard Support Request')}
              >
                <View style={[sd.menuIcon, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2' }]}>
                  <Ionicons name="help-buoy-outline" size={20} color="#EF4444" />
                </View>
                <Text style={[sd.menuLabel, { color: text }]}>{language === 'ar' ? 'الدعم الفني' : 'Support'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={{ paddingVertical: 16 }}>
            <TouchableOpacity style={sd.signOutBtn} onPress={onLogout}>
              <Text style={sd.signOutText}>{language === 'ar' ? 'تسجيل خروج' : 'Sign Out'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

/* ─── Share option row ─── */
function ShareRow({ icon, label, onPress, isLast, customIcon }) {
  return (
    <TouchableOpacity style={[sh.row, !isLast && sh.rowBorder]} onPress={onPress} activeOpacity={0.7}>
      <View style={sh.rowIconWrap}>
        {customIcon || <Ionicons name={icon} size={22} color="#fff" />}
      </View>
      <Text style={sh.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.35)" />
    </TouchableOpacity>
  );
}

/* ─── Email sub-screen ─── */
function EmailScreen({ onBack, cardUrl, displayName }) {
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('Hi, tap this link to get my business card:');
  const send = () => {
    if (!to.trim()) { Alert.alert('Required', 'Enter a recipient email.'); return; }
    Linking.openURL(`mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(`${displayName}'s Digital Card`)}&body=${encodeURIComponent(`${message}\n\n${cardUrl}`)}`);
  };
  return (
    <KeyboardAvoidingView style={sub.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={sub.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12}><Ionicons name="chevron-back" size={26} color="#fff" /></TouchableOpacity>
        <Text style={sub.headerTitle}>Email Your Card</Text>
        <TouchableOpacity onPress={send} hitSlop={12}><Text style={sub.headerAction}>SEND</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={sub.body} keyboardShouldPersistTaps="handled">
        <View style={sub.card}>
          <Text style={sub.cardLabel}>To...</Text>
          <TextInput style={sub.input} placeholder="recipient@email.com" placeholderTextColor="rgba(255,255,255,0.4)" value={to} onChangeText={setTo} keyboardType="email-address" autoCapitalize="none" />
        </View>
        <View style={sub.card}>
          <Text style={sub.cardLabel}>Message...</Text>
          <TextInput style={[sub.input, { minHeight: 60 }]} multiline value={message} onChangeText={setMessage} placeholderTextColor="rgba(255,255,255,0.4)" />
        </View>
        <TouchableOpacity style={sub.sendBtn} onPress={send} activeOpacity={0.85}>
          <Ionicons name="send" size={18} color={BRAND} style={{ marginRight: 8 }} />
          <Text style={sub.sendBtnText}>SEND EMAIL</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─── Text sub-screen ─── */
function TextScreen({ onBack, cardUrl }) {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('Hi, tap this link to get my business card:');
  const send = () => Linking.openURL(phone.trim() ? `sms:${encodeURIComponent(phone.trim())}?body=${encodeURIComponent(`${message}\n${cardUrl}`)}` : `sms:?body=${encodeURIComponent(`${message}\n${cardUrl}`)}`);
  return (
    <KeyboardAvoidingView style={sub.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={sub.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12}><Ionicons name="chevron-back" size={26} color="#fff" /></TouchableOpacity>
        <Text style={sub.headerTitle}>Text Your Card</Text>
        <TouchableOpacity onPress={send} hitSlop={12}><Text style={sub.headerAction}>SEND</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={sub.body} keyboardShouldPersistTaps="handled">
        <View style={sub.card}>
          <Text style={sub.cardLabel}>Phone number...</Text>
          <TextInput style={sub.input} placeholder="Phone number" placeholderTextColor="rgba(255,255,255,0.4)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </View>
        <View style={sub.card}>
          <Text style={sub.cardLabel}>Message...</Text>
          <TextInput style={[sub.input, { minHeight: 60 }]} multiline value={message} onChangeText={setMessage} placeholderTextColor="rgba(255,255,255,0.4)" />
        </View>
        <TouchableOpacity style={sub.sendBtn} onPress={send} activeOpacity={0.85}>
          <Ionicons name="send" size={18} color={BRAND} style={{ marginRight: 8 }} />
          <Text style={sub.sendBtnText}>SEND TEXT</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─── WhatsApp sub-screen ─── */
function WhatsAppScreen({ onBack, cardUrl }) {
  const [countryCode, setCountryCode] = useState('+965');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('Hi, tap this link to get my business card:');
  const send = () => {
    const num = `${countryCode}${phone}`.replace(/[^+\d]/g, '');
    if (num.length > 4) Linking.openURL(`https://wa.me/${num.replace('+', '')}?text=${encodeURIComponent(`${message}\n${cardUrl}`)}`);
    else Linking.openURL(`whatsapp://send?text=${encodeURIComponent(`${message}\n${cardUrl}`)}`);
  };
  return (
    <KeyboardAvoidingView style={sub.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={sub.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12}><Ionicons name="chevron-back" size={26} color="#fff" /></TouchableOpacity>
        <Text style={sub.headerTitle}>Send via WhatsApp</Text>
        <TouchableOpacity onPress={send} hitSlop={12}><Text style={sub.headerAction}>SEND</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={sub.body} keyboardShouldPersistTaps="handled">
        <View style={sub.card}>
          <Text style={sub.cardLabel}>Number...</Text>
          <View style={{ flexDirection: 'row' }}>
            <TextInput style={[sub.input, { width: 60, marginRight: 8 }]} value={countryCode} onChangeText={setCountryCode} keyboardType="phone-pad" />
            <TextInput style={[sub.input, { flex: 1 }]} placeholder="Phone number" placeholderTextColor="rgba(255,255,255,0.4)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
        </View>
        <View style={sub.card}>
          <Text style={sub.cardLabel}>Message...</Text>
          <TextInput style={[sub.input, { minHeight: 60 }]} multiline value={message} onChangeText={setMessage} placeholderTextColor="rgba(255,255,255,0.4)" />
        </View>
        <TouchableOpacity style={sub.sendBtn} onPress={send} activeOpacity={0.85}>
          <Ionicons name="send" size={18} color={BRAND} style={{ marginRight: 8 }} />
          <Text style={sub.sendBtnText}>SEND MESSAGE</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ═══════════════════════ Share Modal ═══════════════════════ */
function ShareModal({ visible, onClose, cardUrl, displayName, cardId, cardSlug, tenantSlug }) {
  const [walletLoading, setWalletLoading] = useState(false);
  const [subScreen, setSubScreen] = useState(null);
  const qrSvgRef = useRef(null);
  const insets = useSafeAreaInsets();

  const shareMsg = `Check out my digital business card: ${cardUrl}`;

  const copyLink = async () => {
    try { await Clipboard.setStringAsync(cardUrl); Alert.alert('Copied!', 'Card link copied to clipboard.'); }
    catch { Alert.alert('Error', 'Could not copy link.'); }
  };

  const sendOther = async () => {
    try { await Share.share({ message: shareMsg, url: cardUrl }); } catch {}
  };

  const saveQRToPhotos = async () => {
    if (!qrSvgRef.current?.toDataURL) { Alert.alert('Error', 'QR not ready. Try again.'); return; }
    try {
      const base64 = await new Promise((res, rej) => qrSvgRef.current.toDataURL(d => d ? res(d) : rej(new Error('Empty'))));
      const clean = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
      const uri = `${FileSystem.cacheDirectory}qrcode_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(uri, clean, { encoding: 'base64' });
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.status === 'granted') {
        const asset = await MediaLibrary.createAssetAsync(uri);
        const album = await MediaLibrary.getAlbumAsync('ANSOFTT DC');
        album ? await MediaLibrary.addAssetsToAlbumAsync([asset], album, false) : await MediaLibrary.createAlbumAsync('ANSOFTT DC', asset, false);
        Alert.alert('Saved', 'QR code saved to your photos.');
      } else {
        const can = await Sharing.isAvailableAsync();
        can ? await Sharing.shareAsync(uri, { mimeType: 'image/png' }) : Alert.alert('Error', 'Permission denied.');
      }
    } catch (err) { Alert.alert('Error', err?.message || 'Could not save QR.'); }
  };

  const addToWallet = async () => {
    if ((!tenantSlug || !cardSlug) && !cardId) { Alert.alert('Unavailable', 'Card info not found.'); return; }
    setWalletLoading(true);
    try {
      let walletUrl = null;
      if (tenantSlug && cardSlug) {
        try { const { data } = await cardsApi.getPublicWalletPass(tenantSlug, cardSlug); walletUrl = data?.walletUrl; } catch {}
      }
      if (!walletUrl && cardId) { const { data } = await cardsApi.getWalletPass(cardId); walletUrl = data?.walletUrl; }
      walletUrl ? await Linking.openURL(walletUrl) : Alert.alert('Error', 'Could not generate wallet pass.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed.');
    } finally { setWalletLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView style={sh.safe}>
        {subScreen === 'email' && <EmailScreen onBack={() => setSubScreen(null)} cardUrl={cardUrl} displayName={displayName} />}
        {subScreen === 'text' && <TextScreen onBack={() => setSubScreen(null)} cardUrl={cardUrl} />}
        {subScreen === 'whatsapp' && <WhatsAppScreen onBack={() => setSubScreen(null)} cardUrl={cardUrl} />}

        {!subScreen && (
          <>
            <StatusBar barStyle="light-content" backgroundColor={BRAND} />
            <View style={[sh.header, { paddingTop: Math.max(insets.top, 8) + 6 }]}>
              <TouchableOpacity onPress={() => { setSubScreen(null); onClose(); }} hitSlop={12} style={sh.headerBtn}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={sh.headerTitle}>Send Your Card</Text>
              <View style={sh.headerBtn} />
            </View>

            <ScrollView contentContainerStyle={sh.scroll} showsVerticalScrollIndicator={false}>
              {cardUrl ? (
                <View style={sh.qrWrap}>
                  <View style={sh.qrBox}>
                    <QRCode value={cardUrl} size={210} color="#111" backgroundColor="#fff" getRef={r => { qrSvgRef.current = r; }} />
                  </View>
                  <Text style={sh.qrText}>Point your camera at the QR{'\n'}code to receive the card</Text>
                </View>
              ) : null}

              <View style={sh.group}>
                <ShareRow icon="copy-outline" label="Copy link" onPress={copyLink} isLast />
              </View>

              <View style={sh.group}>
                <ShareRow icon="chatbubble-outline" label="Text your card" onPress={() => setSubScreen('text')} />
                <ShareRow icon="mail-outline" label="Email your card" onPress={() => setSubScreen('email')} />
                <ShareRow label="Send via WhatsApp" onPress={() => setSubScreen('whatsapp')}
                  customIcon={<View style={[sh.brandBadge, { backgroundColor: '#25D366' }]}><Ionicons name="logo-whatsapp" size={16} color="#fff" /></View>} />
                <ShareRow label="Send via LinkedIn" onPress={() => Linking.openURL(`https://www.linkedin.com/messaging/compose/?body=${encodeURIComponent(`${shareMsg}`)}`)}
                  customIcon={<View style={[sh.brandBadge, { backgroundColor: '#0A66C2' }]}><Text style={sh.liText}>in</Text></View>} />
                <ShareRow icon="ellipsis-horizontal" label="Send another way" onPress={sendOther} isLast />
              </View>

              <View style={sh.group}>
                <ShareRow label="Post to LinkedIn" onPress={() => Linking.openURL(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(cardUrl)}`)}
                  customIcon={<View style={[sh.brandBadge, { backgroundColor: '#0A66C2' }]}><Text style={sh.liText}>in</Text></View>} />
                <ShareRow label="Post to Facebook" onPress={() => Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(cardUrl)}`)} isLast
                  customIcon={<View style={[sh.brandBadge, { backgroundColor: '#1877F2' }]}><Ionicons name="logo-facebook" size={17} color="#fff" /></View>} />
              </View>

              <View style={sh.group}>
                <ShareRow label="Save QR to photos" onPress={saveQRToPhotos}
                  customIcon={<View style={[sh.brandBadge, { backgroundColor: 'transparent' }]}><Text style={{ fontSize: 22 }}>🖼️</Text></View>} />
                <ShareRow icon="paper-plane-outline" label="Send QR code" onPress={() => Share.share({ message: `${shareMsg}\n\nScan the QR or open the link.`, url: cardUrl }).catch(() => {})} isLast />
              </View>

              <View style={sh.group}>
                <TouchableOpacity style={sh.row} onPress={addToWallet} activeOpacity={0.7} disabled={walletLoading}>
                  <View style={sh.rowIconWrap}>
                    {walletLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="wallet-outline" size={22} color="#fff" />}
                  </View>
                  <Text style={[sh.rowLabel, { flex: 1 }]}>{walletLoading ? 'Opening wallet…' : 'Add card to wallet'}</Text>
                  <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.35)" />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

/* ═══════════════════════════════ Main Screen ═══════════════════════════════ */
export default function MyCardScreen() {
  const { user, logout } = useAuth();
  const { isDark: isAppDark } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [cardUrl, setCardUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [cardId, setCardId] = useState(null);
  const [cardSlug, setCardSlug] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [webLoading, setWebLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [upcomingMeeting, setUpcomingMeeting] = useState(null);

  const fetchUpcoming = useCallback(async () => {
    try {
      const { data } = await cardsApi.getMeetings();
      const list = data.meetings || [];
      // Check if any meeting is "tomorrow"
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDateStr = tomorrow.toISOString().split('T')[0];
      
      const found = list.find(m => m.time.startsWith(tomorrowDateStr));
      setUpcomingMeeting(found || null);
    } catch {}
  }, []);

  useEffect(() => { fetchUpcoming(); }, [fetchUpcoming]);

  const handleLogout = () => {
    const go = async () => { await logout(); router.replace('/(auth)/login'); };
    if (Platform.OS === 'web') { if (window.confirm('Sign out?')) go(); return; }
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: go },
    ]);
  };

  const fetchCard = useCallback(async () => {
    setLoading(true);
    try {
      if (user?.role === 'card_user') {
        // Use slugs stored at login time — no API call needed
        const tSlug = user?.tenant_slug || '';
        const cSlug = user?.card_slug || parseDigCardPath(user?.card_url)?.cardSlug || '';

        if (tSlug && cSlug) {
          setTenantSlug(tSlug);
          setCardSlug(cSlug);
          setCardId(user?.card_id || null);
          setDisplayName(user?.name || 'My Card');
          setCardUrl(`${FRONTEND_BASE_URL}/#/card/${tSlug}/${cSlug}`);

          // Non-blocking: enrich avatar/name from slug endpoint
          authApi.getCardSlug().then(({ data }) => {
            if (data?.profile_image) setAvatarUrl(resolveUrl(data.profile_image));
            if (data?.name) setDisplayName(data.name);
          }).catch(() => {});
          return;
        }

        // Fallback: dedicated slug endpoint — finds card by card_email when card_id is stale
        try {
          const { data } = await authApi.getCardSlug();
          const ts = data?.tenant_slug || user?.tenant_slug || '';
          const cs = data?.card_slug || parseDigCardPath(data?.card_url)?.cardSlug || '';
          if (ts && cs) {
            setTenantSlug(ts);
            setCardSlug(cs);
            setCardId(data?.card_id || user?.card_id || null);
            setDisplayName(data?.name || user?.name || 'My Card');
            if (data?.profile_image) setAvatarUrl(resolveUrl(data.profile_image));
            setCardUrl(`${FRONTEND_BASE_URL}/#/card/${ts}/${cs}`);
          }
        } catch (err) {
          console.warn('[fetchCard card_user slug]', err?.response?.status, err?.message);
        }
      } else {
        // Admin / sub_admin
        const { data } = await cardsApi.getAll();
        const cards = Array.isArray(data) ? data : data?.cards ?? [];
        if (!cards.length) return;
        const cardData = cards[0];
        const tSlug =
          user?.tenant_slug || user?.schema_slug || user?.schemaSlug ||
          cardData?.tenant_slug || cardData?.schema_slug ||
          parseDigCardPath(cardData?.card_url)?.tenantSlug || '';
        const cSlug = cardData?.slug || parseDigCardPath(cardData?.card_url)?.cardSlug || '';
        setCardId(cardData.id);
        setTenantSlug(tSlug);
        setCardSlug(cSlug);
        setDisplayName(cardData.name || user?.name || 'My Card');
        setAvatarUrl(resolveUrl(cardData.profile_image));
        if (tSlug && cSlug) setCardUrl(`${FRONTEND_BASE_URL}/#/card/${tSlug}/${cSlug}`);
        else if (cardData?.card_url) {
          const raw = String(cardData.card_url).replace(/^#?\/?/, '');
          setCardUrl(`${FRONTEND_BASE_URL}/#${raw}`);
        }
      }
    } catch (err) {
      console.warn('[fetchCard]', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchCard(); }, [fetchCard]);

  const pageBg = isAppDark ? '#0F172A' : '#F3F4F6';
  const footerBg = isAppDark ? 'rgba(15,23,42,0.97)' : 'rgba(243,244,246,0.97)';

  return (
    <View style={{ flex: 1, backgroundColor: BRAND }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} translucent={false} />

      {/* ── Top bar ── */}
      <View style={[s.topBar, { paddingTop: (insets.top || 0) + 12 }]}>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} hitSlop={10} style={s.menuBtn}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={s.menuAvatar} />
            : <View style={s.menuAvatarFallback}>
                <Text style={s.menuAvatarText}>{(user?.name || 'U').charAt(0).toUpperCase()}</Text>
              </View>}
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>{displayName || 'My Card'}</Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            style={[s.logoutBtn, { marginRight: 12 }]} 
            onPress={() => {
              if (upcomingMeeting) {
                Alert.alert(
                  'Meeting Reminder',
                  `You have an upcoming meeting: "${upcomingMeeting.title}" tomorrow.`,
                  [
                    { text: 'Later', style: 'cancel' },
                    { text: 'View Calendar', onPress: () => router.push('/calendar') }
                  ]
                );
              } else {
                router.push('/calendar');
              }
            }}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {upcomingMeeting && <View style={s.badge} />}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLogout} style={s.logoutBtn} hitSlop={10}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Content ── */}
      <View style={{ flex: 1, backgroundColor: pageBg }}>
        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} color={BRAND} size="large" />
        ) : cardUrl ? (
          <>
            {/* WebView renders EXACTLY the same card as the public web page */}
            <WebView
              source={{ uri: cardUrl }}
              style={{ flex: 1, backgroundColor: pageBg }}
              startInLoadingState
              onLoadStart={() => setWebLoading(true)}
              onLoadEnd={() => setWebLoading(false)}
              renderLoading={() => (
                <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center', backgroundColor: pageBg }]}>
                  <ActivityIndicator color={BRAND} size="large" />
                </View>
              )}
              // Inject CSS to remove the web page's own share/action buttons
              // so the mobile native Share button handles sharing
              injectedJavaScriptBeforeContentLoaded={`
                (function() {
                  var style = document.createElement('style');
                  style.textContent = '.space-y-2\\.5 { display: none !important; } body { -webkit-user-select: none; }';
                  document.head.appendChild(style);
                })();
                true;
              `}
              injectedJavaScript={`
                (function() {
                  // Hide the Share Details + Visit Website buttons after React renders
                  function hideButtons() {
                    var els = document.querySelectorAll('button, a[href]');
                    els.forEach(function(el) {
                      var t = el.textContent || '';
                      if (t.includes('Share Details') || t.includes('Visit Website')) {
                        el.style.display = 'none';
                      }
                    });
                  }
                  setTimeout(hideButtons, 800);
                  setTimeout(hideButtons, 2000);
                })();
                true;
              `}
              allowsFullscreenVideo={false}
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
              onShouldStartLoadWithRequest={(req) => {
                // Allow same-origin (digicards.ansoftt.com) and about:blank
                if (!req.url || req.url === 'about:blank') return true;
                const base = FRONTEND_BASE_URL.replace(/\/$/, '');
                if (req.url.startsWith(base) || req.url.startsWith('https://digicards.ansoftt.com')) return true;
                // Open external links (mailto, tel, https external) in device browser
                Linking.openURL(req.url).catch(() => {});
                return false;
              }}
            />
          </>
        ) : (
          /* No card found */
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
            <Ionicons name="card-outline" size={64} color={BRAND} style={{ opacity: 0.3, marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: BRAND, textAlign: 'center', marginBottom: 8 }}>No Card Found</Text>
            <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 }}>
              Ask your admin to set up your digital card.
            </Text>
            <TouchableOpacity style={[s.shareBtn, { marginTop: 24, paddingHorizontal: 32 }]} onPress={fetchCard}>
              <Ionicons name="refresh-outline" size={17} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.shareBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Share button (native) ── */}
        {cardUrl ? (
          <View style={[s.footer, { backgroundColor: footerBg }]}>
            <TouchableOpacity style={s.shareBtn} onPress={() => setShareOpen(true)}>
              <Ionicons name="paper-plane-outline" size={17} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.shareBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <ShareModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        cardUrl={cardUrl}
        displayName={displayName}
        cardId={cardId}
        cardSlug={cardSlug}
        tenantSlug={tenantSlug}
      />

      <SidebarDrawer
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={{ ...user, name: displayName || user?.name }}
        avatarUrl={avatarUrl}
        onLogout={() => { setSidebarOpen(false); handleLogout(); }}
      />
    </View>
  );
}

/* ════════════ Styles ════════════ */
const s = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 16, paddingHorizontal: 16, backgroundColor: BRAND,
  },
  topTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  menuBtn: { padding: 2 },
  menuAvatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  menuAvatarFallback: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
  },
  menuAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  logoutBtn: { padding: 4 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5252',
    borderWidth: 1.5,
    borderColor: BRAND,
  },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 24, paddingTop: 12, paddingHorizontal: 40,
  },
  shareBtn: {
    backgroundColor: BRAND, borderRadius: 28, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

const sh = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  headerBtn: { width: 36, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  qrWrap: { alignItems: 'center', marginBottom: 22, marginTop: 4 },
  qrBox: { backgroundColor: '#fff', borderRadius: 22, padding: 18, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  qrText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '500', textAlign: 'center', marginTop: 16, lineHeight: 22 },
  group: { backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 14, marginBottom: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.18)' },
  rowIconWrap: { width: 32, marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 16, fontWeight: '500', color: '#fff' },
  brandBadge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  liText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

const sub = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerAction: { fontSize: 15, fontWeight: '700', color: '#fff' },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  card: { backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 14, padding: 16, marginBottom: 16 },
  cardLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  input: { flex: 1, color: '#fff', fontSize: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)', paddingBottom: 6 },
  sendBtn: { backgroundColor: '#fff', borderRadius: 28, paddingVertical: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  sendBtnText: { color: BRAND, fontWeight: '800', fontSize: 15 },
});

const sd = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: { position: 'absolute', top: 0, left: 0, bottom: 0, width: SCREEN_WIDTH * 0.75, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 4, height: 0 }, elevation: 12 },
  profileSection: { backgroundColor: BRAND, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 28, alignItems: 'flex-start' },
  avatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 14 },
  avatarFallback: { backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 26, fontWeight: '800', color: '#fff' },
  name: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  divider: { height: 1, marginHorizontal: 16, marginVertical: 8 },
  menu: { paddingHorizontal: 12, paddingTop: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10 },
  menuIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuLabel: { fontSize: 15, fontWeight: '600' },
  signOutBtn: { marginHorizontal: 16, marginBottom: 24, backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  signOutText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
});
