import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppContext } from '@/context/AppContext';
import { leadsApi } from '@/services/api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// ─── Theme ────────────────────────────────────────────────────────────────────
const BG        = '#F0EBE1';
const CARD      = '#FFFFFF';
const BRAND     = '#1b4654';
const BORDER    = '#E4DDD3';
const TEXT      = '#1A1A1A';
const SUBTEXT   = '#6B7280';
const LABEL     = '#9CA3AF';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  new:               { label: 'New',         label_ar: 'جديد',           color: '#374151', bg: '#F3F4F6',  border: '#D1D5DB' },
  contacted:         { label: 'Contacted',   label_ar: 'تم التواصل',        color: '#92400E', bg: '#FEF3C7',  border: '#FCD34D' },
  qualified:         { label: 'Qualified',   label_ar: 'مؤهل',            color: '#065F46', bg: '#D1FAE5',  border: '#6EE7B7' },
  in_progress:       { label: 'In Progress', label_ar: 'قيد الإجراء',      color: '#92400E', bg: '#FEF3C7',  border: '#FCD34D' },
  meeting_scheduled: { label: 'Meeting',     label_ar: 'اجتماع',          color: '#1E40AF', bg: '#DBEAFE',  border: '#93C5FD' },
  closed:            { label: 'Closed',      label_ar: 'مغلق',            color: '#065F46', bg: '#D1FAE5',  border: '#6EE7B7' },
  lost:              { label: 'Lost',        label_ar: 'مفقود',           color: '#991B1B', bg: '#FEE2E2',  border: '#FCA5A5' },
};

// ─── Source badge config ──────────────────────────────────────────────────────
const SOURCE_CFG = {
  manual_entry: { label: 'Manual',   label_ar: 'يدوي',           color: '#92400E', bg: '#FEF3C7' },
  qr_scan:      { label: 'QR Scan',  label_ar: 'مسح QR',         color: '#1E40AF', bg: '#DBEAFE' },
  nfc_tap:      { label: 'NFC',      label_ar: 'NFC',            color: '#5B21B6', bg: '#EDE9FE' },
  default:      { label: 'Direct',   label_ar: 'مباشر',          color: '#374151', bg: '#F3F4F6' },
};

const FILTERS = [
  { key: 'all',               label: 'All Connections',  label_ar: 'كل جهات الاتصال' },
  { key: 'manual_entry',      label: 'Manual',           label_ar: 'يدوي',             sourceFilter: true },
  { key: 'qr_scan',           label: 'QR Scan',          label_ar: 'مسح QR',           sourceFilter: true },
  { key: 'new',               label: 'New',              label_ar: 'جديد' },
  { key: 'contacted',         label: 'Contacted',        label_ar: 'تم التواصل' },
  { key: 'qualified',         label: 'Qualified',        label_ar: 'مؤهل' },
];

const AVATAR_COLORS = ['#4CAF50','#2196F3','#FF9800','#9C27B0','#F44336','#00BCD4','#FF5722'];

function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'numeric', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }) + ` (${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })})`;
}

function formatRelative(dateStr, isAR) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return isAR ? 'الآن' : 'Just now';
  if (diff < 3600000) return isAR ? `منذ ${Math.floor(diff / 60000)} دقيقة` : `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return isAR ? `منذ ${Math.floor(diff / 3600000)} ساعة` : `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 2 * 86400000) return isAR ? 'أمس' : 'Yesterday';
  return isAR ? `منذ ${Math.floor(diff / 86400000)} يوم` : `${Math.floor(diff / 86400000)} days ago`;
}

function sourceCfg(lead) {
  const t = lead.action_type || '';
  return SOURCE_CFG[t] || { label: lead.source || 'Direct', label_ar: 'مباشر', color: '#374151', bg: '#F3F4F6' };
}

