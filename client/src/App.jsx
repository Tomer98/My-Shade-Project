import { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/Login';
import RoomDashboard from './components/RoomDashboard';
import CampusMap from './components/CampusMap';
import UserManagement from './components/UserManagement';
import AlertsSystem from './components/AlertsSystem';
import { socket } from './socket'; // <--- הייבוא החשוב
import './App.css';

// --- Constants and Settings ---
const API_BASE_URL = 'http://localhost:3001'; 

function App() {
  const [user, setUser] = useState(null); 
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [globalLogs, setGlobalLogs] = useState([]);
  
  const [showUserManagement, setShowUserManagement] = useState(false); 
  const [showAlerts, setShowAlerts] = useState(false); 

  // --- API Calls ---
  const loadAreas = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/areas`);
      if (res.data.success) setAreas(res.data.data);
    } catch (err) { console.error("Error loading areas:", err); }
  };

  const fetchGlobalLogs = async () => {
      try {
          const res = await axios.get(`${API_BASE_URL}/api/sensors/logs`);
          if (res.data.success) setGlobalLogs(res.data.data);
      } catch (err) { console.error("Error loading logs:", err); }
  };

  // --- Login Persistence ---
  useEffect(() => {
      const savedUser = localStorage.getItem('shade_app_user');
      if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (e) { console.error("Login parse error", e); }
      }
  }, []);

  // --- Data Loading on Login ---
  useEffect(() => {
    if (user) {
        loadAreas();
        fetchGlobalLogs();
    }
  }, [user]);

// --- 🔌 SOCKET.IO INTEGRATION (התיקון המסנכרן) ---
  useEffect(() => {
    // 1. מאזין להתחברות
    socket.on("connect", () => {
        console.log("🟢 WebSocket Connected! ID:", socket.id);
    });

    // 2. מאזין לניתוק
    socket.on("disconnect", () => {
        console.log("🔴 WebSocket Disconnected");
    });

    // 3. מאזין לעדכון כללי מהשרת
    socket.on("refresh_areas", () => {
        console.log("🔄 Received refresh signal - Updating map...");
        if (user) loadAreas(); 
    });

    // 4. --- התיקון: כשמגיע לוג חדש, אנחנו גם מושכים את המצב החדש של החדרים ---
    socket.on("new_log", (newLogEntry) => {
        // א. עדכון רשימת הלוגים בצד ימין
        setGlobalLogs(prevLogs => [newLogEntry, ...prevLogs]);
        
        // ב. עדכון המפה (כדי שהצבע ישתנה מיד בלי רענון ידני)
        if (user) loadAreas(); 
    });

    // ניקוי האזנות כשהקומפוננטה יורדת
    return () => {
        socket.off("connect");
        socket.off("disconnect");
        socket.off("refresh_areas");
        socket.off("new_log");
    };
  }, [user]);

  // --- Sync Selected Area ---
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

  // --- User and Navigation Functions ---
  const handleLoginSuccess = (loggedInUser) => {
      setUser(loggedInUser);
      localStorage.setItem('shade_app_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => { 
      setUser(null); 
      setSelectedArea(null); 
      setShowUserManagement(false);
      setShowAlerts(false);
      localStorage.removeItem('shade_app_user');
  };

  const goBackToMap = () => {
    setSelectedArea(null);
    setShowUserManagement(false);
    setShowAlerts(false);
  };

  const handleGlobalControl = async (newState) => {
      if (!window.confirm(`Are you sure you want to change the status of the entire campus to ${newState}?`)) return;
      try {
          await axios.put(`${API_BASE_URL}/api/areas/global/state`, { state: newState });
          // אין צורך ב-setTimeout כאן יותר, כי ה-Socket יעדכן אותנו!
          // אבל נשאיר ליתר ביטחון למקרה שהסוקט לא מחובר
          loadAreas(); 
      } catch (err) { console.error(err); }
  };
  
  // --- Display Helpers ---
  const getLogMessage = (log) => {
      if (log.temperature > 30) return `🔥 Extreme heat (${log.temperature}°C)`;
      if (log.light_intensity > 90) return `😎 High glare (${log.light_intensity}%)`;
      if (log.current_position > 0) return `🔒 Closed to ${log.current_position}%`;
      return `✅ Opened (Natural Light)`;
  };

  // --- Rendering ---
  if (!user) {
      return <Login onLogin={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', backgroundColor: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
             <div style={{ fontSize: '1.8rem' }}>🎓</div> 
             <div>
               <h1 style={{ margin: 0, fontSize: '1.3rem', color: '#2c3e50', fontWeight: '700' }}>Smart Shading System</h1>
               <div style={{ fontSize: '0.8rem', color: '#555' }}>
                   Logged in as: <strong>{user.username}</strong> <span style={{background: '#eee', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', textTransform: 'uppercase'}}>{user.role}</span>
               </div>
             </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!selectedArea && !showUserManagement && (
                <button 
                    onClick={() => setShowAlerts(!showAlerts)} 
                    className="header-btn"
                >
                    {showAlerts ? 'Back to Map' : '🚨 Alerts'}
                </button>
            )}

            {user.role === 'admin' && !selectedArea && !showAlerts && (
                <button onClick={() => setShowUserManagement(!showUserManagement)} className="header-btn">
                    {showUserManagement ? 'Back to Map' : '👥 Users'}
                </button>
            )}
            
            {(user.role === 'admin' || user.role === 'maintenance') && !selectedArea && !showUserManagement && !showAlerts && (
                <>
                    <button onClick={() => handleGlobalControl('AUTO')} className="header-btn-subtle">Auto</button>
                    <button onClick={() => handleGlobalControl('OPEN')} className="header-btn-subtle">Open All</button>
                    <button onClick={() => handleGlobalControl('CLOSED')} className="header-btn-subtle">Close All</button>
                </>
            )}

            {selectedArea && (
                <button onClick={goBackToMap} className="back-btn"><span>↩</span> Back to Map</button>
            )}
            
            <button onClick={handleLogout} className="header-btn-logout">Logout</button>
        </div>
      </header>

      <div className="main-content-wrapper">
        {/* Left Side: Map or Dashboard */}
        <div className="map-section-container">
            {showUserManagement && user.role === 'admin' ? (
              <UserManagement />
            ) : showAlerts ? ( 
              <AlertsSystem user={user} areas={areas} />
            ) : selectedArea ? (
                <RoomDashboard 
                    selectedArea={selectedArea}
                    user={user}
                    onBack={goBackToMap}
                    onUpdate={loadAreas}
                />
            ) : (
                <CampusMap areas={areas} onSelectArea={setSelectedArea} user={user} onUpdateAreas={loadAreas} />
            )}
        </div>

        {/* Right Side: Sidebar (Log/Alerts) */}
        {!selectedArea && !showUserManagement && !showAlerts && (
            <div className="sidebar-section-container">
                <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
                    <h3 style={{ margin: 0, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '10px', height: '10px', background: '#e74c3c', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #e74c3c' }}></span>
                        Live Activity Log
                    </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0', padding: '10px' }}>
                    {globalLogs.map((log, index) => (
                        <div key={index} style={{ padding: '10px', borderBottom: '1px solid #eee', fontSize: '0.9rem' }}>
                            <div style={{ fontWeight: 'bold', color: '#34495e', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{log.room}</span>
                                <span style={{ fontSize: '0.75rem', color: '#95a5a6' }}>{new Date(log.recorded_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                            </div>
                            <div style={{ marginTop: '5px', color: '#555' }}>{getLogMessage(log)}</div>
                        </div>
                    ))}
                    {globalLogs.length === 0 && <div style={{ color: '#aaa', textAlign: 'center', padding: '20px' }}>No activity yet...</div>}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

export default App;