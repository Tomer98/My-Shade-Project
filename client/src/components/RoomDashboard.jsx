import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SensorChart from './SensorChart';
import { getShadeColor } from '../utils/getShadeColor';
import './RoomDashboard.css';

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
  const [saveButtonText, setSaveButtonText] = useState('💾 Save & Exit');
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingCommand, setIsSendingCommand] = useState(false); // אינדיקציה לשליחה

  // --- סימולציה (Testing Mode) ---
  const [simTemp, setSimTemp] = useState(25);
  const [simLight, setSimLight] = useState(50);

  // Refs
  const imageWrapperRef = useRef(null);
  const draggedSensorRef = useRef(null);
  const fileInputRef = useRef(null);

  const roomName = selectedArea.name || selectedArea.room || 'Unknown Room';

  // סנכרון נתונים כשהחדר מתעדכן (למשל מ-Socket)
  useEffect(() => {
    if (!selectedArea) return;

    // עדכון סליידר הוילון רק אם אנחנו לא באמצע גרירה ידנית שלו (אופציונלי, כאן פשוט נעדכן)
    setShadePosition(selectedArea.current_position || 0);

    // --- Robust Sensor Parsing ---
    let parsedSensors = [];
    try {
      const rawData = selectedArea.sensor_position;
      if (Array.isArray(rawData)) {
        parsedSensors = rawData;
      } else if (typeof rawData === 'string') {
        const cleaned = rawData.startsWith('"') ? JSON.parse(rawData) : rawData;
        parsedSensors = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned;
      } else {
        parsedSensors = [];
      }
    } catch (e) {
      console.warn("Sensor parse warning:", e);
      parsedSensors = [];
    }
    setSensors(Array.isArray(parsedSensors) ? parsedSensors : []);
  }, [selectedArea]);

  useEffect(() => {
    if (!isSensorEditing) setSensorEditMode('none');
  }, [isSensorEditing]);

  // Fetch History
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

  // --- פונקציות שליטה (התיקון החדש) ---

  // 1. שליטה ידנית בוילון
  const handleManualControl = async () => {
    setIsSendingCommand(true);
    try {
        // קובעים מצב (אם זה 0 או 100 זה OPEN/CLOSED, אחרת MANUAL)
        let newState = 'MANUAL';
        if (shadePosition === 0) newState = 'OPEN';
        if (shadePosition === 100) newState = 'CLOSED';

        await axios.put(`${API_BASE_URL}/api/areas/${selectedArea.id}/state`, {
            state: newState,
            position: shadePosition
        });

        // רענון הנתונים כדי לוודא שה-DB וה-UI מסונכרנים
        if (onUpdate) onUpdate();
        alert(`Command Sent: ${newState} at ${shadePosition}%`);

    } catch (error) {
        console.error("Manual control failed:", error);
        alert("Failed to send command.");
    } finally {
        setIsSendingCommand(false);
    }
  };

  // 2. חזרה למצב אוטומטי
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

  // 3. שמירת מיקומי חיישנים
  const handleSaveLayout = async () => {
    try {
      await axios.put(`${API_BASE_URL}/api/areas/${selectedArea.id}/sensor-positions`, {
        sensor_position: JSON.stringify(sensors)
      });
      setSaveButtonText('Saved! ✓');
      setTimeout(() => {
        setSensorEditMode('none');   
        setIsSensorEditing(false); 
        setSaveButtonText('💾 Save & Exit');
        onUpdate(); 
      }, 1500);
    } catch (error) {
      console.error('Save failed:', error);
      setSaveButtonText('Error!');
      setTimeout(() => setSaveButtonText('💾 Save & Exit'), 2000);
    }
  };

  // --- סימולציה (מחובר לשרת) ---
  const handleSimulationUpdate = async () => {
      try {
          await axios.post(`${API_BASE_URL}/api/areas/${selectedArea.id}/simulation`, {
              temperature: simTemp,
              light: simLight
          });
          
          alert(`Simulated data injected! AI is evaluating...`);
          
          // רענון המסך כדי שנראה את השינוי מיד
          if (onUpdate) onUpdate(); 

      } catch (error) {
          console.error("Simulation failed:", error);
          alert("Failed to inject simulation data");
      }
  };

  // --- Image & Sensor Dragging Logic ---
  const handleImageClick = (e) => {
    if (sensorEditMode !== 'add') return;
    const rect = imageWrapperRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newSensor = { id: `new-${Date.now()}`, x, y, temp: 21 };
    setSensors([...sensors, newSensor]);
  };

  const handleSensorClick = (e, sensor) => {
    e.stopPropagation();
    if (sensorEditMode === 'delete') {
      if (window.confirm('Delete this sensor?')) {
        setSensors(sensors.filter(s => s.id !== sensor.id));
      }
    }
  };

  const handleDragStart = (e, sensor) => {
    if (sensorEditMode !== 'move') { e.preventDefault(); return; }
    draggedSensorRef.current = sensor;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sensor.id);
    const emptyImg = new Image();
    emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(emptyImg, 0, 0);
  };
  
  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    if (sensorEditMode !== 'move' || !draggedSensorRef.current) return;
    const rect = imageWrapperRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setSensors(sensors.map(s => s.id === draggedSensorRef.current.id ? { ...s, x, y } : s));
    draggedSensorRef.current = null;
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
      alert('Image updated successfully!');
      onUpdate(); 
    } catch (error) {
      console.error('Image upload failed:', error);
      alert('Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  const getRoomImageSrc = () => {
      const path = selectedArea.map_file_path || selectedArea.map_image;
      if (!path) return null;
      if (path.startsWith('http')) return path;
      return path;
  };

  return (
    <div className="room-dashboard-container">
      <div className="room-dashboard-header">
        <button className="back-button" onClick={onBack}>← Back to Map</button>
        <h2>{roomName}</h2>
        {user?.role === 'admin' && (
          <button 
            className="header-icon-btn" 
            onClick={() => fileInputRef.current.click()} 
            title="Change Room Image"
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : '🖼️ Upload Image'}
          </button>
        )}
      </div>

      <div 
        className="room-image-wrapper" 
        ref={imageWrapperRef} 
        onClick={handleImageClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ cursor: sensorEditMode === 'add' ? 'crosshair' : 'default' }}
      >
        {user?.role === 'admin' && (
          <div className="floating-toolbar">
            {!isSensorEditing ? (
              <button onClick={() => setIsSensorEditing(true)}>✏️ Edit Sensors</button>
            ) : (
              <>
                <button className={sensorEditMode === 'add' ? 'active' : ''} onClick={() => setSensorEditMode(prev => prev === 'add' ? 'none' : 'add')}>➕ Add</button>
                <button className={sensorEditMode === 'move' ? 'active' : ''} onClick={() => setSensorEditMode(prev => prev === 'move' ? 'none' : 'move')}>✋ Move</button>
                <button className={sensorEditMode === 'delete' ? 'active' : ''} onClick={() => setSensorEditMode(prev => prev === 'delete' ? 'none' : 'delete')}>🗑️ Delete</button>
                <button onClick={handleSaveLayout}>{saveButtonText}</button>
              </>
            )}
          </div>
        )}
        
        {getRoomImageSrc() ? (
            <img 
                src={getRoomImageSrc()} 
                alt={`${roomName} layout`} 
                className="room-image"
                onError={(e) => {
                    e.target.onerror = null; 
                    e.target.src = '/room206_sketch.png';
                }}
            />
        ) : (
            <div className="image-placeholder">Waiting for image...</div>
        )}
        
        {sensors.map(sensor => (
          <div
            key={sensor.id}
            className="sensor-indicator"
            style={{ 
              left: `${sensor.x}%`, 
              top: `${sensor.y}%`,
              backgroundColor: getShadeColor(shadePosition),
              cursor: sensorEditMode === 'move' ? 'grab' : (sensorEditMode === 'delete' ? 'pointer' : 'default')
            }}
            draggable={sensorEditMode === 'move'}
            onDragStart={(e) => handleDragStart(e, sensor)}
            onClick={(e) => handleSensorClick(e, sensor)}
          >
            {Math.round(sensor.temp || 24)}°
          </div>
        ))}
      </div>

      {/* --- אזור השליטה המתוקן --- */}
      <div className="room-dashboard-controls">
        
        {/* סטטוס נוכחי */}
        <div className="control-group">
          <label>Shade Status</label>
          <div className="status-display">
             <span className="status-text" style={{ color: getShadeColor(shadePosition) }}>
                {shadePosition}% ({selectedArea.shade_state})
             </span>
             {selectedArea.shade_state === 'MANUAL' && <span className="badge-manual">MANUAL</span>}
             {selectedArea.shade_state === 'AUTO' && <span className="badge-auto">AUTO</span>}
          </div>
        </div>

        {/* שליטה ידנית */}
        <div className="control-group">
          <label>Manual Control</label>
          <div className="slider-container">
            <input 
                type="range" min="0" max="100" 
                value={shadePosition} 
                onChange={(e) => setShadePosition(parseInt(e.target.value))} 
            />
            <span>{shadePosition}%</span>
          </div>
          <div className="button-group">
            <button onClick={handleManualControl} disabled={isSendingCommand}>
                {isSendingCommand ? 'Sending...' : '⚡ Send Command'}
            </button>
            <button onClick={handleAutoControl} className="outline-btn" disabled={isSendingCommand}>
                🔄 Revert to Auto
            </button>
          </div>
        </div>

        {/* --- אזור סימולציה חדש (Test Mode) --- */}
        <div className="control-group simulation-group" style={{borderTop: '1px solid #444', marginTop: '10px', paddingTop: '10px'}}>
            <label>🧪 Simulation (Test AI)</label>
            <div className="sim-controls">
                <div className="sim-slider">
                    <span>Temp: {simTemp}°C</span>
                    <input type="range" min="0" max="50" value={simTemp} onChange={(e) => setSimTemp(parseInt(e.target.value))} />
                </div>
                <div className="sim-slider">
                    <span>Light: {simLight}%</span>
                    <input type="range" min="0" max="100" value={simLight} onChange={(e) => setSimLight(parseInt(e.target.value))} />
                </div>
                <button onClick={handleSimulationUpdate} className="sim-btn">🚀 Inject Data</button>
            </div>
        </div>

        <div className="control-group">
          <label>Analysis</label>
          <button onClick={() => setShowGraph(true)}>View History</button>
        </div>
      </div>

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
        <div>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} accept="image/*" />
        </div>
      )}
    </div>
  );
};

export default RoomDashboard;