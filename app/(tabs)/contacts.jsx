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
  ScrollView,
  Linking,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Contacts from 'expo-contacts';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AddMeetingModal from '@/components/AddMeetingModal';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { leadsApi, cardsApi, authApi } from '@/services/api';
import SwipeableRow from '@/components/SwipeableRow';

const CORAL = '#1b4654';

const COUNTRIES = [
  { code: '+965', flag: '🇰🇼', name: 'KW' },
  { code: '+966', flag: '🇸🇦', name: 'SA' },
  { code: '+971', flag: '🇦🇪', name: 'AE' },
  { code: '+974', flag: '🇶🇦', name: 'QA' },
  { code: '+973', flag: '🇧🇭', name: 'BH' },
  { code: '+968', flag: '🇴🇲', name: 'OM' },
  { code: '+20',  flag: '🇪🇬', name: 'EG' },
  { code: '+91',  flag: '🇮🇳', name: 'IN' },
  { code: '+1',   flag: '🇺🇸', name: 'US' },
  { code: '+44',  flag: '🇬🇧', name: 'GB' },
];

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

function renderStatusBadge(status, isAR) {
  let label = 'New';
  let color = '#64748B'; // gray
  let bg = 'rgba(100, 116, 139, 0.1)';

  if (status === 'in_progress') {
    label = isAR ? 'قيد المتابعة' : 'In Progress';
    color = '#F59E0B'; // orange
    bg = 'rgba(245, 158, 11, 0.1)';
  } else if (status === 'meeting_scheduled') {
    label = isAR ? 'موعد مجدول' : 'Meeting';
    color = '#3B82F6'; // blue
    bg = 'rgba(59, 130, 246, 0.1)';
  } else if (status === 'closed') {
    label = isAR ? 'مكتملة' : 'Closed';
    color = '#10B981'; // green
    bg = 'rgba(16, 185, 129, 0.1)';
  } else {
    label = isAR ? 'جديد' : 'New';
  }

  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: isAR ? 'flex-end' : 'flex-start', marginTop: 4 }}>
      <Text style={{ fontSize: 9, fontWeight: '800', color }}>{label}</Text>
    </View>
  );
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

