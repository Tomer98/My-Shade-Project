import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SmartDashboard = () => {
  const [metrics, setMetrics] = useState({ temp: 0, light: 0, clouds: 0, score: 0, decision: 'WAITING', reason: 'Loading...' });

  const fetchSmartData = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/sensors/latest');
      if(res.data) setMetrics(res.data);
    } catch (err) { console.error("Stats Error"); }
  };

  useEffect(() => {
    fetchSmartData();
    const interval = setInterval(fetchSmartData, 2000); // רענון מהיר בקליינט
    return () => clearInterval(interval);
  }, []);

  const bg = metrics.decision === 'CLOSE' ? '#c0392b' : '#27ae60';

  return (
    <div style={{ 
      background: 'white', 
      height: '50px', // גובה מינימלי
      borderBottom: '1px solid #ccc',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      padding: '0 15px',
      fontSize: '0.9rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      
      {/* צד שמאל: אייקון וכותרת */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.2rem' }}>🧠</span>
        <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>Smart Algorithm</span>
      </div>

      {/* אמצע: נתונים בשורה אחת */}
      <div style={{ display: 'flex', gap: '20px', color: '#555' }}>
        <span>🌡️ <b>{metrics.temp}°C</b></span>
        <span>☁️ <b>{metrics.clouds}%</b></span>
        <span>☀️ <b>{metrics.light} lx</b></span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            📊 Score: <b>{metrics.score?.toFixed(2)}</b>
            <div style={{ width: '30px', height: '4px', background: '#eee' }}>
                <div style={{ width: `${metrics.score * 100}%`, height: '100%', background: bg }}></div>
            </div>
        </span>
      </div>

      {/* צד ימין: ההחלטה */}
      <div style={{ 
        background: bg, 
        color: 'white', 
        padding: '2px 12px', 
        borderRadius: '12px', 
        fontSize: '0.8rem', 
        fontWeight: 'bold',
        minWidth: '120px',
        textAlign: 'center'
      }}>
        {metrics.decision}: {metrics.reason.split(':')[0]}
      </div>

    </div>
  );
};

export default SmartDashboard;