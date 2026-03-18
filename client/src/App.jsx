import { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import { NotificationProvider } from './context/NotificationContext';
import RoomDashboard from './components/RoomDashboard';
import CampusMap from './components/CampusMap';
import UserManagement from './components/UserManagement';
import AlertsSystem from './components/AlertsSystem';
import SmartDashboard from './components/SmartDashboard';
import SchedulerPanel from './components/SchedulerPanel';
import ActivityLog from './components/ActivityLog';
import { getAuthHeader } from './utils/auth';
import { API_BASE_URL } from './config';
import { socket } from './socket'; 
import './App.css';

function App() {
    // --- State Management ---
    const [user, setUser] = useState(null); 
    const [areas, setAreas] = useState([]);
    const [selectedArea, setSelectedArea] = useState(null);
    const [globalLogs, setGlobalLogs] = useState([]);
    
    // View States
    const [showUserManagement, setShowUserManagement] = useState(false); 
    const [showAlerts, setShowAlerts] = useState(false); 
    const [showSmartDash, setShowSmartDash] = useState(true); 
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetToken, setResetToken] = useState(null);

    // --- Data Fetching ---
    const loadAreas = async () => {
        const config = getAuthHeader();
        if (!config) return;
        try {
            const res = await axios.get(`${API_BASE_URL}/areas`, config);
            if (res.data.success) setAreas(res.data.data);
            else if (Array.isArray(res.data)) setAreas(res.data); 
        } catch (err) { 
            console.error("Error loading areas:", err); 
        }
    };

    const fetchGlobalLogs = async () => {
        const config = getAuthHeader();
        if (!config) return;
        try {
            const res = await axios.get(`${API_BASE_URL}/sensors/logs`, config);
            if (res.data.success) setGlobalLogs(res.data.data);
        } catch (err) { 
            console.warn("Logs endpoint check failed."); 
        }
    };

    // --- Lifecycles & Sockets ---
    
    // 1. Login Persistence on Mount
    useEffect(() => {
        const savedUser = localStorage.getItem('shade_app_user');
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (e) { console.error("Login parse error", e); }
        }
    }, []);

    // 2. Check URL for password reset token on first load
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        if (token) {
            setResetToken(token);
            // Clean the token from the URL bar without reloading the page
            window.history.replaceState({}, '', '/');
        }
    }, []);

    // 3. Fetch Initial Data after Login
    useEffect(() => {
        if (user) {
            loadAreas();
            fetchGlobalLogs();
        }
    }, [user]);

    // 4. Socket.io Integration
    useEffect(() => {
        socket.on("connect", () => console.log("🟢 WebSocket Connected! ID:", socket.id));
        socket.on("disconnect", () => console.log("🔴 WebSocket Disconnected"));
        
        socket.on("refresh_areas", () => {
            if (user) loadAreas(); 
        });

        socket.on("new_log", (newLogEntry) => {
            console.log("new_log received:", newLogEntry);
            setGlobalLogs(prevLogs => [newLogEntry, ...prevLogs]);
        });

        return () => {
            socket.off("connect");
            socket.off("disconnect");
            socket.off("refresh_areas");
            socket.off("new_log");
        };
    }, [user]);

    // 5. Sync Selected Area Data
    useEffect(() => {
        if (selectedArea && areas.length > 0) {
            const updatedArea = areas.find(a => a.id === selectedArea.id);
            if (updatedArea && JSON.stringify(selectedArea) !== JSON.stringify(updatedArea)) {
                 setSelectedArea(updatedArea);
            }
        }
    }, [areas, selectedArea]);

    // --- Action Handlers ---
    
    const handleLoginSuccess = (loggedInUser) => {
        setUser(loggedInUser);
        localStorage.setItem('shade_app_user', JSON.stringify(loggedInUser));
    };

    const handleLogout = () => { 
        setUser(null); 
        setSelectedArea(null); 
        localStorage.removeItem('shade_app_user');
        localStorage.removeItem('token');
    };

    const goBackToMap = () => {
        setSelectedArea(null);
        setShowUserManagement(false);
        setShowAlerts(false);
    };

    const handleGlobalControl = async (newState) => {
        if (!window.confirm(`Change entire campus to ${newState}?`)) return;
        const config = getAuthHeader();
        if (!config) return;

        try {
            await axios.put(`${API_BASE_URL}/areas/global/state`, { state: newState }, config);
            loadAreas(); 
        } catch (err) { 
            console.error(err); 
        }
    };

    // --- Render ---
    
    if (resetToken) return <ResetPassword token={resetToken} onBack={() => setResetToken(null)} />;
    if (!user && showForgotPassword) return <ForgotPassword onBack={() => setShowForgotPassword(false)} />;
    if (!user) return <Login onLogin={handleLoginSuccess} onForgotPassword={() => setShowForgotPassword(true)} />;

    return (
        <NotificationProvider>
            <div className="app-container">
                
                {/* 1. Header Navigation */}
                <header className="app-header">
                    
                    {/* Left Side: Brand & Toggles */}
                    <div className="header-brand">
                         <div style={{ fontSize: '1.8rem' }}>☀️</div> 
                         <div><h1>Smart Shade</h1></div>
                         <button 
                            onClick={() => setShowSmartDash(!showSmartDash)}
                            className={`smart-dash-toggle ${showSmartDash ? 'active' : ''}`}
                         >
                            🧠 Algorithm {showSmartDash ? 'ON' : 'OFF'}
                         </button>
                    </div>

                    {/* Right Side: Global Controls & Navigation */}
                    <div className="header-controls">
                        
                        {(user.role === 'admin' || user.role === 'maintenance') && !selectedArea && (
                            <div className="global-controls">
                                <button onClick={() => handleGlobalControl('AUTO')} className="header-btn-subtle">⚡ Auto</button>
                                <button onClick={() => handleGlobalControl('OPEN')} className="header-btn-subtle">⬆ Open All</button>
                                <button onClick={() => handleGlobalControl('CLOSED')} className="header-btn-subtle">⬇ Close All</button>
                            </div>
                        )}

                        {!selectedArea && !showUserManagement && (
                            <button onClick={() => setShowAlerts(!showAlerts)} className="header-btn">
                                {showAlerts ? '🗺️ Map' : '🚨 Alerts'}
                            </button>
                        )}
                        
                        {user.role === 'admin' && !selectedArea && !showAlerts && (
                            <button onClick={() => setShowUserManagement(!showUserManagement)} className="header-btn">
                                {showUserManagement ? '🗺️ Map' : '⚙️ Manage'}
                            </button>
                        )}
                        
                        <button onClick={handleLogout} className="header-btn-logout">Logout</button>
                    </div>
                </header>

                {/* 2. The Scientific Brain Ticker */}
                {showSmartDash && !selectedArea && !showUserManagement && !showAlerts && (
                    <div style={{ flexShrink: 0, zIndex: 10 }}>
                        <SmartDashboard />
                    </div>
                )}

                {/* 3. Main Content Area */}
                <div className="main-content-wrapper">
                    
                    <div className="map-section-container">
                        {showUserManagement && user.role === 'admin' ? (
                            <div className="admin-panels-wrapper">
                                <SchedulerPanel />
                                <UserManagement />
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
                            <CampusMap 
                                areas={areas} 
                                onSelectArea={setSelectedArea} 
                                user={user} 
                                onUpdateAreas={loadAreas} 
                            />
                        )
                        }
                    </div>

                    {!selectedArea && !showUserManagement && !showAlerts && (
                        <div className="sidebar-section-container">
                            <ActivityLog logs={globalLogs} />
                        </div>
                    )}
                </div>
            </div>
        </NotificationProvider>
    );
}

export default App;