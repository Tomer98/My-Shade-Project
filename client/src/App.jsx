import { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/Login';
import RoomDashboard from './components/RoomDashboard';
import CampusMap from './components/CampusMap';
import UserManagement from './components/UserManagement';
import AlertsSystem from './components/AlertsSystem';
import SmartDashboard from './components/SmartDashboard';
import SchedulerPanel from './components/SchedulerPanel'; // <--- 1. הייבוא החדש
import { socket } from './socket'; 
import ActivityLog from './components/ActivityLog';
import './App.css';

// --- Constants and Settings ---
const API_BASE_URL = 'http://localhost:3001'; 

function App() {
  const [user, setUser] = useState(null); 
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [globalLogs, setGlobalLogs] = useState([]);
  
  // --- מצבי תצוגה ---
  const [showUserManagement, setShowUserManagement] = useState(false); 
  const [showAlerts, setShowAlerts] = useState(false); 
  const [showSmartDash, setShowSmartDash] = useState(true); 

  // --- API Calls ---
  const loadAreas = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/areas`);
      if (res.data.success) setAreas(res.data.data);
      else if (Array.isArray(res.data)) setAreas(res.data); 
    } catch (err) { console.error("Error loading areas:", err); }
  };

  const fetchGlobalLogs = async () => {
      try {
          const res = await axios.get(`${API_BASE_URL}/api/sensors/logs`);
          if (res.data.success) setGlobalLogs(res.data.data);
      } catch (err) { console.log("Logs endpoint might be different, skipping..."); }
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

// --- 🔌 SOCKET.IO INTEGRATION ---
  useEffect(() => {
    socket.on("connect", () => {
        console.log("🟢 WebSocket Connected! ID:", socket.id);
    });

    socket.on("disconnect", () => {
        console.log("🔴 WebSocket Disconnected");
    });

    socket.on("refresh_areas", () => {
        if (user) loadAreas(); 
    });

    socket.on("new_log", (newLogEntry) => {
        setGlobalLogs(prevLogs => [newLogEntry, ...prevLogs]);
        if (user) loadAreas(); 
    });

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
        if (updatedArea && JSON.stringify(selectedArea) !== JSON.stringify(updatedArea)) {
             setSelectedArea(updatedArea);
        }
    }
  }, [areas, selectedArea]);

  // --- User Functions ---
  const handleLoginSuccess = (loggedInUser) => {
      setUser(loggedInUser);
      localStorage.setItem('shade_app_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => { 
      setUser(null); 
      setSelectedArea(null); 
      localStorage.removeItem('shade_app_user');
  };

  const goBackToMap = () => {
    setSelectedArea(null);
    setShowUserManagement(false);
    setShowAlerts(false);
  };

  const handleGlobalControl = async (newState) => {
      if (!window.confirm(`Change entire campus to ${newState}?`)) return;
      try {
          await axios.put(`${API_BASE_URL}/api/areas/global/state`, { state: newState });
          loadAreas(); 
      } catch (err) { console.error(err); }
  };

  // --- Rendering ---
  if (!user) return <Login onLogin={handleLoginSuccess} />;

  return (
    <div className="app-container" style={{display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden'}}>
      
      {/* 1. Header */}
      <header style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '60px', backgroundColor: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 20 }}>
        
        {/* צד שמאל: לוגו + כפתור האלגוריתם */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
             <div style={{ fontSize: '1.8rem' }}>☀️</div> 
             <div>
               <h1 style={{ margin: 0, fontSize: '1.2rem', color: '#2c3e50', fontWeight: '700' }}>Smart Shade</h1>
             </div>

             {/* כפתור להדלקה/כיבוי של הסטריפ המדעי */}
             <button 
                onClick={() => setShowSmartDash(!showSmartDash)}
                style={{
                    background: showSmartDash ? '#e0e0e0' : 'transparent',
                    border: '1px solid #ccc',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    marginLeft: '15px'
                }}
             >
                🧠 Algorithm {showSmartDash ? 'ON' : 'OFF'}
             </button>
        </div>

        {/* צד ימין: כפתורי שליטה וניווט */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            
            {/* כפתורי שליטה גלובליים */}
            {(user.role === 'admin' || user.role === 'maintenance') && !selectedArea && (
                <div style={{ display: 'flex', gap: '5px', marginRight: '10px', borderRight: '1px solid #eee', paddingRight: '10px' }}>
                    <button onClick={() => handleGlobalControl('AUTO')} className="header-btn-subtle" style={{fontSize: '0.8rem'}}>⚡ Auto</button>
                    <button onClick={() => handleGlobalControl('OPEN')} className="header-btn-subtle" style={{fontSize: '0.8rem'}}>⬆ Open All</button>
                    <button onClick={() => handleGlobalControl('CLOSED')} className="header-btn-subtle" style={{fontSize: '0.8rem'}}>⬇ Close All</button>
                </div>
            )}

            {!selectedArea && !showUserManagement && (
                <button onClick={() => setShowAlerts(!showAlerts)} className="header-btn">
                    {showAlerts ? '🗺️ Map' : '🚨 Alerts'}
                </button>
            )}
            
            {user.role === 'admin' && !selectedArea && !showAlerts && (
                <button onClick={() => setShowUserManagement(!showUserManagement)} className="header-btn">
                    {/* שיניתי את הטקסט כדי שיראה שמדובר בניהול כללי */}
                    {showUserManagement ? '🗺️ Map' : '⚙️ Manage'}
                </button>
            )}
            
            <button onClick={handleLogout} className="header-btn-logout">Logout</button>
        </div>
      </header>

      {/* 2. THE SCIENTIFIC BRAIN */}
      {showSmartDash && !selectedArea && !showUserManagement && !showAlerts && (
          <div style={{ flexShrink: 0, zIndex: 10 }}>
              <SmartDashboard />
          </div>
      )}

      {/* 3. Main Content */}
      <div className="main-content-wrapper" style={{ flexGrow: 1, overflow: 'hidden', display: 'flex' }}>
        
        {/* Left Side */}
        <div className="map-section-container" style={{ flex: 3, padding: '20px', overflowY: 'auto' }}>
            {showUserManagement && user.role === 'admin' ? (
              // --- כאן השילוב החדש! ---
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  <SchedulerPanel /> {/* הלו"ז מופיע ראשון */}
                  <UserManagement /> {/* ניהול המשתמשים מופיע מתחתיו */}
              </div>
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

        {/* Right Side: Sidebar */}
        {!selectedArea && !showUserManagement && !showAlerts && (
            <ActivityLog initialLogs={globalLogs} />
        )}
      </div>
    </div>
  );
}

export default App;