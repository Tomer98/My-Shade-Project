import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SchedulerPanel = () => {
    const [schedules, setSchedules] = useState([]);
    const [areas, setAreas] = useState([]);
    const [newTask, setNewTask] = useState({ area_id: '', execution_time: '', action_type: 'OPEN' });
    
    // שליפת הטוקן לאבטחה
    const getAuthHeader = () => {
        const token = JSON.parse(localStorage.getItem('shade_app_user'))?.token;
        return { headers: { Authorization: `Bearer ${token}` } };
    };

    const fetchData = async () => {
        try {
            const [schedRes, areasRes] = await Promise.all([
                axios.get('http://localhost:3001/api/schedules', getAuthHeader()),
                axios.get('http://localhost:3001/api/areas', getAuthHeader())
            ]);
            setSchedules(schedRes.data.data);
            setAreas(areasRes.data.data || areasRes.data);
        } catch (err) { console.error("Error loading data", err); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:3001/api/schedules', newTask, getAuthHeader());
            setNewTask({ area_id: '', execution_time: '', action_type: 'OPEN' });
            fetchData(); // רענון הטבלה
        } catch (err) { alert('Error creating task'); }
    };

    const handleDelete = async (id) => {
        if(!window.confirm('Delete this task?')) return;
        try {
            await axios.delete(`http://localhost:3001/api/schedules/${id}`, getAuthHeader());
            fetchData();
        } catch (err) { alert('Error deleting'); }
    };

    return (
        <div style={{ padding: '20px', background: 'white', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ borderBottom: '2px solid #3498db', paddingBottom: '10px', marginTop: 0 }}>📅 Automation Schedule</h3>
            
            {/* טופס הוספה */}
            <form onSubmit={handleCreate} style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '5px' }}>
                <select required value={newTask.area_id} onChange={e => setNewTask({...newTask, area_id: e.target.value})} style={{ padding: '8px', flex: 1 }}>
                    <option value="">Select Room...</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.room || a.name}</option>)}
                </select>
                <input required type="time" value={newTask.execution_time} onChange={e => setNewTask({...newTask, execution_time: e.target.value})} style={{ padding: '8px' }} />
                <select value={newTask.action_type} onChange={e => setNewTask({...newTask, action_type: e.target.value})} style={{ padding: '8px' }}>
                    <option value="OPEN">☀️ Open</option>
                    <option value="CLOSE">🌑 Close</option>
                </select>
                <button type="submit" style={{ background: '#27ae60', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer' }}>Add Task</button>
            </form>

            {/* טבלה */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#eee', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>Time</th>
                        <th style={{ padding: '10px' }}>Room</th>
                        <th style={{ padding: '10px' }}>Action</th>
                        <th style={{ padding: '10px' }}>Manage</th>
                    </tr>
                </thead>
                <tbody>
                    {schedules.map(task => (
                        <tr key={task.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px' }}><strong>{task.execution_time}</strong></td>
                            <td style={{ padding: '10px' }}>{task.room}</td>
                            <td style={{ padding: '10px', color: task.action_type === 'OPEN' ? 'green' : 'red' }}>{task.action_type}</td>
                            <td style={{ padding: '10px' }}>
                                <button onClick={() => handleDelete(task.id)} style={{ cursor: 'pointer', background: 'none', border: 'none' }}>🗑️</button>
                            </td>
                        </tr>
                    ))}
                    {schedules.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No tasks scheduled yet.</td></tr>}
                </tbody>
            </table>
        </div>
    );
};

export default SchedulerPanel;