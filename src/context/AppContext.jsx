import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { I18nManager, Alert } from 'react-native';
import * as Updates from 'expo-updates';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [theme, setTheme] = useState('light'); // 'light' or 'dark'
  const [language, setLanguage] = useState('en'); // 'en' or 'ar'

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedTheme = await SecureStore.getItemAsync('app_theme');
        if (storedTheme) setTheme(storedTheme);

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
    
    // Force RTL for Arabic
    const isRTL = lang === 'ar';
    I18nManager.forceRTL(isRTL);
    if (!__DEV__) {
      Updates.reloadAsync().catch(()=>{});
    } else {
      Alert.alert('Language Changed', 'Please restart the app to apply language layout changes.');
    }
  };

  return (
    <AppContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme, language, changeLanguage, isRTL: language === 'ar' }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
