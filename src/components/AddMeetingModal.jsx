import React, { useState, useEffect, useRef } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endTime, setEndTime] = useState('11:00 AM');
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setNoteText(initialNote);
      
      const d = initialDate instanceof Date ? initialDate : new Date(initialDate);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setDateStr(`${y}-${m}-${day}`);

      // Set default times
      setStartTime('10:00 AM');
      setEndTime('11:00 AM');
    }
  }, [visible, initialTitle, initialNote, initialDate]);

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert(
        isAR ? 'خطأ' : 'Error',
        isAR ? 'يرجى إدخال عنوان الاجتماع.' : 'Please enter a meeting title.'
      );
      return;
    }

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      Alert.alert(
        isAR ? 'خطأ في التاريخ' : 'Invalid Date',
        isAR ? 'يرجى إدخال التاريخ بالصيغة YYYY-MM-DD.' : 'Please enter date as YYYY-MM-DD.'
      );
      return;
    }

    // Validate times
    const timeRegex = /^\d{1,2}:\d{2}\s*(AM|PM|ص|م)?$/i;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      Alert.alert(
        isAR ? 'خطأ في الوقت' : 'Invalid Time',
        isAR
          ? 'يرجى إدخال الوقت بصيغة HH:MM AM/PM (مثال: 10:00 AM).'
          : 'Please enter times as HH:MM AM/PM (e.g. 10:00 AM).'
      );
      return;
    }

    onSave({
      title: title.trim(),
      dateStr,
      startTime,
      endTime,
      noteText: noteText.trim(),
    });
  };

  const bg = isDark ? '#1E293B' : '#FFFFFF';
  const textClr = isDark ? '#F8FAFC' : '#1E293B';
  const subtextClr = isDark ? '#94A3B8' : '#64748B';
  const inputBg = isDark ? '#0F172A' : '#F8FAFC';
  const borderClr = isDark ? '#334155' : '#E2E8F0';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: borderClr, flexDirection: isAR ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={[styles.cancelText, { color: subtextClr }]}>
              {isAR ? 'إلغاء' : 'Cancel'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textClr }]}>
            {isAR ? 'جدولة اجتماع جديد' : 'Schedule New Meeting'}
          </Text>
          <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: brandColor }]}>
            <Text style={styles.saveText}>
              {isAR ? 'حفظ' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* Title */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: subtextClr, textAlign: isAR ? 'right' : 'left' }]}>
                {isAR ? 'عنوان الاجتماع *' : 'Meeting Title *'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, color: textClr, borderColor: borderClr, textAlign: isAR ? 'right' : 'left' }]}
                placeholder={isAR ? "مثال: اجتماع فريق المبيعات" : "e.g. Sales Team Alignment"}
                placeholderTextColor={subtextClr}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Date */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: subtextClr, textAlign: isAR ? 'right' : 'left' }]}>
                {isAR ? 'التاريخ (YYYY-MM-DD) *' : 'Date (YYYY-MM-DD) *'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, color: textClr, borderColor: borderClr, textAlign: isAR ? 'right' : 'left' }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={subtextClr}
                value={dateStr}
                onChangeText={setDateStr}
                keyboardType="numeric"
              />
            </View>

            {/* Times */}
            <View style={[styles.row, { flexDirection: isAR ? 'row-reverse' : 'row' }]}>
              <View style={[styles.field, { flex: 1, marginRight: isAR ? 0 : 12, marginLeft: isAR ? 12 : 0 }]}>
                <Text style={[styles.label, { color: subtextClr, textAlign: isAR ? 'right' : 'left' }]}>
                  {isAR ? 'وقت البدء *' : 'Start Time *'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, color: textClr, borderColor: borderClr, textAlign: isAR ? 'right' : 'left' }]}
                  placeholder="10:00 AM"
                  placeholderTextColor={subtextClr}
                  value={startTime}
                  onChangeText={setStartTime}
                />
              </View>

              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: subtextClr, textAlign: isAR ? 'right' : 'left' }]}>
                  {isAR ? 'وقت الانتهاء *' : 'End Time *'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, color: textClr, borderColor: borderClr, textAlign: isAR ? 'right' : 'left' }]}
                  placeholder="11:00 AM"
                  placeholderTextColor={subtextClr}
                  value={endTime}
                  onChangeText={setEndTime}
                />
              </View>
            </View>

            {/* Note */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: subtextClr, textAlign: isAR ? 'right' : 'left' }]}>
                {isAR ? 'ملاحظات / وصف' : 'Notes / Description'}
              </Text>
              <TextInput
                style={[styles.input, styles.multilineInput, { backgroundColor: inputBg, color: textClr, borderColor: borderClr, textAlign: isAR ? 'right' : 'left' }]}
                placeholder={isAR ? "اكتب تفاصيل الاجتماع هنا..." : "Type meeting details here..."}
                placeholderTextColor={subtextClr}
                multiline
                value={noteText}
                onChangeText={setNoteText}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerBtn: { padding: 4 },
  cancelText: { fontSize: 16 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  scroll: { padding: 20 },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row' },
});
