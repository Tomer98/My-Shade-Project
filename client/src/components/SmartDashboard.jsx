import { useState, useEffect } from 'react';
import axios from 'axios';
import './SmartDashboard.css';

// TODO: In production, move to .env file
const API_BASE_URL = 'http://localhost:3001/api';

/**
 * SmartDashboard Component
 * A real-time ticker that displays the latest AI algorithm metrics 
 * and its current decision (OPEN/CLOSE) based on live sensor data.
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

    const fetchSmartData = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/sensors/latest`);
            if (res.data) setMetrics(res.data);
        } catch (err) { 
            // Changed to warn so it doesn't spam the error console as aggressively every 2 seconds if offline
            console.warn("Stats fetch failed - system might be offline"); 
        }
    };

    // Polling mechanism: fetch data every 2 seconds
    useEffect(() => {
        fetchSmartData();
        const interval = setInterval(fetchSmartData, 2000); 
        return () => clearInterval(interval);
    }, []);

    // Dynamic styling variables
    const decisionColor = metrics.decision === 'CLOSE' ? '#c0392b' : '#27ae60';
    // Ensure score is a number to prevent NaN errors in the UI
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
                        {/* Inline styles kept here only for purely dynamic values (width & color) */}
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
                title={metrics.reason} /* Allows user to hover and read the full, uncut reason */
            >
                {metrics.decision}: {metrics.reason.split(':')[0]}
            </div>

        </div>
    );
};

export default SmartDashboard;