import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SensorChart from './SensorChart';
import { getShadeColor } from '../utils/getShadeColor';
import './RoomDashboard.css';
import SensorMap from './SensorMap';

const API_BASE_URL = 'http://localhost:3001';

const RoomDashboard = ({ selectedArea, user, onBack, onUpdate }) => {
  const [sensors, setSensors] = useState([]);
  const [shadePosition, setShadePosition] = useState(selectedArea.current_position || 0);
  
  // מצבי עריכה
  const [isSensorEditing, setIsSensorEditing] = useState(false);
  const [sensorEditMode, setSensorEditMode] = useState('none'); 
  
  // גרפים והיסטוריה
  const [showGraph, setShowGraph] = useState(false);
  const [sensorHistory, setSensorHistory] = useState(null); 
  const [historyLoading, setHistoryLoading] = useState(false);

  // UI States
  const [saveButtonText, setSaveButtonText] = useState('💾 Save');
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingCommand, setIsSendingCommand] = useState(false);

  // --- Real-Time Data Display ---
  const [displayTemp, setDisplayTemp] = useState(0);
  const [displayLight, setDisplayLight] = useState(0);

  // --- סימולציה ---
  const [simTemp, setSimTemp] = useState(25);
  const [simLight, setSimLight] = useState(5000);
  const [simCondition, setSimCondition] = useState('Clear');

  // Refs
  const fileInputRef = useRef(null);

  const roomName = selectedArea.name || selectedArea.room || 'Unknown Room';

  // --- Logic & Effects ---
  
  // 1. Fetch Latest Sensor Data (Real or Simulated)
  useEffect(() => {
    if (!selectedArea) return;

    const fetchLatestData = async () => {
        // If simulation is active, use the values from the area record directly
        if (selectedArea.is_simulation) {
            setDisplayTemp(selectedArea.sim_temp || 25);
            setDisplayLight(selectedArea.sim_light || 5000);
            setSimTemp(selectedArea.sim_temp || 25);
            setSimLight(selectedArea.sim_light || 5000);
        } else {
            // If real mode, try to get the last recorded values from the area or logs
            // Assuming backend now updates last_temperature/last_light_intensity on area
            if (selectedArea.last_temperature !== undefined) {
                setDisplayTemp(selectedArea.last_temperature);
                setDisplayLight(selectedArea.last_light_intensity);
            } else {
                // Fallback: could fetch from logs API if needed
            }
        }
    };
    fetchLatestData();
  }, [selectedArea]);

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
      console.warn("Sensor parse warning:", e);
    }
    setSensors(Array.isArray(parsedSensors) ? parsedSensors : []);
  }, [selectedArea]);

  useEffect(() => {
    if (!isSensorEditing) setSensorEditMode('none');
  }, [isSensorEditing]);

  useEffect(() => {
    if (showGraph && selectedArea.id) {
      const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
          const response = await axios.get(`${API_BASE_URL}/api/sensors/history/${selectedArea.id}`);
          setSensorHistory(response.data);
        } catch (error) {
          console.error("History fetch error:", error);
          setSensorHistory([]);
        } finally {
          setHistoryLoading(false);
        }
      };
      fetchHistory();
    }
  }, [showGraph, selectedArea.id]);

  // --- Handlers ---
  const handleManualControl = async () => {
    setIsSendingCommand(true);
    try {
        let newState = 'MANUAL';
        if (shadePosition === 0) newState = 'OPEN';
        if (shadePosition === 100) newState = 'CLOSED';

        await axios.put(`${API_BASE_URL}/api/areas/${selectedArea.id}/state`, {
            state: newState,
            position: shadePosition
        });
        if (onUpdate) onUpdate();
        alert(`Command Sent: ${newState} at ${shadePosition}%`);
    } catch (error) {
        console.error("Manual control failed:", error);
        alert("Failed to send command.");
    } finally {
        setIsSendingCommand(false);
    }
  };

  const handleAutoControl = async () => {
    setIsSendingCommand(true);
    try {
        await axios.put(`${API_BASE_URL}/api/areas/${selectedArea.id}/state`, {
            state: 'AUTO'
        });
        if (onUpdate) onUpdate();
        alert("System reverted to AUTO mode.");
    } catch (error) {
        console.error("Auto revert failed:", error);
        alert("Failed to revert to auto.");
    } finally {
        setIsSendingCommand(false);
    }
  };

  const handleSaveLayout = async () => {
    try {
      await axios.put(`${API_BASE_URL}/api/areas/${selectedArea.id}/sensor-positions`, {
        sensor_position: JSON.stringify(sensors)
      });
      setSaveButtonText('Saved! ✓');
      setTimeout(() => {
        setSensorEditMode('none');   
        setIsSensorEditing(false); 
        setSaveButtonText('💾 Save');
        onUpdate(); 
      }, 1500);
    } catch (error) {
      console.error('Save failed:', error);
      setSaveButtonText('Error!');
      setTimeout(() => setSaveButtonText('💾 Save'), 2000);
    }
  };

 const handleSimulationUpdate = async () => {
    try {
        // אנחנו משנים את שמות השדות שיתאימו בדיוק למה שה-Controller מצפה לקבל
        await axios.post(`${API_BASE_URL}/api/sensors/update-sim`, {
            id: selectedArea.id,
            isActive: true,
            temp: simTemp,    // שינוי מ-temperature ל-temp
            light: simLight,
            weather_condition: simCondition 
        });
        alert(`Simulated data injected!`);
        if (onUpdate) onUpdate(); 
    } catch (error) {
        console.error("Simulation failed:", error);
        alert("Failed to inject simulation data");
    }
};

  const stopSimulation = async () => {
      try {
          await axios.post(`${API_BASE_URL}/api/areas/${selectedArea.id}/simulation`, {
              is_active: false,
              isActive: false,
              temperature: 25,
              light: 500,
              weather_condition: 'Clear'
          });
          alert(`Simulation Stopped! Back to Real Weather.`);
          if (onUpdate) onUpdate(); 
      } catch (error) {
          console.error("Failed to stop simulation:", error);
          alert("Error stopping simulation");
      }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('roomImage', file);
    try {
      await axios.post(`${API_BASE_URL}/api/areas/${selectedArea.id}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert('Image updated!');
      onUpdate(); 
    } catch (error) {
      console.error('Image upload failed:', error);
      alert('Failed to upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const getRoomImageSrc = () => {
      const path = selectedArea.map_file_path || selectedArea.map_image;
      if (!path) return null;
      return path.startsWith('http') ? path : path;
  };


  // --- RENDER ---
  return (
    <div className="room-dashboard-container">
      
      {/* 1. Header */}
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
                        <button className="action-btn secondary" onClick={() => { setIsSensorEditing(false); setSensorEditMode('none'); onUpdate(); }} style={{ padding: '6px 16px', background: '#95a5a6', color: 'white' }}>✖ Cancel</button>
                        <button className="action-btn primary" onClick={handleSaveLayout} style={{ padding: '6px 16px' }}>{saveButtonText}</button>
                    </div>
                )
            )}
        </div>
      </div>

      {/* 2. Main Layout */}
      <div className="dashboard-grid">
        
        {/* === Map Panel === */}
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

        {/* === Controls Sidebar === */}
        <div className="controls-sidebar">
            
            {/* 1. Status */}
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

            {/* 2. Manual Control */}
            <div className="control-card">
                <h3>Manual Control</h3>
                <div className="slider-container" style={{marginBottom:'10px', flexDirection:'column', alignItems:'stretch'}}>
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'#666'}}>
                        <span>Open</span>
                        <span>Closed</span>
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

            {/* 3. Simulation */}
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
                    {/* תצוגה כפולה: גם אחוזים וגם לוקס בסוגריים כדי שתדע מה נשלח */}
                    <span>Light: {simLight / 100}% <small style={{color:'#7f8c8d'}}>({simLight} lx)</small></span>
                    
                    <input 
                        type="range" 
                        min="0" 
                        max="100"      // הסליידר זז מ-0 עד 100
                        step="1" 
                        value={simLight / 100} // מציגים את הערך באחוזים
                        onChange={(e) => {
                            const percent = parseInt(e.target.value);
                            setSimLight(percent * 100); // ממירים ללוקס (0-10000) לשמירה ב-State
                        }} 
                    />
                </div>
                    
                    <div style={{display: 'flex', flexDirection:'column', gap: '8px', marginTop:'10px'}}>
                        <button onClick={handleSimulationUpdate} className="action-btn sim-btn">🚀 Inject Data</button>
                        <button onClick={stopSimulation} className="action-btn stop-btn">🌍 Stop / Real Weather</button>
                    </div>
                </div>
            </div>

            {/* 4. History Button (כפתור נקי ללא כותרת) */}
            <div className="control-card">
                <button 
                    onClick={() => setShowGraph(true)} 
                    className="action-btn secondary" 
                    style={{
                        width:'100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px'
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 
                    View History
                </button>
            </div>

        </div>
      </div>

      {/* Modals & Hidden Inputs */}
      {showGraph && (
        <div className="graph-overlay">
            <div className="graph-content">
                <button className="close-btn" onClick={() => setShowGraph(false)}>✖</button>
                <h3>Sensor History for {roomName}</h3>
                {historyLoading ? <p>Loading...</p> : 
                 (!sensorHistory || sensorHistory.length === 0) ? <p>No history available.</p> : 
                 <SensorChart data={sensorHistory} />
                }
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