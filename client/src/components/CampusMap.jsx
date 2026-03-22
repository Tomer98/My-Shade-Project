import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { getShadeColor } from '../utils/getShadeColor';
import { getAuthHeader } from '../utils/auth';
import { useNotification } from '../context/NotificationContext';
import { API_BASE_URL } from '../config';
import './CampusMap.css';

/**
 * Parses a coordinate value (string or number) into a clean percentage number.
 * @param {string|number} val - The coordinate value to parse.
 * @returns {number} The parsed percentage value.
 */
const parseCoord = (val) => {
    if (val === undefined || val === null) return 50;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString().replace('%', ''));
};

/**
 * Extracts and parses top/left coordinates from an area object.
 * Handles potential double-stringified JSON from the database.
 * @param {Object} area - The area object containing coordinate data.
 * @returns {Object} An object with { top, left } properties.
 */
const getCoords = (area) => {
    let raw = area.map_coordinates || area.map_position;
    if (!raw) return { top: 50, left: 50 };

    if (typeof raw === 'object') return raw;

    try {
        if (typeof raw === 'string') {
            if (raw.startsWith('"')) raw = JSON.parse(raw);
            if (typeof raw === 'string') raw = JSON.parse(raw);
        }
        return raw;
    } catch (e) {
        return { top: 50, left: 50 };
    }
};

/**
 * CampusMap Component
 * Renders an interactive map with draggable pins representing different rooms.
 * Provides administrative tools to add, move, and delete pins.
 * @component
 * @param {Object} props
 * @param {Array} props.areas - List of area objects to display on the map.
 * @param {Function} props.onSelectArea - Callback when a room pin is clicked.
 * @param {Function} props.onUpdateAreas - Callback to refresh data from the server.
 * @param {Object} props.user - The currently authenticated user object.
 */
