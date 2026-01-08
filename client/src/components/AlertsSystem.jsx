import { useState, useEffect } from 'react';
import axios from 'axios';
import './AlertsSystem.css';

const AlertsSystem = ({ user, areas }) => {
    const [alerts, setAlerts] = useState([]);
    const [maintenanceUsers, setMaintenanceUsers] = useState([]);
    const [newAlert, setNewAlert] = useState({ area_id: '', description: '', priority: 'Medium' });
    const [message, setMessage] = useState({ text: '', type: '' });
    const [loading, setLoading] = useState(true);

    const API_URL = 'http://localhost:3001/api';

    // --- שיפור אבטחה: פונקציה בטוחה להוצאת הטוקן ---
    const getAuthHeader = () => {
        const savedUser = localStorage.getItem('shade_app_user');
        if (!savedUser) return null;
        
        try {
            const userData = JSON.parse(savedUser);
            if (!userData || !userData.token) return null;
            return { headers: { Authorization: `Bearer ${userData.token}` } };
        } catch (e) {
            return null;
        }
    };

    const fetchAlerts = async () => {
        const config = getAuthHeader();
        if (!config) return; // לא שולחים בקשה אם אין טוקן

        try {
            const res = await axios.get(`${API_URL}/alerts`, config);
            if (res.data.success) setAlerts(res.data.data);
        } catch (err) {
            console.error("Error loading alerts:", err);
            // אם הטוקן פג תוקף - נבקש מהמשתמש להתחבר מחדש
            if (err.response && err.response.status === 401) {
                setMessage({ text: 'Session expired. Please logout and login again.', type: 'error' });
            }
        }
    };

    const fetchMaintenanceStaff = async () => {
        if (user.role !== 'admin') return;
        const config = getAuthHeader();
        if (!config) return;

        try {
            const res = await axios.get(`${API_URL}/users`, config);
            if (res.data.success) {
                const staff = res.data.data.filter(u => u.role === 'maintenance' || u.role === 'admin');
                setMaintenanceUsers(staff);
            }
        } catch (err) { console.error("Failed to fetch staff"); }
    };

    useEffect(() => {
        if (user) {
            setLoading(true);
            Promise.all([fetchAlerts(), fetchMaintenanceStaff()])
                .finally(() => setLoading(false));
        }
    }, [user]);

    const handleCreate = async (e) => {
        e.preventDefault();
        const config = getAuthHeader();
        
        if (!config) {
            alert("Your session has expired. Please logout and login again.");
            return;
        }

        if (!newAlert.area_id) {
            setMessage({ text: 'Please select a room.', type: 'error' });
            return;
        }
        
        try {
            await axios.post(
                `${API_URL}/alerts`, 
                { ...newAlert, created_by: user.id }, 
                config
            );
            
            setMessage({ text: 'Alert created successfully!', type: 'success' });
            setNewAlert({ area_id: '', description: '', priority: 'Medium' });
            fetchAlerts(); 
            setTimeout(() => setMessage({ text: '', type: '' }), 4000);
        } catch (err) {
            console.error(err);
            setMessage({ text: 'Error creating alert. Check permissions.', type: 'error' });
        }
    };

    // --- שאר הפונקציות (ללא שינוי) ---
    const handleUpdate = async (alertId, updates) => {
        const config = getAuthHeader();
        if (!config) return;
        try {
            await axios.put(`${API_URL}/alerts/${alertId}`, updates, config);
            fetchAlerts();
        } catch (err) { alert('Update failed'); }
    };

    const handleDelete = async (alertId) => {
        if (!window.confirm('Delete this alert?')) return;
        const config = getAuthHeader();
        if (!config) return;
        try {
            await axios.delete(`${API_URL}/alerts/${alertId}`, config);
            fetchAlerts();
        } catch (err) { alert('Delete failed'); }
    };

    const getPriorityStyle = (p) => {
        if (p === 'Critical') return { borderRightColor: '#e74c3c' };
        if (p === 'High') return { borderRightColor: '#e67e22' };
        return { borderRightColor: '#f1c40f' };
    };

    const getStatusClass = (s) => {
        if (s === 'Resolved') return 'alert-status-resolved';
        if (s === 'Acknowledged') return 'alert-status-acknowledged';
        return 'alert-status-open';
    }

    return (
        <div className="fade-in alerts-container">
            <div className="create-alert-form-container">
                <h3>📢 Report a New Issue</h3>
                <form onSubmit={handleCreate} className="create-alert-form">
                    <div>
                        <label>Room / Area:</label>
                        <select value={newAlert.area_id} onChange={e => setNewAlert({...newAlert, area_id: e.target.value})} required>
                            <option value="">Select a room...</option>
                            {areas.map(area => <option key={area.id} value={area.id}>{area.name || area.room}</option>)}
                        </select>
                    </div>
                    <div>
                        <label>Description:</label>
                        <input type="text" value={newAlert.description} onChange={e => setNewAlert({...newAlert, description: e.target.value})} placeholder="e.g., Shade is stuck..." required />
                    </div>
                    <div>
                        <label>Priority:</label>
                        <select value={newAlert.priority} onChange={e => setNewAlert({...newAlert, priority: e.target.value})}>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical 🔥</option>
                        </select>
                    </div>
                    <button type="submit">Submit Report</button>
                </form>
                {message.text && <p style={{ color: message.type === 'error' ? 'red' : 'green' }} className="form-message">{message.text}</p>}
            </div>

            <h3 className="alerts-list-header">📋 Active Issues List</h3>
            
            {loading ? <p>Loading alerts...</p> : (
                <div className="alerts-list">
                    {alerts.length === 0 && <p className="no-alerts-message">No open issues. Great! 🎉</p>}
                    
                    {alerts.map(alert => (
                        <div key={alert.id} className="alert-card" style={getPriorityStyle(alert.priority)}>
                            <div className="alert-card-content">
                                <div className="alert-details">
                                    <strong>{alert.room_name}</strong>
                                    <span className="alert-priority-badge">{alert.priority}</span>
                                    <span className="alert-reporter">Reported by: {alert.created_by_name || 'Unknown'}</span>
                                </div>
                                <p className="alert-description">{alert.description}</p>
                                <div className="alert-status-section">
                                    <strong>Status: </strong> 
                                    <span className={getStatusClass(alert.status)}>
                                        {alert.status === 'Open' ? 'Open (Pending)' : alert.status === 'Acknowledged' ? 'In Progress' : 'Resolved ✅'}
                                    </span>
                                    {alert.assigned_to_name && <span className="alert-assignee">| Assigned to: 👷 {alert.assigned_to_name}</span>}
                                </div>
                            </div>

                            {(user.role === 'admin' || user.role === 'maintenance') && (
                                <div className="alert-actions">
                                    {user.role === 'admin' && alert.status !== 'Resolved' && (
                                        <select onChange={(e) => handleUpdate(alert.id, { assigned_to: e.target.value, status: 'Acknowledged' })} value={alert.assigned_to || ""}>
                                            <option value="" disabled>Assign staff...</option>
                                            {maintenanceUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                        </select>
                                    )}
                                    {alert.status !== 'Resolved' && (
                                        <button className="resolve-btn" onClick={() => handleUpdate(alert.id, { status: 'Resolved' })}>
                                            ✅ Resolve
                                        </button>
                                    )}
                                    {user.role === 'admin' && (
                                        <button className="delete-btn" onClick={() => handleDelete(alert.id)}>
                                            🗑️ Delete
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AlertsSystem;