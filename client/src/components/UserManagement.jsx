import { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeader } from '../utils/auth';
import { useNotification } from '../context/NotificationContext';
import { API_BASE_URL } from '../config';
import './UserManagement.css';

/**
 * Helper function: Returns the appropriate CSS class for a user role badge.
 * @param {string} role - The user role (admin, maintenance, planner).
 * @returns {string} CSS class name.
 */
const getRoleClass = (role) => {
    if (role === 'admin') return 'role-admin';
    if (role === 'maintenance') return 'role-maintenance';
    return 'role-planner';
};

/**
 * UserManagement Component
 * Admin dashboard for viewing, adding, and deleting system users.
 * Uses global notification system for feedback.
 * * @component
 */
const UserManagement = () => {
    const showNotification = useNotification();
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'planner' });
    const [loading, setLoading] = useState(false);

    /**
     * Fetches the list of all users from the server.
     */
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
            showNotification('Failed to fetch users. Check permissions.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    /**
     * Handles the creation of a new system user.
     */
    const handleAddUser = async () => {
        if (!newUser.username || !newUser.password) {
            showNotification('Username and password are required.', 'error');
            return;
        }
        
        const config = getAuthHeader();
        if (!config) {
            showNotification('Session expired. Please log in again.', 'error');
            return;
        }

        try {
            const response = await axios.post(`${API_BASE_URL}/users`, newUser, config);
            if (response.data.success) {
                setNewUser({ username: '', password: '', role: 'planner' });
                showNotification(`User "${newUser.username}" added successfully! 🎉`, 'success');
                fetchUsers();
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Failed to add user.';
            showNotification(errorMsg, 'error');
        }
    };

    /**
     * Permanently deletes a user by ID.
     * @param {number|string} id - The unique ID of the user to delete.
     */
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to permanently delete this user?')) return;
        
        const config = getAuthHeader();
        if (!config) return;

        try {
            const response = await axios.delete(`${API_BASE_URL}/users/${id}`, config);
            if (response.data.success) {
                showNotification('User deleted successfully.', 'success');
                fetchUsers();
            }
        } catch (err) {
            showNotification('Failed to delete user.', 'error');
        }
    };

    return (
        <div className="user-management-container">
            <h3>👥 User Management (Admin Only)</h3>
            
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