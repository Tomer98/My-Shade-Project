import { useRef } from 'react';
import './RoomDashboard.css';

/**
 * Maps a weather condition string to its corresponding emoji icon.
 * Kept outside to prevent recreation on every render.
 */
const getWeatherIcon = (condition) => {
    switch (condition) {
        case 'Storm': return '⛈️';
        case 'Rain': return '🌧️';
        case 'Cloudy': return '☁️';
        default: return '☀️'; // Clear/Default
    }
};

/**
 * Determines the visual CSS class for the sensor badge based on the current temperature.
 */
const getSensorBadgeClass = (temp) => {
    if (temp < 20) return 'sensor-badge cold';
    if (temp > 26) return 'sensor-badge hot';
    return 'sensor-badge optimal';
};

/**
 * A transparent 1x1 pixel image used to hide the default browser drag ghost image.
 * Created once globally to save memory allocations during rapid drag events.
 */
const emptyDragImage = new Image();
emptyDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * SensorMap Component
 * Displays the room layout image and overlays interactive sensor badges.
 * Handles drag-and-drop repositioning, adding, and deleting sensors.
 */
const SensorMap = ({ 
    imageSrc, 
    roomName, 
    sensors, 
    setSensors, 
    sensorEditMode, 
    displayTemp, 
    displayLight, 
    simCondition 
}) => {
    const imageWrapperRef = useRef(null);
    const draggedSensorRef = useRef(null);

    // --- Interaction Handlers ---

    // 1. Add Sensor (Clicking on the map)
    const handleImageClick = (e) => {
        if (sensorEditMode !== 'add') return;
        
        const rect = imageWrapperRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        const newSensor = { id: `new-${Date.now()}`, x, y, temp: 21 }; // Default temp 21 for visual test
        setSensors([...sensors, newSensor]);
    };

    // 2. Delete Sensor (Clicking on a badge in delete mode)
    const handleSensorClick = (e, sensor) => {
        e.stopPropagation(); // Prevent the map click (which adds a sensor) from firing
        if (sensorEditMode === 'delete') {
            if (window.confirm('Are you sure you want to delete this sensor?')) {
                setSensors(sensors.filter(s => s.id !== sensor.id));
            }
        }
    };

    // --- Drag and Drop Logic ---

    const handleDragStart = (e, sensor) => {
        if (sensorEditMode !== 'move') { 
            e.preventDefault(); 
            return; 
        }
        
        draggedSensorRef.current = sensor;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', sensor.id);
        
        // Use the pre-created transparent image to hide the browser's default drag ghost
        e.dataTransfer.setDragImage(emptyDragImage, 0, 0);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Necessary to allow a drop event
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (sensorEditMode !== 'move' || !draggedSensorRef.current) return;
        
        const rect = imageWrapperRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        // Update the coordinates of the dragged sensor
        setSensors(sensors.map(s => 
            s.id === draggedSensorRef.current.id ? { ...s, x, y } : s
        ));
        
        draggedSensorRef.current = null; // Reset reference
    };

    // --- RENDER ---

    return (
        <div className="map-panel">
            <div 
                className="room-image-wrapper" 
                ref={imageWrapperRef} 
                onClick={handleImageClick}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                style={{ cursor: sensorEditMode === 'add' ? 'crosshair' : 'default' }}
            >
                {/* Data Overlay (Top-Left) showing current environment status */}
                <div className="data-overlay">
                    <span>{getWeatherIcon(simCondition)}</span>
                    <span>🌡️ {Math.round(displayTemp)}°C</span>
                    <span>💡 {Math.round(displayLight)} lx</span>
                </div>
                
                {/* Room Layout Image */}
                {imageSrc ? (
                    <img 
                        src={imageSrc} 
                        alt={`${roomName} layout`} 
                        className="room-image"
                        onError={(e) => {
                            e.target.onerror = null; 
                            e.target.src = '/room206_sketch.png'; // Fallback image if main fails
                        }}
                    />
                ) : (
                    <div className="image-placeholder">Waiting for image...</div>
                )}
                
                {/* Overlaying Interactive Sensor Badges */}
                {sensors.map(sensor => (
                    <div
                        key={sensor.id}
                        className={getSensorBadgeClass(displayTemp)}
                        style={{ 
                            left: `${sensor.x}%`, 
                            top: `${sensor.y}%`,
                            cursor: sensorEditMode === 'move' ? 'grab' : (sensorEditMode === 'delete' ? 'pointer' : 'default')
                        }}
                        draggable={sensorEditMode === 'move'}
                        onDragStart={(e) => handleDragStart(e, sensor)}
                        onClick={(e) => handleSensorClick(e, sensor)}
                        title={`Sensor ID: ${sensor.id}`}
                    >
                        {Math.round(displayTemp)}°
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SensorMap;