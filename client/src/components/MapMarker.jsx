import React from 'react';
import { getShadeColor } from '../utils/getShadeColor';
import './CampusMap.css'; // Make sure styling is available

const MapMarker = ({ area, onClick, isEditing }) => {
    // Do not render if there are no coordinates
    if (!area.map_coordinates) {
        return null;
    }

    let coords;
    try {
        // Coordinates are stored as a JSON string '{"x": 50, "y": 50}'
        coords = JSON.parse(area.map_coordinates);
    } catch (e) {
        console.error('Failed to parse map coordinates for area:', area);
        return null; // Don't render if coordinates are invalid
    }

    const color = getShadeColor(area.current_position);

    const style = {
        left: `${coords.x}%`,
        top: `${coords.y}%`,
    };

    return (
        <div
            style={style}
            className="map-pin"
            onClick={(e) => {
                e.stopPropagation(); // Prevent map click event when clicking on a marker
                onClick(area);
            }}
        >
            <div className="pin" style={{ backgroundColor: color }}></div>
            <div className="pin-label">
                {area.name} ({area.current_position}%)
            </div>
        </div>
    );
};

export default MapMarker;