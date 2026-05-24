import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function AddMeetingModal({
  visible,
  onClose,
  onSave,
  initialTitle = '',
  initialNote = '',
  initialDate = new Date(),
  isAR = false,
  brandColor = '#1b4654',
  isDark = false,
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('');

  // Start time parts
  const [startHour, setStartHour] = useState('10');
  const [startMin, setStartMin] = useState('00');
  const [startAmpm, setStartAmpm] = useState('AM');

  // End time parts
  const [endHour, setEndHour] = useState('11');
  const [endMin, setEndMin] = useState('00');
  const [endAmpm, setEndAmpm] = useState('AM');

  const [noteText, setNoteText] = useState('');
  const [reminderMode, setReminderMode] = useState('preset'); // 'preset' | 'custom'
  const [reminderOffset, setReminderOffset] = useState(10);
  const [customMinutes, setCustomMinutes] = useState('');

  // Date picker visibility
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(new Date());

  // Track focused fields for modern active borders
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setNoteText(initialNote);

      const d = initialDate instanceof Date ? initialDate : new Date(initialDate);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setDateStr(`${y}-${m}-${day}`);

      setStartHour('10'); setStartMin('00'); setStartAmpm('AM');
      setEndHour('11');   setEndMin('00');   setEndAmpm('AM');
      setReminderMode('preset'); setReminderOffset(10); setCustomMinutes('');
      setShowDatePicker(false);
      setPickerMonth(d);
    }
  }, [visible, initialTitle, initialNote, initialDate]);

  const buildTime = (h, m, ap) =>
    `${h || '10'}:${String(m || '0').padStart(2, '0')} ${ap}`;

  const parseDate = (str) => {
    if (!str) return new Date();
    const parts = str.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return new Date();
  };

  const getPickerDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    const cells = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, prevMonthTotalDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let i = 1; i <= totalDays; i++) {
      cells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding to complete 42-cell grid
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return cells;
  };

  const weekdaysEn = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const weekdaysAr = ['أحد', 'إثن', 'ثلا', 'أرب', 'خميس', 'جمع', 'سبت'];
  const weekdays = isAR ? weekdaysAr : weekdaysEn;

  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'يرجى إدخال عنوان الاجتماع.' : 'Please enter a meeting title.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      Alert.alert(isAR ? 'خطأ في التاريخ' : 'Invalid Date', isAR ? 'يرجى إدخال التاريخ بالصيغة YYYY-MM-DD.' : 'Please enter date as YYYY-MM-DD.');
      return;
    }
    const sh = parseInt(startHour, 10);
    const sm = parseInt(startMin, 10);
    const eh = parseInt(endHour, 10);
    const em = parseInt(endMin, 10);
    if (!startHour || sh < 1 || sh > 12 || isNaN(sm) || sm < 0 || sm > 59 ||
        !endHour   || eh < 1 || eh > 12 || isNaN(em) || em < 0 || em > 59) {
      Alert.alert(isAR ? 'خطأ في الوقت' : 'Invalid Time', isAR ? 'أدخل ساعة (1-12) ودقيقة (0-59) صحيحة.' : 'Enter a valid hour (1–12) and minute (0–59).');
      return;
    }

    let finalOffset = reminderOffset;
    if (reminderMode === 'custom') {
      const parsed = parseInt(customMinutes, 10);
      if (!customMinutes || isNaN(parsed) || parsed < 0) {
        Alert.alert(isAR ? 'خطأ' : 'Error', isAR ? 'أدخل عدد دقائق صحيح.' : 'Enter a valid number of minutes.');
        return;
      }
      finalOffset = parsed;
    }

    onSave({
      title: title.trim(),
      dateStr,
      startTime: buildTime(startHour, startMin, startAmpm),
      endTime: buildTime(endHour, endMin, endAmpm),
      noteText: noteText.trim(),
      reminderOffset: finalOffset,
    });
  };

  const bg        = isDark ? '#0F172A' : '#F8FAFC';
  const modalBg   = isDark ? '#1E293B' : '#FFFFFF';
  const textClr   = isDark ? '#F8FAFC' : '#0F172A';
  const subtextClr = isDark ? '#94A3B8' : '#64748B';
  const inputBg   = isDark ? '#0F172A' : '#F1F5F9';
  const borderClr = isDark ? '#334155' : '#E2E8F0';

  const presets = [
    { label: isAR ? 'عند الوقت' : 'At time', value: 0 },
    { label: isAR ? '10 د'      : '10 min',  value: 10 },
    { label: isAR ? '30 د'      : '30 min',  value: 30 },
    { label: isAR ? 'ساعة'      : '1 hr',    value: 60 },
    { label: isAR ? 'يوم'       : '1 day',   value: 1440 },
  ];

  const AmpmToggle = ({ value, onChange }) => (
    <View style={[styles.ampmContainer, { backgroundColor: inputBg, borderColor: borderClr }]}>
      {['AM', 'PM'].map((ap) => {
        const active = value === ap;
        return (
          <TouchableOpacity
            key={ap}
            onPress={() => onChange(ap)}
            activeOpacity={0.8}
            style={[
              styles.ampmBtn,
              active && { backgroundColor: brandColor }
            ]}
          >
            <Text
              style={[
                styles.ampmText,
                { color: active ? '#fff' : subtextClr }
              ]}
            >
              {ap}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: modalBg, paddingTop: Math.max(insets.top, 10) }]}>
        
        {/* Modern Sheet Header */}
        <View style={[styles.header, { borderBottomColor: borderClr, flexDirection: isAR ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]} activeOpacity={0.6}>
            <Ionicons name="close" size={20} color={textClr} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textClr }]}>
            {isAR ? 'اجتماع جديد' : 'New Meeting'}
          </Text>
          <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: brandColor }]} activeOpacity={0.8}>
            <Text style={styles.saveText}>{isAR ? 'حفظ' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Title */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: subtextClr, textAlign: isAR ? 'right' : 'left' }]}>
                {isAR ? 'عنوان الاجتماع *' : 'MEETING TITLE *'}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: inputBg, color: textClr, borderColor: focusedField === 'title' ? brandColor : borderClr, textAlign: isAR ? 'right' : 'left' }
                ]}
                placeholder={isAR ? 'مثال: اجتماع فريق المبيعات' : 'e.g. Sales Team Alignment'}
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                value={title}
                onChangeText={setTitle}
                onFocus={() => setFocusedField('title')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Date */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: subtextClr, textAlign: isAR ? 'right' : 'left' }]}>
                {isAR ? 'التاريخ *' : 'DATE *'}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowDatePicker(!showDatePicker)}
                style={[
                  styles.inputButton,
                  {
                    backgroundColor: inputBg,
                    borderColor: showDatePicker ? brandColor : borderClr,
                    flexDirection: isAR ? 'row-reverse' : 'row',
                  }
                ]}
              >
                <Text style={{ color: dateStr ? textClr : subtextClr, fontSize: 16, fontWeight: '500', flex: 1, textAlign: isAR ? 'right' : 'left' }}>
                  {dateStr || (isAR ? 'اختر التاريخ' : 'Select Date')}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={brandColor} />
              </TouchableOpacity>

              {/* Custom Pure Javascript Inline Calendar Picker */}
              {showDatePicker && (
                <View style={[styles.inlinePickerContainer, { backgroundColor: isDark ? '#141E30' : '#F8FAFC', borderColor: borderClr }]}>
                  {/* Month header selector */}
                  <View style={{ flexDirection: isAR ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <TouchableOpacity
                      onPress={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1))}
                      style={{ padding: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#E2E8F0', borderRadius: 8 }}
                    >
                      <Ionicons name={isAR ? "chevron-forward" : "chevron-back"} size={18} color={textClr} />
                    </TouchableOpacity>
                    
                    <Text style={{ fontSize: 15, fontWeight: '700', color: textClr }}>
                      {isAR ? monthNamesAr[pickerMonth.getMonth()] : monthNamesEn[pickerMonth.getMonth()]} {pickerMonth.getFullYear()}
                    </Text>

                    <TouchableOpacity
                      onPress={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1))}
                      style={{ padding: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#E2E8F0', borderRadius: 8 }}
                    >
                      <Ionicons name={isAR ? "chevron-back" : "chevron-forward"} size={18} color={textClr} />
                    </TouchableOpacity>
                  </View>

                  {/* Weekday headers */}
                  <View style={{ flexDirection: isAR ? 'row-reverse' : 'row', justifyContent: 'space-around', marginBottom: 8 }}>
                    {weekdays.map((wd, i) => (
                      <Text key={i} style={{ fontSize: 12, fontWeight: '600', color: subtextClr, width: 36, textAlign: 'center' }}>
                        {wd}
                      </Text>
                    ))}
                  </View>

                  {/* 42-day Grid */}
                  <View style={{ flexDirection: isAR ? 'row-reverse' : 'row', flexWrap: 'wrap', justifyContent: 'space-around' }}>
                    {getPickerDays(pickerMonth).map((cell, idx) => {
                      const today = new Date();
                      const isToday = cell.date.getDate() === today.getDate() &&
                                      cell.date.getMonth() === today.getMonth() &&
                                      cell.date.getFullYear() === today.getFullYear();

                      const currentSelected = parseDate(dateStr);
                      const isSelected = cell.date.getDate() === currentSelected.getDate() &&
                                         cell.date.getMonth() === currentSelected.getMonth() &&
                                         cell.date.getFullYear() === currentSelected.getFullYear();

                      return (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => {
                            const y = cell.date.getFullYear();
                            const m = String(cell.date.getMonth() + 1).padStart(2, '0');
                            const d = String(cell.date.getDate()).padStart(2, '0');
                            setDateStr(`${y}-${m}-${d}`);
                          }}
                          style={{
                            width: 36,
                            height: 36,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginVertical: 4,
                          }}
                        >
                          <View style={[
                            { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
                            isToday && { borderWidth: 1.5, borderColor: brandColor },
                            isSelected && { backgroundColor: brandColor }
                          ]}>
                            <Text style={{
                              fontSize: 13,
                              fontWeight: isSelected || isToday ? '700' : '500',
                              color: isSelected ? '#fff' : (cell.isCurrentMonth ? textClr : subtextClr),
                              opacity: cell.isCurrentMonth ? 1 : 0.4
                            }}>
                              {cell.date.getDate()}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Done button */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowDatePicker(false)}
                    style={{ alignSelf: isAR ? 'flex-start' : 'flex-end', paddingTop: 12, paddingHorizontal: 8 }}
                  >
                    <Text style={{ color: brandColor, fontWeight: '700', fontSize: 15 }}>{isAR ? 'تم' : 'Done'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Times Selection Container */}
            <View style={[styles.timeCard, { backgroundColor: isDark ? '#141E30' : '#F8FAFC', borderColor: borderClr }]}>
              {/* Start Time */}
              <View style={styles.timeSubField}>
                <Text style={[styles.label, { color: subtextClr, textAlign: isAR ? 'right' : 'left', marginBottom: 10 }]}>
                  {isAR ? 'وقت البدء *' : 'START TIME *'}
                </Text>
                <View style={[styles.timeRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                  <View style={styles.timeInputsWrap}>
                    <TextInput
                      style={[styles.timeBox, { backgroundColor: inputBg, color: textClr, borderColor: focusedField === 'shour' ? brandColor : borderClr }]}
                      value={startHour}
                      onChangeText={v => setStartHour(v.replace(/\D/g, '').slice(0, 2))}
                      keyboardType="numeric" maxLength={2}
                      placeholder="10" placeholderTextColor={subtextClr}
                      onFocus={() => setFocusedField('shour')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <Text style={[styles.colon, { color: textClr }]}>:</Text>
                    <TextInput
                      style={[styles.timeBox, { backgroundColor: inputBg, color: textClr, borderColor: focusedField === 'smin' ? brandColor : borderClr }]}
                      value={startMin}
                      onChangeText={v => setStartMin(v.replace(/\D/g, '').slice(0, 2))}
                      keyboardType="numeric" maxLength={2}
                      placeholder="00" placeholderTextColor={subtextClr}
                      onFocus={() => setFocusedField('smin')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                  <AmpmToggle value={startAmpm} onChange={setStartAmpm} />
                </View>
              </View>

              <View style={[styles.timeDivider, { backgroundColor: borderClr }]} />

              {/* End Time */}
              <View style={styles.timeSubField}>
                <Text style={[styles.label, { color: subtextClr, textAlign: isAR ? 'right' : 'left', marginBottom: 10 }]}>
                  {isAR ? 'وقت الانتهاء *' : 'END TIME *'}
                </Text>
                <View style={[styles.timeRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                  <View style={styles.timeInputsWrap}>
                    <TextInput
                      style={[styles.timeBox, { backgroundColor: inputBg, color: textClr, borderColor: focusedField === 'ehour' ? brandColor : borderClr }]}
                      value={endHour}
                      onChangeText={v => setEndHour(v.replace(/\D/g, '').slice(0, 2))}
                      keyboardType="numeric" maxLength={2}
                      placeholder="11" placeholderTextColor={subtextClr}
                      onFocus={() => setFocusedField('ehour')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <Text style={[styles.colon, { color: textClr }]}>:</Text>
                    <TextInput
                      style={[styles.timeBox, { backgroundColor: inputBg, color: textClr, borderColor: focusedField === 'emin' ? brandColor : borderClr }]}
                      value={endMin}
                      onChangeText={v => setEndMin(v.replace(/\D/g, '').slice(0, 2))}
                      keyboardType="numeric" maxLength={2}
                      placeholder="00" placeholderTextColor={subtextClr}
                      onFocus={() => setFocusedField('emin')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                  <AmpmToggle value={endAmpm} onChange={setEndAmpm} />
                </View>
              </View>
            </View>

            {/* Notes */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: subtextClr, textAlign: isAR ? 'right' : 'left' }]}>
                {isAR ? 'ملاحظات / وصف' : 'NOTES / DESCRIPTION'}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.multilineInput,
                  { backgroundColor: inputBg, color: textClr, borderColor: focusedField === 'notes' ? brandColor : borderClr, textAlign: isAR ? 'right' : 'left' }
                ]}
                placeholder={isAR ? 'اكتب تفاصيل الاجتماع هنا...' : 'Type meeting details here...'}
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                multiline
                value={noteText}
                onChangeText={setNoteText}
                onFocus={() => setFocusedField('notes')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Reminder */}
            <View style={styles.field}>
              <View style={[styles.reminderHeader, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                <Ionicons name="notifications-outline" size={16} color={brandColor}
                  style={{ marginRight: isAR ? 0 : 8, marginLeft: isAR ? 8 : 0 }} />
                <Text style={[styles.label, { color: subtextClr, marginBottom: 0 }]}>
                  {isAR ? 'التذكير قبل' : 'REMIND ME BEFORE'}
                </Text>
              </View>

              {/* Preset chips + Custom chip */}
              <View style={[styles.chipRow, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                {presets.map((opt) => {
                  const active = reminderMode === 'preset' && reminderOffset === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => { setReminderMode('preset'); setReminderOffset(opt.value); }}
                      activeOpacity={0.7}
                      style={[
                        styles.chip,
                        { backgroundColor: active ? brandColor : inputBg, borderColor: active ? brandColor : borderClr }
                      ]}
                    >
                      <Text style={[styles.chipText, { color: active ? '#fff' : subtextClr }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  onPress={() => setReminderMode('custom')}
                  activeOpacity={0.7}
                  style={[
                    styles.chip,
                    { backgroundColor: reminderMode === 'custom' ? brandColor : inputBg, borderColor: reminderMode === 'custom' ? brandColor : borderClr }
                  ]}
                >
                  <Text style={[styles.chipText, { color: reminderMode === 'custom' ? '#fff' : subtextClr }]}>
                    {isAR ? 'مخصص' : 'Custom'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Custom minute entry */}
              {reminderMode === 'custom' && (
                <View style={[styles.customRow, { borderColor: borderClr, backgroundColor: inputBg, flexDirection: isAR ? 'row-reverse' : 'row' }]}>
                  <TextInput
                    style={[styles.customInput, { color: textClr }]}
                    placeholder="20"
                    placeholderTextColor={subtextClr}
                    value={customMinutes}
                    onChangeText={v => setCustomMinutes(v.replace(/\D/g, ''))}
                    keyboardType="numeric"
                    autoFocus
                  />
                  <Text style={[styles.customUnit, { color: subtextClr }]}>
                    {isAR ? 'دقيقة قبل الاجتماع' : 'min before meeting'}
                  </Text>
                </View>
              )}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: 0.2, flex: 1, textAlign: 'center' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  saveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  field: { marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 16,
    fontWeight: '500',
  },
  inputButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  inlinePickerContainer: {
    marginTop: 10,
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 10,
  },
  multilineInput: { minHeight: 110, textAlignVertical: 'top', paddingTop: 14 },

  // Time picker card styles
  timeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  timeSubField: { paddingVertical: 4 },
  timeDivider: { height: 1.5, marginVertical: 16 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeInputsWrap: { flexDirection: 'row', alignItems: 'center' },
  timeBox: {
    width: 65,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  colon: { fontSize: 24, fontWeight: '800', marginHorizontal: 6 },
  ampmContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1.5,
  },
  ampmBtn: {
    width: 48,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ampmText: { fontSize: 13, fontWeight: '700' },

  // Reminder
  reminderHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '700' },
  customRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  customInput: { fontSize: 20, fontWeight: '800', minWidth: 60, padding: 0 },
  customUnit: { fontSize: 14, fontWeight: '600' },
});
