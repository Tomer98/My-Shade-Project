import { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './Login.css';

/**
 * ResetPassword Component
 * Allows a user to set a new password using a one-time token from their reset email.
 * The token is read from the URL query string (?token=...) and passed in as a prop.
 * @param {string} token - The reset token extracted from the URL.
 * @param {Function} onBack - Callback to return to the Login view after success.
 */
const ResetPassword = ({ token, onBack }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (newPassword !== confirm) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/auth/reset-password`, { token, newPassword });
            if (res.data.success) {
                setMessage(res.data.message);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Server error, please try again later');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h2>Set New Password 🔒</h2>
                <p style={{ color: '#aaa', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    Choose a strong new password for your account.
                </p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                    />
                    <button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Reset Password'}
                    </button>
                </form>
                {message && (
                    <>
                        <div className="login-error" style={{ color: '#27ae60', borderColor: '#27ae60' }}>{message}</div>
                        <button
                            onClick={onBack}
                            style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', marginTop: '1rem', fontSize: '0.9rem' }}
                        >
                            ← Back to Login
                        </button>
                    </>
                )}
                {error && <div className="login-error">{error}</div>}
            </div>
        </div>
    );
};

export default ResetPassword;
