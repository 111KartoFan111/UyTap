import { createContext, useContext, useState, useEffect } from 'react';
import ruTranslations from '../locales/ru.json';
import kkTranslations from '../locales/kk.json';

// Словарь переводов
const translations = {
  ru: ruTranslations,
  kk: kkTranslations
};

// Контекст языка
const LanguageContext = createContext();

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation должен использоваться внутри LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  // Получаем начальный язык из localStorage или по умолчанию русский
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('app_language');
    return savedLanguage || 
           (navigator.language.startsWith('kk') ? 'kk' : 'ru');
  });

  // Сохраняем выбранный язык
  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  // Функция перевода
  const t = (key, params = {}) => {
    const keys = key.split('.');
    let translation = translations[language];
    
    for (const k of keys) {
      translation = translation?.[k];
      if (translation === undefined) return key;
    }

    // Замена параметров в переводе
    if (typeof translation === 'string') {
      return translation.replace(/\{(\w+)\}/g, (match, p1) => 
        params[p1] !== undefined ? params[p1] : match
      );
    }

    return translation;
  };

  // Доступные языки
  const languages = [
    { code: 'ru', name: 'Русский' },
    { code: 'kk', name: 'Қазақша' }
  ];

  return (
    <LanguageContext.Provider value={{ 
      t, 
      language, 
      setLanguage, 
      languages 
    }}>
      {children}
    </LanguageContext.Provider>
  );
};