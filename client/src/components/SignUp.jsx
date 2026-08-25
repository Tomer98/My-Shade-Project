import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useLanguage } from '../i18n/LanguageContext';
import './Login.css';

/**
 * SignUp Component
 * Self-registration for a maintenance worker. The account is created in the
 * Pending state and cannot be used until an administrator approves it, so the
 * form ends with an explanation rather than logging the user straight in.
 */
const SignUp = ({ onBack }) => {
    const { t } = useLanguage();

    const [form, setForm] = useState({
        username: '', email: '', password: '', confirm: '',
        speciality: '', work_area: '', company_id: '',
    });
    const [companies, setCompanies] = useState([]);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // The company list is public precisely so this form can populate itself
    useEffect(() => {
        axios.get(`${API_BASE_URL}/auth/companies`)
            .then(res => {
                if (res.data.success) {
                    setCompanies(res.data.data);
                    if (res.data.data.length > 0) {
                        setForm(f => ({ ...f, company_id: res.data.data[0].id }));
                    }
                }
            })
            .catch(() => { /* the field simply stays empty and defaults server-side */ });
    }, []);

    const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (form.password !== form.confirm) {
            setError(t('signup.mismatch'));
            return;
        }
        if (form.password.length < 6) {
            setError(t('signup.tooShort'));
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/auth/signup`, {
                username: form.username,
                email: form.email,
                password: form.password,
                speciality: form.speciality || null,
                work_area: form.work_area || null,
                company_id: form.company_id || undefined,
            });
            setSubmitted(true);
        } catch (err) {
            setError(err.response?.data?.message || t('signup.failed'));
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="login-container">
                <div className="login-card">
                    <h2>✅ {t('signup.doneTitle')}</h2>
                    <p style={{ color: '#aaa', margin: '1rem 0', lineHeight: 1.5 }}>
                        {t('signup.doneBody')}
                    </p>
                    <button onClick={onBack}>{t('signup.backToLogin')}</button>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="login-card">
                <h2>{t('signup.title')} 📝</h2>
                <p style={{ color: '#aaa', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    {t('signup.subtitle')}
                </p>

                <form onSubmit={handleSubmit}>
                    <input required type="text" placeholder={t('signup.username')}
                        value={form.username} onChange={update('username')} />
                    <input required type="email" placeholder={t('signup.email')}
                        value={form.email} onChange={update('email')} />
                    <input required type="password" placeholder={t('signup.password')}
                        value={form.password} onChange={update('password')} />
                    <input required type="password" placeholder={t('signup.confirm')}
                        value={form.confirm} onChange={update('confirm')} />

                    {companies.length > 0 && (
                        <select value={form.company_id} onChange={update('company_id')} className="signup-select">
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}

                    <input type="text" placeholder={t('signup.speciality')}
                        value={form.speciality} onChange={update('speciality')} />
                    <input type="text" placeholder={t('signup.workArea')}
                        value={form.work_area} onChange={update('work_area')} />

                    <button type="submit" disabled={loading}>
                        {loading ? t('common.loading') : t('signup.submit')}
                    </button>
                </form>

                {error && <div className="login-error">{error}</div>}

                <button
                    onClick={onBack}
                    style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', marginTop: '1rem', fontSize: '0.9rem' }}
                >
                    ← {t('signup.backToLogin')}
                </button>
            </div>
        </div>
    );
};

export default SignUp;
