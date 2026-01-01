import { useState, useEffect } from 'react';
import axios from 'axios';
import SensorChart from './SensorChart';
import CampusMap from './components/CampusMap';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import AlertsSystem from './components/AlertsSystem';
import './App.css';

function App() {
  const [user, setUser] = useState(null); 
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [sensorHistory, setSensorHistory] = useState([]);
  const [globalLogs, setGlobalLogs] = useState([]);
  
  // --- מצבי תצוגה ---
  const [showGraph, setShowGraph] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showManualControl, setShowManualControl] = useState(false);
  const [showUserManagment, setShowUserManagement] = useState(false); 
  const [showAlerts, setShowAlerts] = useState(false);

  const [manualTemp, setManualTemp] = useState(24);
  const [manualLight, setManualLight] = useState(50);
  const [isSimulating, setIsSimulating] = useState(false);
  const [targetPosition, setTargetPosition] = useState(0); 

  // --- יצירת אובייקט תצוגה חכם (Display Object) ---
  const currentSensorData = sensorHistory.length > 0 ? sensorHistory[0] : null;
  
  // הנתונים מוצגים בזמן אמת מהחדר עצמו (ולא מההיסטוריה הישנה)
  const displayData = {
      temperature: currentSensorData?.temperature || '--', 
      light_intensity: currentSensorData?.light_intensity || '--',
      current_position: selectedArea?.current_position ?? (currentSensorData?.current_position || 0),
      image: currentSensorData?.image || null
  };

  const loadAreas = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/areas');
      if (res.data.success) setAreas(res.data.data);
    } catch (err) { console.error("Error loading areas:", err); }
  };

  const fetchGlobalLogs = async () => {
      try {
          const res = await axios.get('http://localhost:3001/api/sensors/logs');
          if (res.data.success) setGlobalLogs(res.data.data);
      } catch (err) { console.error("Error loading logs:", err); }
  };

  const fetchSensors = async () => {
    if (!selectedArea) return;
    try {
      const res = await axios.get(`http://localhost:3001/api/sensors/history/${selectedArea.id}`);
      if (res.data.success) setSensorHistory(res.data.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (user) {
        loadAreas();
        fetchGlobalLogs();
        const interval = setInterval(() => {
            loadAreas();
            fetchGlobalLogs();
            if (selectedArea) fetchSensors();
        }, 3000);
        return () => clearInterval(interval);
    }
  }, [selectedArea, user]);

  // סנכרון החדר הנבחר בזמן אמת (כדי שיראו את השינויים של האוטומציה מיד)
  useEffect(() => {
    if (selectedArea && areas.length > 0) {
        const updatedArea = areas.find(a => a.id === selectedArea.id);
        if (updatedArea) {
             setSelectedArea(prev => {
                 if (JSON.stringify(prev) !== JSON.stringify(updatedArea)) {
                     return updatedArea;
                 }
                 return prev;
             });
        }
    }
  }, [areas]);

  // עדכון הסליידר רק בכניסה לחדר (כדי לא להפריע לגרירה)
  useEffect(() => {
    if (selectedArea) {
        setTargetPosition(displayData.current_position);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArea?.id]); 

  const goBackToMap = () => {
    setSelectedArea(null);
    setSensorHistory([]);
    setShowGraph(false);
    setShowAdminPanel(false);
    setShowManualControl(false);
    setShowUserManagement(false);
    setShowAlerts(false);
  };

  const handleLogout = () => { 
      setUser(null); 
      setSelectedArea(null); 
      setShowUserManagement(false);
      setShowAlerts(false);
  };
  
  if (!user) {
      return <Login onLogin={(loggedInUser) => setUser(loggedInUser)} />;
  }
  
  const getStatusText = (position) => {
      if (position === 0) return "פתוח לחלוטין (אור טבעי)";
      if (position === 100) return "סגור הרמטית (הגנה)";
      return `סגירה חלקית של ${position}%`;
  };

  const handleManualTest = async () => {
    if (!selectedArea) return;
    setIsSimulating(true);
    try {
        await axios.post('http://localhost:3001/api/sensors/data', {
            area_id: selectedArea.id,
            temperature: manualTemp,
            light_intensity: manualLight
        });
        setTimeout(() => { loadAreas(); fetchSensors(); setIsSimulating(false); }, 500);
    } catch (err) { setIsSimulating(false); }
  };

  const applyManualPosition = async (requestedState) => {
    if (!selectedArea) return;

    let stateToSend;
    
    if (requestedState === 'AUTO') {
        stateToSend = 'AUTO';
    } else {
        if (targetPosition === 0) stateToSend = 'OPEN';
        else if (targetPosition === 100) stateToSend = 'CLOSED';
        else stateToSend = 'MANUAL'; 
    }

    try {
        await axios.put(`http://localhost:3001/api/areas/${selectedArea.id}/state`, { 
            state: stateToSend, 
            position: targetPosition 
        });
        
        // רענון מהיר
        setTimeout(() => { loadAreas(); }, 200);
        setTimeout(() => { loadAreas(); }, 1000); 
    } catch (err) { console.error(err); }
  };

  const handleGlobalControl = async (newState) => {
      if (!window.confirm(`האם אתה בטוח שברצונך לשנות את הסטטוס של כל הקמפוס ל-${newState}?`)) return;
      try {
          await axios.put('http://localhost:3001/api/areas/global/state', { state: newState });
          setTimeout(() => { loadAreas(); }, 200);
          setTimeout(() => { loadAreas(); }, 1000);
      } catch (err) { console.error(err); }
  };
  
  const getLogMessage = (log) => {
      if (log.temperature > 30) return `🔥 חום קיצוני (${log.temperature}°C)`;
      if (log.light_intensity > 90) return `😎 סינוור גבוה (${log.light_intensity}%)`;
      if (log.current_position > 0) return `🔒 נסגר ל-${log.current_position}%`;
      return `✅ נפתח (אור טבעי)`;
  };

  const statusDotColor = displayData.current_position > 50 ? '#ef5350' : '#66bb6a';

  return (
    <div className="app-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px', background: 'linear-gradient(90deg, #ffffff 0%, #f8f9fa 100%)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
             <div style={{ fontSize: '2rem' }}>🎓</div> 
             <div>
               <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#2c3e50', fontWeight: '800' }}>מערכת הצללה חכמה</h1>
               <div style={{ fontSize: '0.8rem', color: '#555' }}>
                   מחובר כ: <strong>{user.username}</strong> <span style={{background: '#eee', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', textTransform: 'uppercase'}}>{user.role}</span>
               </div>
             </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
            {!selectedArea && !showUserManagment && (
                <button 
                    onClick={() => setShowAlerts(!showAlerts)} 
                    style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid #e67e22', color: '#e67e22', background: '#fff3e0', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    {showAlerts ? 'חזרה למפה' : '🚨 התראות'}
                </button>
            )}

            {user.role === 'admin' && !selectedArea && !showAlerts && (
                <button onClick={() => setShowUserManagement(!showUserManagment)} style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid #9c27b0', color: '#9c27b0', background: '#f3e5f5', cursor: 'pointer', fontWeight: 'bold' }}>
                    {showUserManagment ? 'חזרה למפה' : '👥 משתמשים'}
                </button>
            )}
            
            {(user.role === 'admin' || user.role === 'maintenance') && !selectedArea && !showUserManagment && !showAlerts && (
                <>
                    <button onClick={() => handleGlobalControl('AUTO')} style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid #2196f3', color: '#2196f3', background: '#e3f2fd', cursor: 'pointer', fontWeight: 'bold' }}>🤖 שגרה</button>
                    <button onClick={() => handleGlobalControl('OPEN')} style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid #4caf50', color: '#4caf50', background: '#e8f5e9', cursor: 'pointer', fontWeight: 'bold' }}>⬆️ פתח הכל</button>
                    <button onClick={() => handleGlobalControl('CLOSED')} style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid #f44336', color: '#f44336', background: '#ffebee', cursor: 'pointer', fontWeight: 'bold' }}>⬇️ סגור הכל</button>
                </>
            )}

            {selectedArea && (
                <button onClick={goBackToMap} className="back-btn" style={{ padding: '10px 20px', background: '#fff', border: '1px solid #ddd', borderRadius: '50px', cursor: 'pointer', fontWeight: '600', color: '#555', display: 'flex', alignItems: 'center', gap: '8px' }}><span>↩</span> חזרה</button>
            )}
            
            <button onClick={handleLogout} style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid #ccc', color: '#555', background: '#fff', cursor: 'pointer' }}>יציאה</button>
        </div>
      </header>

      {showUserManagment && user.role === 'admin' ? (
          <UserManagement />
      ) : showAlerts ? ( 
          <AlertsSystem user={user} areas={areas} />
      ) : !selectedArea ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
            <CampusMap areas={areas} onSelectArea={setSelectedArea} />
            <div className="fade-in" style={{ background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', height: 'fit-content', maxHeight: '600px', overflowY: 'auto' }}>
                <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '10px', height: '10px', background: '#e74c3c', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #e74c3c' }}></span>
                    Live Activity Log
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {globalLogs.map((log, index) => (
                        <div key={index} style={{ padding: '10px', background: '#f8f9fa', borderRadius: '8px', borderRight: '4px solid #3498db', fontSize: '0.9rem' }}>
                            <div style={{ fontWeight: 'bold', color: '#34495e', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{log.room}</span>
                                <span style={{ fontSize: '0.75rem', color: '#95a5a6' }}>{new Date(log.recorded_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                            </div>
                            <div style={{ marginTop: '5px', color: '#555' }}>{getLogMessage(log)}</div>
                        </div>
                    ))}
                    {globalLogs.length === 0 && <div style={{ color: '#aaa', textAlign: 'center', padding: '20px' }}>אין נתונים עדיין...</div>}
                </div>
            </div>
        </div>
      ) : (
        <div className="room-dashboard fade-in">
             <div className="area-card" style={{ maxWidth: '1200px', margin: '0 auto', background: '#fff', padding: '0', overflow: 'hidden' }}>
                
                <div style={{ padding: '25px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#2c3e50' }}>{selectedArea.room}</h2>
                        <div style={{ color: '#7f8c8d', marginTop: '5px' }}>📍 {selectedArea.description}</div>
                    </div>
                    <div style={{ width: '15px', height: '15px', borderRadius: '50%', background: statusDotColor, boxShadow: `0 0 10px ${statusDotColor}` }}></div>
                </div>

                <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '0' }}>
                    
                    <div className="map-container" style={{ margin: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fcfcfc', minHeight: '400px' }}>
                        <div style={{ position: 'relative', width: 'fit-content', display: 'inline-block' }}>
                            <img src={displayData.image || selectedArea.map_file_path} alt={selectedArea.room} style={{ display: 'block', maxWidth: '100%', maxHeight: '550px', width: 'auto', height: 'auto', borderRadius: '10px' }} />
                            
                            {selectedArea.sensor_position && Array.isArray(selectedArea.sensor_position) && (
                                selectedArea.sensor_position.map((pos, index) => (
                                    <div key={index} 
                                         className={`visual-sensor-indicator ${displayData.current_position > 50 ? 'indicator-closed' : 'indicator-open'}`} 
                                         style={{ top: pos.top, left: pos.left, width: pos.size || '50px', height: pos.size || '50px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}
                                    >
                                        {displayData.temperature !== '--' ? `${displayData.temperature}°` : '?'}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="controls-column" style={{ padding: '30px', background: '#f8f9fa', borderLeft: '1px solid #eee', overflowY: 'auto' }}>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                             <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                 <div style={{fontSize: '0.8rem', color: '#888'}}>טמפרטורה</div>
                                 <div style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{displayData.temperature}°C</div>
                             </div>
                             <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                 <div style={{fontSize: '0.8rem', color: '#888'}}>תאורה</div>
                                 <div style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{displayData.light_intensity}%</div>
                             </div>
                        </div>

                        <div style={{ padding: '20px', borderRadius: '12px', marginBottom: '20px', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRight: `5px solid ${statusDotColor}` }}>
                            <strong style={{ color: '#95a5a6', fontSize: '0.8rem', textTransform: 'uppercase' }}>מצב וילון</strong>
                            <div style={{ fontSize: '1.1em', fontWeight: 'bold', marginTop: '10px', color: '#2c3e50' }}>{getStatusText(displayData.current_position)}</div>
                        </div>

                        {(user.role === 'admin' || user.role === 'maintenance') && (
                            <>
                                <button onClick={() => setShowAdminPanel(!showAdminPanel)} style={{ width: '100%', padding: '12px', marginBottom: '15px', background: showAdminPanel ? '#e3f2fd' : '#fff', color: showAdminPanel ? '#1976d2' : '#555', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}><span>🧪 מעבדת ניסויים</span><span>{showAdminPanel ? '▲' : '▼'}</span></button>
                                {showAdminPanel && (
                                    <div className="fade-in" style={{ background: '#f1f8ff', padding: '15px', borderRadius: '10px', marginBottom: '25px', border: '1px dashed #2196f3' }}>
                                        <div style={{ marginBottom: '15px' }}><label style={{ fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>טמפרטורה: <strong>{manualTemp}°C</strong></label><input type="range" min="10" max="40" value={manualTemp} onChange={(e) => setManualTemp(Number(e.target.value))} style={{ width: '100%' }} /></div>
                                        <div style={{ marginBottom: '15px' }}><label style={{ fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>עוצמת אור: <strong>{manualLight}%</strong></label><input type="range" min="0" max="100" value={manualLight} onChange={(e) => setManualLight(Number(e.target.value))} style={{ width: '100%' }} /></div>
                                        <button onClick={handleManualTest} disabled={isSimulating} style={{ width: '100%', padding: '10px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>{isSimulating ? 'מעדכן נתונים...' : 'הזרק נתונים ובדוק תגובה ⚡'}</button>
                                    </div>
                                )}

                                <button onClick={() => setShowManualControl(!showManualControl)} style={{ width: '100%', padding: '12px', marginBottom: '15px', background: showManualControl ? '#fff3e0' : '#fff', color: showManualControl ? '#e65100' : '#555', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}><span>⚙️ כיוון וילונות ידני</span><span>{showManualControl ? '▲' : '▼'}</span></button>
                                
                                {showManualControl && (
                                    <div className="fade-in control-panel" style={{ background: '#fff8e1', border: '1px solid #ffe0b2' }}>
                                        <h3 style={{ fontSize: '0.9rem', color: '#f57c00', marginBottom: '15px', marginTop: 0 }}>קביעת גובה וילון מדויק</h3>
                                        <div style={{ marginBottom: '20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}><span>פתוח (0%)</span><span>סגור (100%)</span></div>
                                            <input type="range" min="0" max="100" value={targetPosition} onChange={(e) => setTargetPosition(Number(e.target.value))} style={{ width: '100%', accentColor: '#fb8c00' }} />
                                            <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '1.2rem', fontWeight: 'bold', color: '#fb8c00' }}>{targetPosition}% סגירה</div>
                                        </div>
                                        
                                        <div className="buttons-group" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <button 
                                                onClick={() => applyManualPosition()} 
                                                style={{ 
                                                    padding: '12px', 
                                                    background: '#2196f3',
                                                    color: 'white', 
                                                    border: 'none', 
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontWeight: 'bold',
                                                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                                                }}
                                            >
                                                שדר מצב חדש לחדר 📡
                                            </button>
                                            
                                            <button 
                                                onClick={() => applyManualPosition('AUTO')} 
                                                style={{ 
                                                    padding: '12px', 
                                                    background: '#f3e5f5',
                                                    color: '#9c27b0',
                                                    border: '1px solid #9c27b0', 
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontWeight: 'bold',
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    gap: '8px'
                                                }}
                                            >
                                                <span>🤖</span>
                                                <span>שחרר למצב אוטומטי</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        <button onClick={() => setShowGraph(!showGraph)} style={{ marginTop: '20px', width: '100%', padding: '10px', background: 'white', color: '#555', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer' }}>{showGraph ? '📉 הסתר גרף' : '📊 הצג היסטוריה'}</button>
                    </div>
                </div>
                {showGraph && (<div className="graph-section fade-in" style={{ padding: '30px', background: '#fff', borderTop: '1px solid #eee' }}><div style={{ height: '300px' }}><SensorChart data={sensorHistory} /></div></div>)}
             </div>
        </div>
      )}
    </div>
  );
}

export default App;