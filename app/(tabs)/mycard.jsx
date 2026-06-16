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
import DateTimePicker from '@react-native-community/datetimepicker';
import { WebView } from 'react-native-webview';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useRouter, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { cardsApi, authApi, API_BASE_URL, FRONTEND_BASE_URL, tokenStore, leadsApi } from '@/services/api';
import { useAppContext } from '@/context/AppContext';
import * as Location from 'expo-location';

const BRAND = '#1b4654';
const SCREEN_WIDTH = Dimensions.get('window').width;

/* ─── helpers ─── */
const resolveUrl = (val) => {
  if (!val) return null;
  if (val.startsWith('data:')) return val;
  const base = API_BASE_URL.replace(/\/api$/, '');
  const uploadPath = val.match(/\/uploads\/.+/);
  if (uploadPath) return `${base}${uploadPath[0]}`;
  if (val.startsWith('http')) return val;
  return `${base}${val}`;
};

const parseDigCardPath = (value) => {
  if (!value) return null;
  const t = String(value);
  const m = t.match(/\/card\/([^/]+)\/([^/?#]+)/) || t.match(/\/c\/([^/]+)\/([^/?#]+)/);
  return m ? { tenantSlug: m[1], cardSlug: m[2] } : null;
};

import Svg, { Circle } from 'react-native-svg';

/* ─── Premium Modern Clockwise Rings Chart ─── */
function ConcentricRingsChart({ views = 0, scans = 0, captured = 0, manual = 0, isDark }) {
  const total = views + scans + captured + manual;
  const pctViews = total > 0 ? (views / total) : 0;
  const pctScans = total > 0 ? (scans / total) : 0;
  const pctCaptured = total > 0 ? (captured / total) : 0;
  const pctManual = total > 0 ? (manual / total) : 0;

  const size = 200;
  const center = size / 2;
  
  // Radius of concentric rings
  const r1 = 80; // Views (Outer)
  const r2 = 64; // Scans
  const r3 = 48; // Captured Leads
  const r4 = 32; // Manual Entries (Inner)
  
  // Circumferences
  const c1 = 2 * Math.PI * r1;
  const c2 = 2 * Math.PI * r2;
  const c3 = 2 * Math.PI * r3;
  const c4 = 2 * Math.PI * r4;

  const strokeWidth = 10;
  const bgOpacity = isDark ? 0.12 : 0.06;

  // Custom Harmonious Color Palette
  const colorViews = '#0E7490';    // Cyan/Dark Blue Teal
  const colorScans = '#10B981';    // Vivid Emerald
  const colorCaptured = '#3B82F6'; // Indigo Blue
  const colorManual = '#F59E0B';   // Warm Amber

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: 24 }}>
      <View style={{ position: 'relative', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Ring 1 (Views) */}
          <Circle cx={center} cy={center} r={r1} fill="transparent" stroke={colorViews} strokeWidth={strokeWidth} opacity={bgOpacity} />
          <Circle
            cx={center} cy={center} r={r1} fill="transparent" stroke={colorViews} strokeWidth={strokeWidth}
            strokeDasharray={`${c1} ${c1}`}
            strokeDashoffset={c1 * (1 - (pctViews || 0.02))} // minimal trail if zero
            strokeLinecap="round"
            origin={`${center}, ${center}`}
            rotation="-90"
          />

          {/* Ring 2 (Scans) */}
          <Circle cx={center} cy={center} r={r2} fill="transparent" stroke={colorScans} strokeWidth={strokeWidth} opacity={bgOpacity} />
          <Circle
            cx={center} cy={center} r={r2} fill="transparent" stroke={colorScans} strokeWidth={strokeWidth}
            strokeDasharray={`${c2} ${c2}`}
            strokeDashoffset={c2 * (1 - (pctScans || 0.02))}
            strokeLinecap="round"
            origin={`${center}, ${center}`}
            rotation="-90"
          />

          {/* Ring 3 (Captured) */}
          <Circle cx={center} cy={center} r={r3} fill="transparent" stroke={colorCaptured} strokeWidth={strokeWidth} opacity={bgOpacity} />
          <Circle
            cx={center} cy={center} r={r3} fill="transparent" stroke={colorCaptured} strokeWidth={strokeWidth}
            strokeDasharray={`${c3} ${c3}`}
            strokeDashoffset={c3 * (1 - (pctCaptured || 0.02))}
            strokeLinecap="round"
            origin={`${center}, ${center}`}
            rotation="-90"
          />

          {/* Ring 4 (Manual) */}
          <Circle cx={center} cy={center} r={r4} fill="transparent" stroke={colorManual} strokeWidth={strokeWidth} opacity={bgOpacity} />
          <Circle
            cx={center} cy={center} r={r4} fill="transparent" stroke={colorManual} strokeWidth={strokeWidth}
            strokeDasharray={`${c4} ${c4}`}
            strokeDashoffset={c4 * (1 - (pctManual || 0.02))}
            strokeLinecap="round"
            origin={`${center}, ${center}`}
            rotation="-90"
          />
        </Svg>

        {/* Center content */}
        <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: isDark ? '#FFFFFF' : '#1E293B', letterSpacing: -0.5 }}>
            {total}
          </Text>
          <Text style={{ fontSize: 9, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B', textTransform: 'uppercase', marginTop: 2, letterSpacing: 0.5 }}>
            Interactions
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ─── Analytics Page ─── */
function AnalyticsScreen({ onBack, user, isAR, isDark, brandColor }) {
  const [stats, setStats] = useState({ views: 0, qr_scans: 0, shares: 0, leads: 0 });
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all', 'today', 'week', 'month', 'custom'
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 3600000));
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      if (user?.role === 'card_user') {
        const [cardRes, leadsRes] = await Promise.all([
          cardsApi.getMyCard().catch(() => null),
          leadsApi.getAll().catch(() => ({ data: [] }))
        ]);
        const cardData = cardRes?.data || {};
        const allLeads = Array.isArray(leadsRes.data) ? leadsRes.data : leadsRes.data?.leads || [];
        setStats({
          views: cardData.stats?.views || 0,
          qr_scans: cardData.stats?.qr_scans || 0,
          shares: cardData.stats?.shares || 0,
          leads: allLeads.length
        });
        setLeads(allLeads);
      } else {
        const [cardsRes, leadsRes] = await Promise.all([
          cardsApi.getAll().catch(() => ({ data: [] })),
          leadsApi.getAll().catch(() => ({ data: [] }))
        ]);
        const cards = Array.isArray(cardsRes.data) ? cardsRes.data : cardsRes.data?.cards || [];
        const allLeads = Array.isArray(leadsRes.data) ? leadsRes.data : leadsRes.data?.leads || [];
        
        let totalViews = 0;
        let totalScans = 0;
        let totalShares = 0;
        cards.forEach(c => {
          totalViews += (c.views || 0);
          totalScans += (c.qr_scans || 0);
          totalShares += (c.contact_shares || 0);
        });
        
        setStats({
          views: totalViews,
          qr_scans: totalScans,
          shares: totalShares,
          leads: allLeads.length
        });
        setLeads(allLeads);
      }
    } catch (err) {
      console.warn('[fetchStats AnalyticsScreen]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (!leads.length) {
      setFilteredLeads([]);
      return;
    }
    
    let result = [...leads];
    const now = new Date();
    
    if (filterType === 'today') {
      const todayStr = now.toDateString();
      result = leads.filter(l => new Date(l.created_at).toDateString() === todayStr);
    } else if (filterType === 'week') {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600000);
      result = leads.filter(l => new Date(l.created_at) >= oneWeekAgo);
    } else if (filterType === 'month') {
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      result = leads.filter(l => {
        const d = new Date(l.created_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
    } else if (filterType === 'custom') {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      result = leads.filter(l => {
        const d = new Date(l.created_at);
        return d >= start && d <= end;
      });
    }
    
    setFilteredLeads(result);
  }, [leads, filterType, startDate, endDate]);

  const bg = isDark ? '#0F172A' : '#F8FAFC';
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const text = isDark ? '#F8FAFC' : '#1A1A1A';
  const subtext = isDark ? '#94A3B8' : '#64748B';
  const divider = isDark ? '#334155' : '#F1F5F9';
  const rowDir = isAR ? 'row-reverse' : 'row';
  const txtAlign = isAR ? 'right' : 'left';

  const formatDateLabel = (d) => {
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  const activeLeads = filterType === 'all' ? leads : filteredLeads;
  const activeCapturedCount = activeLeads.filter(l => l.action_type !== 'manual_entry').length;
  const activeManualCount = activeLeads.filter(l => l.action_type === 'manual_entry').length;
  const activeTotalLeads = activeCapturedCount + activeManualCount;

  return (
    <View style={[sub.container, { backgroundColor: bg }]}>
      <SubHeader
        onBack={onBack}
        title={isAR ? 'إحصائيات البطاقة' : 'Card Analytics'}
        onSend={fetchStats}
        sendLabel={isAR ? 'تحديث' : 'REFRESH'}
        isAR={isAR}
      />
      
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Date Filter Segmented Control */}
        <View style={{ flexDirection: rowDir, justifyContent: 'space-between', marginBottom: 20, gap: 4 }}>
          {['all', 'today', 'week', 'month', 'custom'].map((type) => {
            const active = filterType === type;
            let label = 'All';
            if (type === 'today') label = isAR ? 'اليوم' : 'Today';
            if (type === 'week') label = isAR ? 'أسبوع' : 'Weekly';
            if (type === 'month') label = isAR ? 'شهري' : 'Monthly';
            if (type === 'custom') label = isAR ? 'مخصص' : 'Range';

            return (
              <TouchableOpacity
                key={type}
                onPress={() => setFilterType(type)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: active ? brandColor : cardBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: active ? brandColor : divider,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: active ? '#fff' : subtext }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom Range picker buttons */}
        {filterType === 'custom' && (
          <View style={{ flexDirection: rowDir, gap: 12, marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => setShowStartPicker(true)}
              style={{ flex: 1, backgroundColor: cardBg, padding: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: divider }}
            >
              <Text style={{ fontSize: 10, color: subtext }}>{isAR ? 'من تاريخ' : 'START DATE'}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: text, marginTop: 4 }}>{formatDateLabel(startDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowEndPicker(true)}
              style={{ flex: 1, backgroundColor: cardBg, padding: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: divider }}
            >
              <Text style={{ fontSize: 10, color: subtext }}>{isAR ? 'إلى تاريخ' : 'END DATE'}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: text, marginTop: 4 }}>{formatDateLabel(endDate)}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Date Pickers */}
        {showStartPicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(e, d) => { setShowStartPicker(false); if (d) setStartDate(d); }}
          />
        )}
        {showEndPicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(e, d) => { setShowEndPicker(false); if (d) setEndDate(d); }}
          />
        )}

        {loading ? (
          <ActivityIndicator color={brandColor} size="large" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Clockwise Circular Concentric Graph */}
            <View style={{ backgroundColor: cardBg, padding: 16, borderRadius: 24, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: divider }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: text, marginBottom: 10 }}>{isAR ? 'توزيع الأنشطة' : 'Activity Breakdown'}</Text>
              <ConcentricRingsChart views={stats.views} scans={stats.qr_scans} captured={activeCapturedCount} manual={activeManualCount} isDark={isDark} />
              
              {/* Legend */}
              <View style={{ flexDirection: rowDir, justifyContent: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#0E7490' }} />
                  <Text style={{ fontSize: 11, color: subtext }}>{isAR ? 'زيارات' : 'Views'}</Text>
                </View>
                <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' }} />
                  <Text style={{ fontSize: 11, color: subtext }}>{isAR ? 'مسح QR' : 'QR Scans'}</Text>
                </View>
                <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' }} />
                  <Text style={{ fontSize: 11, color: subtext }}>{isAR ? 'جهات الاتصال' : 'Captured'}</Text>
                </View>
                <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#F59E0B' }} />
                  <Text style={{ fontSize: 11, color: subtext }}>{isAR ? 'يدوي' : 'Manual'}</Text>
                </View>
              </View>
            </View>

            {/* Individual Detailed Cards */}
            <View style={{ gap: 12 }}>
              {/* Card Views */}
              <View style={{ backgroundColor: cardBg, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: divider, flexDirection: rowDir, alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(27, 70, 84, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="eye-outline" size={22} color="#1b4654" />
                  </View>
                  <View style={{ alignItems: txtAlign, flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: text }}>{isAR ? 'زيارات البطاقة' : 'Card Views'}</Text>
                    <Text style={{ fontSize: 11, color: subtext }}>{isAR ? 'إجمالي عدد مرات فتح الرابط' : 'Total times card link was opened'}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: text, marginLeft: 8 }}>{stats.views}</Text>
              </View>

              {/* QR Scans */}
              <View style={{ backgroundColor: cardBg, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: divider, flexDirection: rowDir, alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(13, 155, 110, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="qr-code-outline" size={22} color="#0d9b6e" />
                  </View>
                  <View style={{ alignItems: txtAlign, flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: text }}>{isAR ? 'مسح رمز QR' : 'QR Scans'}</Text>
                    <Text style={{ fontSize: 11, color: subtext }}>{isAR ? 'إجمالي عدد مرات مسح الكود' : 'Total times QR code was scanned'}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: text, marginLeft: 8 }}>{stats.qr_scans}</Text>
              </View>

              {/* Captured Leads (Online) */}
              <View style={{ backgroundColor: cardBg, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: divider, flexDirection: rowDir, alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="people-outline" size={22} color="#3b82f6" />
                  </View>
                  <View style={{ alignItems: txtAlign, flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: text }}>{isAR ? 'جهات الاتصال الملتقطة' : 'Captured Leads'}</Text>
                    <Text style={{ fontSize: 11, color: subtext }}>
                      {filterType === 'all' 
                        ? (isAR ? 'مسجلة عبر رمز الاستجابة أو النموذج' : 'Registered via QR scan or form')
                        : (isAR ? `المصفاة للمدة المحددة` : 'Filtered online contacts')}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: text, marginLeft: 8 }}>{activeCapturedCount}</Text>
              </View>

              {/* Manually Added Leads */}
              <View style={{ backgroundColor: cardBg, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: divider, flexDirection: rowDir, alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(245, 158, 11, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="person-add-outline" size={22} color="#f59e0b" />
                  </View>
                  <View style={{ alignItems: txtAlign, flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: text }}>{isAR ? 'مضافة يدويًا' : 'Manual Contacts'}</Text>
                    <Text style={{ fontSize: 11, color: subtext }}>
                      {filterType === 'all' 
                        ? (isAR ? 'جهات اتصال مضافة يدويًا من قبلك' : 'Contacts added manually by you')
                        : (isAR ? `المصفاة للمدة المحددة` : 'Filtered manual contacts')}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: text, marginLeft: 8 }}>{activeManualCount}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ─── Sidebar Drawer ─── */
function SidebarDrawer({
  visible, onClose, user, onLogout, avatarUrl, onOpenAnalytics,
  onOpenLocationMap, isLocationSharing, onToggleLocationSharing
}) {
  const { isDark, toggleTheme, language, changeLanguage } = useAppContext();
  const isRTL = language === 'ar';
  const hiddenOffset = -SCREEN_WIDTH * 0.78;
  const translateX = useState(new Animated.Value(hiddenOffset))[0];

  // Analytics states
  const [stats, setStats] = useState({ views: 0, qr_scans: 0, shares: 0, leads: 0 });
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'today', 'week', 'month', 'custom'
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 3600000));
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Fetch stats and leads on visible
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      if (user?.role === 'card_user') {
        const [cardRes, leadsRes] = await Promise.all([
          cardsApi.getMyCard().catch(() => null),
          leadsApi.getAll().catch(() => ({ data: [] }))
        ]);
        const cardData = cardRes?.data || {};
        const allLeads = Array.isArray(leadsRes.data) ? leadsRes.data : leadsRes.data?.leads || [];
        setStats({
          views: cardData.stats?.views || 0,
          qr_scans: cardData.stats?.qr_scans || 0,
          shares: cardData.stats?.shares || 0,
          leads: allLeads.length
        });
        setLeads(allLeads);
      } else {
        const [cardsRes, leadsRes] = await Promise.all([
          cardsApi.getAll().catch(() => ({ data: [] })),
          leadsApi.getAll().catch(() => ({ data: [] }))
        ]);
        const cards = Array.isArray(cardsRes.data) ? cardsRes.data : cardsRes.data?.cards || [];
        const allLeads = Array.isArray(leadsRes.data) ? leadsRes.data : leadsRes.data?.leads || [];
        
        let totalViews = 0;
        let totalScans = 0;
        let totalShares = 0;
        cards.forEach(c => {
          totalViews += (c.views || 0);
          totalScans += (c.qr_scans || 0);
          totalShares += (c.contact_shares || 0);
        });
        
        setStats({
          views: totalViews,
          qr_scans: totalScans,
          shares: totalShares,
          leads: allLeads.length
        });
        setLeads(allLeads);
      }
    } catch (err) {
      console.warn('[fetchStats Sidebar Drawer]', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchStats();
    }
  }, [visible]);

  // Apply filters on leads when type or dates change
  useEffect(() => {
    if (!leads.length) {
      setFilteredLeads([]);
      return;
    }
    
    let result = [...leads];
    const now = new Date();
    
    if (filterType === 'today') {
      const todayStr = now.toDateString();
      result = leads.filter(l => new Date(l.created_at).toDateString() === todayStr);
    } else if (filterType === 'week') {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600000);
      result = leads.filter(l => new Date(l.created_at) >= oneWeekAgo);
    } else if (filterType === 'month') {
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      result = leads.filter(l => {
        const d = new Date(l.created_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
    } else if (filterType === 'custom') {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      result = leads.filter(l => {
        const d = new Date(l.created_at);
        return d >= start && d <= end;
      });
    }
    
    setFilteredLeads(result);
  }, [leads, filterType, startDate, endDate]);

  // Reset to correct side whenever direction changes while drawer is closed
  useEffect(() => {
    if (!visible) translateX.setValue(hiddenOffset);
  }, [isRTL]);

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : hiddenOffset,
      duration: 260,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible]);

  if (!visible) return null;

  const isAR = language === 'ar';
  const displayName = isAR && user?.name_ar ? user.name_ar : (user?.name || 'User');
  const initials = (displayName || 'U').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  const bg = isDark ? '#1E293B' : '#fff';
  const cardBg = isDark ? '#0F172A' : '#F8FAFC';
  const text = isDark ? '#F8FAFC' : '#1A1A1A';
  const subtext = isDark ? '#94A3B8' : '#64748B';
  const divider = isDark ? '#334155' : '#F0F0F0';

  const panelPos = { left: 0 };
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const iconMargin = isRTL ? { marginLeft: 14 } : { marginRight: 14 };
  const txtAlign = isRTL ? 'right' : 'left';

  const formatDateLabel = (d) => {
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  const activeLeads = filterType === 'all' ? leads : filteredLeads;
  const activeCapturedCount = activeLeads.filter(l => l.action_type !== 'manual_entry').length;
  const activeManualCount = activeLeads.filter(l => l.action_type === 'manual_entry').length;

  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={sd.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[sd.panel, panelPos, { transform: [{ translateX }], shadowOffset: { width: isRTL ? -4 : 4, height: 0 } }]}>
        <SafeAreaView style={{ flex: 1, backgroundColor: BRAND }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ backgroundColor: bg }}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {/* Profile */}
            <View style={[sd.profileSection, { alignItems: isRTL ? 'flex-end' : 'flex-start', backgroundColor: BRAND }]}>
              {avatarUrl
                ? <Image source={{ uri: avatarUrl }} style={sd.avatar} />
                : <View style={[sd.avatar, sd.avatarFallback]}>
                    <Text style={sd.avatarInitial}>{initials}</Text>
                  </View>}
              <Text style={[sd.name, { textAlign: txtAlign }]} numberOfLines={1}>{displayName}</Text>
              <Text style={[sd.email, { textAlign: txtAlign }]} numberOfLines={1}>{user?.email || ''}</Text>
            </View>

            {/* 📈 Analytics Section */}
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: BRAND, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12, textAlign: txtAlign }}>
                {isAR ? 'التحليلات والإحصائيات' : 'ANALYTICS & STATS'}
              </Text>
              
              {/* Date Filter Buttons */}
              <View style={{ flexDirection: rowDir, justifyContent: 'space-between', marginBottom: 12, gap: 4 }}>
                {['all', 'today', 'week', 'month', 'custom'].map((type) => {
                  const active = filterType === type;
                  let label = 'All';
                  if (type === 'today') label = isAR ? 'اليوم' : 'Today';
                  if (type === 'week') label = isAR ? 'أسبوع' : 'Weekly';
                  if (type === 'month') label = isAR ? 'شهري' : 'Monthly';
                  if (type === 'custom') label = isAR ? 'مخصص' : 'Range';

                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setFilterType(type)}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: active ? BRAND : (isDark ? '#334155' : '#F1F5F9'),
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '700', color: active ? '#fff' : (isDark ? '#94A3B8' : '#64748B') }}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Date Inputs */}
              {filterType === 'custom' && (
                <View style={{ flexDirection: rowDir, gap: 10, marginBottom: 14 }}>
                  <TouchableOpacity
                    onPress={() => setShowStartPicker(true)}
                    style={{ flex: 1, backgroundColor: cardBg, padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: divider }}
                  >
                    <Text style={{ fontSize: 10, color: subtext }}>{isAR ? 'من تاريخ' : 'START DATE'}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: text, marginTop: 2 }}>{formatDateLabel(startDate)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowEndPicker(true)}
                    style={{ flex: 1, backgroundColor: cardBg, padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: divider }}
                  >
                    <Text style={{ fontSize: 10, color: subtext }}>{isAR ? 'إلى تاريخ' : 'END DATE'}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: text, marginTop: 2 }}>{formatDateLabel(endDate)}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Native Date Pickers */}
              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(e, date) => {
                    setShowStartPicker(false);
                    if (date) setStartDate(date);
                  }}
                />
              )}
              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(e, date) => {
                    setShowEndPicker(false);
                    if (date) setEndDate(date);
                  }}
                />
              )}

              {/* Stats Cards */}
              {loadingStats ? (
                <ActivityIndicator color={BRAND} style={{ marginVertical: 20 }} />
              ) : (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: rowDir, gap: 8 }}>
                    {/* View Scans Card */}
                    <View style={{ flex: 1, backgroundColor: cardBg, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: divider, alignItems: 'center' }}>
                      <Ionicons name="eye-outline" size={18} color={BRAND} style={{ marginBottom: 4 }} />
                      <Text style={{ fontSize: 9, fontWeight: '600', color: subtext, textAlign: 'center' }}>{isAR ? 'الزيارات' : 'CARD VIEWS'}</Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: text, marginTop: 4 }}>
                        {stats.views}
                      </Text>
                    </View>
                    
                    {/* QR Scans Card */}
                    <View style={{ flex: 1, backgroundColor: cardBg, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: divider, alignItems: 'center' }}>
                      <Ionicons name="qr-code-outline" size={18} color="#0d9b6e" style={{ marginBottom: 4 }} />
                      <Text style={{ fontSize: 9, fontWeight: '600', color: subtext, textAlign: 'center' }}>{isAR ? 'مسح QR' : 'QR SCANS'}</Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: text, marginTop: 4 }}>
                        {stats.qr_scans}
                      </Text>
                    </View>
                  </View>

                  {/* Captured Leads Card */}
                  <View style={{ backgroundColor: cardBg, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: divider, flexDirection: rowDir, alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 10, flex: 1 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="people-outline" size={16} color="#3b82f6" />
                      </View>
                      <View style={{ alignItems: txtAlign, flex: 1 }}>
                        <Text style={{ fontSize: 9, fontWeight: '600', color: subtext }}>{isAR ? 'الملتقطة أونلاين' : 'CAPTURED LEADS'}</Text>
                        <Text style={{ fontSize: 11, color: subtext, marginTop: 1 }} numberOfLines={1}>
                          {isAR ? 'عبر النموذج أو QR' : 'Via form or QR'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: text, marginLeft: 6 }}>
                      {activeCapturedCount}
                    </Text>
                  </View>

                  {/* Manual Leads Card */}
                  <View style={{ backgroundColor: cardBg, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: divider, flexDirection: rowDir, alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 10, flex: 1 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(245, 158, 11, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="person-add-outline" size={16} color="#f59e0b" />
                      </View>
                      <View style={{ alignItems: txtAlign, flex: 1 }}>
                        <Text style={{ fontSize: 9, fontWeight: '600', color: subtext }}>{isAR ? 'الملقنة يدويًا' : 'MANUAL CONTACTS'}</Text>
                        <Text style={{ fontSize: 11, color: subtext, marginTop: 1 }} numberOfLines={1}>
                          {isAR ? 'جهات اتصال مدخلة' : 'Manually inputted contacts'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: text, marginLeft: 6 }}>
                      {activeManualCount}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={[sd.divider, { backgroundColor: divider }]} />

            <View style={sd.menu}>


              {/* Analytics */}
              <TouchableOpacity
                style={[sd.menuItem, { flexDirection: rowDir }]}
                onPress={() => {
                  onClose();
                  if (onOpenAnalytics) onOpenAnalytics();
                }}
              >
                <View style={[sd.menuIcon, iconMargin, { backgroundColor: isDark ? 'rgba(27,70,84,0.2)' : '#EDF5F3' }]}>
                  <Ionicons name="stats-chart-outline" size={20} color={isDark ? '#4DD0E1' : BRAND} />
                </View>
                <Text style={[sd.menuLabel, { flex: 1, color: text, textAlign: txtAlign }]}>
                  {language === 'ar' ? 'التحليلات' : 'Analytics'}
                </Text>
              </TouchableOpacity>

              {/* Language */}
              <View style={[sd.menuItem, { flexDirection: rowDir }]}>
                <View style={[sd.menuIcon, iconMargin, { backgroundColor: isDark ? 'rgba(0,96,100,0.2)' : '#E0F7FA' }]}>
                  <Ionicons name="language-outline" size={20} color={isDark ? '#4DD0E1' : '#006064'} />
                </View>
                <Text style={[sd.menuLabel, { flex: 1, color: text, textAlign: txtAlign }]}>
                  {language === 'ar' ? 'اللغة' : 'Language'}
                </Text>
                <View style={[sd.langToggle, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
                  <TouchableOpacity
                    onPress={() => changeLanguage('ar')}
                    style={[sd.langBtn, language === 'ar' && { backgroundColor: isDark ? '#1E293B' : '#fff' }]}
                  >
                    <Text style={[sd.langBtnText, { color: language === 'ar' ? (isDark ? '#fff' : BRAND) : subtext }]}>ع</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => changeLanguage('en')}
                    style={[sd.langBtn, language === 'en' && { backgroundColor: isDark ? '#1E293B' : '#fff' }]}
                  >
                    <Text style={[sd.langBtnText, { color: language === 'en' ? (isDark ? '#fff' : BRAND) : subtext }]}>EN</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Dark Mode */}
              <View style={[sd.menuItem, { flexDirection: rowDir }]}>
                <View style={[sd.menuIcon, iconMargin, { backgroundColor: isDark ? 'rgba(74,20,140,0.3)' : '#F3E5F5' }]}>
                  <Ionicons name="moon-outline" size={20} color={isDark ? '#E1BEE7' : '#4A148C'} />
                </View>
                <Text style={[sd.menuLabel, { flex: 1, color: text, textAlign: txtAlign }]}>
                  {language === 'ar' ? 'الوضع الداكن' : 'Dark Mode'}
                </Text>
                <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#CBD5E1', true: BRAND }} thumbColor="#fff" />
              </View>

              {/* Support */}
              <TouchableOpacity
                style={[sd.menuItem, { flexDirection: rowDir }]}
                onPress={() => Linking.openURL('mailto:anintl.ind@gmail.com?subject=DigCard Support Request')}
              >
                <View style={[sd.menuIcon, iconMargin, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2' }]}>
                  <Ionicons name="help-buoy-outline" size={20} color="#EF4444" />
                </View>
                <Text style={[sd.menuLabel, { flex: 1, color: text, textAlign: txtAlign }]}>
                  {language === 'ar' ? 'الدعم الفني' : 'Support'}
                </Text>
              </TouchableOpacity>

              {/* Share Location */}
              <View style={[sd.menuItem, { flexDirection: rowDir }]}>
                <View style={[sd.menuIcon, iconMargin, { backgroundColor: isLocationSharing ? 'rgba(16,185,129,0.15)' : (isDark ? 'rgba(255,255,255,0.1)' : '#EDF5F3') }]}>
                  <Ionicons name="location-outline" size={20} color={isLocationSharing ? '#10B981' : (isDark ? '#4DD0E1' : BRAND)} />
                </View>
                <Text style={[sd.menuLabel, { flex: 1, color: text, textAlign: txtAlign }]}>
                  {language === 'ar' ? 'مشاركة الموقع' : 'Share Location'}
                </Text>
                <Switch
                  value={isLocationSharing}
                  onValueChange={onToggleLocationSharing}
                  trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                  thumbColor="#fff"
                />
              </View>



              {/* Generate Lead */}
              <TouchableOpacity
                style={[sd.menuItem, { flexDirection: rowDir }]}
                onPress={() => {
                  onClose();
                  router.push('/(tabs)/contacts?add=true');
                }}
              >
                <View style={[sd.menuIcon, iconMargin, { backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EDF5F3' }]}>
                  <Ionicons name="person-add-outline" size={20} color={isDark ? '#3b82f6' : BRAND} />
                </View>
                <Text style={[sd.menuLabel, { flex: 1, color: text, textAlign: txtAlign }]}>
                  {language === 'ar' ? 'إضافة عميل' : 'Generate Lead'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={[sd.drawerFooter, { backgroundColor: bg }]}>
            <TouchableOpacity style={sd.signOutBtn} onPress={onLogout}>
              <Text style={sd.signOutText}>{isAR ? 'تسجيل خروج' : 'Sign Out'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

/* ─── Share option row ─── */
function ShareRow({ icon, label, onPress, isLast, customIcon, isAR }) {
  return (
    <TouchableOpacity
      style={[sh.row, !isLast && sh.rowBorder, { flexDirection: isAR ? 'row-reverse' : 'row' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[sh.rowIconWrap, { marginRight: isAR ? 0 : 14, marginLeft: isAR ? 14 : 0 }]}>
        {customIcon || <Ionicons name={icon} size={22} color="#fff" />}
      </View>
      <Text style={[sh.rowLabel, { flex: 1, textAlign: isAR ? 'right' : 'left' }]}>{label}</Text>
      <Ionicons name={isAR ? 'chevron-back' : 'chevron-forward'} size={15} color="rgba(255,255,255,0.35)" />
    </TouchableOpacity>
  );
}

/* ─── Shared sub-screen header ─── */
function SubHeader({ onBack, title, onSend, sendLabel, isAR }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[sub.header, {
      paddingTop: Math.max(insets.top, 16) + 8,
      flexDirection: isAR ? 'row-reverse' : 'row',
      backgroundColor: BRAND,
    }]}>
      <TouchableOpacity
        onPress={onBack}
        style={sub.backBtn}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        activeOpacity={0.6}
      >
        <Ionicons name={isAR ? 'chevron-forward' : 'chevron-back'} size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={sub.headerTitle} numberOfLines={1}>{title}</Text>
      <TouchableOpacity
        onPress={onSend}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={sub.headerAction}>{sendLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Email sub-screen ─── */
function EmailScreen({ onBack, cardUrl, displayName }) {
  const { language } = useAppContext();
  const isAR = language === 'ar';
  const [to, setTo] = useState('');
  const [message, setMessage] = useState(isAR ? 'مرحباً، انقر على هذا الرابط للحصول على بطاقتي:' : 'Hi, tap this link to get my business card:');
  const send = () => {
    if (!to.trim()) { Alert.alert(isAR ? 'مطلوب' : 'Required', isAR ? 'أدخل البريد الإلكتروني للمستلم.' : 'Enter a recipient email.'); return; }
    Linking.openURL(`mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(`${displayName}'s Digital Card`)}&body=${encodeURIComponent(`${message}\n\n${cardUrl}`)}`);
  };
  return (
    <KeyboardAvoidingView style={sub.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SubHeader
        onBack={onBack}
        title={isAR ? 'إرسال بطاقتك بالبريد' : 'Email Your Card'}
        onSend={send}
        sendLabel={isAR ? 'إرسال' : 'SEND'}
        isAR={isAR}
      />
      <ScrollView contentContainerStyle={sub.body} keyboardShouldPersistTaps="handled">
        <View style={[sub.card, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
          <Text style={[sub.cardLabel, { textAlign: isAR ? 'right' : 'left' }]}>{isAR ? 'إلى...' : 'To...'}</Text>
          <TextInput
            style={[sub.input, { textAlign: isAR ? 'right' : 'left', width: '100%' }]}
            placeholder="recipient@email.com"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={to}
            onChangeText={setTo}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        <View style={[sub.card, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
          <Text style={[sub.cardLabel, { textAlign: isAR ? 'right' : 'left' }]}>{isAR ? 'الرسالة...' : 'Message...'}</Text>
          <TextInput
            style={[sub.input, { minHeight: 60, textAlign: isAR ? 'right' : 'left', width: '100%' }]}
            multiline
            value={message}
            onChangeText={setMessage}
            placeholderTextColor="rgba(255,255,255,0.4)"
          />
        </View>
        <TouchableOpacity style={[sub.sendBtn, { flexDirection: isAR ? 'row-reverse' : 'row' }]} onPress={send} activeOpacity={0.85}>
          <Ionicons name="send" size={18} color={BRAND} style={{ marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }} />
          <Text style={sub.sendBtnText}>{isAR ? 'إرسال البريد الإلكتروني' : 'SEND EMAIL'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─── Text sub-screen ─── */
function TextScreen({ onBack, cardUrl }) {
  const { language } = useAppContext();
  const isAR = language === 'ar';
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(isAR ? 'مرحباً، انقر على هذا الرابط للحصول على بطاقتي:' : 'Hi, tap this link to get my business card:');
  const send = () => Linking.openURL(
    phone.trim()
      ? `sms:${encodeURIComponent(phone.trim())}?body=${encodeURIComponent(`${message}\n${cardUrl}`)}`
      : `sms:?body=${encodeURIComponent(`${message}\n${cardUrl}`)}`
  );
  return (
    <KeyboardAvoidingView style={sub.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SubHeader
        onBack={onBack}
        title={isAR ? 'إرسال بطاقتك برسالة' : 'Text Your Card'}
        onSend={send}
        sendLabel={isAR ? 'إرسال' : 'SEND'}
        isAR={isAR}
      />
      <ScrollView contentContainerStyle={sub.body} keyboardShouldPersistTaps="handled">
        <View style={[sub.card, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
          <Text style={[sub.cardLabel, { textAlign: isAR ? 'right' : 'left' }]}>{isAR ? 'رقم الهاتف...' : 'Phone number...'}</Text>
          <TextInput
            style={[sub.input, { textAlign: isAR ? 'right' : 'left', width: '100%' }]}
            placeholder={isAR ? 'رقم الهاتف' : 'Phone number'}
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>
        <View style={[sub.card, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
          <Text style={[sub.cardLabel, { textAlign: isAR ? 'right' : 'left' }]}>{isAR ? 'الرسالة...' : 'Message...'}</Text>
          <TextInput
            style={[sub.input, { minHeight: 60, textAlign: isAR ? 'right' : 'left', width: '100%' }]}
            multiline
            value={message}
            onChangeText={setMessage}
            placeholderTextColor="rgba(255,255,255,0.4)"
          />
        </View>
        <TouchableOpacity style={[sub.sendBtn, { flexDirection: isAR ? 'row-reverse' : 'row' }]} onPress={send} activeOpacity={0.85}>
          <Ionicons name="send" size={18} color={BRAND} style={{ marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }} />
          <Text style={sub.sendBtnText}>{isAR ? 'إرسال الرسالة' : 'SEND TEXT'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─── WhatsApp sub-screen ─── */
function WhatsAppScreen({ onBack, cardUrl, isAR }) {
  const [countryCode, setCountryCode] = useState('+965');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(isAR ? 'مرحباً، اضغط على هذا الرابط للحصول على بطاقة عملي:' : 'Hi, tap this link to get my business card:');
  const send = () => {
    const num = `${countryCode}${phone}`.replace(/[^+\d]/g, '');
    if (num.length > 4) Linking.openURL(`https://wa.me/${num.replace('+', '')}?text=${encodeURIComponent(`${message}\n${cardUrl}`)}`);
    else Linking.openURL(`whatsapp://send?text=${encodeURIComponent(`${message}\n${cardUrl}`)}`);
  };
  return (
    <KeyboardAvoidingView style={sub.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SubHeader
        onBack={onBack}
        title={isAR ? 'إرسال عبر واتساب' : 'Send via WhatsApp'}
        onSend={send}
        sendLabel={isAR ? 'إرسال' : 'SEND'}
        isAR={isAR}
      />
      <ScrollView contentContainerStyle={sub.body} keyboardShouldPersistTaps="handled">
        <View style={[sub.card, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
          <Text style={sub.cardLabel}>{isAR ? 'الرقم...' : 'Number...'}</Text>
          <View style={{ flexDirection: isAR ? 'row-reverse' : 'row', width: '100%' }}>
            <TextInput style={[sub.input, { width: 60, [isAR ? 'marginLeft' : 'marginRight']: 8, textAlign: 'center' }]} value={countryCode} onChangeText={setCountryCode} keyboardType="phone-pad" />
            <TextInput style={[sub.input, { flex: 1, textAlign: isAR ? 'right' : 'left' }]} placeholder={isAR ? 'رقم الهاتف' : 'Phone number'} placeholderTextColor="rgba(255,255,255,0.4)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
        </View>
        <View style={[sub.card, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
          <Text style={sub.cardLabel}>{isAR ? 'الرسالة...' : 'Message...'}</Text>
          <TextInput style={[sub.input, { minHeight: 60, textAlign: isAR ? 'right' : 'left', width: '100%' }]} multiline value={message} onChangeText={setMessage} placeholderTextColor="rgba(255,255,255,0.4)" />
        </View>
        <TouchableOpacity style={[sub.sendBtn, { flexDirection: isAR ? 'row-reverse' : 'row' }]} onPress={send} activeOpacity={0.85}>
          <Ionicons name="send" size={18} color={BRAND} style={isAR ? { marginLeft: 8 } : { marginRight: 8 }} />
          <Text style={sub.sendBtnText}>{isAR ? 'إرسال الرسالة' : 'SEND MESSAGE'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ═══════════════════════ Share Modal ═══════════════════════ */
function ShareModal({ visible, onClose, cardUrl, displayName, cardId, cardSlug, tenantSlug }) {
  const insets = useSafeAreaInsets();
  const [walletLoading, setWalletLoading] = useState(false);
  const [subScreen, setSubScreen] = useState(null);
  const qrSvgRef = useRef(null);
  const { language } = useAppContext();
  const isAR = language === 'ar';

  const shareMsg = isAR 
    ? `تحقق من بطاقة عملي الرقمية: ${cardUrl}`
    : `Check out my digital business card: ${cardUrl}`;

  const copyLink = async () => {
    try { 
      await Clipboard.setStringAsync(cardUrl); 
      Alert.alert(isAR ? 'تم النسخ!' : 'Copied!', isAR ? 'تم نسخ رابط البطاقة إلى الحافظة.' : 'Card link copied to clipboard.'); 
    }
    catch { 
      Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'تعذر نسخ الرابط.' : 'Could not copy link.'); 
    }
  };

  const sendOther = async () => {
    try { await Share.share({ message: shareMsg, url: cardUrl }); } catch {}
  };

  const saveQRToPhotos = async () => {
    if (!qrSvgRef.current?.toDataURL) { Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'رمز QR غير جاهز بعد. حاول مجدداً.' : 'QR not ready. Try again.'); return; }
    try {
      const base64 = await new Promise((res, rej) => qrSvgRef.current.toDataURL(d => d ? res(d) : rej(new Error('Empty'))));
      const clean = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
      const uri = `${FileSystem.cacheDirectory}qrcode_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(uri, clean, { encoding: 'base64' });
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (perm.status === 'granted') {
        const asset = await MediaLibrary.createAssetAsync(uri);
        const album = await MediaLibrary.getAlbumAsync('ANSOFTT DC');
        album ? await MediaLibrary.addAssetsToAlbumAsync([asset], album, false) : await MediaLibrary.createAlbumAsync('ANSOFTT DC', asset, false);
        Alert.alert(isAR ? 'تم الحفظ' : 'Saved', isAR ? 'تم حفظ رمز QR في صورك.' : 'QR code saved to your photos.');
      } else {
        const can = await Sharing.isAvailableAsync();
        can ? await Sharing.shareAsync(uri, { mimeType: 'image/png' }) : Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'تم رفض الإذن.' : 'Permission denied.');
      }
    } catch (err) { Alert.alert(isAR ? 'خطأ' : 'Error', err?.message || (isAR ? 'تعذر حفظ رمز QR.' : 'Could not save QR.')); }
  };

  const addToWallet = async () => {
    if ((!tenantSlug || !cardSlug) && !cardId) {
      Alert.alert(
        isAR ? 'غير متوفر' : 'Unavailable',
        isAR ? 'معلومات البطاقة غير متوفرة.' : 'Card info not found.'
      );
      return;
    }
    setWalletLoading(true);
    try {
      if (Platform.OS === 'ios') {
        if (tenantSlug && cardSlug) {
          // On iOS, we directly open the public Apple Wallet .pkpass endpoint
          // Safari will download it and show the native "Add to Apple Wallet" card.
          const applePassUrl = `${API_BASE_URL}/public/card/apple-pass/${tenantSlug}/${cardSlug}`;
          await Linking.openURL(applePassUrl);
          return;
        }
      }

      // Fallback / Android: Fetch Google Wallet URL from server
      let walletUrl = null;

      // Try public endpoint first (requires POST)
      if (tenantSlug && cardSlug) {
        try {
          const res = await cardsApi.getPublicWalletPass(tenantSlug, cardSlug);
          // Prefer applePassUrl on iOS if we hit fallback, otherwise use walletUrl (Google Pay URL)
          walletUrl = Platform.OS === 'ios'
            ? (res.data?.applePassUrl || res.data?.apple_wallet_url || res.data?.walletUrl || res.data?.url)
            : (res.data?.walletUrl || res.data?.applePassUrl || res.data?.apple_wallet_url || res.data?.url);
        } catch {}
      }

      // Fallback: authenticated endpoint
      if (!walletUrl && cardId) {
        try {
          const res = await cardsApi.getWalletPass(cardId);
          walletUrl = res.data?.walletUrl || res.data?.apple_wallet_url || res.data?.url;
        } catch {}
      }

      if (!walletUrl) {
        throw new Error(
          isAR ? 'تعذر إنشاء بطاقة المحفظة.' : 'Could not generate wallet pass.'
        );
      }

      await Linking.openURL(walletUrl);
    } catch (err) {
      Alert.alert(isAR ? 'خطأ' : 'Error', err?.message || 'Failed.');
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      {/* Sub-screens: each manages its own safe-area via SubHeader */}
      {subScreen === 'email' && (
        <EmailScreen onBack={() => setSubScreen(null)} cardUrl={cardUrl} displayName={displayName} isAR={isAR} />
      )}
      {subScreen === 'text' && (
        <TextScreen onBack={() => setSubScreen(null)} cardUrl={cardUrl} isAR={isAR} />
      )}
      {subScreen === 'whatsapp' && (
        <WhatsAppScreen onBack={() => setSubScreen(null)} cardUrl={cardUrl} isAR={isAR} />
      )}

      {!subScreen && (
        <View style={sh.safe}>
          <StatusBar barStyle="light-content" backgroundColor={BRAND} />

          {/* Main share modal header */}
          <View style={[sh.header, {
            paddingTop: Math.max(insets.top, 16) + 8,
            flexDirection: isAR ? 'row-reverse' : 'row'
          }]}>
            <TouchableOpacity
              onPress={() => { setSubScreen(null); onClose(); }}
              style={sh.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={sh.headerTitle}>{isAR ? 'إرسال بطاقتك' : 'Send Your Card'}</Text>
            <View style={sh.headerBtn} />
          </View>

          <ScrollView contentContainerStyle={sh.scroll} showsVerticalScrollIndicator={false}>
            {cardUrl ? (
              <View style={sh.qrWrap}>
                <View style={sh.qrBox}>
                  <QRCode value={cardUrl} size={210} color="#111" backgroundColor="#fff" getRef={r => { qrSvgRef.current = r; }} />
                </View>
                <Text style={sh.qrText}>
                  {isAR
                    ? `وجه الكاميرا نحو رمز QR\nلاستلام البطاقة`
                    : `Point your camera at the QR\ncode to receive the card`}
                </Text>
              </View>
            ) : null}

            <View style={sh.group}>
              <ShareRow icon="copy-outline" label={isAR ? 'نسخ الرابط' : 'Copy link'} onPress={copyLink} isLast isAR={isAR} />
            </View>

            <View style={sh.group}>
              <ShareRow icon="chatbubble-outline" label={isAR ? 'إرسال عبر رسالة نصية' : 'Text your card'} onPress={() => setSubScreen('text')} isAR={isAR} />
              <ShareRow icon="mail-outline" label={isAR ? 'إرسال عبر بريد إلكتروني' : 'Email your card'} onPress={() => setSubScreen('email')} isAR={isAR} />
              <ShareRow label={isAR ? 'إرسال عبر واتساب' : 'Send via WhatsApp'} onPress={() => setSubScreen('whatsapp')} isAR={isAR}
                customIcon={<View style={[sh.brandBadge, { backgroundColor: '#25D366' }]}><Ionicons name="logo-whatsapp" size={16} color="#fff" /></View>} />
              <ShareRow label={isAR ? 'إرسال عبر لينكد إن' : 'Send via LinkedIn'} onPress={() => Linking.openURL(`https://www.linkedin.com/messaging/compose/?body=${encodeURIComponent(shareMsg)}`)} isAR={isAR}
                customIcon={<View style={[sh.brandBadge, { backgroundColor: '#0A66C2' }]}><Text style={sh.liText}>in</Text></View>} />
              <ShareRow icon="ellipsis-horizontal" label={isAR ? 'إرسال بطريقة أخرى' : 'Send another way'} onPress={sendOther} isLast isAR={isAR} />
            </View>

            <View style={sh.group}>
              <ShareRow label={isAR ? 'نشر على لينكد إن' : 'Post to LinkedIn'} onPress={() => Linking.openURL(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(cardUrl)}`)} isAR={isAR}
                customIcon={<View style={[sh.brandBadge, { backgroundColor: '#0A66C2' }]}><Text style={sh.liText}>in</Text></View>} />
              <ShareRow label={isAR ? 'نشر على فيسبوك' : 'Post to Facebook'} onPress={() => Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(cardUrl)}`)} isLast isAR={isAR}
                customIcon={<View style={[sh.brandBadge, { backgroundColor: '#1877F2' }]}><Ionicons name="logo-facebook" size={17} color="#fff" /></View>} />
            </View>

            <View style={sh.group}>
              <ShareRow label={isAR ? 'حفظ رمز QR في الصور' : 'Save QR to photos'} onPress={saveQRToPhotos} isAR={isAR}
                customIcon={<View style={[sh.brandBadge, { backgroundColor: 'transparent' }]}><Text style={{ fontSize: 22 }}>🖼️</Text></View>} />
              <ShareRow icon="paper-plane-outline" label={isAR ? 'إرسال رمز QR' : 'Send QR code'} onPress={() => Share.share({ message: `${shareMsg}\n\nScan the QR or open the link.`, url: cardUrl }).catch(() => {})} isLast isAR={isAR} />
            </View>

            <View style={sh.group}>
              <TouchableOpacity style={[sh.row, { flexDirection: isAR ? 'row-reverse' : 'row' }]} onPress={addToWallet} activeOpacity={0.7} disabled={walletLoading}>
                <View style={[sh.rowIconWrap, { marginRight: isAR ? 0 : 14, marginLeft: isAR ? 14 : 0 }]}>
                  {walletLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="wallet-outline" size={22} color="#fff" />}
                </View>
                <Text style={[sh.rowLabel, { flex: 1, textAlign: isAR ? 'right' : 'left' }]}>
                  {walletLoading
                    ? (isAR ? 'جاري فتح المحفظة...' : 'Opening wallet…')
                    : (isAR ? 'إضافة البطاقة إلى المحفظة' : 'Add card to wallet')}
                </Text>
                <Ionicons name={isAR ? 'chevron-back' : 'chevron-forward'} size={15} color="rgba(255,255,255,0.35)" />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

/* ─── Admin Location Map Page ─── */
function AdminMapScreen({ onBack, user, isAR, isDark }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef(null);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const { data } = await cardsApi.getAll();
      const list = Array.isArray(data) ? data : data?.cards || [];
      const activeLocations = list.filter(c => c.latitude && c.longitude);
      setCards(activeLocations);
    } catch (err) {
      console.warn('[fetchLocations Map]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (!loading && webViewRef.current && cards.length > 0) {
      const js = `if (window.updateMarkers) { window.updateMarkers(${JSON.stringify(cards)}); }`;
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(js);
      }, 1000);
    }
  }, [cards, loading]);

  const mapHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; background-color: ${isDark ? '#0f172a' : '#f3f4f6'}; }
      .custom-popup { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .popup-title { font-weight: 700; font-size: 14px; color: #1e293b; margin-bottom: 2px; }
      .popup-sub { font-size: 12px; color: #64748b; margin-bottom: 4px; }
      .popup-time { font-size: 10px; color: #94a3b8; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var map = L.map('map').setView([29.3759, 47.9774], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      var markers = [];

      window.updateMarkers = function(cardList) {
        markers.forEach(m => map.removeLayer(m));
        markers = [];
        var bounds = [];

        cardList.forEach(function(card) {
          if (card.latitude && card.longitude) {
            var lat = parseFloat(card.latitude);
            var lng = parseFloat(card.longitude);
            bounds.push([lat, lng]);

            var popupContent = '<div class="custom-popup">' +
              '<div class="popup-title">' + (card.name || 'Unknown') + '</div>' +
              (card.title ? '<div class="popup-sub">' + card.title + '</div>' : '') +
              '<div class="popup-time">Last active: ' + new Date(card.location_updated_at || Date.now()).toLocaleTimeString() + '</div>' +
              '</div>';

            var m = L.marker([lat, lng]).addTo(map).bindPopup(popupContent);
            markers.push(m);
          }
        });

        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      };
    </script>
  </body>
  </html>
  `;

  return (
    <View style={[sub.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
      <SubHeader
        onBack={onBack}
        title={isAR ? 'خريطة تتبع الموظفين' : 'Employee Map Tracking'}
        onSend={fetchLocations}
        sendLabel={isAR ? 'تحديث' : 'REFRESH'}
        isAR={isAR}
      />

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={BRAND} size="large" />
      ) : cards.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Ionicons name="map-outline" size={64} color={BRAND} style={{ opacity: 0.3, marginBottom: 16 }} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? '#fff' : '#111827', textAlign: 'center', marginBottom: 8 }}>
            {isAR ? 'لا توجد بيانات موقع نشطة' : 'No Active Locations'}
          </Text>
          <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 }}>
            {isAR ? 'لم يقم أي موظف بتشغيل مشاركة الموقع بعد.' : 'No employees are sharing their location currently.'}
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <WebView
            ref={webViewRef}
            source={{ html: mapHtml }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
          />
        </View>
      )}
    </View>
  );
}

/* ─── Card Selector Modal (Admin Only) ─── */
function CardSelectorModal({ visible, onClose, cards, onSelect, selectedCardId, isAR }) {
  const [search, setSearch] = useState('');
  const filtered = cards.filter(c => {
    const q = search.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) || (c.name_ar || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
  });

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: '75%',
          paddingTop: 16,
          paddingHorizontal: 20
        }}>
          {/* Header */}
          <View style={{ flexDirection: isAR ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
              {isAR ? 'اختر بطاقة للمعاينة' : 'Select Card to Preview'}
            </Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={{
            flexDirection: isAR ? 'row-reverse' : 'row',
            alignItems: 'center',
            backgroundColor: '#F3F4F6',
            borderRadius: 12,
            paddingHorizontal: 12,
            marginBottom: 16,
            height: 46
          }}>
            <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }} />
            <TextInput
              style={{ flex: 1, fontSize: 15, color: '#1F2937', textAlign: isAR ? 'right' : 'left' }}
              placeholder={isAR ? 'البحث بالاسم...' : 'Search by name...'}
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Cards List */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {filtered.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 32 }}>
                {isAR ? 'لا توجد نتائج' : 'No cards found.'}
              </Text>
            ) : (
              filtered.map((item) => {
                const isSelected = String(item.id) === String(selectedCardId);
                const title = item.job_title || item.title || '';
                const name = isAR && item.name_ar ? item.name_ar : (item.name || 'No Name');
                const avatar = item.profile_image ? resolveUrl(item.profile_image) : null;
                const initials = (name || 'U').charAt(0).toUpperCase();

                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                    style={{
                      flexDirection: isAR ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 14,
                      marginBottom: 10,
                      backgroundColor: isSelected ? 'rgba(27, 70, 84, 0.08)' : '#F9FAFB',
                      borderWidth: 1.5,
                      borderColor: isSelected ? '#1b4654' : 'transparent',
                    }}
                  >
                    {/* Avatar */}
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: isAR ? 0 : 12, marginLeft: isAR ? 12 : 0 }} />
                    ) : (
                      <View style={{
                        width: 44, height: 44, borderRadius: 22,
                        backgroundColor: isSelected ? '#1b4654' : '#E5E7EB',
                        justifyContent: 'center', alignItems: 'center',
                        marginRight: isAR ? 0 : 12, marginLeft: isAR ? 12 : 0
                      }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: isSelected ? '#fff' : '#6B7280' }}>
                          {initials}
                        </Text>
                      </View>
                    )}

                    {/* Details */}
                    <View style={{ flex: 1, alignItems: isAR ? 'flex-end' : 'flex-start' }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937' }}>{name}</Text>
                      {title ? <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{title}</Text> : null}
                    </View>

                    {/* Selected Checkmark */}
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color="#1b4654" />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Location Disclosure Modal ─── */
function LocationDisclosureModal({ visible, onDecline, onAccept, isAR }) {
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{
          backgroundColor: '#fff',
          borderRadius: 20,
          padding: 24,
          width: '100%',
          maxWidth: 380,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 8
        }}>
          {/* Icon */}
          <View style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: 'rgba(27, 70, 84, 0.1)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16
          }}>
            <Ionicons name="location" size={32} color="#1b4654" />
          </View>

          {/* Title */}
          <Text style={{
            fontSize: 18,
            fontWeight: '800',
            color: '#111827',
            marginBottom: 12,
            textAlign: 'center'
          }}>
            {isAR ? 'الإفصاح عن مشاركة الموقع' : 'Location Sharing Disclosure'}
          </Text>

          {/* Description */}
          <Text style={{
            fontSize: 14,
            color: '#4B5563',
            lineHeight: 20,
            textAlign: 'center',
            marginBottom: 24
          }}>
            {isAR 
              ? 'يجمع تطبيق ANSOFTT DC بيانات موقعك (الإحداثيات الجغرافية) أثناء استخدام التطبيق لتتمكن من مشاركتها مع مسؤول أو مدير مؤسستك لأغراض إثبات الحضور، الملاحة، وسجلات العمل الإدارية.\n\nنحن لا نتتبع موقعك عند إغلاق التطبيق، ولا نشارك البيانات مع أي معلنين أو جهات خارجية.'
              : 'ANSOFTT DC collects location data (GPS coordinates) while the app is in use to allow you to share your coordinate location with your workspace/organization administrator for workplace attendance, navigation, and administrative logs.\n\nWe do not track your location when the app is closed, and we do not share location data with any third-party advertisers.'}
          </Text>

          {/* Buttons */}
          <View style={{ flexDirection: isAR ? 'row-reverse' : 'row', gap: 12, width: '100%' }}>
            <TouchableOpacity 
              onPress={onDecline}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: '#F3F4F6',
                alignItems: 'center'
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#4B5563' }}>
                {isAR ? 'رفض' : 'Decline'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={onAccept}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: '#1b4654',
                alignItems: 'center'
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                {isAR ? 'موافق' : 'Accept'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ═══════════════════════════════ Main Screen ═══════════════════════════════ */
export default function MyCardScreen() {
  const { user, token, logout } = useAuth();
  const { isDark: isAppDark, language: appLang } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [cardUrl, setCardUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [cardSlug, setCardSlug] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [cardId, setCardId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState('fab'); // 'fab' or 'footer'
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [allCards, setAllCards] = useState([]);
  const [cardSelectorOpen, setCardSelectorOpen] = useState(false);
  const [isLocationSharing, setIsLocationSharing] = useState(false);
  const [locationMapOpen, setLocationMapOpen] = useState(false);
  const [locationDisclosureOpen, setLocationDisclosureOpen] = useState(false);

  useEffect(() => {
    const loadLayoutPreference = async () => {
      try {
        const saved = await AsyncStorage.getItem('mycard_layout_mode');
        if (saved) {
          setLayoutMode(saved);
        }
      } catch (err) {
        console.warn('[loadLayoutPreference]', err);
      }
    };
    loadLayoutPreference();
  }, []);

  const lastToggleTime = useRef(0);

  const toggleLayoutMode = useCallback(async () => {
    const now = Date.now();
    if (now - lastToggleTime.current < 500) return; // Prevent double-triggering
    lastToggleTime.current = now;

    setLayoutMode((prev) => {
      const nextMode = prev === 'fab' ? 'footer' : 'fab';
      AsyncStorage.setItem('mycard_layout_mode', nextMode).catch((err) =>
        console.warn('[saveLayoutPreference]', err)
      );
      return nextMode;
    });
  }, []);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'DOUBLE_TAP') {
        toggleLayoutMode();
      } else if (data.type === 'WALLET_URL') {
        console.log('[WebView] Apple Wallet URL from web page:', data.url);
      }
    } catch (err) {
      // Ignore
    }
  }, [toggleLayoutMode]);

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
      // If user profile is not ready yet, try card-user slug endpoint first.
      if (!user?.role && token) {
        try {
          const { data } = await authApi.getCardSlug();
          const ts = data?.tenant_slug || '';
          const cs = data?.card_slug || parseDigCardPath(data?.card_url)?.cardSlug || '';
          if (ts && cs) {
            setTenantSlug(ts);
            setCardSlug(cs);
            if (data?.card_id) setCardId(data.card_id);
            const dName = (appLang === 'ar' && (data?.name_ar || user?.name_ar)) ? (data.name_ar || user?.name_ar) : (data?.name || 'My Card');
            setDisplayName(dName);
            if (data?.profile_image) setAvatarUrl(resolveUrl(data.profile_image));
            setCardUrl(`${FRONTEND_BASE_URL}/?v=${Date.now()}#/card/${ts}/${cs}?lang=${appLang}`);

            // Enrich from public card endpoint
            cardsApi.getPublicCard(ts, cs).then(({ data: cardRes }) => {
              const card = cardRes?.card || cardRes;
              if (card) {
                if (card.profile_image) setAvatarUrl(resolveUrl(card.profile_image));
                const finalName = (appLang === 'ar' && card.name_ar) ? card.name_ar : (card.name || user?.name || data?.name);
                setDisplayName(finalName);
                if (card.id) setCardId(card.id);
              }
            }).catch(() => {});
            return;
          }
        } catch (err) {
          console.warn('[fetchCard delayed-user slug]', err?.response?.status, err?.message);
        }
      }

      if (user?.role === 'card_user') {
        // Use slugs stored at login time — no API call needed
        const tSlug = user?.tenant_slug || '';
        const cSlug = user?.card_slug || parseDigCardPath(user?.card_url)?.cardSlug || '';

        if (user?.card_id) setCardId(user.card_id);

        if (tSlug && cSlug) {
          setTenantSlug(tSlug);
          setCardSlug(cSlug);
          const dName = (appLang === 'ar' && user?.name_ar) ? user.name_ar : (user?.name || 'My Card');
          setDisplayName(dName);
          setCardUrl(`${FRONTEND_BASE_URL}/?v=${Date.now()}#/card/${tSlug}/${cSlug}?lang=${appLang}`);

          // Enrich from public card endpoint
          cardsApi.getPublicCard(tSlug, cSlug).then(({ data: cardRes }) => {
            const card = cardRes?.card || cardRes;
            if (card) {
              if (card.profile_image) setAvatarUrl(resolveUrl(card.profile_image));
              const finalName = (appLang === 'ar' && card.name_ar) ? card.name_ar : (card.name || user?.name);
              setDisplayName(finalName);
              if (card.id) setCardId(card.id);
            }
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
            if (data?.card_id) setCardId(data.card_id);
            const dName = (appLang === 'ar' && (data?.name_ar || user?.name_ar)) ? (data.name_ar || user?.name_ar) : (data?.name || user?.name || 'My Card');
            setDisplayName(dName);
            if (data?.profile_image) setAvatarUrl(resolveUrl(data.profile_image));
            setCardUrl(`${FRONTEND_BASE_URL}/?v=${Date.now()}#/card/${ts}/${cs}?lang=${appLang}`);

            // Enrich from public card endpoint
            cardsApi.getPublicCard(ts, cs).then(({ data: cardRes }) => {
              const card = cardRes?.card || cardRes;
              if (card) {
                if (card.profile_image) setAvatarUrl(resolveUrl(card.profile_image));
                const finalName = (appLang === 'ar' && card.name_ar) ? card.name_ar : (card.name || user?.name || data?.name);
                setDisplayName(finalName);
                if (card.id) setCardId(card.id);
              }
            }).catch(() => {});
          }
        } catch (err) {
          console.warn('[fetchCard card_user slug]', err?.response?.status, err?.message);
        }
      } else {
        // Admin / sub_admin
        const { data } = await cardsApi.getAll();
        const cards = Array.isArray(data) ? data : data?.cards ?? [];
        setAllCards(cards);
        if (!cards.length) return;

        let cardData = cards[0];
        try {
          const savedCardId = await AsyncStorage.getItem('admin_selected_card_id');
          if (savedCardId) {
            const found = cards.find(c => String(c.id) === savedCardId);
            if (found) cardData = found;
          } else {
            // Save default card ID to AsyncStorage so the background location task has access
            await AsyncStorage.setItem('admin_selected_card_id', String(cardData.id)).catch(() => {});
          }
        } catch {}

        const tSlug =
          user?.tenant_slug || user?.schema_slug || user?.schemaSlug ||
          cardData?.tenant_slug || cardData?.schema_slug ||
          parseDigCardPath(cardData?.card_url)?.tenantSlug || '';
        const cSlug = cardData?.slug || parseDigCardPath(cardData?.card_url)?.cardSlug || '';
        setTenantSlug(tSlug);
        setCardSlug(cSlug);
        if (cardData.id) setCardId(cardData.id);
        const dName = (appLang === 'ar' && (cardData.name_ar || user?.name_ar)) ? (cardData.name_ar || user?.name_ar) : (cardData.name || user?.name || 'My Card');
        setDisplayName(dName);
        setAvatarUrl(resolveUrl(cardData.profile_image));
        if (tSlug && cSlug) setCardUrl(`${FRONTEND_BASE_URL}/?v=${Date.now()}#/card/${tSlug}/${cSlug}?lang=${appLang}`);
        else if (cardData?.card_url) {
          const raw = String(cardData.card_url).replace(/^#?\/?/, '');
          setCardUrl(`${FRONTEND_BASE_URL}/?v=${Date.now()}#${raw}`);
        }
      }
    } catch (err) {
      console.warn('[fetchCard]', err);
    } finally {
      setLoading(false);
    }
  }, [user, token, appLang]);

  const handleSelectCard = useCallback(async (cardData) => {
    if (!cardData) return;
    const tSlug =
      user?.tenant_slug || user?.schema_slug || user?.schemaSlug ||
      cardData?.tenant_slug || cardData?.schema_slug ||
      parseDigCardPath(cardData?.card_url)?.tenantSlug || '';
    const cSlug = cardData?.slug || parseDigCardPath(cardData?.card_url)?.cardSlug || '';
    
    setTenantSlug(tSlug);
    setCardSlug(cSlug);
    if (cardData.id) {
      setCardId(cardData.id);
      await AsyncStorage.setItem('admin_selected_card_id', String(cardData.id)).catch(() => {});
    }
    const dName = (appLang === 'ar' && (cardData.name_ar || user?.name_ar)) ? (cardData.name_ar || user?.name_ar) : (cardData.name || user?.name || 'My Card');
    setDisplayName(dName);
    setAvatarUrl(resolveUrl(cardData.profile_image));
    if (tSlug && cSlug) setCardUrl(`${FRONTEND_BASE_URL}/?v=${Date.now()}#/card/${tSlug}/${cSlug}?lang=${appLang}`);
    else if (cardData?.card_url) {
      const raw = String(cardData.card_url).replace(/^#?\/?/, '');
      setCardUrl(`${FRONTEND_BASE_URL}/?v=${Date.now()}#${raw}`);
    }
  }, [user, appLang]);

  const startTracking = async () => {
    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to share location.');
        setIsLocationSharing(false);
        return;
      }
      await AsyncStorage.setItem('location_tracking_enabled', 'true');
      setIsLocationSharing(true);
      triggerLocationUpdate();
    } catch (err) {
      console.warn('[startTracking Error]', err);
    }
  };

  const stopTracking = async () => {
    try {
      await AsyncStorage.setItem('location_tracking_enabled', 'false');
      setIsLocationSharing(false);
      if (cardId) {
        await cardsApi.updateMyLocation({ is_tracking: false, cardId: cardId }).catch(() => {});
      }
    } catch (err) {
      console.warn('[stopTracking Error]', err);
    }
  };

  const triggerLocationUpdate = useCallback(async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (loc && loc.coords) {
        await cardsApi.updateMyLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          is_tracking: true,
          cardId: cardId
        });
      }
    } catch (err) {
      console.warn('[triggerLocationUpdate]', err.message);
    }
  }, [cardId]);

  useEffect(() => {
    let interval = null;
    if (isLocationSharing) {
      triggerLocationUpdate();
      interval = setInterval(triggerLocationUpdate, 45000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLocationSharing, triggerLocationUpdate]);

  useEffect(() => {
    const loadTrackingPref = async () => {
      const enabled = await AsyncStorage.getItem('location_tracking_enabled');
      if (enabled === 'true') {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          setIsLocationSharing(true);
        }
      }
    };
    loadTrackingPref();
  }, []);

  const handleToggleLocationSharing = (val) => {
    if (val) {
      setSidebarOpen(false);
      setLocationDisclosureOpen(true);
    } else {
      stopTracking();
    }
  };

  useEffect(() => { fetchCard(); }, [fetchCard, appLang]);

  const pageBg = isAppDark ? '#0F172A' : '#F3F4F6';
  const footerBg = isAppDark ? 'rgba(15,23,42,0.97)' : 'rgba(243,244,246,0.97)';

  const INJECT_SCRIPT = `
    (function() {
      // Force proper mobile viewport
      var vp = document.querySelector('meta[name="viewport"]');
      if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
      vp.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

      // Force card to fill full mobile width — remove all side gaps
      var st = document.createElement('style');
      st.textContent = [
        'html,body{margin:0!important;padding:0!important;width:100vw!important;min-width:0!important;max-width:100vw!important;overflow-x:hidden!important;}',
        '*{box-sizing:border-box!important;}',
        '#root,#app,#__next{width:100%!important;max-width:100%!important;margin:0!important;padding:0!important;}',
        '[class]{max-width:100vw!important;}',
        '[class*="container"],[class*="wrapper"],[class*="card"],[class*="layout"],[class*="page"],[class*="main"]',
        '{width:100%!important;max-width:100%!important;margin-left:0!important;margin-right:0!important;padding-left:0!important;padding-right:0!important;}'
      ].join('');
      document.head.appendChild(st);

      // Hide bottom action buttons (EN + AR)
      var KEYWORDS = [
        'share details','share your details','save contact','download card','submit my details',
        'مشاركة التفاصيل','حفظ جهة الاتصال','تحميل البطاقة'
      ];
      function hideUI() {
        document.querySelectorAll('button,[role="button"]').forEach(function(el) {
          var t = (el.innerText || el.textContent || '').trim();
          if (KEYWORDS.some(function(k) { return t.toLowerCase().indexOf(k.toLowerCase()) !== -1; })) {
            el.style.setProperty('display','none','important');
            var p = el.parentElement;
            if (p) p.style.setProperty('display','none','important');
          }
        });
        document.querySelectorAll('div,section').forEach(function(el) {
          var t = (el.innerText || el.textContent || '').toLowerCase();
          if (t.indexOf('share your details') !== -1 ||
             (t.indexOf('your name') !== -1 && t.indexOf('your email') !== -1 && t.indexOf('your phone') !== -1)) {
            el.style.setProperty('display','none','important');
          }
        });
      }
      hideUI();
      setInterval(hideUI, 400);
      new MutationObserver(hideUI).observe(document.documentElement, { childList: true, subtree: true });
    })();
    true;
  `;

  if (locationMapOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: BRAND }}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} translucent={false} />
        <AdminMapScreen
          onBack={() => setLocationMapOpen(false)}
          user={user}
          isAR={appLang === 'ar'}
          isDark={isAppDark}
        />
      </View>
    );
  }

  if (analyticsOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: BRAND }}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} translucent={false} />
        <AnalyticsScreen
          onBack={() => setAnalyticsOpen(false)}
          user={user}
          isAR={appLang === 'ar'}
          isDark={isAppDark}
          brandColor={BRAND}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} translucent={false} />

      {/* ── Top bar ── */}
      <View style={[s.topBar, { paddingTop: (insets.top || 0) + 12 }]}>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} hitSlop={10} style={s.menuBtn}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={s.menuAvatar} />
            : <View style={s.menuAvatarFallback}>
                <Text style={s.menuAvatarText}>{(displayName || user?.name || 'U').charAt(0).toUpperCase()}</Text>
              </View>}
        </TouchableOpacity>
        <Text style={[s.topTitle, { textAlign: appLang === 'ar' ? 'right' : 'left', flex: 1, marginLeft: 12 }]} numberOfLines={1}>
          {displayName || (appLang === 'ar' ? 'بطاقتي' : 'My Card')}
          {isLocationSharing && (
            <Text style={{ color: '#10B981', fontSize: 13, fontWeight: 'bold' }}> 📡</Text>
          )}
        </Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {user?.role !== 'card_user' && allCards.length > 0 && (
            <TouchableOpacity onPress={() => setCardSelectorOpen(true)} style={[s.logoutBtn, { marginRight: 14 }]} hitSlop={10}>
              <Ionicons name="people-outline" size={24} color="#fff" />
            </TouchableOpacity>
          )}
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
          <View style={{ flex: 1 }}>
            <WebView
              key={cardUrl}
              source={{ uri: cardUrl }}
              style={{ flex: 1, backgroundColor: 'transparent' }}
              containerStyle={{ backgroundColor: 'transparent' }}
              startInLoadingState
              cacheEnabled={false}
              incognito={Platform.OS === 'android'}
              onMessage={handleMessage}
              renderLoading={() => (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: pageBg }}>
                  <ActivityIndicator color={BRAND} size="large" />
                </View>
              )}
              injectedJavaScriptBeforeContentLoaded={`
                (function() {
                  function injectDOM() {
                    var head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
                    if (head) {
                      var style = document.createElement('style');
                      style.textContent = 'html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; overflow-x: hidden !important; } .space-y-2\\.5 { display: none !important; } body { -webkit-user-select: none; }';
                      head.appendChild(style);
                      var meta = document.createElement('meta');
                      meta.name = 'viewport';
                      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
                      head.appendChild(meta);
                    } else {
                      setTimeout(injectDOM, 50);
                    }
                  }
                  injectDOM();
                  var lastTap = 0;
                  window.addEventListener('touchstart', function(e) {
                    var currentTime = new Date().getTime();
                    var tapLength = currentTime - lastTap;
                    if (tapLength < 350 && tapLength > 0) {
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DOUBLE_TAP' }));
                      }
                    }
                    lastTap = currentTime;
                  }, true);
                  var lastClick = 0;
                  window.addEventListener('click', function(e) {
                    var currentTime = new Date().getTime();
                    var clickLength = currentTime - lastClick;
                    if (clickLength < 350 && clickLength > 0) {
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DOUBLE_TAP' }));
                      }
                    }
                    lastClick = currentTime;
                  }, true);
                })();
                true;
              `}
              injectedJavaScript={`
                (function() {
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

                  // Find and report Apple Wallet link URLs for diagnostics
                  function reportWalletUrls() {
                    document.querySelectorAll('a[href]').forEach(function(el) {
                      var h = el.href || '';
                      var t = (el.textContent || '').toLowerCase();
                      if (h.includes('wallet') || h.includes('pkpass') || h.includes('pass') || t.includes('wallet') || t.includes('apple')) {
                        if (window.ReactNativeWebView) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'WALLET_URL', url: h }));
                        }
                      }
                    });
                  }
                  setTimeout(reportWalletUrls, 1500);
                  setTimeout(reportWalletUrls, 4000);
                })();
                true;
              `}
              allowsFullscreenVideo={false}
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
              onShouldStartLoadWithRequest={(req) => {
                if (!req.url || req.url === 'about:blank') return true;
                const base = FRONTEND_BASE_URL.replace(/\/$/, '');
                if (req.url.startsWith(base) || req.url.startsWith('https://digicards.ansoftt.com')) return true;
                Linking.openURL(req.url).catch(() => {});
                return false;
              }}
            />
          </View>
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

        {cardUrl && layoutMode === 'footer' ? (
          <View style={[s.footer, { backgroundColor: footerBg }]}>
            <TouchableOpacity style={s.shareBtn} onPress={() => setShareOpen(true)} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.shareBtnText}>{appLang === 'ar' ? 'مشاركة' : 'Share'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {cardUrl && layoutMode === 'fab' ? (
          <TouchableOpacity style={s.fabShareBtn} onPress={() => setShareOpen(true)} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={24} color="#fff" />
          </TouchableOpacity>
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
        onOpenAnalytics={() => {
          setSidebarOpen(false);
          setAnalyticsOpen(true);
        }}
        onOpenLocationMap={() => {
          setSidebarOpen(false);
          setLocationMapOpen(true);
        }}
        isLocationSharing={isLocationSharing}
        onToggleLocationSharing={handleToggleLocationSharing}
      />

      <CardSelectorModal
        visible={cardSelectorOpen}
        onClose={() => setCardSelectorOpen(false)}
        cards={allCards}
        onSelect={handleSelectCard}
        selectedCardId={cardId}
        isAR={appLang === 'ar'}
      />

      <LocationDisclosureModal
        visible={locationDisclosureOpen}
        isAR={appLang === 'ar'}
        onDecline={() => {
          setLocationDisclosureOpen(false);
          setIsLocationSharing(false);
        }}
        onAccept={() => {
          setLocationDisclosureOpen(false);
          startTracking();
        }}
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
  shareBtn: {
    backgroundColor: BRAND, borderRadius: 28, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer: {
    paddingBottom: 24,
    paddingTop: 12,
    paddingHorizontal: 40,
  },
  fabShareBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fsCloseBtn: {
    position: 'absolute', right: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: BRAND,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 6,
  },
});

const sh = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  headerBtn: { width: 36, alignItems: 'center' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center' },
  headerAction: { fontSize: 15, fontWeight: '700', color: '#fff', minWidth: 40, textAlign: 'right' },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  card: { backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 14, padding: 16, marginBottom: 16 },
  cardLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  input: { flex: 1, color: '#fff', fontSize: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)', paddingBottom: 6 },
  sendBtn: { backgroundColor: '#fff', borderRadius: 28, paddingVertical: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  sendBtnText: { color: BRAND, fontWeight: '800', fontSize: 15 },
});

const sd = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: { position: 'absolute', top: 0, bottom: 0, width: SCREEN_WIDTH * 0.78, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 4, height: 0 }, elevation: 12 },
  profileSection: { backgroundColor: BRAND, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 28 },
  avatar: { width: 76, height: 76, borderRadius: 38, marginBottom: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  avatarFallback: { backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 28, fontWeight: '800', color: '#fff' },
  name: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 4 },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16, marginVertical: 6 },
  menu: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8 },
  menuItem: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
  menuIcon: { width: 40, height: 40, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { fontSize: 15, fontWeight: '600' },
  langToggle: { flexDirection: 'row', borderRadius: 20, padding: 3 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  langBtnText: { fontSize: 13, fontWeight: '700' },
  drawerFooter: { paddingHorizontal: 16, paddingBottom: 28, paddingTop: 8 },
  signOutBtn: { backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  signOutText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
});
