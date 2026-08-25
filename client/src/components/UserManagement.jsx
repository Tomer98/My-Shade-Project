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
 * @component
 */
const UserManagement = () => {
    const showNotification = useNotification();
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({
        username: '', password: '', role: 'planner', speciality: '', work_area: ''
    });
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
                setNewUser({ username: '', password: '', role: 'planner', speciality: '', work_area: '' });
                showNotification(`User "${newUser.username}" added successfully! 🎉`, 'success');
                fetchUsers();
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Failed to add user.';
            showNotification(errorMsg, 'error');
        }
    };

    /**
     * Updates an existing user's role (permission promotion/demotion).
     * @param {number|string} id - The unique ID of the user to update.
     * @param {string} newRole - The role to assign.
     */
    const handleRoleChange = async (id, newRole) => {
        const config = getAuthHeader();
        if (!config) {
            showNotification('Session expired. Please log in again.', 'error');
            return;
        }

        try {
            const response = await axios.put(`${API_BASE_URL}/users/${id}`, { role: newRole }, config);
            if (response.data.success) {
                showNotification('User role updated.', 'success');
                fetchUsers();
            }
        } catch (err) {
            showNotification('Failed to update user role.', 'error');
        }
    };

    /**
     * Approves or rejects a self-registered account.
     * @param {number|string} id - The applicant.
     * @param {string} status - 'Active' to approve, 'Rejected' to refuse.
     */
    const handleReview = async (id, status) => {
        const config = getAuthHeader();
        if (!config) return;

        try {
            const res = await axios.put(`${API_BASE_URL}/users/${id}/review`, { status }, config);
            if (res.data.success) {
                showNotification(res.data.message, 'success');
                fetchUsers();
            }
        } catch (err) {
            console.error('Error reviewing user:', err);
            showNotification('Failed to review the registration.', 'error');
        }
    };

    /**
     * Marks a worker as available or unavailable for new assignments.
     * @param {number|string} id - The user to update.
     * @param {boolean} isAvailable - The new availability state.
     */
    const handleAvailabilityToggle = async (id, isAvailable) => {
        const config = getAuthHeader();
        if (!config) return;

        try {
            await axios.put(`${API_BASE_URL}/users/${id}`, { is_available: isAvailable }, config);
            fetchUsers();
        } catch (err) {
            console.error('Error updating availability:', err);
            showNotification('Failed to update availability.', 'error');
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
                <input
                    placeholder="Speciality (e.g. Electrical)"
                    value={newUser.speciality}
                    onChange={e => setNewUser({...newUser, speciality: e.target.value})}
                />
                <input
                    placeholder="Work area (e.g. Building 5)"
                    value={newUser.work_area}
                    onChange={e => setNewUser({...newUser, work_area: e.target.value})}
                />
                <button onClick={handleAddUser}>+ Add User</button>
            </div>
            
            {loading ? <p>Loading users...</p> : (
                <div className="users-table-wrapper">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Speciality</th>
                            <th>Work area</th>
                            <th>Workload</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className={user.status === 'Pending' ? 'row-pending' : ''}>
                                <td>{user.id}</td>
                                <td>
                                    {user.username}
                                    {user.status === 'Pending' && (
                                        <span className="pending-badge">Pending</span>
                                    )}
                                    {user.status === 'Rejected' && (
                                        <span className="rejected-badge">Rejected</span>
                                    )}
                                </td>
                                <td>
                                    <select
                                        className={`role-badge ${getRoleClass(user.role)}`}
                                        value={user.role}
                                        onChange={e => handleRoleChange(user.id, e.target.value)}
                                    >
                                        <option value="admin">admin</option>
                                        <option value="maintenance">maintenance</option>
                                        <option value="planner">planner</option>
                                    </select>
                                </td>
                                <td>{user.speciality || '—'}</td>
                                <td>{user.work_area || '—'}</td>
                                <td>
                                    <span className="workload-badge" title="Open missions assigned">
                                        {user.open_missions || 0}
                                    </span>
                                    <button
                                        className={`availability-toggle ${user.is_available ? 'free' : 'busy'}`}
                                        onClick={() => handleAvailabilityToggle(user.id, !user.is_available)}
                                        title="Toggle availability"
                                    >
                                        {user.is_available ? 'Available' : 'Unavailable'}
                                    </button>
                                </td>
                                <td>
                                    {user.status === 'Pending' ? (
                                        <div className="review-actions">
                                            <button
                                                className="approve-btn"
                                                onClick={() => handleReview(user.id, 'Active')}
                                                title="Approve registration"
                                            >
                                                ✅
                                            </button>
                                            <button
                                                className="reject-btn"
                                                onClick={() => handleReview(user.id, 'Rejected')}
                                                title="Reject registration"
                                            >
                                                ✖
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => handleDelete(user.id)} className="delete-btn" title="Delete User">
                                            🗑️
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            )}
        </div>
    );
};

export default UserManagement;