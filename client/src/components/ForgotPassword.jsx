import { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './Login.css';

/**
 * ForgotPassword Component
 * Allows a user to request a password reset email by entering their email address.
 * @param {Function} onBack - Callback to return to the Login view.
 */
const ForgotPassword = ({ onBack }) => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            const res = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email });
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
                <h2>Forgot Password 🔑</h2>
                <p style={{ color: '#aaa', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    Enter your email address and we'll send you a reset link.
                </p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="email"
                        placeholder="Your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <button type="submit" disabled={loading}>
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                </form>
                {message && <div className="login-error" style={{ color: '#27ae60', borderColor: '#27ae60' }}>{message}</div>}
                {error && <div className="login-error">{error}</div>}
                <button
                    onClick={onBack}
                    style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', marginTop: '1rem', fontSize: '0.9rem' }}
                >
                    ← Back to Login
                </button>
            </div>
        </div>
    );
};

export default ForgotPassword;
