import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { leadsApi, authApi } from '@/services/api';
import AddMeetingModal from '@/components/AddMeetingModal';
import * as Linking from 'expo-linking';

const LEAD_STATUSES = [
  { val: 'new', label_en: 'New', label_ar: 'جديد', color: '#3B82F6', icon: 'star-outline' },
  { val: 'contacted', label_en: 'Contacted', label_ar: 'تم الاتصال', color: '#F59E0B', icon: 'call-outline' },
  { val: 'qualified', label_en: 'Qualified', label_ar: 'مؤهل', color: '#10B981', icon: 'ribbon-outline' },
  { val: 'lost', label_en: 'Lost', label_ar: 'مفقود', color: '#EF4444', icon: 'close-circle-outline' }
];

const MEETING_STATUSES = [
  { val: 'scheduled', label_en: 'Scheduled', label_ar: 'مجدول', color: '#0EA5E9', icon: 'time-outline' },
  { val: 'completed', label_en: 'Completed', label_ar: 'مكتمل', color: '#10B981', icon: 'checkmark-circle-outline' },
  { val: 'postponed', label_en: 'Postponed', label_ar: 'مؤجل', color: '#F59E0B', icon: 'arrow-forward-outline' },
  { val: 'cancelled', label_en: 'Cancelled', label_ar: 'ملغي', color: '#EF4444', icon: 'close-outline' }
];

