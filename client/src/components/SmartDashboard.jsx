import { useState, useEffect } from 'react';
import axios from 'axios';
import { socket } from '../socket'; // <--- התיקון: מייבאים את החיבור המשותף!
import './SmartDashboard.css';

// TODO: In production, move to .env file
const API_BASE_URL = 'http://localhost:3001/api';

/**
 * SmartDashboard Component
 * A real-time ticker that displays the latest AI algorithm metrics 
 * listening via shared WebSockets for instant, zero-lag updates.
 */
const SmartDashboard = () => {
    // Default state prevents undefined errors before the first fetch
    const [metrics, setMetrics] = useState({ 
        temp: 0, 
        light: 0, 
        clouds: 0, 
        score: 0, 
        decision: 'WAITING', 
        reason: 'Loading...' 
    });

    // Fetch the *initial* state immediately when the page loads
    const fetchInitialData = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/sensors/latest`);
            if (res.data) setMetrics(res.data);
        } catch (err) { 
            console.warn("Stats fetch failed - system might be offline"); 
        }
    };

    // --- The Magic: Shared WebSocket Listener ---
    useEffect(() => {
        // 1. Get current status immediately
        fetchInitialData();

        // 2. Listen for the server "shouting" new data on the shared socket
        socket.on('smartDataUpdate', (newData) => {
            setMetrics(newData);
        });

        // 3. Cleanup: Stop listening when leaving the page (Crucial!)
        return () => {
            socket.off('smartDataUpdate');
        };
    }, []);

    // Dynamic styling variables
    const decisionColor = metrics.decision === 'CLOSE' ? '#c0392b' : '#27ae60';
    const scoreValue = metrics.score || 0; 

    return (
        <div className="smart-dashboard-container">
            
            {/* Left Side: Icon and Title */}
            <div className="smart-dashboard-left">
                <span className="smart-icon">🧠</span>
                <span className="smart-title">Smart Algorithm</span>
            </div>

            {/* Middle: Real-time Metrics */}
            <div className="smart-metrics">
                <span>🌡️ <b>{metrics.temp}°C</b></span>
                <span>☁️ <b>{metrics.clouds}%</b></span>
                <span>☀️ <b>{metrics.light} lx</b></span>
                
                <div className="smart-score-container">
                    <span>📊 Score: <b>{scoreValue.toFixed(2)}</b></span>
                    <div className="score-bar-bg">
                        <div 
                            className="score-bar-fill" 
                            style={{ 
                                width: `${Math.min(scoreValue * 100, 100)}%`, 
                                backgroundColor: decisionColor 
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Right Side: AI Decision Badge */}
            <div 
                className="smart-decision-badge" 
                style={{ backgroundColor: decisionColor }}
                title={metrics.reason} 
            >
                {metrics.decision}: {metrics.reason.split(':')[0]}
            </div>

        </div>
    );
};

export default SmartDashboard;