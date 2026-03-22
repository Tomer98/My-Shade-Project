import { useRef, useState, useEffect } from 'react';
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
    const imageRef = useRef(null);
    const [draggingSensorId, setDraggingSensorId] = useState(null);
    const [imageMetrics, setImageMetrics] = useState(null);

    const getClientXY = (e) => {
        if (e.touches?.length) return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        if (e.changedTouches?.length) return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
        return { clientX: e.clientX, clientY: e.clientY };
    };

    // Calculate image's rendered rect relative to the wrapper (for accurate sensor positioning)
    const updateMetrics = () => {
        if (!imageRef.current || !imageWrapperRef.current) return;
        const imgRect = imageRef.current.getBoundingClientRect();
        const wrapRect = imageWrapperRef.current.getBoundingClientRect();
        setImageMetrics({
            left: imgRect.left - wrapRect.left,
            top: imgRect.top - wrapRect.top,
            width: imgRect.width,
            height: imgRect.height,
        });
    };

    useEffect(() => {
        window.addEventListener('resize', updateMetrics);
        return () => window.removeEventListener('resize', updateMetrics);
    }, []);

    useEffect(() => { setImageMetrics(null); }, [imageSrc]);

    // --- Interaction Handlers ---

    // 1. Add Sensor (Clicking on the map)
    const handleImageClick = (e) => {
        if (sensorEditMode !== 'add') return;
        if (!imageRef.current) return;
        const rect = imageRef.current.getBoundingClientRect();
        const { clientX, clientY } = getClientXY(e);
        const x = ((clientX - rect.left) / rect.width) * 100;
        const y = ((clientY - rect.top) / rect.height) * 100;
        setSensors([...sensors, { id: `new-${Date.now()}`, x, y, temp: 21 }]);
    };

    // 2. Delete Sensor (Clicking on a badge in delete mode)
    const handleSensorClick = (e, sensor) => {
        e.stopPropagation();
        if (sensorEditMode === 'delete') {
            if (window.confirm('Are you sure you want to delete this sensor?')) {
                setSensors(sensors.filter(s => s.id !== sensor.id));
            }
        }
    };

    // 3. Start moving a sensor (mouse or touch)
    const handleSensorPointerDown = (e, sensor) => {
        if (sensorEditMode !== 'move') return;
        e.preventDefault();
        e.stopPropagation();
        setDraggingSensorId(sensor.id);
    };

    // 4. Track sensor drag via window events
    useEffect(() => {
        if (!draggingSensorId) return;

        const handleMove = (e) => {
            e.preventDefault();
            if (!imageRef.current) return;
            const rect = imageRef.current.getBoundingClientRect();
            const { clientX, clientY } = getClientXY(e);
            const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
            const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
            setSensors(prev => prev.map(s => s.id === draggingSensorId ? { ...s, x, y } : s));
        };

        const handleUp = () => setDraggingSensorId(null);

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleUp);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
        };
    }, [draggingSensorId, setSensors]);

    // --- RENDER ---

    return (
        <div className="map-panel">
            <div
                ref={imageWrapperRef}
                className="room-image-wrapper"
                onClick={handleImageClick}
                style={{ cursor: sensorEditMode === 'add' ? 'crosshair' : 'default' }}
            >
                {/* Data Overlay (Top-Left) showing current environment status */}
                <div className="data-overlay">
                    <span>{getWeatherIcon(simCondition)}</span>
                    <span>🌡️ {Math.round(displayTemp)}°C</span>
                    <span>💡 {Math.round(displayLight)} lx</span>
                </div>

                {imageSrc ? (
                    <img
                        ref={imageRef}
                        src={imageSrc}
                        alt={`${roomName} layout`}
                        className="room-image"
                        onLoad={updateMetrics}
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/room206_sketch.png';
                        }}
                    />
                ) : (
                    <div className="image-placeholder">Waiting for image...</div>
                )}

                {/* Sensors positioned in px relative to the image's actual rendered area */}
                {imageMetrics && sensors.map(sensor => (
                    <div
                        key={sensor.id}
                        className={getSensorBadgeClass(displayTemp)}
                        style={{
                            left: `${imageMetrics.left + (sensor.x / 100) * imageMetrics.width}px`,
                            top: `${imageMetrics.top + (sensor.y / 100) * imageMetrics.height}px`,
                            cursor: sensorEditMode === 'move' ? 'grab' : (sensorEditMode === 'delete' ? 'pointer' : 'default')
                        }}
                        onMouseDown={(e) => handleSensorPointerDown(e, sensor)}
                        onTouchStart={(e) => handleSensorPointerDown(e, sensor)}
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