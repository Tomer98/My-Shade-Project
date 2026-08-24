import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, LOCALES, DEFAULT_LOCALE } from './translations';

const LanguageContext = createContext();

/**
 * Resolves the starting locale: the viewer's own choice wins, otherwise the
 * system-wide default an administrator configured.
 */
const resolveInitialLocale = () => {
    const userChoice = localStorage.getItem('shade_locale');
    if (userChoice && LOCALES[userChoice]) return userChoice;

    const adminDefault = localStorage.getItem('shade_default_locale');
    if (adminDefault && LOCALES[adminDefault]) return adminDefault;

    return DEFAULT_LOCALE;
};

export const LanguageProvider = ({ children }) => {
    const [locale, setLocaleState] = useState(resolveInitialLocale);

    // Keep the document direction in sync so Hebrew renders right-to-left
    useEffect(() => {
        document.documentElement.lang = locale;
        document.documentElement.dir = LOCALES[locale]?.dir || 'ltr';
    }, [locale]);

    const setLocale = useCallback((next) => {
        if (!LOCALES[next]) return;
        localStorage.setItem('shade_locale', next);
        setLocaleState(next);
    }, []);

    /** Sets the system-wide default for users who haven't chosen a language. */
    const setDefaultLocale = useCallback((next) => {
        if (!LOCALES[next]) return;
        localStorage.setItem('shade_default_locale', next);
    }, []);

    // Falls back to English, then to the key itself, so a missing string is
    // visible in the UI rather than rendering as blank.
    const t = useCallback((key) => {
        return translations[locale]?.[key] ?? translations[DEFAULT_LOCALE]?.[key] ?? key;
    }, [locale]);

    return (
        <LanguageContext.Provider value={{ t, locale, setLocale, setDefaultLocale, locales: LOCALES }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
    return ctx;
};
