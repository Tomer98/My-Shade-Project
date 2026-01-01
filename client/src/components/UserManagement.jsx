import { useState, useEffect } from 'react';
import axios from 'axios';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'planner' });

    const fetchUsers = async () => {
        const res = await axios.get('http://localhost:3001/api/users');
        if (res.data.success) setUsers(res.data.data);
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleAddUser = async () => {
        await axios.post('http://localhost:3001/api/users', newUser);
        setNewUser({ username: '', password: '', role: 'planner' });
        fetchUsers();
    };

    const handleDelete = async (id) => {
        if (window.confirm('למחוק משתמש זה?')) {
            await axios.delete(`http://localhost:3001/api/users/${id}`);
            fetchUsers();
        }
    };

    return (
        <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '10px', marginTop: '20px' }}>
            <h3 style={{ color: '#2c3e50' }}>👥 ניהול משתמשים (Admin Only)</h3>
            
            {/* טופס הוספה */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input placeholder="שם משתמש" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }} />
                <input placeholder="סיסמה" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }} />
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} style={{ padding: '8px', borderRadius: '5px' }}>
                    <option value="admin">Admin</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="planner">Planner</option>
                </select>
                <button onClick={handleAddUser} style={{ background: '#4caf50', color: 'white', border: 'none', borderRadius: '5px', padding: '0 20px', cursor: 'pointer' }}>+ הוסף</button>
            </div>

            {/* טבלת משתמשים */}
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                <thead>
                    <tr style={{ background: '#eee', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>ID</th>
                        <th>שם משתמש</th>
                        <th>תפקיד</th>
                        <th>פעולות</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px' }}>{user.id}</td>
                            <td>{user.username}</td>
                            <td>
                                <span style={{ 
                                    padding: '3px 8px', borderRadius: '12px', fontSize: '0.8rem', color: 'white',
                                    background: user.role === 'admin' ? '#e74c3c' : user.role === 'maintenance' ? '#f39c12' : '#3498db' 
                                }}>{user.role}</span>
                            </td>
                            <td>
                                <button onClick={() => handleDelete(user.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>🗑️</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default UserManagement;