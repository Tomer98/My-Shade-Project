import { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeader } from '../utils/auth';
import { useNotification } from '../context/NotificationContext';
import { API_BASE_URL } from '../config';
import './SchedulerPanel.css';

/**
 * SchedulerPanel Component
 * Allows admins to schedule automated open/close actions for specific rooms.
 */
const SchedulerPanel = () => {
    const showNotification = useNotification();
    const [schedules, setSchedules] = useState([]);
    const [areas, setAreas] = useState([]);
    const [newTask, setNewTask] = useState({ area_id: '', execution_time: '', action_type: 'OPEN' });

    const fetchData = async () => {
        const config = getAuthHeader();
        if (!config) return;

        try {
            const [schedRes, areasRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/schedules`, config),
                axios.get(`${API_BASE_URL}/areas`, config)
            ]);
            setSchedules(schedRes.data.data);
            setAreas(areasRes.data.data || areasRes.data);
        } catch (err) { 
            console.error("Error loading scheduling data", err); 
        }
    };

    useEffect(() => { 
        fetchData(); 
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        const config = getAuthHeader();
        
        if (!config) {
            showNotification('Session expired. Please login again.', 'error');
            return;
        }

        try {
            await axios.post(`${API_BASE_URL}/schedules`, newTask, config);
            setNewTask({ area_id: '', execution_time: '', action_type: 'OPEN' });
            showNotification('Task scheduled successfully! ⏰', 'success');
            fetchData(); 
        } catch (err) { 
            showNotification('Error creating task', 'error'); 
        }
    };

    const handleDelete = async (id) => {
        if(!window.confirm('Are you sure you want to delete this scheduled task?')) return;
        
        const config = getAuthHeader();
        if (!config) return;

        try {
            await axios.delete(`${API_BASE_URL}/schedules/${id}`, config);
            showNotification('Task deleted', 'success');
            fetchData();
        } catch (err) { 
            showNotification('Error deleting task', 'error'); 
        }
    };

    return (
        <div className="scheduler-panel-container">
            <h3 className="scheduler-header">📅 Automation Schedule</h3>
            
            {/* Add Task Form */}
            <form onSubmit={handleCreate} className="scheduler-form">
                <select 
                    required 
                    className="scheduler-input scheduler-select-room"
                    value={newTask.area_id} 
                    onChange={e => setNewTask({...newTask, area_id: e.target.value})} 
                >
                    <option value="">Select Room...</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.room || a.name}</option>)}
                </select>
                
                <input 
                    required 
                    type="time" 
                    className="scheduler-input"
                    value={newTask.execution_time} 
                    onChange={e => setNewTask({...newTask, execution_time: e.target.value})} 
                />
                
                <select 
                    className="scheduler-input"
                    value={newTask.action_type} 
                    onChange={e => setNewTask({...newTask, action_type: e.target.value})} 
                >
                    <option value="OPEN">☀️ Open</option>
                    <option value="CLOSE">🌑 Close</option>
                </select>
                
                <button type="submit" className="scheduler-submit-btn">Add Task</button>
            </form>

            {/* Tasks Table */}
            <div className="scheduler-table-wrapper">
            <table className="scheduler-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Room</th>
                        <th>Action</th>
                        <th>Manage</th>
                    </tr>
                </thead>
                <tbody>
                    {schedules.map(task => (
                        <tr key={task.id}>
                            <td><strong>{task.execution_time}</strong></td>
                            <td>{task.room}</td>
                            <td className={task.action_type === 'OPEN' ? 'action-open' : 'action-close'}>
                                {task.action_type}
                            </td>
                            <td>
                                <button onClick={() => handleDelete(task.id)} className="delete-task-btn" title="Delete Task">
                                    🗑️
                                </button>
                            </td>
                        </tr>
                    ))}
                    {schedules.length === 0 && (
                        <tr>
                            <td colSpan="4" className="empty-tasks">
                                No tasks scheduled yet.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            </div>
        </div>
    );
};

export default SchedulerPanel;