import { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeader } from '../utils/auth';
import { useNotification } from '../context/NotificationContext';
import { API_BASE_URL } from '../config';
import './AlertsSystem.css';

/**
 * Visual helper for alert priority styling
 */
const getPriorityStyle = (priority) => {
    if (priority === 'Critical') return { borderRightColor: '#e74c3c' };
    if (priority === 'High') return { borderRightColor: '#e67e22' };
    return { borderRightColor: '#f1c40f' };
};

/**
 * Visual helper for alert status styling classes
 */
const getStatusClass = (status) => {
    if (status === 'Resolved') return 'alert-status-resolved';
    if (status === 'Acknowledged') return 'alert-status-acknowledged';
    return 'alert-status-open';
};

/**
 * AlertsSystem Component
 * Handles the reporting, listing, and management of system issues.
 * Features role-based access: Admins can assign/delete, Maintenance can resolve.
 */
const AlertsSystem = ({ user, areas }) => {
    const showNotification = useNotification();
    const [alerts, setAlerts] = useState([]);
    const [maintenanceUsers, setMaintenanceUsers] = useState([]);
    const [newAlert, setNewAlert] = useState({ area_id: '', description: '', priority: 'Medium' });
    const [loading, setLoading] = useState(true);

    const fetchAlerts = async () => {
        const config = getAuthHeader();
        if (!config) return;

        try {
            const res = await axios.get(`${API_BASE_URL}/alerts`, config);
            if (res.data.success) setAlerts(res.data.data);
        } catch (err) {
            console.error("Error loading alerts:", err);
            // Handle expired tokens gracefully
            if (err.response?.status === 401) {
                showNotification('Session expired. Please logout and login again.', 'error');
            }
        }
    };

    const fetchMaintenanceStaff = async () => {
        // Only admins need to see the staff list for assignment
        if (user.role !== 'admin') return;
        
        const config = getAuthHeader();
        if (!config) return;

        try {
            const res = await axios.get(`${API_BASE_URL}/users`, config);
            if (res.data.success) {
                // Filter users to only include those who can handle alerts
                const staff = res.data.data.filter(u => u.role === 'maintenance' || u.role === 'admin');
                setMaintenanceUsers(staff);
            }
        } catch (err) { 
            console.error("Failed to fetch staff", err); 
        }
    };

    // Initial data load when component mounts or user changes
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
            showNotification('Your session has expired. Please login again.', 'error');
            return;
        }

        if (!newAlert.area_id) {
            showNotification('Please select a room.', 'error');
            return;
        }
        
        try {
            await axios.post(
                `${API_BASE_URL}/alerts`, 
                { ...newAlert, created_by: user.id }, 
                config
            );
            
            showNotification('Alert created successfully!', 'success');
            setNewAlert({ area_id: '', description: '', priority: 'Medium' }); // Reset form
            fetchAlerts(); 
        } catch (err) {
            console.error(err);
            showNotification('Error creating alert. Check permissions.', 'error');
        }
    };

    const handleUpdate = async (alertId, updates) => {
        const config = getAuthHeader();
        if (!config) return;
        
        try {
            await axios.put(`${API_BASE_URL}/alerts/${alertId}`, updates, config);
            showNotification('Alert updated successfully.', 'success');
            fetchAlerts();
        } catch (err) { 
            showNotification('Failed to update alert.', 'error');
        }
    };

    const handleDelete = async (alertId) => {
        if (!window.confirm('Are you sure you want to delete this alert?')) return;
        
        const config = getAuthHeader();
        if (!config) return;
        
        try {
            await axios.delete(`${API_BASE_URL}/alerts/${alertId}`, config);
            showNotification('Alert deleted.', 'success');
            fetchAlerts();
        } catch (err) { 
            showNotification('Failed to delete alert.', 'error');
        }
    };

    return (
        <div className="fade-in alerts-container">
            {/* Create Alert Section */}
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
            </div>

            {/* Alerts List Section */}
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

                            {/* Action Buttons (Role Based) */}
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