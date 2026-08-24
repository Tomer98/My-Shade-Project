import { useLanguage } from '../i18n/LanguageContext';

/**
 * LanguageSwitcher
 * Lets any user pick their own language. Admins additionally set the
 * system-wide default applied to users who haven't chosen one.
 */
const LanguageSwitcher = ({ isAdmin }) => {
    const { locale, setLocale, setDefaultLocale, locales, t } = useLanguage();

    const handleChange = (e) => {
        const next = e.target.value;
        setLocale(next);
        // An admin's pick also becomes the default for everyone else
        if (isAdmin) setDefaultLocale(next);
    };

    return (
        <select
            className="language-switcher"
            value={locale}
            onChange={handleChange}
            title={isAdmin ? t('app.defaultLanguage') : t('app.language')}
            aria-label={t('app.language')}
        >
            {Object.entries(locales).map(([code, meta]) => (
                <option key={code} value={code}>{meta.name}</option>
            ))}
        </select>
    );
};

export default LanguageSwitcher;
