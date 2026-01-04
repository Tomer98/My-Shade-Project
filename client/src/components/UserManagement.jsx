import { useState, useEffect } from 'react';
import axios from 'axios';
import './UserManagement.css';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'planner' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:3001/api/users');
            if (res.data.success) {
                setUsers(res.data.data);
            }
        } catch (err) {
            setError('Failed to fetch users.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleAddUser = async () => {
        if (!newUser.username || !newUser.password) {
            setError('Username and password are required.');
            return;
        }
        setError('');
        try {
            const response = await axios.post('http://localhost:3001/api/users', newUser);
            if (response.data.success) {
                setNewUser({ username: '', password: '', role: 'planner' });
                fetchUsers(); // Refetch users on success
            }
        } catch (err) {
            setError('Failed to add user.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            try {
                const response = await axios.delete(`http://localhost:3001/api/users/${id}`);
                if (response.data.success) {
                    fetchUsers(); // Refetch users on success
                }
            } catch (err) {
                setError('Failed to delete user.');
            }
        }
    };

    const getRoleClass = (role) => {
        if (role === 'admin') return 'role-admin';
        if (role === 'maintenance') return 'role-maintenance';
        return 'role-planner';
    };

    return (
        <div className="user-management-container">
            <h3>👥 User Management (Admin Only)</h3>
            
            <div className="add-user-form">
                <input placeholder="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                <input placeholder="Password" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="admin">Admin</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="planner">Planner</option>
                </select>
                <button onClick={handleAddUser}>+ Add User</button>
            </div>
            {error && <p className="login-error">{error}</p>}

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
                                    <span className={`role-badge ${getRoleClass(user.role)}`}>{user.role}</span>
                                </td>
                                <td>
                                    <button onClick={() => handleDelete(user.id)} className="delete-btn">🗑️</button>
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