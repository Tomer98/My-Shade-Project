import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

const ActivityLog = ({ initialLogs = [] }) => {
    const [logs, setLogs] = useState(initialLogs);

    useEffect(() => {
        const socket = io(SOCKET_URL);

        // לוג חדש מהשרת → הוסף לראש הרשימה
        socket.on('new_log', (newLog) => {
            setLogs(prev => [newLog, ...prev].slice(0, 50));
        });

        return () => socket.disconnect();
    }, []);

    // סנכרון אם ההורה מעדכן (טעינה ראשונית מ-API)
    useEffect(() => {
        if (initialLogs.length > 0) {
            setLogs(initialLogs);
        }
    }, [initialLogs]);

    const getLogDisplayData = (log) => {
        switch (log.action_type) {
            case 'EXTREME_HEAT':
                return { icon: '🔥', text: 'Extreme Heat', color: '#c0392b', bg: '#fadbd8' };
            case 'EXTREME_COLD':
                return { icon: '❄️', text: 'Freeze Alert', color: '#2980b9', bg: '#d6eaf8' };
            case 'NEW_ALERT':
                return { icon: '⚠️', text: 'System Alert', color: '#d35400', bg: '#fdebd0' };
            case 'NEW_SCHEDULE':
            case 'NEW_TASK':
                return { icon: '📅', text: 'New Task/Schedule', color: '#8e44ad', bg: '#ebdef0' };
            case 'STORM':
                return { icon: '⛈️', text: 'Storm Mode', color: '#2c3e50', bg: '#d5d8dc' };
            case 'CLOSED':
                return { icon: '🔒', text: `Closed ${log.current_position}%`, color: '#7f8c8d' };
            case 'OPENED':
                return { icon: '✅', text: 'Opened', color: '#2ecc71' };
            case 'SENSOR_UPDATE':
                return { icon: '📡', text: `Sensor (${log.temperature}°C)`, color: '#3498db' };
                case 'ROOM_CREATED':
                return { icon: '🏠', text: 'Room Added', color: '#27ae60', bg: '#d5f5e3' };
            case 'ROOM_DELETED':
                return { icon: '🗑️', text: 'Room Removed', color: '#e74c3c', bg: '#fadbd8' };
            case 'SENSOR_UPDATE':
                return { icon: '📡', text: `Sensor (${log.temperature}°C)`, color: '#3498db' };
            default:
                if (log.temperature > 30) return { icon: '🔥', text: `Extreme heat (${log.temperature}°C)`, color: '#e74c3c' };
                if (log.light_intensity > 1000) return { icon: '😎', text: `High glare (${log.light_intensity}%)`, color: '#e67e22' };
                if (log.current_position > 0) return { icon: '🔒', text: `Closed ${log.current_position}%`, color: '#7f8c8d' };
                return { icon: '✅', text: 'Opened', color: '#2ecc71' };
        }
    };

    return (
        <div className="sidebar-section-container" style={{ flex: 1, borderLeft: '1px solid #ddd', background: 'white', overflowY: 'auto', maxWidth: '300px' }}>
            <div style={{ padding: '15px', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#7f8c8d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Activity Log
                    <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#2ecc71', display: 'inline-block' }} title="Live" />
                </h3>
            </div>
            <div style={{ padding: '10px' }}>
                {logs.map((log, index) => {
                    const { icon, text, color, bg } = getLogDisplayData(log);
                    return (
                        <div key={log.id || index} style={{
                            padding: '10px', borderBottom: '1px solid #eee', fontSize: '0.85rem',
                            backgroundColor: bg || 'transparent'
                        }}>
                            <div style={{ fontWeight: 'bold' }}>{log.room || 'System'}</div>
                            <div style={{ color, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <span style={{ fontSize: '1.1em' }}>{icon}</span>
                                <span>{text}</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '4px' }}>
                                {new Date(log.recorded_at).toLocaleTimeString()}
                            </div>
                        </div>
                    );
                })}
                {logs.length === 0 && <p style={{ textAlign: 'center', color: '#ccc' }}>Waiting for data...</p>}
            </div>
        </div>
    );
};

export default ActivityLog;