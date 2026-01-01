import { useState, useEffect } from 'react';
import axios from 'axios';

const AlertsSystem = ({ user, areas }) => {
    const [alerts, setAlerts] = useState([]);
    const [maintenanceUsers, setMaintenanceUsers] = useState([]);
    
    // טופס יצירה
    const [newAlert, setNewAlert] = useState({ area_id: '', description: '', priority: 'Medium' });
    const [msg, setMsg] = useState('');

    // טעינת נתונים
    const fetchAlerts = async () => {
        try {
            const res = await axios.get('http://localhost:3001/api/alerts');
            if (res.data.success) setAlerts(res.data.data);
        } catch (err) { console.error("Error fetching alerts"); }
    };

    // שליפת משתמשי תחזוקה (כדי שאדמין יוכל להקצות משימות)
    const fetchMaintenanceStaff = async () => {
        if (user.role !== 'admin') return;
        try {
            const res = await axios.get('http://localhost:3001/api/users');
            if (res.data.success) {
                // סינון ידני: רק מי שהוא maintenance או admin
                const staff = res.data.data.filter(u => u.role === 'maintenance' || u.role === 'admin');
                setMaintenanceUsers(staff);
            }
        } catch (err) { console.error("Error fetching staff"); }
    };

    useEffect(() => {
        fetchAlerts();
        fetchMaintenanceStaff();
    }, []);

    // יצירת התראה חדשה
    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newAlert.area_id) return alert('נא לבחור חדר');
        
        try {
            await axios.post('http://localhost:3001/api/alerts', {
                ...newAlert,
                created_by: user.id
            });
            setMsg('✅ התראה נשלחה בהצלחה!');
            setNewAlert({ area_id: '', description: '', priority: 'Medium' });
            fetchAlerts(); // רענון הרשימה
            setTimeout(() => setMsg(''), 3000);
        } catch (err) { alert('שגיאה ביצירת התראה'); }
    };

    // עדכון סטטוס / הקצאה
    const handleUpdate = async (alertId, updates) => {
        try {
            await axios.put(`http://localhost:3001/api/alerts/${alertId}`, updates);
            fetchAlerts();
        } catch (err) { console.error(err); }
    };

    // מחיקה (רק לאדמין)
    const handleDelete = async (alertId) => {
        if (!window.confirm('למחוק התראה זו?')) return;
        try {
            await axios.delete(`http://localhost:3001/api/alerts/${alertId}`);
            fetchAlerts();
        } catch (err) { console.error(err); }
    };

    // פונקציות עזר לצבעים
    const getPriorityColor = (p) => {
        if (p === 'Critical') return '#e74c3c'; // אדום
        if (p === 'High') return '#e67e22';     // כתום
        return '#f1c40f';                       // צהוב
    };

    return (
        <div className="fade-in" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            
            {/* --- חלק 1: טופס דיווח (לכולם) --- */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
                <h3 style={{ marginTop: 0, color: '#2c3e50' }}>📢 דיווח על תקלה חדשה</h3>
                <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '15px', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>חדר / אזור:</label>
                        <select 
                            value={newAlert.area_id} 
                            onChange={e => setNewAlert({...newAlert, area_id: e.target.value})}
                            style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
                            required
                        >
                            <option value="">בחר חדר...</option>
                            {areas.map(area => <option key={area.id} value={area.id}>{area.room}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>תיאור התקלה:</label>
                        <input 
                            type="text" 
                            value={newAlert.description} 
                            onChange={e => setNewAlert({...newAlert, description: e.target.value})}
                            placeholder="לדוגמה: וילון תקוע..."
                            style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }} 
                            required 
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>דחיפות:</label>
                        <select 
                            value={newAlert.priority} 
                            onChange={e => setNewAlert({...newAlert, priority: e.target.value})}
                            style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
                        >
                            <option value="Low">נמוכה</option>
                            <option value="Medium">רגילה</option>
                            <option value="High">גבוהה</option>
                            <option value="Critical">קריטית 🔥</option>
                        </select>
                    </div>
                    <button type="submit" style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>שלח דיווח</button>
                </form>
                {msg && <p style={{ color: 'green', marginTop: '10px', fontWeight: 'bold' }}>{msg}</p>}
            </div>

            {/* --- חלק 2: רשימת התראות (בעיקר לאדמין ותחזוקה) --- */}
            <h3 style={{ color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>📋 רשימת תקלות פעילות</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {alerts.length === 0 && <p style={{ color: '#aaa', textAlign: 'center' }}>אין תקלות פתוחות. מצוין! 🎉</p>}
                
                {alerts.map(alert => (
                    <div key={alert.id} style={{ 
                        background: 'white', padding: '15px', borderRadius: '8px', borderRight: `5px solid ${getPriorityColor(alert.priority)}`,
                        boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                <strong style={{ fontSize: '1.1rem' }}>{alert.room_name}</strong>
                                <span style={{ fontSize: '0.8rem', padding: '2px 6px', borderRadius: '4px', background: '#eee', color: '#555' }}>{alert.priority}</span>
                                <span style={{ fontSize: '0.8rem', color: '#999' }}>דווח ע"י: {alert.created_by_name}</span>
                            </div>
                            <div style={{ color: '#555' }}>{alert.description}</div>
                            <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                                <strong>סטטוס: </strong> 
                                <span style={{ color: alert.status === 'Resolved' ? 'green' : alert.status === 'Acknowledged' ? 'orange' : 'red' }}>
                                    {alert.status === 'Open' ? 'פתוח (ממתין לטיפול)' : alert.status === 'Acknowledged' ? 'בטיפול' : 'טופל ✅'}
                                </span>
                                {alert.assigned_to_name && <span style={{ marginRight: '10px' }}> | מטפל: 👷 {alert.assigned_to_name}</span>}
                            </div>
                        </div>

                        {/* כפתורי שליטה (רק לאדמין ותחזוקה) */}
                        {(user.role === 'admin' || user.role === 'maintenance') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '150px' }}>
                                {/* הקצאת משימה (Admin Only) */}
                                {user.role === 'admin' && alert.status !== 'Resolved' && (
                                    <select 
                                        onChange={(e) => handleUpdate(alert.id, { assigned_to: e.target.value })}
                                        style={{ padding: '5px', borderRadius: '4px', fontSize: '0.8rem' }}
                                        value={alert.assigned_to_id || ""}
                                    >
                                        <option value="" disabled>שייך לאיש צוות...</option>
                                        {maintenanceUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                    </select>
                                )}

                                {/* כפתור סיום טיפול */}
                                {alert.status !== 'Resolved' && (
                                    <button 
                                        onClick={() => handleUpdate(alert.id, { status: 'Resolved' })}
                                        style={{ padding: '5px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        ✅ סמן כטופל
                                    </button>
                                )}

                                {/* מחיקה (Admin Only) */}
                                {user.role === 'admin' && (
                                    <button 
                                        onClick={() => handleDelete(alert.id)}
                                        style={{ padding: '5px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        🗑️ מחק
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AlertsSystem;