/* ─── Contact Detail Bottom Sheet ─── */
function ContactDetailSheet({ contact, onClose, isDark, onAddMeeting }) {
  if (!contact) return null;

  const name = contact.visitor_name || 'Unknown';
  const initials = getInitials(name);
  const avatarColor = getAvatarColor(name);

  const rows = [
    contact.email && { icon: 'mail', label: contact.email, action: `mailto:${contact.email}` },
    contact.phone && { icon: 'call', label: contact.phone, action: `tel:${contact.phone}` },
  ].filter(Boolean);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={cs.overlay}>
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[cs.sheet, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
          {/* Drag handle */}
          <View style={cs.handle} />

          {/* Close button */}
          <TouchableOpacity style={cs.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>

          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {/* Profile card */}
            <View style={[cs.profileCard, { backgroundColor: isDark ? '#0F172A' : '#F8F9FA' }]}>
              <View style={[cs.avatar, { backgroundColor: avatarColor }]}>
                <Text style={cs.avatarText}>{initials}</Text>
              </View>
              <Text style={[cs.nameText, { color: isDark ? '#F8FAFC' : '#111' }]}>{name}</Text>
              {contact.action_type ? (
                <Text style={cs.roleText}>
                  {contact.action_type.replace(/_/g, ' ')}
                </Text>
              ) : null}
              <Text style={cs.capturedText}>{formatRelative(contact.created_at)}</Text>
            </View>

            {/* Contact rows */}
            {rows.length > 0 && (
              <View style={[cs.rowsWrap, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
                {rows.map((row, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[cs.row, i < rows.length - 1 && cs.rowBorder]}
                    onPress={() => Linking.openURL(row.action).catch(() => {})}
                    activeOpacity={0.7}
                  >
                    <View style={[cs.rowIcon, { backgroundColor: CORAL }]}>
                      <Ionicons name={row.icon} size={18} color="#fff" />
                    </View>
                    <View style={cs.rowInfo}>
                      <Text style={[cs.rowLabel, { color: isDark ? '#F8FAFC' : '#111' }]}>{row.label}</Text>
                      <Text style={cs.rowSub}>{row.label}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#CCC" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Actions */}
            <View style={cs.actions}>
              <TouchableOpacity
                style={cs.shareBtn}
                onPress={() => {
                  const text = [name, contact.email, contact.phone].filter(Boolean).join('\n');
                  Share.share({ message: text });
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="share-social" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={cs.shareBtnText}>Share Details</Text>
              </TouchableOpacity>

              <View style={cs.secondRow}>
                {contact.phone ? (
                  <TouchableOpacity
                    style={[cs.actionBtn, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' }]}
                    onPress={() => Linking.openURL(`tel:${contact.phone}`).catch(() => {})}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call-outline" size={20} color={CORAL} style={{ marginRight: 6 }} />
                    <Text style={[cs.actionBtnText, { color: CORAL }]}>Call</Text>
                  </TouchableOpacity>
                ) : null}
                {contact.email ? (
                  <TouchableOpacity
                    style={[cs.actionBtn, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' }]}
                    onPress={() => Linking.openURL(`mailto:${contact.email}`).catch(() => {})}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="mail-outline" size={20} color={CORAL} style={{ marginRight: 6 }} />
                    <Text style={[cs.actionBtnText, { color: CORAL }]}>Email</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* CRM Actions */}
              <View style={[cs.secondRow, { marginTop: 10 }]}>
                <TouchableOpacity
                  style={[cs.actionBtn, { backgroundColor: '#0284c7' }]}
                  onPress={() => onAddMeeting(contact)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={[cs.actionBtnText, { color: '#fff' }]}>Add Meeting</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[cs.actionBtn, { backgroundColor: '#059669' }]}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Ionicons name="briefcase-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={[cs.actionBtnText, { color: '#fff' }]}>CRM Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ContactsScreen() {
  const { user, logout } = useAuth();
  const { isDark, language, brandColor } = useAppContext();
  const isAR = language === 'ar';
  const router = useRouter();
  const params = useLocalSearchParams();
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
  const [newNotes, setNewNotes] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('+965');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [adding, setAdding] = useState(false);

  // Contact Detail Modal State
  const [selectedContact, setSelectedContact] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [leadStatus, setLeadStatus] = useState('new');
  const [savingNote, setSavingNote] = useState(false);

  // Meeting Modal State
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingContact, setMeetingContact] = useState(null);

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
            let name = data.name;
            let name_ar = null;
            let profile_image = data.profile_image;
            const ts = data.tenant_slug || '';
            let cs = data.card_slug || '';
            if (!cs && data.card_url) {
              const match = data.card_url.match(/\/(?:c|card)\/[^/]+\/([^/?#]+)/);
              if (match) cs = match[1];
            }
            if (ts && cs) {
              try {
                const { data: cardRes } = await cardsApi.getPublicCard(ts, cs);
                const card = cardRes?.card || cardRes;
                if (card) {
                  name = card.name || name;
                  name_ar = card.name_ar;
                  profile_image = card.profile_image || profile_image;
                }
              } catch {}
            }
            cd = {
              id:            data.card_id,
              name:          name,
              name_ar:       name_ar,
              profile_image: profile_image,
              card_url:      data.card_url,
              tenant_slug:   ts,
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

  useEffect(() => {
    if (params?.add === 'true') {
      setShowAddModal(true);
      // Clear route parameters so it doesn't open on re-render/tab switch
      router.setParams({ add: undefined });
    }
  }, [params]);

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

      const formattedPhone = newPhone.trim() 
        ? (newPhone.trim().startsWith('+') ? newPhone.trim() : `${selectedCountryCode}${newPhone.trim().replace(/^0+/, '')}`)
        : null;

      await leadsApi.create({
        tenantSlug,
        cardId: cardData.id,
        visitor_name: newName.trim(),
        email: newEmail.trim() || null,
        phone: formattedPhone,
        notes: newNotes.trim() || null,
        action_type: 'manual_entry'
      });

      // Reset and close
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewNotes('');
      setSelectedCountryCode('+965');
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

  const handleDeleteContact = (contactId) => {
    Alert.alert(
      isAR ? 'حذف جهة الاتصال' : 'Delete Contact',
      isAR ? 'هل أنت متأكد من حذف جهة الاتصال هذه؟' : 'Are you sure you want to delete this contact?',
      [
        { text: isAR ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isAR ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await leadsApi.delete(contactId);
              setSelectedContact(null);
              fetchContacts(true);
              Alert.alert(isAR ? 'نجاح' : 'Success', isAR ? 'تم حذف جهة الاتصال' : 'Contact deleted successfully.');
            } catch (err) {
              console.error('[DeleteLead Error]', err);
              Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'فشل الحذف' : 'Failed to delete contact.');
            }
          }
        }
      ]
    );
  };

  const handleSaveNote = async () => {
    if (!selectedContact) return;
    setSavingNote(true);
    try {
      await leadsApi.update(selectedContact.id, { notes: noteText.trim(), status: leadStatus });
      setSelectedContact(prev => prev ? { ...prev, notes: noteText.trim(), status: leadStatus } : null);
      setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, notes: noteText.trim(), status: leadStatus } : c));
      Alert.alert(isAR ? 'نجاح' : 'Success', isAR ? 'تم حفظ التغييرات بنجاح' : 'Progress saved successfully.');
    } catch (err) {
      console.error('[SaveNote Error]', err);
      Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'فشل حفظ التغييرات' : 'Failed to save notes & status.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveToDevice = async (contact) => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'مطلوب إذن الوصول لجهات الاتصال' : 'Contacts permission is required.');
        return;
      }

      const contactData = {
        [Contacts.Fields.FirstName]: contact.visitor_name || 'Contact',
        [Contacts.Fields.Note]: 'Captured from DigCard App',
      };

      if (contact.phone) {
        contactData[Contacts.Fields.PhoneNumbers] = [{
          label: 'mobile',
          number: contact.phone,
        }];
      }

      if (contact.email) {
        contactData[Contacts.Fields.Emails] = [{
          label: 'work',
          email: contact.email,
        }];
      }

      const companyName = contact.company_name || contact.company;
      if (companyName) {
        contactData[Contacts.Fields.Company] = companyName;
      }

      // Open the native Add Contact form pre-filled with data
      await Contacts.presentFormAsync(null, contactData);
      
    } catch (err) {
      console.error('[SaveToDevice Error]', err);
      Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'فشل حفظ جهة الاتصال بالهاتف' : 'Failed to save to device contacts.');
    }
  };

  const handleScheduleMeeting = (contact) => {
    // Open our modern internal meeting scheduler instead of just Linking to Google Calendar
    setMeetingContact(contact);
    setShowMeetingModal(true);
  };

  const handleSaveMeetingModal = async (meetingDetails) => {
    if (!meetingContact) return;
    const { title, dateStr, startTime, endTime, noteText: meetingNotes } = meetingDetails;
    
    // Format the summary cleanly
    const summary = `--- Meeting Scheduled ---\nTitle: ${title}\nDate: ${dateStr}\nTime: ${startTime} to ${endTime}\nNotes: ${meetingNotes}\n\n`;
    const updatedNotes = meetingContact.notes ? `${summary}${meetingContact.notes}` : summary;

    try {
      await leadsApi.update(meetingContact.id, { 
        notes: updatedNotes,
        meeting_status: 'scheduled'
      });
      
      Alert.alert(isAR ? 'نجاح' : 'Success', isAR ? 'تمت جدولة الاجتماع وحفظه.' : 'Meeting scheduled and saved cleanly to notes.');
      
      // Update local state
      setContacts(prev => prev.map(c => c.id === meetingContact.id ? { ...c, notes: updatedNotes, meeting_status: 'scheduled' } : c));
      
      // Also optionally open Google Calendar URL for convenience if they want to add it to device
      const details = `Meeting with ${meetingContact.visitor_name}\n${meetingNotes}`;
      const toGoogleDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
      const startD = new Date(`${dateStr}T10:00:00`);
      const endD = new Date(startD.getTime() + 3600*1000);
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}&dates=${toGoogleDate(startD)}/${toGoogleDate(endD)}`;
      Linking.openURL(url).catch(() => {});
    } catch (err) {
      console.error('[Save Meeting Error]', err);
      Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'فشل الحفظ' : 'Failed to save meeting.');
    } finally {
      setShowMeetingModal(false);
      setMeetingContact(null);
    }
  };

  const handlePhoneCall = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'لا يمكن إجراء الاتصال' : 'Cannot place phone call.');
    });
  };

  const handleWhatsApp = (phone) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'لا يمكن فتح واتساب' : 'Cannot open WhatsApp.');
    });
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
  const iconColor = isDark ? '#4DD0E1' : brandColor;

  const headerSubName = isAR && (cardData?.name_ar || user?.name_ar) ? (cardData?.name_ar || user?.name_ar) : (cardData?.name || user?.name);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={brandColor} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 6, backgroundColor: brandColor }]}>
        <View style={[styles.headerLeft, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
          <Text style={[styles.headerTitle, { textAlign: isAR ? 'right' : 'left' }]}>{isAR ? 'جهات الاتصال' : 'Contacts'}</Text>
          {headerSubName ? (
            <Text style={[styles.headerSub, { textAlign: isAR ? 'right' : 'left' }]} numberOfLines={1}>{headerSubName}</Text>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconBtn, styles.dashboardBtn]}
            onPress={() => router.push('/crm-dashboard')}
            hitSlop={8}
          >
            <Ionicons name="grid-outline" size={18} color="#fff" />
          </TouchableOpacity>
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
        <ActivityIndicator style={{ flex: 1 }} color={brandColor} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id ?? item.email ?? Math.random())}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchContacts(true); }}
              tintColor={brandColor}
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
              <SwipeableRow
                onDelete={() => handleDeleteContact(item.id)}
                isAR={isAR}
                isDark={isDark}
                backgroundStyle={{ left: 0, right: 0, top: 0, borderRadius: 0 }}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedContact(item);
                    setNoteText(item.notes || '');
                    setLeadStatus(item.status || 'new');
                  }}
                  style={[styles.contactRow, { backgroundColor: cardBg, borderColor: border, flexDirection: isAR ? 'row-reverse' : 'row', paddingVertical: 12 }]}
                >
                  <View style={[styles.avatar, { backgroundColor: getAvatarColor(name), marginLeft: isAR ? 14 : 0, marginRight: isAR ? 0 : 14 }]}>
                    <Text style={styles.avatarText}>{getInitials(name)}</Text>
                  </View>
                  <View style={[styles.info, { alignItems: isAR ? 'flex-end' : 'flex-start', flex: 1 }]}>
                    <Text style={[styles.name, { color: text }]} numberOfLines={1}>{name}</Text>
                    {item.email ? (
                      <View style={[styles.metaRow, { flexDirection: isAR ? 'row-reverse' : 'row', marginTop: 3 }]}>
                        <Ionicons name="mail-outline" size={12} color={subtext} style={[styles.metaIcon, { marginLeft: isAR ? 6 : 0, marginRight: isAR ? 0 : 6 }]} />
                        <Text style={[styles.metaText, { color: subtext }]} numberOfLines={1}>{item.email}</Text>
                      </View>
                    ) : null}
                    {item.phone ? (
                      <View style={[styles.metaRow, { flexDirection: isAR ? 'row-reverse' : 'row', marginTop: 3 }]}>
                        <Ionicons name="call-outline" size={12} color={subtext} style={[styles.metaIcon, { marginLeft: isAR ? 6 : 0, marginRight: isAR ? 0 : 6 }]} />
                        <Text style={[styles.metaText, { color: subtext }]} numberOfLines={1}>{item.phone}</Text>
                      </View>
                    ) : null}
                    {renderStatusBadge(item.status || 'new', isAR)}
                  </View>
                  <View style={[styles.right, { alignItems: isAR ? 'flex-start' : 'flex-end', justifyContent: 'space-between', height: '100%', minHeight: 52 }]}>
                    <Text style={[styles.time, { color: subtext, fontSize: 10 }]}>{formatRelative(item.created_at)}</Text>
                    <View style={{ flexDirection: isAR ? 'row-reverse' : 'row', gap: 12, alignItems: 'center', marginTop: 6 }}>
                      {item.phone ? (
                        <>
                          <TouchableOpacity 
                            onPress={(e) => { e?.stopPropagation?.(); handleWhatsApp(item.phone); }} 
                            onPressIn={(e) => e?.stopPropagation?.()}
                            hitSlop={8}
                          >
                            <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            onPress={(e) => { e?.stopPropagation?.(); handlePhoneCall(item.phone); }} 
                            onPressIn={(e) => e?.stopPropagation?.()}
                            hitSlop={8}
                          >
                            <Ionicons name="call" size={16} color={brandColor} />
                          </TouchableOpacity>
                        </>
                      ) : null}
                      <TouchableOpacity 
                        onPress={(e) => { e?.stopPropagation?.(); handleShare(item); }} 
                        onPressIn={(e) => e?.stopPropagation?.()}
                        hitSlop={8}
                      >
                        <Ionicons name="share-social-outline" size={16} color="#888" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={(e) => { e?.stopPropagation?.(); handleDeleteContact(item.id); }} 
                        onPressIn={(e) => e?.stopPropagation?.()}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              </SwipeableRow>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: isDark ? '#334155' : '#F5F5F5', [isAR ? 'marginRight' : 'marginLeft']: 78 }} />}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, { bottom: insets.bottom + 20, backgroundColor: brandColor, right: isAR ? undefined : 20, left: isAR ? 20 : undefined }]} 
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Contact Detail Sheet */}
      {selectedContact && (
        <ContactDetailSheet
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          isDark={isDark}
        />
      )}

      {/* Add Contact Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                  placeholder={isAR ? "example@email.com" : "example@email.com"}
                  placeholderTextColor={subtext}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={[styles.inputGroup, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.inputLabel, { color: subtext }]}>{isAR ? 'رقم الهاتف' : 'PHONE NUMBER'}</Text>
                <View style={{ flexDirection: isAR ? 'row-reverse' : 'row', alignItems: 'center', width: '100%', gap: 8 }}>
                  {/* Country Code Dropdown Button */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowCountryDropdown(!showCountryDropdown)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: bg,
                      borderWidth: 1.5,
                      borderColor: showCountryDropdown ? brandColor : border,
                      borderRadius: 16,
                      paddingHorizontal: 12,
                      height: 54,
                      gap: 6
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>
                      {COUNTRIES.find(c => c.code === selectedCountryCode)?.flag || '🏳️'}
                    </Text>
                    <Text style={{ fontSize: 15, color: text, fontWeight: '700' }}>
                      {selectedCountryCode}
                    </Text>
                    <Ionicons name={showCountryDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={subtext} />
                  </TouchableOpacity>

                  {/* Rest of Phone Number Input */}
                  <TextInput 
                    style={[styles.input, { flex: 1, backgroundColor: bg, borderColor: border, color: text, textAlign: isAR ? 'right' : 'left', height: 54, paddingVertical: 0 }]}
                    placeholder={selectedCountryCode === '+965' ? '5555 5555' : '123 456 789'}
                    placeholderTextColor={subtext}
                    value={newPhone}
                    onChangeText={setNewPhone}
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Country Code Dropdown List */}
                {showCountryDropdown && (
                  <View style={{
                    marginTop: 8,
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: border,
                    borderRadius: 14,
                    overflow: 'hidden',
                    width: '100%',
                  }}>
                    {COUNTRIES.map((c) => {
                      const isActive = selectedCountryCode === c.code;
                      return (
                        <TouchableOpacity
                          key={c.code}
                          onPress={() => {
                            setSelectedCountryCode(c.code);
                            setShowCountryDropdown(false);
                          }}
                          style={{
                            flexDirection: isAR ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            backgroundColor: isActive ? (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9') : 'transparent',
                            borderBottomWidth: 1,
                            borderBottomColor: isDark ? '#334155' : '#F1F5F9',
                            gap: 12,
                          }}
                        >
                          <Text style={{ fontSize: 20 }}>{c.flag}</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: text, flex: 1, textAlign: isAR ? 'right' : 'left' }}>
                            {c.name}
                          </Text>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: isActive ? brandColor : subtext }}>
                            {c.code}
                          </Text>
                          {isActive && (
                            <Ionicons name="checkmark-circle" size={18} color={brandColor} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={[styles.inputGroup, { alignItems: isAR ? 'flex-end' : 'flex-start', marginTop: 4 }]}>
                <Text style={[styles.inputLabel, { color: subtext }]}>{isAR ? 'ملاحظات' : 'NOTES'}</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: bg, borderColor: border, color: text, textAlign: isAR ? 'right' : 'left', width: '100%', minHeight: 60, textAlignVertical: 'top', paddingVertical: 8 }]}
                  placeholder={isAR ? "أضف ملاحظة..." : "Add a note..."}
                  placeholderTextColor={subtext}
                  value={newNotes}
                  onChangeText={setNewNotes}
                  multiline
                />
              </View>

              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: brandColor, shadowColor: brandColor }, adding && styles.btnDisabled]} 
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

      {/* Internal Add Meeting Modal */}
      <AddMeetingModal
        visible={showMeetingModal}
        onClose={() => {
          setShowMeetingModal(false);
          setMeetingContact(null);
        }}
        onSave={handleSaveMeetingModal}
        initialTitle={meetingContact ? `Follow-up: ${meetingContact.visitor_name}` : ''}
        isAR={isAR}
        isDark={isDark}
        brandColor={brandColor}
      />

      {/* Contact Detail Modal */}
      <Modal
        visible={selectedContact !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedContact(null)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContainer}
          >
            <View style={[styles.modalContent, { backgroundColor: cardBg, borderColor: border }]}>
              {/* Header */}
              <View style={[styles.modalHeader, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.modalTitle, { color: text }]}>
                  {isAR ? 'تفاصيل جهة الاتصال' : 'Contact Details'}
                </Text>
                <TouchableOpacity onPress={() => setSelectedContact(null)} hitSlop={15}>
                  <Ionicons name="close" size={24} color={text} />
                </TouchableOpacity>
              </View>

              {selectedContact && (
                <ScrollView 
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 60 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Avatar & Name */}
                  <View style={{ alignItems: 'center', marginVertical: 20 }}>
                    <View style={[styles.avatar, { width: 75, height: 75, borderRadius: 37.5, backgroundColor: getAvatarColor(selectedContact.visitor_name || ''), justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={[styles.avatarText, { fontSize: 26 }]}>{getInitials(selectedContact.visitor_name || '')}</Text>
                    </View>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: text, marginTop: 12 }}>
                      {selectedContact.visitor_name}
                    </Text>
                    <Text style={{ fontSize: 12, color: subtext, marginTop: 4 }}>
                      {(isAR ? 'تم الحفظ: ' : 'Saved: ') + formatRelative(selectedContact.created_at)}
                    </Text>
                  </View>

                  {/* Actions Row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
                    {selectedContact.phone && (
                      <>
                        <TouchableOpacity 
                          onPress={() => handlePhoneCall(selectedContact.phone)}
                          style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', justifyContent: 'center', alignItems: 'center' }}
                        >
                          <Ionicons name="call" size={22} color={brandColor} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => handleWhatsApp(selectedContact.phone)}
                          style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', justifyContent: 'center', alignItems: 'center' }}
                        >
                          <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                        </TouchableOpacity>
                      </>
                    )}
                    {selectedContact.email && (
                      <TouchableOpacity 
                        onPress={() => Linking.openURL(`mailto:${selectedContact.email}`)}
                        style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Ionicons name="mail" size={22} color="#3b82f6" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      onPress={() => handleShare(selectedContact)}
                      style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', justifyContent: 'center', alignItems: 'center' }}
                    >
                      <Ionicons name="share-social" size={22} color="#888" />
                    </TouchableOpacity>
                  </View>

                  {/* Details List */}
                  <View style={{ gap: 12, marginBottom: 20 }}>
                    {selectedContact.phone && (
                      <View style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', padding: 14, borderRadius: 12 }}>
                        <Text style={{ fontSize: 10, color: subtext, fontWeight: '700', textTransform: 'uppercase' }}>
                          {isAR ? 'رقم الهاتف' : 'PHONE NUMBER'}
                        </Text>
                        <Text style={{ fontSize: 15, color: text, fontWeight: '600', marginTop: 4 }}>
                          {selectedContact.phone}
                        </Text>
                      </View>
                    )}

                    {selectedContact.email && (
                      <View style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', padding: 14, borderRadius: 12 }}>
                        <Text style={{ fontSize: 10, color: subtext, fontWeight: '700', textTransform: 'uppercase' }}>
                          {isAR ? 'البريد الإلكتروني' : 'EMAIL ADDRESS'}
                        </Text>
                        <Text style={{ fontSize: 15, color: text, fontWeight: '600', marginTop: 4 }}>
                          {selectedContact.email}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* CRM Actions (Save to Phone, Schedule Meeting) */}
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                    <TouchableOpacity
                      onPress={() => handleSaveToDevice(selectedContact)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: brandColor,
                        paddingVertical: 12,
                        borderRadius: 12,
                        gap: 8
                      }}
                    >
                      <Ionicons name="download-outline" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                        {isAR ? 'حفظ بالهاتف' : 'Save to Phone'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setSelectedContact(null);
                        handleScheduleMeeting(selectedContact);
                      }}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#0284c7',
                        paddingVertical: 12,
                        borderRadius: 12,
                        gap: 8
                      }}
                    >
                      <Ionicons name="calendar-outline" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                        {isAR ? 'جدولة اجتماع' : 'Add Meeting'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedContact(null); // Close modal
                      router.push({
                        pathname: '/crm-lead',
                        params: {
                          id: selectedContact.id,
                          visitor_name: selectedContact.visitor_name || '',
                          email: selectedContact.email || '',
                          phone: selectedContact.phone || '',
                          company_name: selectedContact.company_name || '',
                          product_name: selectedContact.product_name || '',
                          meeting_purpose: selectedContact.meeting_purpose || '',
                          meeting_date: selectedContact.meeting_date || '',
                          meeting_status: selectedContact.meeting_status || 'scheduled',
                          meeting_review: selectedContact.meeting_review || '',
                          notes: selectedContact.notes || '',
                          action_type: selectedContact.action_type || 'manual_entry',
                          card_id: selectedContact.card_id
                        }
                      });
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: brandColor,
                      paddingVertical: 14,
                      borderRadius: 12,
                      gap: 8,
                      marginBottom: 16
                    }}
                  >
                    <Ionicons name="briefcase" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                      {isAR ? 'تحديث CRM والاجتماعات' : 'CRM Follow-up (Lead Details)'}
                    </Text>
                  </TouchableOpacity>

                  {/* Status Section */}
                  <View style={{ marginTop: 16, marginBottom: 8, alignItems: isAR ? 'flex-end' : 'flex-start' }}>
                    <Text style={{ fontSize: 12, color: subtext, fontWeight: '700', marginBottom: 8 }}>
                      {isAR ? 'حالة المتابعة' : 'LEAD STATUS'}
                    </Text>
                    <View style={{ flexDirection: isAR ? 'row-reverse' : 'row', gap: 6, flexWrap: 'wrap', justifyContent: isAR ? 'flex-start' : 'flex-start' }}>
                      {[
                        { val: 'new', lbl: isAR ? 'جديد' : 'New', clr: '#64748B' },
                        { val: 'in_progress', lbl: isAR ? 'متابعة' : 'In Progress', clr: '#F59E0B' },
                        { val: 'meeting_scheduled', lbl: isAR ? 'موعد' : 'Meeting', clr: '#3B82F6' },
                        { val: 'closed', lbl: isAR ? 'مكتملة' : 'Closed', clr: '#10B981' },
                      ].map((item) => {
                        const active = leadStatus === item.val;
                        return (
                          <TouchableOpacity
                            key={item.val}
                            onPress={() => setLeadStatus(item.val)}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 8,
                              backgroundColor: active ? item.clr : (isDark ? '#1e293b' : '#f1f5f9'),
                              borderWidth: 1.5,
                              borderColor: active ? item.clr : border,
                            }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : subtext }}>
                              {item.lbl}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Notes Section */}
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 12, color: subtext, fontWeight: '700', marginBottom: 6 }}>
                      {isAR ? 'ملاحظات الاتصال' : 'CONTACT NOTES'}
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                        borderColor: border,
                        borderWidth: 1,
                        borderRadius: 12,
                        padding: 12,
                        color: text,
                        minHeight: 80,
                        textAlignVertical: 'top',
                        fontSize: 14
                      }}
                      placeholder={isAR ? 'أضف ملاحظة حول جهة الاتصال هذه...' : 'Add a note about this contact...'}
                      placeholderTextColor={subtext}
                      multiline
                      value={noteText}
                      onChangeText={setNoteText}
                    />
                    <TouchableOpacity
                      onPress={handleSaveNote}
                      disabled={savingNote}
                      style={{
                        backgroundColor: brandColor,
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignItems: 'center',
                        marginTop: 10,
                        opacity: savingNote ? 0.7 : 1
                      }}
                    >
                      {savingNote ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                          {isAR ? 'حفظ الملاحظة' : 'Save Notes'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Danger Zone: Delete Contact */}
                  <TouchableOpacity
                    onPress={() => handleDeleteContact(selectedContact.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 32,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#fca5a5',
                      gap: 6
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>
                      {isAR ? 'حذف جهة الاتصال' : 'Delete Contact'}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
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
  dashboardBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8, marginRight: 6,
    paddingHorizontal: 8, paddingVertical: 5,
  },
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

/* ─── Contact Detail Sheet Styles ─── */
const cs = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#CBD5E1',
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CORAL, justifyContent: 'center', alignItems: 'center',
  },
  profileCard: {
    alignItems: 'center',
    paddingTop: 24, paddingBottom: 20, paddingHorizontal: 24,
    borderRadius: 20, margin: 16, marginTop: 12,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 28 },
  nameText: { fontSize: 22, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  roleText: { fontSize: 13, color: '#888', textTransform: 'capitalize', marginBottom: 2 },
  capturedText: { fontSize: 12, color: '#AAA', marginTop: 4 },
  rowsWrap: {
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  rowIcon: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, color: '#999', marginTop: 2 },
  actions: { paddingHorizontal: 16, gap: 10 },
  shareBtn: {
    backgroundColor: CORAL, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    shadowColor: CORAL, shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, paddingVertical: 14,
  },
  actionBtnText: { fontSize: 15, fontWeight: '600' },
});
