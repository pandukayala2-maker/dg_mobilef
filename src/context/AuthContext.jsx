import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { authApi, tokenStore } from '@/services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [skipNextBiometric, setSkipNextBiometric] = useState(false);

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
    setSkipNextBiometric(true);
    setTokenState(t);
  };

  const consumeSkipNextBiometric = useCallback(() => {
    if (!skipNextBiometric) return false;
    setSkipNextBiometric(false);
    return true;
  }, [skipNextBiometric]);

  const logout = async () => {
    try { await tokenStore.remove('auth_token'); } catch {}
    setSkipNextBiometric(false);
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