const CampusMap = ({ areas, onSelectArea, onUpdateAreas, user }) => {
    const showNotification = useNotification();

    const [isMapEditing, setIsMapEditing] = useState(false);
    const [editMode, setEditMode] = useState('none');
    const [draggingId, setDraggingId] = useState(null);
    const [tempPosition, setTempPosition] = useState({ top: 0, left: 0 });
    const [pendingMoves, setPendingMoves] = useState({});
    const [pendingAdds, setPendingAdds] = useState([]);
    const [pendingDeletes, setPendingDeletes] = useState(new Set());

    const mapWrapperRef = useRef(null);
    const dragPositionRef = useRef({ top: 0, left: 0 });
    const dragStartOffset = useRef({ x: 0, y: 0 });

    const clearAllPending = () => {
        setPendingMoves({});
        setPendingAdds([]);
        setPendingDeletes(new Set());
    };

    useEffect(() => {
        if (!isMapEditing) { setEditMode('none'); clearAllPending(); }
    }, [isMapEditing]);

    const handleSave = async () => {
        try {
            await Promise.all([
                // Save moved pins
                ...Object.entries(pendingMoves).map(([id, pos]) =>
                    axios.put(`${API_BASE_URL}/areas/${id}/map-coordinates`, {
                        map_coordinates: JSON.stringify(pos)
                    }, getAuthHeader())
                ),
                // Create new pins
                ...pendingAdds.map(({ name, position }) => {
                    const formData = new FormData();
                    formData.append('room', name);
                    formData.append('description', 'New Room');
                    formData.append('map_coordinates', JSON.stringify(position));
                    const authConfig = getAuthHeader();
                    return axios.post(`${API_BASE_URL}/areas`, formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                            ...authConfig?.headers
                        }
                    });
                }),
                // Delete removed pins
                ...[...pendingDeletes].map(id =>
                    axios.delete(`${API_BASE_URL}/areas/${id}`, getAuthHeader())
                ),
            ]);
            clearAllPending();
            setIsMapEditing(false);
            onUpdateAreas();
            showNotification("Map layout saved", "success");
        } catch (error) {
            showNotification("Failed to save map layout", "error");
        }
    };

    /**
     * Initializes the dragging sequence for a room pin.
     */
    const handleMouseDown = (e, area) => {
        if (!isMapEditing || editMode !== 'move') return;
        e.preventDefault();
        e.stopPropagation();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const mapRect = mapWrapperRef.current.getBoundingClientRect();
        const currentCoords = pendingMoves[area.id] || getCoords(area);

        const pinX = (parseCoord(currentCoords.left) / 100) * mapRect.width;
        const pinY = (parseCoord(currentCoords.top) / 100) * mapRect.height;

        dragStartOffset.current = {
            x: clientX - mapRect.left - pinX,
            y: clientY - mapRect.top - pinY
        };

        setTempPosition(currentCoords);
        setDraggingId(area.id);
    };

    /**
     * Handles the movement and final drop of a dragged pin.
     */
    useEffect(() => {
        if (draggingId === null) return;

        const handleMouseMove = (e) => {
            e.preventDefault();
            const mapRect = mapWrapperRef.current?.getBoundingClientRect();
            if (!mapRect) return;

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            const newPinX = clientX - mapRect.left - dragStartOffset.current.x;
            const newPinY = clientY - mapRect.top - dragStartOffset.current.y;

            let newLeft = (newPinX / mapRect.width) * 100;
            let newTop = (newPinY / mapRect.height) * 100;

            newTop = Math.max(0, Math.min(100, newTop));
            newLeft = Math.max(0, Math.min(100, newLeft));

            const newPos = { top: newTop, left: newLeft };
            setTempPosition(newPos);
            dragPositionRef.current = newPos;
        };

        const handleMouseUp = () => {
            const id = draggingId;
            const finalPos = dragPositionRef.current;
            // If it's a pending add, update its position; otherwise track as pending move
            setPendingAdds(prev => {
                const idx = prev.findIndex(a => a.tempId === id);
                if (idx !== -1) {
                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], position: finalPos, map_coordinates: finalPos };
                    return updated;
                }
                return prev;
            });
            setPendingMoves(prev => ({ ...prev, [id]: finalPos }));
            setDraggingId(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleMouseMove, { passive: false });
        window.addEventListener('touchend', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [draggingId]);

    /**
     * Queues a new room pin at the clicked map coordinates (saved on Save).
     */
    const handleMapClick = (e) => {
        if (editMode !== 'add') return;
        const rect = e.currentTarget.getBoundingClientRect();
        const top = ((e.clientY - rect.top) / rect.height) * 100;
        const left = ((e.clientX - rect.left) / rect.width) * 100;

        const roomName = prompt('Enter a name for the new room:');
        if (roomName) {
            const tempId = `temp_${Date.now()}`;
            setPendingAdds(prev => [...prev, {
                tempId,
                id: tempId,
                name: roomName,
                room: roomName,
                position: { top, left },
                map_coordinates: { top, left },
                current_position: null,
            }]);
        }
    };

    /**
     * Queues a room for deletion (or removes a pending add immediately).
     */
    const handleDeleteClick = (e, areaToDelete) => {
        e.stopPropagation();
        const isTempPin = String(areaToDelete.id).startsWith('temp_');
        if (isTempPin) {
            setPendingAdds(prev => prev.filter(a => a.tempId !== areaToDelete.id));
            return;
        }
        const name = areaToDelete.name || areaToDelete.room || 'this room';
        if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
            setPendingDeletes(prev => new Set([...prev, areaToDelete.id]));
        }
    };

    // Combine real areas (minus pending deletes) with pending adds
    const visibleAreas = [
        ...areas.filter(a => !pendingDeletes.has(a.id)),
        ...pendingAdds,
    ];

    return (
        <div className="map-scroll-wrapper">
            {user?.role === 'admin' && (
                <div className="map-admin-controls">
                    {!isMapEditing ? (
                        <button className="map-control-btn" onClick={() => setIsMapEditing(true)}>
                            ✏️ Edit Map
                        </button>
                    ) : (
                        <div className="floating-toolbar" onClick={(e) => e.stopPropagation()}>
                            <button className={editMode === 'add' ? 'active' : ''} onClick={() => setEditMode(prev => prev === 'add' ? 'none' : 'add')} title="Add Room">➕ Add</button>
                            <button className={editMode === 'move' ? 'active' : ''} onClick={() => setEditMode(prev => prev === 'move' ? 'none' : 'move')} title="Move Room">✋ Move</button>
                            <button className={editMode === 'delete' ? 'active' : ''} onClick={() => setEditMode(prev => prev === 'delete' ? 'none' : 'delete')} title="Delete Room">🗑️ Delete</button>

                            <div className="toolbar-divider"></div>

                            <button className="save-btn" onClick={handleSave}>💾 Save</button>
                            <button className="cancel-btn" onClick={() => { clearAllPending(); setIsMapEditing(false); onUpdateAreas(); }}>✖ Cancel</button>
                        </div>
                    )}
                </div>
            )}

            <div
                ref={mapWrapperRef}
                className="map-image-wrapper"
                onClick={handleMapClick}
                style={{ cursor: editMode === 'add' ? 'crosshair' : 'default' }}
            >
                <img src="/campus_map.png" alt="Campus Map" className="main-map-image" />

                {visibleAreas.map((area) => {
                    const isTempPin = String(area.id).startsWith('temp_');
                    const coords = area.id === draggingId
                        ? tempPosition
                        : (isTempPin
                            ? (pendingMoves[area.id] || area.map_coordinates)
                            : (pendingMoves[area.id] || getCoords(area)));
                    const isDeleting = isMapEditing && editMode === 'delete';
                    const displayName = area.name || area.room || 'Room';

                    return (
                        <div
                            key={area.id}
                            className={`map-pin ${draggingId === area.id ? 'dragging' : ''} ${isTempPin ? 'pin-pending' : ''}`}
                            style={{
                                top: `${parseCoord(coords.top)}%`,
                                left: `${parseCoord(coords.left)}%`,
                                zIndex: draggingId === area.id ? 1002 : 1000,
                                cursor: isMapEditing ? (editMode === 'move' ? 'grab' : (editMode === 'delete' ? 'pointer' : 'default')) : 'pointer',
                                '--pin-color': getShadeColor(area.current_position),
                            }}
                            onMouseDown={(e) => handleMouseDown(e, area)}
                            onTouchStart={(e) => handleMouseDown(e, area)}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isDeleting) {
                                    handleDeleteClick(e, area);
                                } else if (!isMapEditing) {
                                    onSelectArea(area);
                                }
                            }}
                        >
                            {isDeleting ? <span className="pin-delete-icon">🗑️</span> : <div className="pin-inner-dot"></div>}
                            <div className="pin-tooltip">{displayName}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CampusMap;
