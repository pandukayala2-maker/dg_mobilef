import { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import { authApi, tokenStore, registerLogoutCallback } from '@/services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const skipNextBiometricRef = useRef(false);

  useEffect(() => {
    const handleApiUnauthorized = () => {
      setTokenState(null);
      setUser(null);
    };
    registerLogoutCallback(handleApiUnauthorized);
    return () => {
      registerLogoutCallback(null);
    };
  }, []);

  useEffect(() => {
    (async () => {
      let storedToken = null;
      let userData = null;
      try {
        storedToken = await tokenStore.get('auth_token');
        if (storedToken) {
          try {
            const { data } = await authApi.me({ timeout: 8000 });
            userData = data.user ?? data;
          } catch (e) {
            console.warn('[AuthContext init me failed]', e.message);
            // If boot check fails due to token expiry (401/403), clear storedToken
            // so we route cleanly to login instead of setting invalid state.
            if (e.response && (e.response.status === 401 || e.response.status === 403)) {
              storedToken = null;
              try { await tokenStore.remove('auth_token'); } catch {}
            }
          }
        }
      } catch (err) {
        console.warn('[AuthContext init tokenStore failed]', err.message);
      } finally {
        if (storedToken) {
          setTokenState(storedToken);
          if (userData) setUser(userData);
        } else {
          // If storedToken is null, ensure token state is set to null
          setTokenState(null);
          setUser(null);
        }
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
