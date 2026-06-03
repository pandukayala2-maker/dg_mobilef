import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Dimensions, Platform } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context/AppContext';

const BRAND = '#1b4654';
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const { isDark, language, brandColor } = useAppContext();

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);
    if (data && data.startsWith('http')) {
      Linking.openURL(data).catch(() => { });
    }
  };

  const bg = isDark ? '#0F172A' : '#F3F4F6';
  const text = isDark ? '#F8FAFC' : '#1A1A1A';

  if (!permission) {
    return <View style={[s.center, { backgroundColor: bg }]} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: bg }]}>
        <View style={s.center}>
          <Ionicons name="camera-outline" size={64} color={brandColor} style={{ marginBottom: 16 }} />
          <Text style={[s.title, { color: text }]}>
            {language === 'ar' ? 'مطلب إذن الكاميرا' : 'Camera Access Required'}
          </Text>
          <Text style={[s.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {language === 'ar'
              ? 'نحتاج إلى الوصول إلى الكاميرا لمسح رموز DigCard QR.'
              : 'We need camera access to scan DigCard QR codes.'}
          </Text>
          <TouchableOpacity style={[s.btn, { backgroundColor: brandColor }]} onPress={requestPermission}>
            <Text style={s.btnText}>{language === 'ar' ? 'السماح بالكاميرا' : 'Allow Camera'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: '#000' }]} edges={['top']}>
      {Platform.OS === 'web' ? (
        <View style={[s.center, { backgroundColor: bg }]}>
          <Text style={[s.title, { color: text }]}>
            {language === 'ar' ? 'الماسح الضوئي غير مدعوم على الويب' : 'Scanner not supported on web'}
          </Text>
        </View>
      ) : (
        <View style={s.container}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          />
          <View style={s.overlay}>
            <View style={s.scanFrame}>
              <View style={[s.corner, s.topLeft]} />
              <View style={[s.corner, s.topRight]} />
              <View style={[s.corner, s.bottomLeft]} />
              <View style={[s.corner, s.bottomRight]} />
            </View>
            <Text style={s.scanHint}>
              {language === 'ar' ? 'قم بتوجيه الكاميرا نحو رمز QR' : 'Point camera at a QR code to scan'}
            </Text>
          </View>
          {scanned && (
            <View style={s.bottomPanel}>
              <TouchableOpacity style={[s.rescanBtn, { backgroundColor: brandColor }]} onPress={() => setScanned(false)}>
                <Ionicons name="scan-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={s.btnText}>{language === 'ar' ? 'اضغط للمسح مرة أخرى' : 'Tap to Scan Again'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: BRAND, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  container: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanFrame: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
  scanHint: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 40,
    textAlign: 'center',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
});
