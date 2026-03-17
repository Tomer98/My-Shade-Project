import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SensorChart from './SensorChart';
import SensorMap from './SensorMap';
import { getShadeColor } from '../utils/getShadeColor';
import { getAuthHeader } from '../utils/auth';
import { useNotification } from '../context/NotificationContext';
import { API_BASE_URL } from '../config';
import './RoomDashboard.css';

/**
 * RoomDashboard Component
 * Represents the detailed control panel for a specific area/room.
 * Allows users to view real-time data, control shades manually/automatically, 
 * run weather simulations, and view historical sensor data.
 * * @param {Object} props.selectedArea - Data of the specific room being viewed.
 * @param {Object} props.user - The currently authenticated user object.
 * @param {Function} props.onBack - Callback to return to the main map view.
 * @param {Function} props.onUpdate - Callback to refresh parent component state.
 */
const RoomDashboard = ({ selectedArea, user, onBack, onUpdate }) => {
    const showNotification = useNotification();

    // --- State Management ---
    const [sensors, setSensors] = useState([]);
    const [shadePosition, setShadePosition] = useState(selectedArea?.current_position || 0);
    
    // Edit Modes
    const [isSensorEditing, setIsSensorEditing] = useState(false);
    const [sensorEditMode, setSensorEditMode] = useState('none'); 
    
    // Graphs & History
    const [showGraph, setShowGraph] = useState(false);
    const [sensorHistory, setSensorHistory] = useState(null); 
    const [historyLoading, setHistoryLoading] = useState(false);

    // UI Status
    const [saveButtonText, setSaveButtonText] = useState('💾 Save');
    const [isUploading, setIsUploading] = useState(false);
    const [isSendingCommand, setIsSendingCommand] = useState(false);

    // Real-Time Data Display
    const [displayTemp, setDisplayTemp] = useState(0);
    const [displayLight, setDisplayLight] = useState(0);

    // Simulation Data
    const [simTemp, setSimTemp] = useState(25);
    const [simLight, setSimLight] = useState(40000);
    const [simCondition, setSimCondition] = useState('Clear');

    // Refs
    const fileInputRef = useRef(null);
    const roomName = selectedArea?.name || selectedArea?.room || 'Unknown Room';

    // --- Side Effects ---
    
    // 1. Sync Display Data (Real or Simulated)
    useEffect(() => {
        if (!selectedArea) return;

        if (selectedArea.is_simulation) {
            setDisplayTemp(selectedArea.sim_temp ?? 25);
            setDisplayLight(selectedArea.sim_light ?? 40000);
            setSimTemp(selectedArea.sim_temp ?? 25);
            setSimLight(selectedArea.sim_light ?? 40000);
        } else {
            if (selectedArea.last_temperature !== undefined) {
                setDisplayTemp(selectedArea.last_temperature);
                setDisplayLight(selectedArea.last_light_intensity);
            }
        }
    }, [selectedArea]);

    // 2. Initialize Shade Position and Sensors Layout
    useEffect(() => {
        if (!selectedArea) return;
        setShadePosition(selectedArea.current_position || 0);

        let parsedSensors = [];
        try {
            const rawData = selectedArea.sensor_position;
            if (Array.isArray(rawData)) {
                parsedSensors = rawData;
            } else if (typeof rawData === 'string') {
                const cleaned = rawData.startsWith('"') ? JSON.parse(rawData) : rawData;
                parsedSensors = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned;
            }
        } catch (e) {
            console.warn("Failed to parse sensor data, defaulting to empty array.", e);
        }
        setSensors(Array.isArray(parsedSensors) ? parsedSensors : []);
    }, [selectedArea]);

    // 3. Cleanup Edit Modes
    useEffect(() => {
        if (!isSensorEditing) setSensorEditMode('none');
    }, [isSensorEditing]);

    // 4. Fetch Sensor History on Modal Open
    useEffect(() => {
        if (!showGraph || !selectedArea.id) return;

        const fetchHistory = async () => {
            setHistoryLoading(true);
            try {
                const response = await axios.get(`${API_BASE_URL}/sensors/history/${selectedArea.id}`, getAuthHeader());
                setSensorHistory(response.data);
            } catch (error) {
                console.error("History fetch error:", error);
                showNotification("Could not load history data.", "error");
                setSensorHistory([]);
            } finally {
                setHistoryLoading(false);
            }
        };
        fetchHistory();
    }, [showGraph, selectedArea.id, showNotification]);


    // --- Action Handlers ---

    /**
     * Send manual shade control command.
     */
    const handleManualControl = async () => {
        setIsSendingCommand(true);
        try {
            let newState = 'MANUAL';
            if (shadePosition === 0) newState = 'OPEN';
            if (shadePosition === 100) newState = 'CLOSED';

            await axios.put(`${API_BASE_URL}/areas/${selectedArea.id}/state`, {
                state: newState,
                position: shadePosition
            }, getAuthHeader());
            
            if (onUpdate) onUpdate();
            showNotification(`Command Sent: ${newState} at ${shadePosition}%`, "success");
        } catch (error) {
            console.error("Manual control failed:", error);
            showNotification("Failed to send command.", "error");
        } finally {
            setIsSendingCommand(false);
        }
    };

    /**
     * Revert shade control back to automatic algorithm.
     */
    const handleAutoControl = async () => {
        setIsSendingCommand(true);
        try {
            await axios.put(`${API_BASE_URL}/areas/${selectedArea.id}/state`, { state: 'AUTO' }, getAuthHeader());
            if (onUpdate) onUpdate();
            showNotification("System reverted to AUTO mode.", "success");
        } catch (error) {
            console.error("Auto revert failed:", error);
            showNotification("Failed to revert to auto.", "error");
        } finally {
            setIsSendingCommand(false);
        }
    };

    /**
     * Save the updated physical layout of sensors on the map.
     */
    const handleSaveLayout = async () => {
        try {
            await axios.put(`${API_BASE_URL}/areas/${selectedArea.id}/sensor-positions`, {
                sensor_position: JSON.stringify(sensors)
            }, getAuthHeader());
            
            setSaveButtonText('Saved! ✓');
            showNotification("Sensor layout saved successfully.", "success");
            setTimeout(() => {
                setSensorEditMode('none');   
                setIsSensorEditing(false); 
                setSaveButtonText('💾 Save');
                if (onUpdate) onUpdate(); 
            }, 1500);
        } catch (error) {
            console.error('Save layout failed:', error);
            setSaveButtonText('Error!');
            showNotification("Failed to save layout.", "error");
            setTimeout(() => setSaveButtonText('💾 Save'), 2000);
        }
    };

    /**
     * Inject simulated weather/sensor data for testing AI decisions.
     */
    const handleSimulationUpdate = async () => {
        try {
            await axios.post(`${API_BASE_URL}/sensors/update-sim`, {
                id: selectedArea.id,
                isActive: true,
                temp: simTemp,
                light: simLight,
                weather_condition: simCondition 
            }, getAuthHeader());
            
            showNotification(`Simulated data injected!`, "info");
            if (onUpdate) onUpdate(); 
        } catch (error) {
            console.error("Simulation failed:", error);
            showNotification("Failed to inject simulation data.", "error");
        }
    };

    /**
     * Stop simulation and revert to real-world weather data.
     */
    const stopSimulation = async () => {
        try {
            await axios.put(`${API_BASE_URL}/areas/${selectedArea.id}/simulation`, {
                is_active: false,
                isActive: false,
                temperature: 25,
                light: 500,
                weather_condition: 'Clear'
            }, getAuthHeader());
            
            showNotification(`Simulation Stopped! Back to Real Weather.`, "info");
            if (onUpdate) onUpdate(); 
        } catch (error) {
            console.error("Failed to stop simulation:", error);
            showNotification("Error stopping simulation.", "error");
        }
    };

    /**
     * Handle room map image upload.
     */
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        
        const formData = new FormData();
        formData.append('roomImage', file);
        
        try {
            const authConfig = getAuthHeader();
            await axios.post(`${API_BASE_URL}/areas/${selectedArea.id}/image`, formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    ...authConfig?.headers 
                },
            });
            showNotification('Map image updated!', "success");
            if (onUpdate) onUpdate(); 
        } catch (error) {
            console.error('Image upload failed:', error);
            showNotification('Failed to upload map image.', "error");
        } finally {
            setIsUploading(false);
            e.target.value = null; 
        }
    };

    const getRoomImageSrc = () => {
        const path = selectedArea.map_file_path || selectedArea.map_image;
        if (!path) return null;
        return path;
    };


    // --- RENDER ---
    return (
        <div className="room-dashboard-container">
            {/* Header Section */}
            <div className="room-dashboard-header">
                <button className="back-button" onClick={onBack}>← Back to Map</button>
                <h2>{roomName}</h2>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                    {user?.role === 'admin' && (
                        !isSensorEditing ? (
                            <>
                                <button className="header-icon-btn" onClick={() => setIsSensorEditing(true)}>✏️ Edit Sensors</button>
                                <button className="header-icon-btn" onClick={() => fileInputRef.current.click()} disabled={isUploading}>
                                    {isUploading ? 'Uploading...' : '🖼️ Upload Image'}
                                </button>
                            </>
                        ) : (
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div style={{ display: 'flex', gap: '5px', paddingRight: '10px', borderRight: '1px solid #ddd', alignItems: 'center' }}>
                                    <button className={`header-icon-btn ${sensorEditMode === 'add' ? 'active' : ''}`} onClick={() => setSensorEditMode(prev => prev === 'add' ? 'none' : 'add')} title="Add Sensor">➕ Add</button>
                                    <button className={`header-icon-btn ${sensorEditMode === 'move' ? 'active' : ''}`} onClick={() => setSensorEditMode(prev => prev === 'move' ? 'none' : 'move')} title="Move Sensor">✋ Move</button>
                                    <button className={`header-icon-btn ${sensorEditMode === 'delete' ? 'active' : ''}`} onClick={() => setSensorEditMode(prev => prev === 'delete' ? 'none' : 'delete')} title="Delete Sensor">🗑️ Delete</button>
                                </div>
                                <button className="action-btn secondary" onClick={() => { setIsSensorEditing(false); setSensorEditMode('none'); }} style={{ padding: '6px 16px', background: '#95a5a6', color: 'white' }}>✖ Cancel</button>
                                <button className="action-btn primary" onClick={handleSaveLayout} style={{ padding: '6px 16px' }}>{saveButtonText}</button>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Main Layout Area */}
            <div className="dashboard-grid">
                
                {/* Visual Map Component */}
                <SensorMap 
                    imageSrc={getRoomImageSrc()}
                    roomName={roomName}
                    sensors={sensors}
                    setSensors={setSensors}
                    sensorEditMode={sensorEditMode}
                    displayTemp={displayTemp}
                    displayLight={displayLight}
                    simCondition={simCondition}
                />

                {/* Right Sidebar Controls */}
                <div className="controls-sidebar">
                    
                    {/* Shade Status Card */}
                    <div className="control-card">
                        <h3>Shade Status</h3>
                        <div className="status-display-large">
                            <span style={{ color: getShadeColor(shadePosition) }}>
                                {shadePosition}% ({selectedArea.shade_state})
                            </span>
                        </div>
                        <div style={{display:'flex', justifyContent:'center', gap:'10px'}}>
                            {selectedArea.shade_state === 'MANUAL' && <span className="badge-manual">MANUAL</span>}
                            {selectedArea.shade_state === 'AUTO' && <span className="badge-auto">AUTO</span>}
                        </div>
                    </div>

                    {/* Manual Control Card */}
                    <div className="control-card">
                        <h3>Manual Control</h3>
                        <div className="slider-container" style={{marginBottom:'10px', display: 'flex', flexDirection:'column', alignItems:'stretch'}}>
                            <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'#666'}}>
                                <span>Open (0%)</span>
                                <span>Closed (100%)</span>
                            </div>
                            <input 
                                type="range" min="0" max="100" 
                                value={shadePosition} 
                                onChange={(e) => setShadePosition(parseInt(e.target.value))} 
                                style={{width:'100%', margin:'10px 0'}}
                            />
                            <div style={{textAlign:'center', fontWeight:'bold'}}>{shadePosition}%</div>
                        </div>
                        <div className="card-actions">
                            <button onClick={handleManualControl} disabled={isSendingCommand} className="action-btn primary">
                                {isSendingCommand ? 'Sending...' : '⚡ Send'}
                            </button>
                            <button onClick={handleAutoControl} disabled={isSendingCommand} className="action-btn secondary">
                                🔄 Auto
                            </button>
                        </div>
                    </div>

                    {/* AI Simulation Card */}
                    <div className="control-card simulation-group">
                        <h3>🧪 Simulation (Test AI)</h3>
                        <div className="sim-controls" style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                            
                            <div className="sim-slider">
                                <label>Weather Condition</label>
                                <select value={simCondition} onChange={(e) => setSimCondition(e.target.value)} style={{width:'100%', padding:'5px', borderRadius:'4px', border:'1px solid #ccc'}}>
                                    <option value="Clear">☀️ Clear</option>
                                    <option value="Cloudy">☁️ Cloudy</option>
                                    <option value="Rain">🌧️ Rain</option>
                                    <option value="Storm">⛈️ Storm</option>
                                </select>
                            </div>

                            <div className="sim-slider">
                                <label>Temp: {simTemp}°C</label>
                                <input type="range" min="0" max="50" value={simTemp} onChange={(e) => setSimTemp(parseInt(e.target.value))} style={{width:'100%'}}/>
                            </div>
                            
                            <div className="sim-slider">
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                    <label>Light: {simLight.toLocaleString()} lx</label>
                                    <small style={{color:'#7f8c8d'}}>{Math.round(simLight / 800)}% of max</small>
                                </div>
                                <input
                                    type="range" min="0" max="100" step="1"
                                    value={Math.round(simLight / 800)}
                                    onChange={(e) => {
                                        const percent = parseInt(e.target.value);
                                        setSimLight(percent * 800);
                                    }}
                                    style={{width:'100%'}}
                                />
                            </div>
                            
                            <div style={{display: 'flex', flexDirection:'column', gap: '8px', marginTop:'10px'}}>
                                <button onClick={handleSimulationUpdate} className="action-btn sim-btn">🚀 Inject Data</button>
                                <button onClick={stopSimulation} className="action-btn stop-btn">🌍 Stop / Real Weather</button>
                            </div>
                        </div>
                    </div>

                    {/* History View Button */}
                    <div className="control-card">
                        <button 
                            onClick={() => setShowGraph(true)} 
                            className="action-btn secondary" 
                            style={{ width:'100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 
                            View History
                        </button>
                    </div>

                </div>
            </div>

            {/* Modals & Hidden Elements */}
            {showGraph && (
                <div className="graph-overlay">
                    <div className="graph-content">
                        <button className="close-btn" onClick={() => setShowGraph(false)}>✖</button>
                        <h3>Sensor History for {roomName}</h3>
                        {historyLoading ? (
                            <p>Loading...</p>
                        ) : (!sensorHistory || sensorHistory.length === 0) ? (
                            <p>No history available.</p> 
                        ) : (
                            <SensorChart data={sensorHistory} />
                        )}
                    </div>
                </div>
            )}

            {user?.role === 'admin' && (
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} accept="image/*" />
            )}
        </div>
    );
};

export default RoomDashboard;