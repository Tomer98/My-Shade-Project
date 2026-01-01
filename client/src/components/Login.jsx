import { useState } from 'react';
import axios from 'axios';

const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:3001/api/users/login', { username, password });
            if (res.data.success) {
                onLogin(res.data.user);
            } else {
                setError('פרטי התחברות שגויים');
            }
        } catch (err) { setError('שגיאת שרת, נסה שוב מאוחר יותר'); }
    };

    return (
        <div className="login-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)' }}>
            <div className="login-card" style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                <h2 style={{ color: '#2c3e50', marginBottom: '30px', fontSize: '2rem' }}>התחברות למערכת 🔐</h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <input type="text" placeholder="אימייל / שם משתמש" value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: '15px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '1rem', outline: 'none', transition: '0.3s' }} />
                    <input type="password" placeholder="סיסמה" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '15px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '1rem', outline: 'none' }} />
                    <button type="submit" style={{ padding: '15px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.3s' }}>התחבר</button>
                </form>
                {error && <div style={{ color: '#e74c3c', marginTop: '20px', fontWeight: 'bold' }}>{error}</div>}
                <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px', color: '#7f8c8d', fontSize: '0.9rem' }}>מערכת שליטה ובקרה - קמפוס חכם</div>
            </div>
        </div>
    );
};

export default Login;