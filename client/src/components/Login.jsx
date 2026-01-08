import { useState } from 'react';
import axios from 'axios';
import './Login.css';

const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // ניקוי שגיאות קודמות
        
        try {
            const res = await axios.post('http://localhost:3001/api/users/login', { username, password });
            
            if (res.data.success) {
                // --- התיקון הקריטי כאן! ---
                // אנחנו יוצרים אובייקט חדש שמכיל גם את פרטי המשתמש וגם את הטוקן
                const userWithToken = {
                    ...res.data.user,
                    token: res.data.token // <--- הנה המפתח החסר!
                };

                // שולחים את הכל ביחד לשמירה ב-LocalStorage
                onLogin(userWithToken);
            } else {
                setError('Invalid login credentials');
            }
        } catch (err) { 
            // טיפול יפה יותר בשגיאה שמגיעה מהשרת (אם יש כזו)
            const msg = err.response?.data?.message || 'Server error, please try again later';
            setError(msg); 
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h2>System Login 🔐</h2>
                <form onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        placeholder="Email / Username" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        required
                    />
                    <input 
                        type="password" 
                        placeholder="Password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required
                    />
                    <button type="submit">Login</button>
                </form>
                {error && <div className="login-error" style={{color: 'red', marginTop: '10px'}}>{error}</div>}
                <div className="login-footer">Smart Campus Control System</div>
            </div>
        </div>
    );
};

export default Login;