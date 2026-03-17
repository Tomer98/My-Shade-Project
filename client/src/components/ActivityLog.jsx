import './ActivityLog.css';

/**
 * Helper function to determine the visual styling and icon for each log type.
 * Kept outside the component to prevent unnecessary re-creations on each render.
 */
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
        case 'ROOM_CREATED':
            return { icon: '🏠', text: 'Room Added', color: '#27ae60', bg: '#d5f5e3' };
        case 'ROOM_DELETED':
            return { icon: '🗑️', text: 'Room Removed', color: '#e74c3c', bg: '#fadbd8' };
        case 'SENSOR_UPDATE':
            return { icon: '📡', text: `Sensor (${log.temperature}°C)`, color: '#3498db' };
        default:
            // Fallbacks for generic or unknown log types based on logical conditions
            if (log.temperature > 30) return { icon: '🔥', text: `Extreme heat (${log.temperature}°C)`, color: '#e74c3c' };
            if (log.light_intensity > 40000) return { icon: '😎', text: `High glare (${Math.round(log.light_intensity / 800)}%)`, color: '#e67e22' };
            if (log.current_position > 0) return { icon: '🔒', text: `Closed ${log.current_position}%`, color: '#7f8c8d' };
            return { icon: '✅', text: 'Opened', color: '#2ecc71' };
    }
};

/**
 * ActivityLog Component
 * Pure display component: receives 'logs' as a prop and renders them.
 * Socket connection and state management are now handled by the parent component (App.jsx).
 */
const ActivityLog = ({ logs = [] }) => {
    return (
        <div className="activity-log-container">
            {/* Header Area */}
            <div className="activity-log-header">
                <h3 className="activity-log-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    Activity Log
                    <span className="live-indicator" title="Live" />
                </h3>
            </div>
            
            {/* Logs List Area */}
            <div className="log-list">
                {logs.length === 0 ? (
                    <p className="empty-state">Waiting for data...</p>
                ) : (
                    logs.map((log) => {
                        const { icon, text, color, bg } = getLogDisplayData(log);
                        // Fallback to randomUUID if no ID is provided by the DB to avoid React list key warnings
                        const uniqueKey = log.id ?? `${log.room}-${log.action_type}-${log.recorded_at}`;
                        
                        return (
                            <div key={uniqueKey} className="log-item" style={{ backgroundColor: bg || 'transparent' }}>
                                <div className="log-room">{log.room || 'System'}</div>
                                {/* Dynamic styles (color/bg) must remain inline, static styles are in CSS */}
                                <div className="log-details" style={{ color }}>
                                    <span className="log-icon">{icon}</span>
                                    <span>{text}</span>
                                </div>
                                <div className="log-time">
                                    {log.recorded_at ? new Date(log.recorded_at).toLocaleTimeString() : 'Unknown Time'}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ActivityLog;