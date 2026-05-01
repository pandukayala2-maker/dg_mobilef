import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Web-safe token storage (SecureStore doesn't support web)
export const tokenStore = {
  async get(key) {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    try {
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue) return secureValue;
    } catch {}

    // Fallback for devices/builds where SecureStore can fail or return null.
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {}

    // Keep a mirrored copy to survive SecureStore edge cases.
    try {
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  async remove(key) {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

const PROD_API = 'https://api-digicards.ansoftt.com';
const LIVE_API = process.env.EXPO_PUBLIC_API_URL || PROD_API;

const BASE = `${LIVE_API}/api`;

export const API_BASE_URL = BASE;
export const FRONTEND_BASE_URL = 'https://digicards.ansoftt.com';
export const PUBLIC_CARD_URL = `${FRONTEND_BASE_URL}/c`;

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(async (config) => {
  try {
    const token = await tokenStore.get('auth_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err),
);

export default api;

export const authApi = {
  login: (credentials) => api.post('/auth/card-user/login', credentials),
  adminLogin: (credentials) => api.post('/admin/login', credentials),
  me: (config) => api.get('/auth/me', config),
  getCardSlug: () => api.get('/auth/card-user/slug'),
};

export const cardsApi = {
  getAll: () => api.get('/cards'),
  getOne: (id) => api.get(`/cards/${id}`),
  getMyCard: () => api.get('/cards/owner/my-card'),
  create: (data) => api.post('/cards', data),
  update: (id, data) => api.put(`/cards/${id}`, data),
  delete: (id) => api.delete(`/cards/${id}`),
  getWalletPass: (id) => api.get(`/cards/wallet/create-pass/${id}`),
  getPublicCard: (tenantSlug, cardSlug) => api.get(`/public/card/${tenantSlug}/${cardSlug}`),
  getPublicWalletPass: (tenantSlug, cardSlug) => api.post(`/public/card/wallet/${tenantSlug}/${cardSlug}`),
  getMeetings: () => api.get('/cards/calendar/meetings'),
};

export const leadsApi = {
  getAll: () => api.get('/cards/leads'),
  getByCard: (cardId) => api.get(`/cards/${cardId}/leads`),
  create: (data) => api.post('/public/card/lead', data),
};