// ─── Lead Card ────────────────────────────────────────────────────────────────
function LeadCard({ lead, onEdit, onDelete, isAR }) {
  const [expanded, setExpanded] = useState(false);
  const sc   = sourceCfg(lead);
  const st   = STATUS_CFG[lead.status] || STATUS_CFG.new;
  const name = lead.visitor_name || (isAR ? 'غير معروف' : 'Unknown');
  const av   = avatarColor(name);
  const ini  = initials(name);
  const hasMeeting = !!(lead.meeting_date || lead.meeting_purpose);

  return (
    <View style={styles.leadCard}>
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: BRAND }]} />

      <View style={styles.leadCardInner}>

        {/* ── Row 1: Header (Avatar + Name block + Chevron) ── */}
        <TouchableOpacity
          onPress={() => setExpanded(e => !e)}
          activeOpacity={0.8}
          style={styles.leadCardHeaderContainer}
        >
          <View style={[styles.leadCardHeader, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
            <View style={[styles.headerLeft, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
              <View style={[styles.avatar, { backgroundColor: av, marginLeft: isAR ? 12 : 0, marginRight: isAR ? 0 : 12 }]}>
                <Text style={styles.avatarTxt}>{ini}</Text>
              </View>
              <View style={[styles.nameBlock, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
                <Text style={styles.leadName} numberOfLines={1}>{name}</Text>
                {lead.company_name || lead.company ? (
                  <Text style={styles.leadCo} numberOfLines={1}>{lead.company_name || lead.company}</Text>
                ) : null}
              </View>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={18} color={LABEL}
            />
          </View>

          {/* Sub Row: Badges & Relative captured time */}
          <View style={styles.leadCardSubRow}>
            <View style={[styles.badgeRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
              <View style={[styles.badge, { backgroundColor: sc.bg, marginRight: isAR ? 0 : 6, marginLeft: isAR ? 6 : 0 }]}>
                <Text style={[styles.badgeTxt, { color: sc.color }]}>{isAR && sc.label_ar ? sc.label_ar : sc.label}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: st.bg, borderWidth: 1, borderColor: st.border }]}>
                <Text style={[styles.badgeTxt, { color: st.color }]}>{isAR && st.label_ar ? st.label_ar : st.label}</Text>
              </View>
            </View>
            <Text style={styles.capturedTime}>{formatRelative(lead.created_at, isAR)}</Text>
          </View>
        </TouchableOpacity>

        {/* ── Row 2: Details (expanded) ── */}
        {expanded && (
          <View style={styles.leadDetails}>

            {/* Contact Details */}
            <View style={styles.detailSection}>
              <Text style={[styles.detailSectionLabel, { textAlign: isAR ? 'right' : 'left' }]}>{isAR ? 'بيانات الاتصال' : 'CONTACT DETAILS'}</Text>

              {lead.company_name || lead.company ? (
                <View style={[styles.detailRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                  <Ionicons name="business-outline" size={14} color={SUBTEXT} style={[styles.detailIcon, { marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }]} />
                  <Text style={[styles.detailValue, { textAlign: isAR ? 'right' : 'left' }]} numberOfLines={1}>{lead.company_name || lead.company}</Text>
                </View>
              ) : null}

              {lead.email ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`mailto:${lead.email}`)}
                  style={[styles.detailRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}
                >
                  <Ionicons name="mail-outline" size={14} color={SUBTEXT} style={[styles.detailIcon, { marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }]} />
                  <Text style={[styles.detailValue, { textAlign: isAR ? 'right' : 'left' }]} numberOfLines={1}>{lead.email}</Text>
                </TouchableOpacity>
              ) : null}

              {lead.phone ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${lead.phone}`)}
                  style={[styles.detailRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}
                >
                  <Ionicons name="call-outline" size={14} color={SUBTEXT} style={[styles.detailIcon, { marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }]} />
                  <Text style={[styles.detailValue, { textAlign: isAR ? 'right' : 'left' }]}>{lead.phone}</Text>
                </TouchableOpacity>
              ) : null}

              {lead.product_name ? (
                <View style={[styles.detailRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                  <Ionicons name="cube-outline" size={14} color={SUBTEXT} style={[styles.detailIcon, { marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }]} />
                  <Text style={styles.detailLabel}>{isAR ? 'المنتج: ' : 'Product: '}</Text>
                  <Text style={[styles.detailValue, { textAlign: isAR ? 'right' : 'left' }]}>{lead.product_name}</Text>
                </View>
              ) : null}

              <View style={[styles.detailRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                <Ionicons name="time-outline" size={14} color={SUBTEXT} style={[styles.detailIcon, { marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }]} />
                <Text style={styles.detailLabel}>{isAR ? 'تاريخ الإضافة: ' : 'Captured: '}</Text>
                <Text style={[styles.detailValue, { flex: 1, textAlign: isAR ? 'right' : 'left' }]} numberOfLines={2}>
                  {formatDate(lead.created_at)}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.detailDivider} />

            {/* Meeting & Follow-Up */}
            <View style={styles.detailSection}>
              <Text style={[styles.detailSectionLabel, { textAlign: isAR ? 'right' : 'left' }]}>{isAR ? 'الاجتماع والمتابعة' : 'MEETING & FOLLOW-UP'}</Text>

              {hasMeeting ? (
                <>
                  {lead.meeting_purpose ? (
                    <View style={[styles.detailRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                      <Ionicons name="chatbox-ellipses-outline" size={14} color={SUBTEXT} style={[styles.detailIcon, { marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }]} />
                      <Text style={[styles.detailValue, { textAlign: isAR ? 'right' : 'left' }]} numberOfLines={2}>{lead.meeting_purpose}</Text>
                    </View>
                  ) : null}
                  {lead.meeting_date ? (
                    <View style={[styles.detailRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                      <Ionicons name="calendar-outline" size={14} color={SUBTEXT} style={[styles.detailIcon, { marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }]} />
                      <Text style={[styles.detailValue, { textAlign: isAR ? 'right' : 'left' }]}>{lead.meeting_date}</Text>
                    </View>
                  ) : null}
                  {lead.meeting_status ? (
                    <View style={[styles.detailRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                      <Ionicons name="flag-outline" size={14} color={SUBTEXT} style={[styles.detailIcon, { marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }]} />
                      <Text style={[styles.detailValue, { textTransform: 'capitalize', textAlign: isAR ? 'right' : 'left' }]}>
                        {isAR && lead.meeting_status === 'scheduled' ? 'مجدول' : 
                         isAR && lead.meeting_status === 'completed' ? 'مكتمل' : 
                         isAR && lead.meeting_status === 'canceled' ? 'ملغي' : 
                         lead.meeting_status}
                      </Text>
                    </View>
                  ) : null}
                  {lead.meeting_review ? (
                    <View style={[styles.detailRow, { alignItems: 'flex-start', flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                      <Ionicons name="document-text-outline" size={14} color={SUBTEXT} style={[styles.detailIcon, { marginTop: 2, marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }]} />
                      <Text style={[styles.detailValue, { textAlign: isAR ? 'right' : 'left' }]}>{lead.meeting_review}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.noMeetingWrap}>
                  <Ionicons name="calendar-outline" size={28} color={BORDER} />
                  <Text style={styles.noMeetingTxt}>{isAR ? 'لا يوجد سجلات اجتماعات' : 'No meeting logs recorded'}</Text>
                  <TouchableOpacity onPress={() => onEdit(lead)}>
                    <Text style={[styles.scheduleTxt, { color: BRAND }]}>{isAR ? '+ جدولة / تسجيل اجتماع' : '+ Schedule / Log Meeting'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Notes */}
            {lead.notes ? (
              <>
                <View style={[styles.detailDivider, { marginTop: 8 }]} />
                <View style={styles.notesSection}>
                  <View style={[styles.notesTitleRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                    <Ionicons name="document-text-outline" size={13} color={SUBTEXT} />
                    <Text style={[styles.notesTitleTxt, { marginLeft: isAR ? 0 : 4, marginRight: isAR ? 4 : 0 }]}>{isAR ? 'ملاحظة' : 'NOTE'}</Text>
                  </View>
                  <Text style={[styles.notesTxt, { textAlign: isAR ? 'right' : 'left' }]}>{lead.notes}</Text>
                </View>
              </>
            ) : null}

            {/* Expanded Actions */}
            <View style={[styles.expandedActions, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
              <TouchableOpacity
                onPress={() => onEdit(lead)}
                style={[styles.outlineActionBtn, { borderColor: BRAND, flexDirection: isAR ? 'row-reverse' : 'row' }]}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={15} color={BRAND} style={isAR ? { marginLeft: 6 } : { marginRight: 6 }} />
                <Text style={[styles.outlineActionTxt, { color: BRAND }]}>{isAR ? 'تعديل التفاصيل' : 'Edit Details'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onDelete(lead)}
                style={[styles.outlineActionBtn, { borderColor: '#FECACA', flexDirection: isAR ? 'row-reverse' : 'row' }]}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={15} color="#EF4444" style={isAR ? { marginLeft: 6 } : { marginRight: 6 }} />
                <Text style={[styles.outlineActionTxt, { color: '#EF4444' }]}>{isAR ? 'حذف' : 'Delete'}</Text>
              </TouchableOpacity>
            </View>

          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CRMDashboard() {
  const { language } = useAppContext();
  const isAR = language === 'ar';
  const router = useRouter();

  const [leads,      setLeads]      = useState([]);
  const [filtered,   setFiltered]   = useState([]);
  const [search,     setSearch]     = useState('');
  const [activeTab,  setActiveTab]  = useState('all');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    try {
      const { data } = await leadsApi.getAll();
      const list = Array.isArray(data) ? data : (data?.data ?? data?.leads ?? []);
      setLeads(list);
    } catch (e) {
      console.error('[CRM]', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── Filter ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tab = FILTERS.find(f => f.key === activeTab);
    let r = leads;
    if (activeTab !== 'all') {
      if (tab?.sourceFilter) {
        r = r.filter(l => l.action_type === activeTab);
      } else {
        r = r.filter(l => l.status === activeTab);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(l =>
        l.visitor_name?.toLowerCase().includes(q) ||
        (l.company_name || l.company)?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q)
      );
    }
    setFiltered(r);
  }, [leads, activeTab, search]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = (lead) => {
    Alert.alert(
      'Delete Lead',
      `Remove "${lead.visitor_name || 'this lead'}" from CRM?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await leadsApi.delete(lead.id);
              setLeads(prev => prev.filter(l => l.id !== lead.id));
            } catch (e) {
              Alert.alert('Error', 'Failed to delete lead.');
            }
          },
        },
      ]
    );
  };

  const handleExportData = async () => {
    try {
      if (!leads || leads.length === 0) {
        Alert.alert('Export Data', 'No leads available to export.');
        return;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Export Data', 'Sharing is not available on this device.');
        return;
      }
      
      const csvHeader = 'Name,Email,Phone,Company,Product,Source,Status,Captured At,Meeting Date,Meeting Purpose,Meeting Status,Notes\n';
      const csvRows = leads.map(l => {
        const escapeCSV = (val) => val ? `"${String(val).replace(/"/g, '""')}"` : '""';
        return [
          escapeCSV(l.visitor_name),
          escapeCSV(l.email),
          escapeCSV(l.phone),
          escapeCSV(l.company_name || l.company),
          escapeCSV(l.product_name),
          escapeCSV(l.action_type || l.source),
          escapeCSV(l.status),
          escapeCSV(new Date(l.created_at).toLocaleString()),
          escapeCSV(l.meeting_date),
          escapeCSV(l.meeting_purpose),
          escapeCSV(l.meeting_status),
          escapeCSV(l.notes)
        ].join(',');
      }).join('\n');
      
      const csvString = csvHeader + csvRows;
      const filename = `${FileSystem.documentDirectory}CRM_Leads_Export.csv`;
      
      // Ensure any existing file is deleted first
      const fileInfo = await FileSystem.getInfoAsync(filename);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filename, { idempotent: true });
      }

      await FileSystem.writeAsStringAsync(filename, csvString, { encoding: FileSystem.EncodingType.UTF8 });
      
      await Sharing.shareAsync(filename, {
        mimeType: 'text/csv',
        dialogTitle: 'Export CRM Leads',
        UTI: 'public.comma-separated-values-text'
      });
    } catch (error) {
      console.error('[Export Error]', error);
      Alert.alert('Export Error', `Failed to export CRM leads: ${error.message}`);
    }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const handleEdit = (lead) => {
    router.push({
      pathname: '/crm-lead',
      params: {
        id:              lead.id,
        visitor_name:    lead.visitor_name    || '',
        email:           lead.email           || '',
        phone:           lead.phone           || '',
        company_name:    lead.company_name    || lead.company || '',
        product_name:    lead.product_name    || '',
        status:          lead.status          || 'new',
        meeting_purpose: lead.meeting_purpose || '',
        meeting_date:    lead.meeting_date    || '',
        meeting_status:  lead.meeting_status  || 'scheduled',
        meeting_review:  lead.meeting_review  || '',
        notes:           lead.notes           || '',
      },
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={[styles.backBtn, { marginRight: isAR ? 0 : 10, marginLeft: isAR ? 10 : 0 }]}>
          <Ionicons name={isAR ? 'arrow-forward' : 'arrow-back'} size={20} color={TEXT} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { textAlign: isAR ? 'right' : 'left' }]}>{isAR ? 'إدارة العملاء' : 'Leads CRM'}</Text>
          <Text style={[styles.headerDate, { textAlign: isAR ? 'right' : 'left' }]}>
            {new Date().toLocaleDateString(isAR ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/crm-lead')}
          style={[styles.newLeadBtn, { backgroundColor: BRAND, flexDirection: isAR ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={[styles.newLeadTxt, { marginLeft: isAR ? 0 : 6, marginRight: isAR ? 6 : 0 }]}>{isAR ? 'إضافة' : 'New Lead'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <LeadCard lead={item} onEdit={handleEdit} onDelete={handleDelete} isAR={isAR} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchLeads(); }}
            tintColor={BRAND}
            colors={[BRAND]}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Pipeline Summary Card ───────────────────────────────────── */}
            <View style={[styles.pipelineCard, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
              <View style={[styles.pipelineLeft, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                <View style={[styles.pipelineIconWrap, { marginRight: isAR ? 0 : 12, marginLeft: isAR ? 12 : 0 }]}>
                  <Ionicons name="people" size={18} color={BRAND} />
                </View>
                <View style={{ flex: 1, marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }}>
                  <Text style={[styles.pipelineTitle, { textAlign: isAR ? 'right' : 'left' }]}>{isAR ? 'متابعة العملاء' : 'CRM Lead Pipeline'}</Text>
                  <Text style={[styles.pipelineSub, { textAlign: isAR ? 'right' : 'left' }]} numberOfLines={1} ellipsizeMode="tail">
                    {loading ? '…' : leads.length} {isAR ? 'عملاء مسجلين' : `contact${leads.length !== 1 ? 's' : ''} tracked`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleExportData} style={[styles.exportBtn, { borderColor: BRAND, flexDirection: isAR ? 'row-reverse' : 'row' }]} activeOpacity={0.7}>
                <Ionicons name="download-outline" size={14} color={BRAND} />
                <Text style={[styles.exportTxt, { color: BRAND, marginLeft: isAR ? 0 : 6, marginRight: isAR ? 6 : 0 }]}>{isAR ? 'تصدير' : 'Export Data'}</Text>
              </TouchableOpacity>
            </View>

            {/* ── Filter Tabs + Search ────────────────────────────────────── */}
            <View style={styles.filterBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.filterTabs, { flexDirection: isAR ? 'row-reverse' : 'row' }]}
              >
                {FILTERS.map(f => {
                  const count = f.key === 'all'
                    ? leads.length
                    : f.sourceFilter
                      ? leads.filter(l => l.action_type === f.key).length
                      : leads.filter(l => l.status === f.key).length;
                  const active = activeTab === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      onPress={() => setActiveTab(f.key)}
                      style={[styles.filterTab, active && { backgroundColor: BRAND }]}
                    >
                      <Text style={[styles.filterTabTxt, active && { color: '#fff' }]}>
                        {isAR && f.label_ar ? f.label_ar : f.label}{count > 0 ? `  ${count}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Search ─────────────────────────────────────────────────── */}
            <View style={[styles.searchWrap, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
              <Ionicons name="search-outline" size={15} color={LABEL} style={{ marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={isAR ? 'البحث في العملاء...' : 'Search CRM…'}
                placeholderTextColor={LABEL}
                style={[styles.searchInput, { textAlign: isAR ? 'right' : 'left' }]}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={15} color={LABEL} />
                </TouchableOpacity>
              )}
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={BRAND} size="large" />
            </View>
          ) : (
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={48} color={BORDER} />
              <Text style={styles.emptyTxt}>{isAR ? 'لا يوجد عملاء' : 'No leads found'}</Text>
              <TouchableOpacity
                onPress={() => router.push('/crm-lead')}
                style={[styles.emptyAddBtn, { backgroundColor: BRAND }]}
              >
                <Text style={styles.emptyAddTxt}>{isAR ? 'أضف عميلك الأول' : 'Add First Lead'}</Text>
              </TouchableOpacity>
            </View>
          )
        }
        ListFooterComponent={
          !loading && filtered.length > 0 ? (
            <Text style={[styles.footerNote, { textAlign: isAR ? 'right' : 'center' }]}>
              {isAR ? `عرض ${filtered.length} من أصل ${leads.length} عملاء` : `Showing ${filtered.length} of ${leads.length} leads`}
            </Text>
          ) : <View style={{ height: 32 }} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, { right: isAR ? undefined : 20, left: isAR ? 20 : undefined }]} 
        onPress={() => router.push('/crm-lead')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: BG,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: TEXT, letterSpacing: -0.3 },
  headerDate:   { fontSize: 12, color: SUBTEXT, marginTop: 1 },
  newLeadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8,
  },
  newLeadTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // List
  listContent: { paddingBottom: 40 },

  // Pipeline Card
  pipelineCard: {
    margin: 16, marginBottom: 0,
    backgroundColor: CARD,
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8,
  },
  pipelineLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  pipelineIconWrap: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: BRAND + '12',
    justifyContent: 'center', alignItems: 'center',
  },
  pipelineTitle: { fontSize: 13, fontWeight: '800', color: TEXT },
  pipelineSub:   { fontSize: 11, color: SUBTEXT, marginTop: 2 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1,
  },
  exportTxt: { fontSize: 11, fontWeight: '700' },

  // Filter bar
  filterBar: {
    marginTop: 16, paddingHorizontal: 16,
  },
  filterTabs:   { flexDirection: 'row', gap: 8 },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER,
  },
  filterTabTxt: { fontSize: 13, fontWeight: '700', color: SUBTEXT },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, marginTop: 12,
    backgroundColor: CARD,
    borderRadius: 10, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 12, height: 40,
  },
  searchInput: { flex: 1, fontSize: 13, color: TEXT, fontWeight: '500' },

  // Lead Card
  leadCard: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    marginHorizontal: 16, marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  accentBar:      { width: 4 },
  leadCardInner:  { flex: 1, padding: 14 },
  leadCardHeaderContainer: {
    width: '100%',
  },
  leadCardHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerLeft: {
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameBlock: { flex: 1, minWidth: 0, marginLeft: 10 },
  avatarTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },
  leadName:  { fontSize: 15, fontWeight: '700', color: TEXT },
  leadCo:    { fontSize: 12, color: SUBTEXT, marginTop: 1 },
  leadCardSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingLeft: 46, // Aligns content with the start of Name block
  },
  badgeRow:  { flexDirection: 'row', gap: 6, flexShrink: 0 },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  capturedTime: {
    fontSize: 11,
    color: SUBTEXT,
    fontWeight: '500',
  },
  expandedActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  outlineActionTxt: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Lead Details
  leadDetails: { marginTop: 14 },
  detailSection: {},
  detailSectionLabel: {
    fontSize: 10, fontWeight: '800', color: LABEL,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 7,
  },
  detailIcon:  { marginRight: 8, flexShrink: 0 },
  detailLabel: { fontSize: 13, color: SUBTEXT, fontWeight: '500' },
  detailValue: { fontSize: 13, color: TEXT, fontWeight: '500', flexShrink: 1 },
  detailDivider: {
    height: 1, backgroundColor: BORDER, marginVertical: 12,
  },

  // No Meeting
  noMeetingWrap: {
    alignItems: 'center', paddingVertical: 12, gap: 6,
  },
  noMeetingTxt: { fontSize: 13, color: SUBTEXT, fontWeight: '500' },
  scheduleTxt:  { fontSize: 13, fontWeight: '700', marginTop: 2 },

  // Notes
  notesSection: { paddingTop: 4 },
  notesTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  notesTitleTxt: {
    fontSize: 10, fontWeight: '800', color: LABEL,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  notesTxt: { fontSize: 13, color: TEXT, lineHeight: 20 },

  // Empty / Loading
  centered: {
    padding: 48, alignItems: 'center', gap: 12,
  },
  emptyTxt: { fontSize: 14, color: SUBTEXT, fontWeight: '500' },
  emptyAddBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 4,
  },
  emptyAddTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Footer
  footerNote: {
    textAlign: 'center', fontSize: 12, color: LABEL,
    paddingVertical: 20,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BRAND,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 99,
  },
});
