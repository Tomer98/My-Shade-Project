import { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './Login.css';

/**
 * Login Component
 * Handles user authentication, capturing username and password, 
 * and passing the authenticated user data (including token) back to the parent.
 */
const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // Clear any previous errors
        
        try {
            const res = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
            
            if (res.data.success) {
                // Combine the user object with the authentication token received from the server
                const userWithToken = {
                    ...res.data.user,
                    token: res.data.token
                };

                // Pass the complete user object up to the parent component (App.jsx) for saving/routing
                onLogin(userWithToken);
            } else {
                setError('Invalid login credentials');
            }
        } catch (err) { 
            // Gracefully handle error messages sent back by the server, with a fallback
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
                {/* Error message display, styles are managed in Login.css */}
                {error && <div className="login-error">{error}</div>}
                <div className="login-footer">Smart Campus Control System</div>
            </div>
        </div>
    );
};

export default Login;