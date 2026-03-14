import { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeader } from '../utils/auth';
import './UserManagement.css';

// TODO: In production, move to .env file
const API_BASE_URL = 'http://localhost:3001/api';

/**
 * Helper function: Returns the appropriate CSS class for a user role badge.
 */
const getRoleClass = (role) => {
    if (role === 'admin') return 'role-admin';
    if (role === 'maintenance') return 'role-maintenance';
    return 'role-planner';
};

/**
 * UserManagement Component
 * Admin dashboard for viewing, adding, and deleting system users.
 */
const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'planner' });
    const [loading, setLoading] = useState(false);
    
    // Unified messaging state for both errors and success notifications
    const [message, setMessage] = useState({ text: '', type: '' });

    const showMessage = (text, type) => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    };

    const fetchUsers = async () => {
        const config = getAuthHeader();
        if (!config) return;

        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/users`, config);
            if (res.data.success) {
                setUsers(res.data.data);
            }
        } catch (err) {
            showMessage('Failed to fetch users. Check connection or permissions.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Load users on component mount
    useEffect(() => {
        fetchUsers();
    }, []);

    const handleAddUser = async () => {
        if (!newUser.username || !newUser.password) {
            showMessage('Username and password are required.', 'error');
            return;
        }
        
        const config = getAuthHeader();
        if (!config) {
            showMessage('Session expired. Please log in again.', 'error');
            return;
        }

        try {
            const response = await axios.post(`${API_BASE_URL}/users`, newUser, config);
            if (response.data.success) {
                setNewUser({ username: '', password: '', role: 'planner' }); // Reset form
                showMessage('User added successfully! 🎉', 'success');
                fetchUsers(); // Refresh list
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Failed to add user.';
            showMessage(errorMsg, 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to permanently delete this user?')) return;
        
        const config = getAuthHeader();
        if (!config) return;

        try {
            const response = await axios.delete(`${API_BASE_URL}/users/${id}`, config);
            if (response.data.success) {
                showMessage('User deleted successfully.', 'success');
                fetchUsers(); // Refresh list
            }
        } catch (err) {
            showMessage('Failed to delete user.', 'error');
        }
    };

    return (
        <div className="user-management-container">
            <h3>👥 User Management (Admin Only)</h3>
            
            {/* Add User Form */}
            <div className="add-user-form">
                <input 
                    placeholder="Username" 
                    value={newUser.username} 
                    onChange={e => setNewUser({...newUser, username: e.target.value})} 
                />
                <input 
                    placeholder="Password" 
                    type="password" 
                    value={newUser.password} 
                    onChange={e => setNewUser({...newUser, password: e.target.value})} 
                />
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="admin">Admin</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="planner">Planner</option>
                </select>
                <button onClick={handleAddUser}>+ Add User</button>
            </div>
            
            {/* Notification Area */}
            {message.text && (
                <p style={{ 
                    color: message.type === 'error' ? '#e74c3c' : '#27ae60',
                    fontWeight: 'bold',
                    marginTop: '-10px',
                    marginBottom: '15px'
                }}>
                    {message.text}
                </p>
            )}

            {/* Users Table */}
            {loading ? <p>Loading users...</p> : (
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td>{user.id}</td>
                                <td>{user.username}</td>
                                <td>
                                    <span className={`role-badge ${getRoleClass(user.role)}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td>
                                    <button onClick={() => handleDelete(user.id)} className="delete-btn" title="Delete User">
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default UserManagement;