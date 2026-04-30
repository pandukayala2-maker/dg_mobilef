import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { leadsApi, cardsApi, authApi } from '@/services/api';

const CORAL = '#1b4654';

const AVATAR_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
  '#F44336', '#00BCD4', '#FF5722', '#607D8B',
];

function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name = '') {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatRelative(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 2 * 86400000) return 'Yesterday';
  return `${Math.floor(diff / 86400000)} days ago`;
}

export default function ContactsScreen() {
  const { user, logout } = useAuth();
  const { isDark, language } = useAppContext();
  const isAR = language === 'ar';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState([]);
  const [cardData, setCardData] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Manual Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [adding, setAdding] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => { await logout(); router.replace('/(auth)/login'); },
      },
    ]);
  };

  const fetchContacts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch card data for header display and manual entry
      if (!cardData) {
        try {
          let cd;
          if (user?.role === 'card_user') {
            // Use the slug endpoint — reliably finds card by card_email even with stale card_id
            const { data } = await authApi.getCardSlug();
            cd = {
              id:            data.card_id,
              name:          data.name,
              profile_image: data.profile_image,
              card_url:      data.card_url,
              tenant_slug:   data.tenant_slug,
            };
          } else {
            const { data } = await cardsApi.getAll();
            const list = Array.isArray(data) ? data : data?.cards ?? [];
            cd = list[0] ?? null;
          }
          if (cd?.id) setCardData(cd);
        } catch {}
      }

      // GET /cards/leads — backend already filters by card_user's card_id from JWT token
      const { data } = await leadsApi.getAll();
      const list = Array.isArray(data) ? data : data?.leads ?? [];
      setContacts(list);
    } catch {
      // keep empty list silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, cardData]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleManualAdd = async () => {
    if (!newName.trim()) { 
      Alert.alert(isAR ? 'مطلوب' : 'Required', isAR ? 'يرجى إدخال الاسم' : 'Please enter a name.'); 
      return; 
    }
    
    if (!cardData?.id) { 
      Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'لم يتم العثور على معرف البطاقة' : 'Card ID not found. Please refresh.'); 
      return; 
    }

    setAdding(true);
    try {
      // Derive tenantSlug safely from available sources
      let tenantSlug = cardData?.tenant_slug || user?.tenant_slug || user?.schema_slug;
      
      // Fallback: parse from card_url if slugs are missing in context
      if (!tenantSlug && cardData?.card_url) {
        const match = cardData.card_url.match(/\/(?:c|card)\/([^/]+)\/[^/?#]+/);
        if (match) tenantSlug = match[1];
      }

      if (!tenantSlug) {
        Alert.alert('Configuration Error', 'Could not determine your workspace ID. Please log in again.');
        setAdding(false);
        return;
      }

      await leadsApi.create({
        tenantSlug,
        cardId: cardData.id,
        visitor_name: newName.trim(),
        email: newEmail.trim() || null,
        phone: newPhone.trim() || null,
        action_type: 'manual_entry'
      });

      // Reset and close
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setShowAddModal(false);
      
      // Refresh list
      fetchContacts(true);
      Alert.alert(isAR ? 'نجاح' : 'Success', isAR ? 'تمت إضافة جهة الاتصال بنجاح' : 'Contact added successfully.');
    } catch (err) {
      console.error('[ManualAdd Error]', err?.response?.data || err.message);
      const msg = err?.response?.data?.message || (isAR ? 'فشل في حفظ جهة الاتصال' : 'Failed to save contact.');
      Alert.alert(isAR ? 'خطأ' : 'Error', msg);
    } finally {
      setAdding(false);
    }
  };

  const handleShare = async (contact) => {
    const text = [contact.visitor_name, contact.email, contact.phone].filter(Boolean).join('\n');
    try {
      await Share.share({ message: text });
    } catch {}
  };

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      (c.visitor_name ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q)
    );
  });

  const bg = isDark ? '#0F172A' : '#F3F4F6';
  const cardBg = isDark ? '#1E293B' : '#fff';
  const text = isDark ? '#F8FAFC' : '#111827';
  const subtext = isDark ? '#94A3B8' : '#64748B';
  const border = isDark ? '#334155' : '#F1F5F9';
  const iconColor = isDark ? '#4DD0E1' : CORAL;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={CORAL} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 6 }]}>
        <View style={[styles.headerLeft, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
          <Text style={styles.headerTitle}>{isAR ? 'جهات الاتصال' : 'Contacts'}</Text>
          {cardData?.name ? (
            <Text style={styles.headerSub} numberOfLines={1}>{cardData.name}</Text>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: cardBg, borderColor: border, flexDirection: isAR ? 'row-reverse' : 'row' }]}>
        <Ionicons name="search-outline" size={20} color={subtext} style={[styles.searchIcon, { marginLeft: isAR ? 8 : 0, marginRight: isAR ? 0 : 8 }]} />
        <TextInput
          style={[styles.searchInput, { color: text, textAlign: isAR ? 'right' : 'left' }]}
          placeholder={isAR ? 'البحث عن جهات الاتصال...' : 'Search contacts...'}
          placeholderTextColor={subtext}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={10} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={CORAL} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id ?? item.email ?? Math.random())}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchContacts(true); }}
              tintColor={CORAL}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={56} color={isDark ? '#334155' : '#DDD'} />
              <Text style={[styles.emptyText, { color: text }]}>{isAR ? 'لا توجد جهات اتصال بعد' : 'No contacts yet'}</Text>
              <Text style={[styles.emptySub, { color: subtext }]}>
                {isAR ? 'سيظهر هنا الأشخاص الذين يقومون بمسح بطاقتك أو استلامها' : 'People who scan or receive your card will appear here'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const name = item.visitor_name || (isAR ? 'غير معروف' : 'Unknown');
            return (
              <View style={[styles.contactRow, { backgroundColor: cardBg, borderColor: border, flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                <View style={[styles.avatar, { backgroundColor: getAvatarColor(name), marginLeft: isAR ? 14 : 0, marginRight: isAR ? 0 : 14 }]}>
                  <Text style={styles.avatarText}>{getInitials(name)}</Text>
                </View>
                <View style={[styles.info, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
                  <Text style={[styles.name, { color: text }]}>{name}</Text>
                  {item.email ? (
                    <View style={[styles.metaRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                      <Ionicons name="mail-outline" size={12} color={subtext} style={[styles.metaIcon, { marginLeft: isAR ? 6 : 0, marginRight: isAR ? 0 : 6 }]} />
                      <Text style={[styles.metaText, { color: subtext }]} numberOfLines={1}>{item.email}</Text>
                    </View>
                  ) : null}
                  {item.phone ? (
                    <View style={styles.metaRow}>
                      <Ionicons name="call-outline" size={12} color="#888" style={styles.metaIcon} />
                      <Text style={styles.metaText}>{item.phone}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.right}>
                  <Text style={styles.time}>{formatRelative(item.created_at)}</Text>
                  <TouchableOpacity onPress={() => handleShare(item)}>
                    <Ionicons name="share-social-outline" size={20} color="#888" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, { bottom: insets.bottom + 20 }]} 
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Add Contact Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            <View style={[styles.modalHeader, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.modalTitle, { color: text }]}>{isAR ? 'إضافة جهة اتصال يدويًا' : 'Add Contact Manually'}</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={subtext} />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <View style={[styles.inputGroup, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.inputLabel, { color: subtext }]}>{isAR ? 'الاسم الكامل' : 'FULL NAME'}</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: bg, borderColor: border, color: text, textAlign: isAR ? 'right' : 'left', width: '100%' }]}
                  placeholder={isAR ? "مثل: محمد علي" : "e.g. John Doe"}
                  placeholderTextColor={subtext}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
              </View>

              <View style={[styles.inputGroup, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.inputLabel, { color: subtext }]}>{isAR ? 'البريد الإلكتروني' : 'EMAIL ADDRESS'}</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: bg, borderColor: border, color: text, textAlign: isAR ? 'right' : 'left', width: '100%' }]}
                  placeholder="john@example.com"
                  placeholderTextColor={subtext}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={[styles.inputGroup, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.inputLabel, { color: subtext }]}>{isAR ? 'رقم الهاتف' : 'PHONE NUMBER'}</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: bg, borderColor: border, color: text, textAlign: isAR ? 'right' : 'left', width: '100%' }]}
                  placeholder="+1 234 567 890"
                  placeholderTextColor={subtext}
                  value={newPhone}
                  onChangeText={setNewPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity 
                style={[styles.saveBtn, adding && styles.btnDisabled]} 
                onPress={handleManualAdd}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{isAR ? 'حفظ جهة الاتصال' : 'Save Contact'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 20,
    backgroundColor: CORAL,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 4 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#1E293B' },
  list: { paddingBottom: 120 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  metaIcon: { marginRight: 4 },
  metaText: { fontSize: 12, color: '#888', flexShrink: 1 },
  right: { alignItems: 'flex-end', gap: 6 },
  time: { fontSize: 12, color: '#AAAAAA' },
  separator: { height: 1, backgroundColor: '#F5F5F5', marginLeft: 78 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 40 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#AAAAAA' },
  emptySub: { fontSize: 13, color: '#CCCCCC', textAlign: 'center', lineHeight: 20 },
  
  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: CORAL,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  form: { gap: 18 },
  inputGroup: { gap: 8 },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: CORAL,
    padding: 18,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: CORAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.5 },
  saveBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
