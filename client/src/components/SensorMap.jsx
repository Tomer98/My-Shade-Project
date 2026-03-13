import React, { useRef } from 'react';
import './RoomDashboard.css';

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

    const getWeatherIcon = (condition) => {
        if (condition === 'Storm') return '⛈️';
        if (condition === 'Rain') return '🌧️';
        if (condition === 'Cloudy') return '☁️';
        return '☀️';
    };
  
    const getSensorBadgeClass = (temp) => {
        if (temp < 20) return 'sensor-badge cold';
        if (temp > 26) return 'sensor-badge hot';
        return 'sensor-badge optimal';
    };

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
                {/* Data Overlay (Top-Left) */}
                <div className="data-overlay">
                    <span>{getWeatherIcon(simCondition)}</span>
                    <span>🌡️ {displayTemp}°C</span>
                    <span>💡 {displayLight} lx</span>
                </div>
                
                {imageSrc ? (
                    <img 
                        src={imageSrc} 
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
                    className={getSensorBadgeClass(displayTemp)}
                    style={{ 
                        left: `${sensor.x}%`, 
                        top: `${sensor.y}%`,
                        cursor: sensorEditMode === 'move' ? 'grab' : (sensorEditMode === 'delete' ? 'pointer' : 'default')
                    }}
                    draggable={sensorEditMode === 'move'}
                    onDragStart={(e) => handleDragStart(e, sensor)}
                    onClick={(e) => handleSensorClick(e, sensor)}
                >
                    {Math.round(displayTemp)}°
                </div>
                ))}
            </div>
        </div>
    );
};

export default SensorMap;