import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { I18nManager, Alert, DevSettings, Platform } from 'react-native';
import * as Updates from 'expo-updates';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [theme, setTheme] = useState('light'); // 'light' or 'dark'
  const [language, setLanguage] = useState('en'); // 'en' or 'ar'
  const [brandColor, setBrandColorState] = useState('#1b4654');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedTheme = await SecureStore.getItemAsync('app_theme');
        if (storedTheme) setTheme(storedTheme);

        const storedColor = await SecureStore.getItemAsync('app_brand_color');
        if (storedColor) setBrandColorState(storedColor);

        const storedLang = await SecureStore.getItemAsync('app_language');
        if (storedLang) {
          setLanguage(storedLang);
          if (storedLang === 'ar' && !I18nManager.isRTL) {
            I18nManager.forceRTL(true);
          } else if (storedLang === 'en' && I18nManager.isRTL) {
            I18nManager.forceRTL(false);
          }
        }
      } catch (e) {}
    };
    loadSettings();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    await SecureStore.setItemAsync('app_theme', newTheme);
  };

  const changeLanguage = async (lang) => {
    if (lang === language) return;
    setLanguage(lang);
    await SecureStore.setItemAsync('app_language', lang);
    
    // Set RTL configuration so the next app start loads in the correct layout natively
    const isRTL = lang === 'ar';
    I18nManager.forceRTL(isRTL);

    // Force immediate app reload to apply LTR/RTL switch natively
    setTimeout(() => {
      if (__DEV__) {
        if (Platform.OS === 'web') {
          window.location.reload();
        } else {
          DevSettings.reload();
        }
      } else {
        Updates.reloadAsync().catch(() => {});
      }
    }, 400);
  };

  const setBrandColor = async (color) => {
    if (!color || color === brandColor) return;
    setBrandColorState(color);
    await SecureStore.setItemAsync('app_brand_color', color).catch(() => {});
  };

  return (
    <AppContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme, language, changeLanguage, isRTL: language === 'ar', brandColor, setBrandColor }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
