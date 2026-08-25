import { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import SignUp from './components/SignUp';
import ResetPassword from './components/ResetPassword';
import { NotificationProvider } from './context/NotificationContext';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import RoomDashboard from './components/RoomDashboard';
import CampusMap from './components/CampusMap';
import UserManagement from './components/UserManagement';
import AlertsSystem from './components/AlertsSystem';
import SmartDashboard from './components/SmartDashboard';
import SchedulerPanel from './components/SchedulerPanel';
import ActivityLog from './components/ActivityLog';
import MissionsPanel from './components/MissionsPanel';
import GuidesPanel from './components/GuidesPanel';
import EquipmentPanel from './components/EquipmentPanel';
import ReportsPanel from './components/ReportsPanel';
import LanguageSwitcher from './components/LanguageSwitcher';
import { getAuthHeader } from './utils/auth';
import { API_BASE_URL } from './config';
import { socket } from './socket';
import './App.css';

function AppContent() {
    const { t } = useLanguage();

    // --- State Management ---
    const [user, setUser] = useState(null);
    const [areas, setAreas] = useState([]);
    const [selectedArea, setSelectedArea] = useState(null);
    const [globalLogs, setGlobalLogs] = useState([]);

    // Which main panel is showing: map | alerts | manage | missions | guides
    const [view, setView] = useState('map');
    const [showSmartDash, setShowSmartDash] = useState(true);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showSignUp, setShowSignUp] = useState(false);
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
        setView('map');
        localStorage.removeItem('shade_app_user');
        localStorage.removeItem('token');
    };

    /** Switches panels, leaving any drilled-into room first. */
    const goToView = (next) => {
        setSelectedArea(null);
        setView(prev => (prev === next ? 'map' : next));
    };

    const handleGlobalControl = async (newState) => {
        if (!window.confirm(`Change entire campus to ${newState}?`)) return;
        const config = getAuthHeader();
        if (!config) return;

        try {
            await axios.put(`${API_BASE_URL}/areas/global/state`, { state: newState }, config);
        } catch (err) {
            console.error(err);
        }
    };

    // --- Render ---

    if (resetToken) return <ResetPassword token={resetToken} onBack={() => setResetToken(null)} />;
    if (!user && showForgotPassword) return <ForgotPassword onBack={() => setShowForgotPassword(false)} />;
    if (!user && showSignUp) return <SignUp onBack={() => setShowSignUp(false)} />;
    if (!user) return (
        <Login
            onLogin={handleLoginSuccess}
            onForgotPassword={() => setShowForgotPassword(true)}
            onSignUp={() => setShowSignUp(true)}
        />
    );

    const isAdmin = user.role === 'admin';
    const isStaff = isAdmin || user.role === 'maintenance';
    const onMapView = view === 'map' && !selectedArea;

    return (
        <div className="app-container">

            {/* 1. Header Navigation */}
            <header className="app-header">

                {/* Left Side: Brand & Toggles */}
                <div className="header-brand">
                    <div style={{ fontSize: '1.8rem' }}>☀️</div>
                    <div><h1>{t('app.title')}</h1></div>
                    <button
                        onClick={() => setShowSmartDash(!showSmartDash)}
                        className={`smart-dash-toggle ${showSmartDash ? 'active' : ''}`}
                    >
                        🧠 {t('app.algorithm')} {showSmartDash ? t('app.on') : t('app.off')}
                    </button>
                </div>

                {/* Right Side: Global Controls & Navigation */}
                <div className="header-controls">

                    {isStaff && onMapView && (
                        <div className="global-controls">
                            <button onClick={() => handleGlobalControl('AUTO')} className="header-btn-subtle">⚡ {t('app.auto')}</button>
                            <button onClick={() => handleGlobalControl('OPEN')} className="header-btn-subtle">⬆ {t('app.openAll')}</button>
                            <button onClick={() => handleGlobalControl('CLOSED')} className="header-btn-subtle">⬇ {t('app.closeAll')}</button>
                        </div>
                    )}

                    {!selectedArea && (
                        <>
                            <button onClick={() => goToView('missions')} className="header-btn">
                                {view === 'missions' ? `🗺️ ${t('app.map')}` : `🧰 ${t('app.missions')}`}
                            </button>

                            <button onClick={() => goToView('guides')} className="header-btn">
                                {view === 'guides' ? `🗺️ ${t('app.map')}` : `📚 ${t('app.guides')}`}
                            </button>

                            <button onClick={() => goToView('equipment')} className="header-btn">
                                {view === 'equipment' ? `🗺️ ${t('app.map')}` : `🔧 ${t('app.equipment')}`}
                            </button>

                            <button onClick={() => goToView('alerts')} className="header-btn">
                                {view === 'alerts' ? `🗺️ ${t('app.map')}` : `🚨 ${t('app.alerts')}`}
                            </button>

                            {isStaff && (
                                <button onClick={() => goToView('reports')} className="header-btn">
                                    {view === 'reports' ? `🗺️ ${t('app.map')}` : `📊 ${t('app.reports')}`}
                                </button>
                            )}

                            {isAdmin && (
                                <button onClick={() => goToView('manage')} className="header-btn">
                                    {view === 'manage' ? `🗺️ ${t('app.map')}` : `⚙️ ${t('app.manage')}`}
                                </button>
                            )}
                        </>
                    )}

                    <LanguageSwitcher isAdmin={isAdmin} />

                    <button onClick={handleLogout} className="header-btn-logout">{t('app.logout')}</button>
                </div>
            </header>

            {/* 2. The Scientific Brain Ticker */}
            {showSmartDash && onMapView && (
                <div style={{ flexShrink: 0, zIndex: 10 }}>
                    <SmartDashboard />
                </div>
            )}

            {/* 3. Main Content Area */}
            <div className="main-content-wrapper">

                <div className="map-section-container">
                    {selectedArea ? (
                        <RoomDashboard
                            selectedArea={selectedArea}
                            user={user}
                            onBack={() => setSelectedArea(null)}
                            onUpdate={loadAreas}
                        />
                    ) : view === 'manage' && isAdmin ? (
                        <div className="admin-panels-wrapper">
                            <SchedulerPanel />
                            <UserManagement />
                        </div>
                    ) : view === 'alerts' ? (
                        <AlertsSystem user={user} areas={areas} />
                    ) : view === 'missions' ? (
                        <MissionsPanel user={user} areas={areas} />
                    ) : view === 'guides' ? (
                        <GuidesPanel user={user} />
                    ) : view === 'equipment' ? (
                        <EquipmentPanel user={user} areas={areas} />
                    ) : view === 'reports' && isStaff ? (
                        <ReportsPanel />
                    ) : (
                        <CampusMap
                            areas={areas}
                            onSelectArea={setSelectedArea}
                            user={user}
                            onUpdateAreas={loadAreas}
                        />
                    )}
                </div>

                {onMapView && (
                    <div className="sidebar-section-container">
                        <ActivityLog logs={globalLogs} />
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Providers wrap the whole app so language and notifications are available
 * on every screen, including the pre-login views.
 */
function App() {
    return (
        <LanguageProvider>
            <NotificationProvider>
                <AppContent />
            </NotificationProvider>
        </LanguageProvider>
    );
}

export default App;
