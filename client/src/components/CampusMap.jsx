import React, { useState } from 'react';
import './CampusMap.css';

const CampusMap = ({ areas, onSelectArea }) => {
  const [hoveredArea, setHoveredArea] = useState(null);

  // מפת מיקומים של הפינים על גבי מפת הקמפוס (באחוזים)
  const pinPositions = {
    // בניין 5 (כיתה 206) - נמצא במרכז-שמאל
    5: { top: '53%', left: '38%' }, 
    
    // בניין 6 (אודיטוריום) - נמצא מימין לבניין 5
    6: { top: '57%', left: '59%' }, 
    
    // בניין 8 (חדר 101) - נמצא למטה בצד שמאל
    8: { top: '70%', left: '32%' }
  };

  return (
    <div className="campus-map-container fade-in">
      <div className="map-wrapper">
        {/* תמונת הרקע של המפה */}
        <img src="/campus-map.png" alt="מפת הקמפוס" className="main-map-image" />
        
        {/* לולאה שיוצרת את הפינים עבור כל אזור */}
        {areas.map((area) => {
          const position = pinPositions[area.building_number];
          if (!position) return null; // אם אין מיקום מוגדר לבניין, דלג

          const isHovered = hoveredArea === area.id;
          const statusColor = (area.current_position > 50 || area.shade_state === 'CLOSED') ? '#ef5350' : '#66bb6a';
          return (
            <div 
              key={area.id}
              className="map-pin-container"
              style={{ top: position.top, left: position.left }}
              onClick={() => onSelectArea(area)}
              onMouseEnter={() => setHoveredArea(area.id)}
              onMouseLeave={() => setHoveredArea(null)}
            >
              {/* הפין עצמו */}
              <div className="map-pin" style={{ background: statusColor }}>
                <div className="pin-pulse" style={{ background: statusColor }}></div>
              </div>

              {/* בועת מידע שקופצת במעבר עכבר */}
              <div className={`pin-tooltip ${isHovered ? 'visible' : ''}`}>
                <strong>{area.room}</strong>
                <br />
                <span style={{ fontSize: '0.8rem', color: '#ccc' }}>בניין {area.building_number}</span>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="map-legend">
        <div className="legend-item"><span className="dot ok"></span> וילונות פתוחים</div>
        <div className="legend-item"><span className="dot alert"></span> וילונות סגורים (הגנה)</div>
        <div style={{ flex: 1, textAlign: 'left', fontSize: '0.8rem', color: '#aaa' }}>
          לחץ על אזור במפה לצפייה ושינוי סטטוס
        </div>
      </div>
    </div>
  );
};

export default CampusMap;