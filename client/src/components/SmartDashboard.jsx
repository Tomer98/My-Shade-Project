import { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeader } from '../utils/auth';
import { socket } from '../socket';
import { API_BASE_URL } from '../config';
import './SmartDashboard.css';

const SmartDashboard = () => {
    const [metrics, setMetrics] = useState({ 
        temp: 0, 
        light: 0, 
        clouds: 0, 
        score: 0, 
        decision: 'WAITING', 
        reason: 'Loading...' 
    });

    const fetchInitialData = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/sensors/latest`, getAuthHeader());
            
            // --- FIX START ---
            // If the server returns { success: true, data: {...} }, use res.data.data
            // If it returns the row directly, use res.data
            const latestData = res.data.data || res.data;
            
            if (latestData) {
                setMetrics(latestData);
            }
            // --- FIX END ---

        } catch (err) { 
            console.warn("Stats fetch failed - system might be offline"); 
        }
    };

    useEffect(() => {
        fetchInitialData();

        socket.on('smartDataUpdate', (newData) => {
            setMetrics(newData);
        });

        return () => {
            socket.off('smartDataUpdate');
        };
    }, []);

    const decisionColor = ['CLOSED', 'EXTREME_HEAT', 'EXTREME_COLD', 'STORM'].includes(metrics.decision) ? '#c0392b' : '#27ae60';
    
    // Safety check: ensure score is always treated as a number
    const scoreValue = typeof metrics.score === 'number' ? metrics.score : parseFloat(metrics.score) || 0; 

    return (
        <div className="smart-dashboard-container">
            <div className="smart-dashboard-left">
                <span className="smart-icon">🧠</span>
                <span className="smart-title">Smart Algorithm</span>
            </div>

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

            <div 
                className="smart-decision-badge" 
                style={{ backgroundColor: decisionColor }}
                title={metrics.reason} 
            >
                {metrics.decision}: {metrics.reason ? metrics.reason.split(':')[0] : 'N/A'}
            </div>
        </div>
    );
};

export default SmartDashboard;