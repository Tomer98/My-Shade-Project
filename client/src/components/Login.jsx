import { useState } from 'react';
import axios from 'axios';
import './Login.css';

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
                setError('Invalid login credentials');
            }
        } catch (err) { setError('Server error, please try again later'); }
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
                    />
                    <input 
                        type="password" 
                        placeholder="Password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                    />
                    <button type="submit">Login</button>
                </form>
                {error && <div className="login-error">{error}</div>}
                <div className="login-footer">Smart Campus Control System</div>
            </div>
        </div>
    );
};

export default Login;