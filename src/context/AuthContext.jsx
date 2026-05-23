import { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import { authApi, tokenStore } from '@/services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const skipNextBiometricRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await tokenStore.get('auth_token');
        if (stored) {
          setTokenState(stored);
          // Do not block initial render on profile fetch.
          setLoading(false);

          try {
            const { data } = await authApi.me({ timeout: 8000 });
            setUser(data.user ?? data);
          } catch {
            // Keep token to avoid forcing user back to login due to transient
            // profile endpoint issues right after biometric/app open.
            setUser(null);
          }
          return;
        }
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setToken = async (t) => {
    try { await tokenStore.set('auth_token', t); } catch {}
    // Skip lock once right after interactive login.
    skipNextBiometricRef.current = true;
    setTokenState(t);
  };

  const consumeSkipNextBiometric = useCallback(() => {
    if (!skipNextBiometricRef.current) return false;
    skipNextBiometricRef.current = false;
    return true;
  }, []);

  const logout = async () => {
    try { await tokenStore.remove('auth_token'); } catch {}
    skipNextBiometricRef.current = false;
    setTokenState(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, setToken, setUser, logout, loading, consumeSkipNextBiometric }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
