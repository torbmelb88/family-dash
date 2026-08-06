import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationNB from './locales/nb/translation.json';
import translationEN from './locales/en/translation.json';
import translationFR from './locales/fr/translation.json';
import translationES from './locales/es/translation.json';
import translationDE from './locales/de/translation.json';
import translationAR from './locales/ar/translation.json';
import translationDA from './locales/da/translation.json';
import translationSV from './locales/sv/translation.json';

const resources = {
    nb: { translation: translationNB },
    en: { translation: translationEN },
    fr: { translation: translationFR },
    es: { translation: translationES },
    de: { translation: translationDE },
    ar: { translation: translationAR },
    da: { translation: translationDA },
    sv: { translation: translationSV },
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'nb',
        debug: import.meta.env.DEV, // Enable debug in dev mode
        interpolation: {
            escapeValue: false, // React already safe from XSS
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        }
    });

export default i18n;