export default function CRMLeadScreen() {
  const { user } = useAuth();
  const { isDark, language, brandColor } = useAppContext();
  const isAR = language === 'ar';
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const isEdit = !!params.id;

  // Form Fields
  const [visitorName, setVisitorName] = useState(params.visitor_name || '');
  const [email, setEmail] = useState(params.email || '');
  const [phone, setPhone] = useState(params.phone || '');
  const [companyName, setCompanyName] = useState(params.company_name || params.company || '');
  
  const initialProduct = params.product_name || '';
  const [productName, setProductName] = useState(initialProduct);
  const [customProducts, setCustomProducts] = useState([]);

  // No default products, only custom ones that the user saves
  const defaultProducts = [];

  // Combined product list (defaults + saved customs)
  const allProductOptions = [...defaultProducts, ...customProducts];

  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const showOtherProduct = isOtherSelected || (!!productName && !allProductOptions.includes(productName));

  useEffect(() => {
    // Load saved custom products
    const loadCustomProducts = async () => {
      try {
        const saved = await AsyncStorage.getItem('@dgcards_custom_products');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setCustomProducts(parsed);
          }
        }
      } catch (err) {}
    };
    loadCustomProducts();
  }, []);

  const [status, setStatus] = useState(params.status || 'new');
  
  // Meeting variables from DB (legacy support, no longer actively used as text inputs)
  const [meetingPurpose, setMeetingPurpose] = useState(params.meeting_purpose || '');
  const [meetingDate, setMeetingDate] = useState(params.meeting_date || '');
  const [meetingStatus, setMeetingStatus] = useState(params.meeting_status || 'scheduled');
  const [meetingReview, setMeetingReview] = useState(params.meeting_review || '');

  const [notes, setNotes] = useState(params.notes || '');

  // UI State
  const [showMeetingModal, setShowMeetingModal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const bg = isDark ? '#0F172A' : '#F8FAFC';
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const text = isDark ? '#F8FAFC' : '#0F172A';
  const subtext = isDark ? '#94A3B8' : '#64748B';
  const border = isDark ? '#334155' : '#E2E8F0';

  const handleSaveMeetingModal = async (meetingDetails) => {
    const { title, dateStr, startTime, endTime, noteText: meetingNotes } = meetingDetails;

    // Update local meeting states so they are visible and get saved to the backend!
    setMeetingPurpose(title);
    setMeetingDate(dateStr);
    setMeetingReview(meetingNotes);
    setMeetingStatus('scheduled');

    // If it's an existing lead, auto-save to ensure it reflects immediately
    if (isEdit) {
      try {
        await leadsApi.update(params.id, {
          visitor_name: visitorName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          company_name: companyName.trim() || null,
          company: companyName.trim() || null,
          product_name: productName.trim() || null,
          status,
          meeting_purpose: title,
          meeting_date: dateStr,
          meeting_status: 'scheduled',
          meeting_review: meetingNotes,
          notes: notes.trim()
        });
      } catch (err) {
        console.error('[Auto-save Meeting Error]', err);
      }
    }

    Alert.alert(
      isAR ? 'تم الحفظ' : 'Meeting Saved',
      isAR 
        ? 'تمت إضافة الاجتماع إلى ملاحظاتك بشكل منظم ونظيف.' 
        : 'The meeting details have been cleanly formatted and saved to your notes.'
    );
    
    setShowMeetingModal(false);

    // Optionally launch calendar
    const details = `Meeting Details:\n${meetingNotes}`;
    const toGoogleDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const startD = new Date(`${dateStr}T10:00:00`);
    const endD = new Date(startD.getTime() + 3600*1000);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}&dates=${toGoogleDate(startD)}/${toGoogleDate(endD)}`;
    Linking.openURL(url).catch(() => {});
  };

  const handleArchiveMeeting = async () => {
    const dateText = meetingDate ? meetingDate : 'N/A';
    const purposeText = meetingPurpose ? meetingPurpose.trim() : 'N/A';
    const statusText = meetingStatus;
    const reviewText = meetingReview ? meetingReview.trim() : 'N/A';

    const summary = `--- Previous Meeting (${dateText}) ---\nPurpose: ${purposeText}\nStatus: ${statusText}\nReview/Outcome: ${reviewText}\n\n`;

    // Prepend to notes to keep history
    const newNotes = notes ? `${summary}${notes}` : summary;
    setNotes(newNotes);

    // Clear meeting fields locally
    setMeetingPurpose('');
    setMeetingDate('');
    setMeetingStatus('scheduled');
    setMeetingReview('');

    if (isEdit) {
      try {
        await leadsApi.update(params.id, {
          meeting_purpose: null,
          meeting_date: null,
          meeting_status: 'scheduled',
          meeting_review: null,
          notes: newNotes.trim()
        });
      } catch (err) {}
    }

    Alert.alert(
      isAR ? 'تم الحفظ' : 'Meeting Archived',
      isAR ? 'تم نقل الاجتماع السابق إلى الملاحظات.' : 'Previous meeting archived to notes. You can now schedule a new one.'
    );
  };

  const saveCustomProduct = async (product) => {
    if (!product || product.trim() === '') return;
    const p = product.trim();
    if (allProductOptions.includes(p)) return;
    
    try {
      const newList = [...customProducts, p];
      await AsyncStorage.setItem('@dgcards_custom_products', JSON.stringify(newList));
      setCustomProducts(newList);
    } catch (err) {}
  };

  const handleSave = async () => {
    if (!visitorName.trim()) {
      Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'الاسم الكامل مطلوب' : 'Full Name is required.');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        // Mode: Update CRM record
        await leadsApi.update(params.id, {
          visitor_name: visitorName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          company_name: companyName.trim() || null,
          company: companyName.trim() || null,
          product_name: productName.trim() || null,
          status,
          meeting_purpose: meetingPurpose.trim() || null,
          meeting_date: meetingDate || null,
          meeting_status: meetingStatus,
          meeting_review: meetingReview.trim() || null,
          notes: notes.trim() || null
        });
        saveCustomProduct(productName);
        Alert.alert(isAR ? 'نجاح' : 'Success', isAR ? 'تم تحديث سجل العميل بنجاح' : 'CRM lead updated successfully.');
      } else {
        // Mode: Create CRM record manually
        const { data: cardData } = await authApi.getCardSlug();
        const cardId = cardData.card_id;
        const tenantSlug = cardData.tenant_slug || user?.tenant_slug || user?.schema_slug;

        if (!cardId || !tenantSlug) {
          Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'فشل تحميل بيانات البطاقة' : 'Could not load active card details.');
          setSaving(false);
          return;
        }

        await leadsApi.create({
          tenantSlug,
          cardId,
          visitor_name: visitorName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          company_name: companyName.trim() || null,
          company: companyName.trim() || null,
          product_name: productName.trim() || null,
          status,
          meeting_purpose: meetingPurpose.trim() || null,
          meeting_date: meetingDate || null,
          meeting_status: meetingStatus,
          meeting_review: meetingReview.trim() || null,
          notes: notes.trim() || null,
          action_type: 'manual_entry'
        });
        saveCustomProduct(productName);
        Alert.alert(isAR ? 'نجاح' : 'Success', isAR ? 'تمت إضافة العميل بنجاح' : 'CRM lead generated successfully.');
      }
      router.back();
    } catch (err) {
      console.error('[Save CRM Lead Error]', err?.response?.data || err.message);
      Alert.alert(
        isAR ? 'خطأ' : 'Error',
        err?.response?.data?.message || (isAR ? 'فشل حفظ التغييرات' : 'Failed to save CRM record.')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: brandColor }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: bg }}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: brandColor, paddingTop: Math.max(insets.top, 8) + 6, height: Math.max(insets.top, 8) + 56 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={15}>
            <Ionicons name={isAR ? "arrow-forward" : "arrow-back"} size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEdit 
              ? (isAR ? 'متابعة سجل العميل' : 'CRM Lead Follow-up')
              : (isAR ? 'إنشاء عميل جديد' : 'Generate New Lead')
            }
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.backBtn} hitSlop={15}>
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="checkmark-done" size={22} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 40) + 400 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          {/* Section 1: Customer Info */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={[styles.cardHeader, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
              <View style={[styles.cardHeaderIconWrap, { backgroundColor: brandColor + '12' }]}>
                <Ionicons name="person-outline" size={18} color={brandColor} />
              </View>
              <Text style={[styles.cardTitle, { color: text, marginLeft: isAR ? 0 : 8, marginRight: isAR ? 8 : 0 }]}>
                {isAR ? 'بيانات العميل الأساسية' : 'Primary Client Details'}
              </Text>
            </View>

            {/* Name */}
            <View style={styles.inputGroup}>
              <View style={[styles.fieldContainer, { flexDirection: isAR ? 'row-reverse' : 'row', borderColor: focusedField === 'visitorName' ? brandColor : border }]}>
                <Ionicons 
                  name="person-outline" 
                  size={18} 
                  color={focusedField === 'visitorName' ? brandColor : subtext} 
                  style={isAR ? { marginLeft: 12 } : { marginRight: 12 }} 
                />
                <View style={[styles.fieldContent, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
                  <Text style={[styles.fieldLabel, { color: focusedField === 'visitorName' ? brandColor : subtext }]}>
                    {isAR ? 'الاسم الكامل' : 'Full Name'}
                  </Text>
                  <TextInput
                    value={visitorName}
                    onChangeText={setVisitorName}
                    placeholder={isAR ? "الاسم" : "John Doe"}
                    placeholderTextColor="#999"
                    onFocus={() => setFocusedField('visitorName')}
                    onBlur={() => setFocusedField(null)}
                    style={[styles.textInput, { color: text, textAlign: isAR ? 'right' : 'left' }]}
                  />
                </View>
              </View>
            </View>

            {/* Company */}
            <View style={styles.inputGroup}>
              <View style={[styles.fieldContainer, { flexDirection: isAR ? 'row-reverse' : 'row', borderColor: focusedField === 'companyName' ? brandColor : border }]}>
                <Ionicons 
                  name="business-outline" 
                  size={18} 
                  color={focusedField === 'companyName' ? brandColor : subtext} 
                  style={isAR ? { marginLeft: 12 } : { marginRight: 12 }} 
                />
                <View style={[styles.fieldContent, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
                  <Text style={[styles.fieldLabel, { color: focusedField === 'companyName' ? brandColor : subtext }]}>
                    {isAR ? 'اسم الشركة' : 'Company Name'}
                  </Text>
                  <TextInput
                    value={companyName}
                    onChangeText={setCompanyName}
                    placeholder={isAR ? "الشركة" : "Company Inc."}
                    placeholderTextColor="#999"
                    onFocus={() => setFocusedField('companyName')}
                    onBlur={() => setFocusedField(null)}
                    style={[styles.textInput, { color: text, textAlign: isAR ? 'right' : 'left' }]}
                  />
                </View>
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <View style={[styles.fieldContainer, { flexDirection: isAR ? 'row-reverse' : 'row', borderColor: focusedField === 'email' ? brandColor : border }]}>
                <Ionicons 
                  name="mail-outline" 
                  size={18} 
                  color={focusedField === 'email' ? brandColor : subtext} 
                  style={isAR ? { marginLeft: 12 } : { marginRight: 12 }} 
                />
                <View style={[styles.fieldContent, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
                  <Text style={[styles.fieldLabel, { color: focusedField === 'email' ? brandColor : subtext }]}>
                    {isAR ? 'البريد الإلكتروني' : 'Email Address'}
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder={isAR ? "البريد الإلكتروني" : "email@example.com"}
                    placeholderTextColor="#999"
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={[styles.textInput, { color: text, textAlign: isAR ? 'right' : 'left' }]}
                  />
                </View>
              </View>
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <View style={[styles.fieldContainer, { flexDirection: isAR ? 'row-reverse' : 'row', borderColor: focusedField === 'phone' ? brandColor : border }]}>
                <Ionicons 
                  name="call-outline" 
                  size={18} 
                  color={focusedField === 'phone' ? brandColor : subtext} 
                  style={isAR ? { marginLeft: 12 } : { marginRight: 12 }} 
                />
                <View style={[styles.fieldContent, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
                  <Text style={[styles.fieldLabel, { color: focusedField === 'phone' ? brandColor : subtext }]}>
                    {isAR ? 'رقم الهاتف' : 'Phone Number'}
                  </Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder={isAR ? "رقم الهاتف" : "+1 234 567 8900"}
                    placeholderTextColor="#999"
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="phone-pad"
                    style={[styles.textInput, { color: text, textAlign: isAR ? 'right' : 'left' }]}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Section 2: CRM Core Parameters */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={[styles.cardHeader, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
              <View style={[styles.cardHeaderIconWrap, { backgroundColor: brandColor + '12' }]}>
                <Ionicons name="funnel-outline" size={18} color={brandColor} />
              </View>
              <Text style={[styles.cardTitle, { color: text, marginLeft: isAR ? 0 : 8, marginRight: isAR ? 8 : 0 }]}>
                {isAR ? 'معايير المتابعة والمنتج' : 'CRM & Product Selection'}
              </Text>
            </View>

            {/* Product Interest Select */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: subtext, marginBottom: 6, textAlign: isAR ? 'right' : 'left' }]}>
                {isAR ? 'المنتج المهتم به' : 'PRODUCT INTEREST'}
              </Text>
              <View style={[styles.gridContainer, { flexDirection: isAR ? 'row-reverse' : 'row', marginBottom: 12, flexWrap: 'wrap' }]}>
                {allProductOptions.map(p => {
                   const active = (productName === p && !showOtherProduct);
                   let icon = 'cube-outline';
                   if (p === 'Digital Card') icon = 'card-outline';
                   else if (p === 'NFC Tag') icon = 'pricetag-outline';
                   else if (p === 'CRM System') icon = 'people-circle-outline';

                   return (
                     <TouchableOpacity
                       key={p}
                       onPress={() => {
                         setIsOtherSelected(false);
                         setProductName(p);
                       }}
                       style={[
                         styles.pickerPill,
                         { 
                           borderColor: active ? brandColor : border, 
                           backgroundColor: active ? brandColor + '12' : cardBg,
                           flexDirection: isAR ? 'row-reverse' : 'row',
                           marginBottom: 8
                         }
                       ]}
                     >
                       <Ionicons name={icon} size={14} color={active ? brandColor : subtext} style={isAR ? { marginLeft: 6 } : { marginRight: 6 }} />
                       <Text style={{ fontSize: 11, fontWeight: '700', color: active ? brandColor : text }}>
                         {p}
                       </Text>
                     </TouchableOpacity>
                   );
                })}

                <TouchableOpacity
                   onPress={() => setIsOtherSelected(true)}
                   style={[
                     styles.pickerPill,
                     { 
                       borderColor: showOtherProduct ? brandColor : border, 
                       backgroundColor: showOtherProduct ? brandColor + '12' : cardBg,
                       flexDirection: isAR ? 'row-reverse' : 'row',
                       marginBottom: 8
                     }
                   ]}
                 >
                   <Ionicons name="ellipsis-horizontal-circle-outline" size={14} color={showOtherProduct ? brandColor : subtext} style={isAR ? { marginLeft: 6 } : { marginRight: 6 }} />
                   <Text style={{ fontSize: 11, fontWeight: '700', color: showOtherProduct ? brandColor : text }}>
                     {isAR ? 'أخرى...' : 'Other...'}
                   </Text>
                 </TouchableOpacity>
              </View>

              {showOtherProduct && (
                <View style={[styles.fieldContainer, { flexDirection: isAR ? 'row-reverse' : 'row', borderColor: focusedField === 'productName' ? brandColor : border }]}>
                  <Ionicons 
                    name="cube-outline" 
                    size={18} 
                    color={focusedField === 'productName' ? brandColor : subtext} 
                    style={isAR ? { marginLeft: 12 } : { marginRight: 12 }} 
                  />
                  <View style={[styles.fieldContent, { alignItems: isAR ? 'flex-end' : 'flex-start' }]}>
                    <Text style={[styles.fieldLabel, { color: focusedField === 'productName' ? brandColor : subtext }]}>
                      {isAR ? 'اكتب اسم المنتج' : 'Type Product Name'}
                    </Text>
                    <TextInput
                      value={productName}
                      onChangeText={setProductName}
                      onFocus={() => setFocusedField('productName')}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.textInput, { color: text, textAlign: isAR ? 'right' : 'left', paddingRight: productName ? 24 : 0 }]}
                    />
                  </View>
                  {!!productName && (
                    <TouchableOpacity 
                      onPress={() => setProductName('')}
                      style={{ position: 'absolute', right: isAR ? undefined : 14, left: isAR ? 14 : undefined }}
                    >
                      <Ionicons name="close-circle" size={16} color={subtext} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Lead Status */}
            <View style={{ marginTop: 4, width: '100%' }}>
              <Text style={[styles.label, { color: subtext, marginBottom: 6, textAlign: isAR ? 'right' : 'left' }]}>
                {isAR ? 'حالة العميل' : 'LEAD STATUS'}
              </Text>
              <View style={[styles.gridContainer, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                {LEAD_STATUSES.map(item => {
                  const active = status === item.val;
                  return (
                    <TouchableOpacity
                      key={item.val}
                      onPress={() => setStatus(item.val)}
                      style={[
                        styles.pickerPill,
                        { 
                          borderColor: active ? item.color : border, 
                          backgroundColor: active ? item.color + '12' : cardBg,
                          flexDirection: isAR ? 'row-reverse' : 'row'
                        }
                      ]}
                    >
                      <Ionicons name={item.icon} size={14} color={active ? item.color : subtext} style={isAR ? { marginLeft: 6 } : { marginRight: 6 }} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: active ? item.color : text }}>
                        {isAR ? item.label_ar : item.label_en}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

            {/* Section 3: Meeting Tracker (Clean Scheduler) */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
              <View style={[styles.cardHeader, { flexDirection: isAR ? 'row-reverse' : 'row', justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: isAR ? 'row-reverse' : 'row', alignItems: 'center' }}>
                  <View style={[styles.cardHeaderIconWrap, { backgroundColor: brandColor + '12' }]}>
                    <Ionicons name="calendar-outline" size={18} color={brandColor} />
                  </View>
                  <Text style={[styles.cardTitle, { color: text, marginLeft: isAR ? 0 : 8, marginRight: isAR ? 8 : 0 }]}>
                    {isAR ? 'سجل وجدولة الاجتماعات' : 'Meeting Follow-up & Schedule'}
                  </Text>
                </View>
              </View>

              <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8, alignItems: 'center' }}>
                {(!!meetingPurpose || !!meetingDate) && (
                  <View style={{ width: '100%', backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: border }}>
                    <View style={{ flexDirection: isAR ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      {productName ? (
                        <View style={{ backgroundColor: brandColor + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: isAR ? 'row-reverse' : 'row', alignItems: 'center' }}>
                          <Ionicons name="pricetag-outline" size={12} color={brandColor} style={isAR ? { marginLeft: 4 } : { marginRight: 4 }} />
                          <Text style={{ fontSize: 10, fontWeight: '800', color: brandColor, textTransform: 'uppercase' }}>{productName}</Text>
                        </View>
                      ) : <View />}
                      <View style={{ backgroundColor: MEETING_STATUSES.find(s => s.val === meetingStatus)?.color + '15' || '#0EA5E915', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: MEETING_STATUSES.find(s => s.val === meetingStatus)?.color || '#0EA5E9', textTransform: 'uppercase' }}>
                          {MEETING_STATUSES.find(s => s.val === meetingStatus)?.[isAR ? 'label_ar' : 'label_en'] || 'Scheduled'}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 10, fontWeight: '700', color: subtext, marginBottom: 4, textTransform: 'uppercase', textAlign: isAR ? 'right' : 'left' }}>
                      {isAR ? 'الغرض' : 'PURPOSE'}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: text, textAlign: isAR ? 'right' : 'left' }}>
                      {meetingPurpose || (isAR ? 'اجتماع' : 'Meeting')}
                    </Text>

                    {!!meetingDate && (
                      <View style={{ flexDirection: isAR ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: isDark ? '#1E293B' : '#FFFFFF', padding: 10, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: border }}>
                        <Ionicons name="calendar-outline" size={14} color={subtext} style={isAR ? { marginLeft: 8 } : { marginRight: 8 }} />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: text }}>{meetingDate}</Text>
                      </View>
                    )}

                    {!!meetingReview && (
                      <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: border, paddingTop: 12 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: subtext, marginBottom: 4, textTransform: 'uppercase', textAlign: isAR ? 'right' : 'left' }}>
                          {isAR ? 'النتائج / المراجعة' : 'REVIEW'}
                        </Text>
                        <Text style={{ fontSize: 13, color: subtext, fontStyle: 'italic', lineHeight: 20, textAlign: isAR ? 'right' : 'left' }}>
                          "{meetingReview}"
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={handleArchiveMeeting}
                      style={{ marginTop: 16, backgroundColor: cardBg, borderWidth: 1, borderColor: border, paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: text }}>
                        {isAR ? 'أرشفة ونقل إلى الملاحظات' : 'Archive to Notes'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => setShowMeetingModal(true)}
                  style={{ backgroundColor: brandColor, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                    {isAR ? 'جدولة اجتماع / إضافة سجل' : 'Schedule or Log Meeting'}
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: subtext, fontSize: 12, marginTop: 12, textAlign: 'center', paddingHorizontal: 20 }}>
                  {isAR ? 'سيتم استخدام أداة الجدولة لترتيب اجتماعاتك، وتُحفظ النتائج بشكل منسّق ونظيف في الملاحظات.' : 'Use the clean scheduler to arrange meetings. Details will be formatted beautifully and saved in your notes.'}
                </Text>
              </View>

              {/* Meeting Status */}
              <View style={{ marginTop: 4, width: '100%', paddingHorizontal: 16, paddingBottom: 16 }}>
                <Text style={[styles.label, { color: subtext, marginBottom: 6, textAlign: isAR ? 'right' : 'left' }]}>
                  {isAR ? 'حالة الاجتماع' : 'MEETING STATUS'}
                </Text>
                <View style={[styles.gridContainer, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                  {MEETING_STATUSES.map(item => {
                    const active = meetingStatus === item.val;
                    return (
                      <TouchableOpacity
                        key={item.val}
                        onPress={() => setMeetingStatus(item.val)}
                        style={[
                          styles.pickerPill,
                          { 
                            borderColor: active ? item.color : border, 
                            backgroundColor: active ? item.color + '12' : cardBg,
                            flexDirection: isAR ? 'row-reverse' : 'row'
                          }
                        ]}
                      >
                        <Ionicons name={item.icon} size={14} color={active ? item.color : subtext} style={isAR ? { marginLeft: 6 } : { marginRight: 6 }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: active ? item.color : text }}>
                          {isAR ? item.label_ar : item.label_en}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

          {/* Section 4: General Notes */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={[styles.cardHeader, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
              <View style={[styles.cardHeaderIconWrap, { backgroundColor: brandColor + '12' }]}>
                <Ionicons name="create-outline" size={18} color={brandColor} />
              </View>
              <Text style={[styles.cardTitle, { color: text, marginLeft: isAR ? 0 : 8, marginRight: isAR ? 8 : 0 }]}>
                {isAR ? 'ملاحظات عامة' : 'General Remarks'}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <View style={[styles.fieldContainer, { minHeight: 140, height: 'auto', alignItems: 'flex-start', paddingTop: 10, paddingBottom: 10, flexDirection: isAR ? 'row-reverse' : 'row', borderColor: focusedField === 'notes' ? brandColor : border }]}>
                <Ionicons 
                  name="create-outline" 
                  size={18} 
                  color={focusedField === 'notes' ? brandColor : subtext} 
                  style={[isAR ? { marginLeft: 12 } : { marginRight: 12 }, { marginTop: 2 }]} 
                />
                <View style={[styles.fieldContent, { alignItems: isAR ? 'flex-end' : 'flex-start', height: '100%' }]}>
                  <Text style={[styles.fieldLabel, { color: focusedField === 'notes' ? brandColor : subtext }]}>
                    {isAR ? 'ملاحظات عامة' : 'General Remarks'}
                  </Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    onFocus={() => setFocusedField('notes')}
                    onBlur={() => setFocusedField(null)}
                    multiline
                    style={[styles.textInput, { color: text, textAlign: isAR ? 'right' : 'left', minHeight: 120, textAlignVertical: 'top' }]}
                  />
                </View>
              </View>
            </View>
          </View>

        </ScrollView>

        {/* Sticky Save Button */}
        <View style={{ padding: 16, backgroundColor: bg, borderTopWidth: 1, borderTopColor: border }}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: brandColor, shadowColor: brandColor, marginTop: 0 }]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>
                {isAR ? 'حفظ سجل العميل' : 'Save CRM Lead Record'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      
      {/* Internal Add Meeting Modal */}
      <AddMeetingModal
        visible={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        onSave={handleSaveMeetingModal}
        initialTitle={`Follow-up: ${visitorName}`}
        isAR={isAR}
        isDark={isDark}
        brandColor={brandColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800'
  },
  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 40
  },
  card: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardHeaderIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  archiveBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inputGroup: {
    width: '100%',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  fieldContainer: {
    width: '100%',
    height: 58,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    alignItems: 'center',
    position: 'relative',
  },
  fieldContent: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  textInput: {
    width: '100%',
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginTop: 4,
  },
  pickerPill: {
    flexDirection: 'row',
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '46%',
    margin: 4,
  },
  saveBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  }
});
