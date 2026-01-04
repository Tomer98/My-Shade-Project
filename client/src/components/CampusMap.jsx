import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { getShadeColor } from '../utils/getShadeColor';
import './CampusMap.css';

const API_BASE_URL = 'http://localhost:3001';

const CampusMap = ({ areas, onSelectArea, onUpdateAreas, user }) => {
    const [isMapEditing, setIsMapEditing] = useState(false);
    const [editMode, setEditMode] = useState('none'); 
    const [draggingId, setDraggingId] = useState(null);
    const [tempPosition, setTempPosition] = useState({ top: 0, left: 0 });
    
    const mapWrapperRef = useRef(null);
    
    const dragPositionRef = useRef({ top: 0, left: 0 }); 
    const dragStartOffset = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!isMapEditing) setEditMode('none');
    }, [isMapEditing]);

    // --- לוגיקת גרירה חדשה המבוססת על useEffect כדי למנוע Stale Closures ---

    // שלב 1: מתחילים את הגרירה בלחיצת עכבר
    const handleMouseDown = (e, area) => {
        if (!isMapEditing || editMode !== 'move') return;
        e.preventDefault();
        e.stopPropagation();

        const mapRect = mapWrapperRef.current.getBoundingClientRect();
        const currentCoords = getCoords(area);

        // מיקום הפין הנוכחי בפיקסלים
        const pinX = (parseCoord(currentCoords.left) / 100) * mapRect.width;
        const pinY = (parseCoord(currentCoords.top) / 100) * mapRect.height;

        // מיקום העכבר בפיקסלים (יחסית למפה)
        const mouseX = e.clientX - mapRect.left;
        const mouseY = e.clientY - mapRect.top;

        // שומרים את ההפרש כדי למנוע "קפיצה" של הפין למיקום הסמן
        dragStartOffset.current = {
            x: mouseX - pinX,
            y: mouseY - pinY
        };
        
        setTempPosition(currentCoords); // מונע הבהוב ראשוני
        setDraggingId(area.id); // מפעיל את ה-useEffect
    };

    // שלב 2: מנהלים את אירועי התזוזה והשחרור דרך useEffect
    useEffect(() => {
        if (draggingId === null) return; // יוצאים אם לא גוררים כלום

        const handleMouseMove = (e) => {
            const mapRect = mapWrapperRef.current.getBoundingClientRect();
            if (!mapRect) return;

            const mouseX = e.clientX - mapRect.left;
            const mouseY = e.clientY - mapRect.top;

            const newPinX = mouseX - dragStartOffset.current.x;
            const newPinY = mouseY - dragStartOffset.current.y;

            let newLeft = (newPinX / mapRect.width) * 100;
            let newTop = (newPinY / mapRect.height) * 100;
            
            newTop = Math.max(0, Math.min(100, newTop));
            newLeft = Math.max(0, Math.min(100, newLeft));

            const newPos = { top: newTop, left: newLeft };
            setTempPosition(newPos);
            dragPositionRef.current = newPos;
        };

        const handleMouseUp = async () => {
            try {
                const finalPos = dragPositionRef.current;
                await axios.put(`${API_BASE_URL}/api/areas/${draggingId}/map-coordinates`, {
                    map_coordinates: JSON.stringify(finalPos)
                });
                onUpdateAreas();
            } catch (error) {
                console.error("Failed to save coordinates:", error);
                alert("Error saving position");
            }
            setDraggingId(null); // מפסיק את הגרירה ומפעיל את ה-cleanup
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingId, onUpdateAreas]);

    const handleMapClick = async (e) => {
        if (editMode !== 'add') return;
        const rect = e.currentTarget.getBoundingClientRect();
        const top = ((e.clientY - rect.top) / rect.height) * 100;
        const left = ((e.clientX - rect.left) / rect.width) * 100;

        const roomName = prompt('Enter a name for the new room:');
        if (roomName) {
            try {
                const formData = new FormData();
                formData.append('room', roomName);
                formData.append('description', 'New Room');
                // שליחת אובייקט בתוך סטרינג זה בסדר ב-FormData כי זה טופס
                formData.append('map_coordinates', JSON.stringify({ top, left }));
                
                await axios.post(`${API_BASE_URL}/api/areas`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                onUpdateAreas(); 
            } catch (error) {
                console.error("Failed to create room:", error);
                alert("Failed to create room");
            }
        }
    };
    
    const handleDeleteClick = async (e, areaToDelete) => {
        e.stopPropagation();
        const name = areaToDelete.name || areaToDelete.room || 'this room';
        if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
            try {
                await axios.delete(`${API_BASE_URL}/api/areas/${areaToDelete.id}`);
                onUpdateAreas();
            } catch (error) {
                console.error("Failed to delete room:", error);
                alert("Failed to delete room");
            }
        }
    };

    const handleSaveAndExit = () => setIsMapEditing(false);

    // --- Parsing Function ---
    const parseCoord = (val) => {
        if (val === undefined || val === null) return 50; 
        if (typeof val === 'number') return val;
        return parseFloat(val.toString().replace('%', ''));
    };

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

    return (
        <div className="map-scroll-wrapper">
            <div
                ref={mapWrapperRef}
                className="map-image-wrapper"
                onClick={handleMapClick}
                style={{ cursor: editMode === 'add' ? 'crosshair' : 'default' }}
            >
                {user?.role === 'admin' && (
                    <div className="floating-toolbar">
                        {!isMapEditing ? (
                            <button onClick={() => setIsMapEditing(true)}>✏️ Edit Map</button>
                        ) : (
                            <>
                                <button className={editMode === 'add' ? 'active' : ''} onClick={() => setEditMode(prev => prev === 'add' ? 'none' : 'add')}>➕ Add</button>
                                <button className={editMode === 'move' ? 'active' : ''} onClick={() => setEditMode(prev => prev === 'move' ? 'none' : 'move')}>✋ Move</button>
                                <button className={editMode === 'delete' ? 'active' : ''} onClick={() => setEditMode(prev => prev === 'delete' ? 'none' : 'delete')}>🗑️ Delete</button>
                                <button onClick={handleSaveAndExit}>💾 Exit Edit</button>
                            </>
                        )}
                    </div>
                )}

                <img src="/campus_map.png" alt="Campus Map" className="main-map-image" />

                {areas.map((area) => {
                    const coords = area.id === draggingId ? tempPosition : getCoords(area);
                    const isDeleting = isMapEditing && editMode === 'delete';
                    const displayName = area.name || area.room || 'Room';

                    return (
                        <div
                            key={area.id}
                            className="map-pin"
                            style={{
                                position: 'absolute',
                                top: `${parseCoord(coords.top)}%`,
                                left: `${parseCoord(coords.left)}%`,
                                transform: 'translate(-50%, -100%)',
                                zIndex: draggingId === area.id ? 102 : 1000,
                                cursor: isMapEditing ? (editMode === 'move' ? 'grab' : (editMode === 'delete' ? 'pointer' : 'default')) : 'pointer',
                                backgroundColor: getShadeColor(area.current_position),
                                display: 'flex',       
                                alignItems: 'center',  
                                justifyContent: 'center' 
                            }}
                            onMouseDown={(e) => handleMouseDown(e, area)}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isDeleting) {
                                    handleDeleteClick(e, area);
                                } else if (!isMapEditing) {
                                    onSelectArea(area);
                                }
                            }}
                        >
                            {isDeleting && <span className="pin-delete-icon">🗑️</span>}
                            <div className="pin-tooltip">{displayName}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CampusMap;