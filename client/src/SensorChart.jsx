import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// --- רכיב נקודה מותאם אישית (הקסם קורה כאן) ---
// הרכיב הזה מחליט איזה צבע תהיה הנקודה על הגרף לפי מצב הוילון באותו רגע
const CustomizedDot = (props) => {
    const { cx, cy, payload } = props; // payload מכיל את כל המידע של אותה נקודת זמן

    // לוגיקת צבעים
    let fill = '#ffa726'; // כתום (ברירת מחדל / חלקי)
    let stroke = '#fff';
    
    if (payload.current_position === 0) {
        fill = '#66bb6a'; // ירוק = פתוח (אור טבעי)
    } else if (payload.current_position === 100) {
        fill = '#ef5350'; // אדום = סגור (הגנה)
    }

    // ציור הנקודה
    return (
        <svg x={cx - 6} y={cy - 6} width={12} height={12} fill="none" viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="5" fill={fill} stroke={stroke} strokeWidth="2" />
        </svg>
    );
};

// --- טולטיפ מותאם אישית ---
// כשעומדים עם העכבר, נראה פירוט מלא
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div style={{ background: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '5px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                <p style={{ margin: 0, fontWeight: 'bold', color: '#555' }}>
                    {new Date(data.recorded_at).toLocaleTimeString()}
                </p>
                <p style={{ margin: '5px 0', color: '#ff7300' }}>
                    🌡️ טמפרטורה: <strong>{data.temperature}°C</strong>
                </p>
                <p style={{ margin: 0, color: data.current_position === 100 ? '#ef5350' : '#66bb6a' }}>
                    🪟 וילון: <strong>{data.current_position === 0 ? 'פתוח' : data.current_position === 100 ? 'סגור' : `${data.current_position}%`}</strong>
                </p>
            </div>
        );
    }
    return null;
};

const SensorChart = ({ data }) => {
  // היפוך המערך (משמאל לימין)
  const chartData = [...data].reverse();

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: '10px', fontSize: '0.9rem', color: '#666', display: 'flex', justifyContent: 'center', gap: '15px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{width: 10, height: 10, background: '#66bb6a', borderRadius: '50%'}}></span> וילון פתוח</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{width: 10, height: 10, background: '#ef5350', borderRadius: '50%'}}></span> וילון סגור</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{width: 10, height: 10, background: '#ffa726', borderRadius: '50%'}}></span> מצב ביניים</span>
      </div>
      
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          
          <XAxis 
            dataKey="recorded_at" 
            tickFormatter={formatTime} 
            tick={{ fontSize: 11 }}
            stroke="#999"
          />
          
          <YAxis 
            domain={['dataMin - 2', 'dataMax + 2']} 
            tick={{ fontSize: 12 }}
            stroke="#999"
            unit="°"
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          {/* הקו עצמו - כתום עדין */}
          <Line 
            type="monotone" 
            dataKey="temperature" 
            stroke="#ff7300" 
            strokeWidth={3}
            dot={<CustomizedDot />} // כאן אנחנו מחליפים את הנקודות הרגילות ברכיב החכם שלנו
            activeDot={{ r: 8 }}
            animationDuration={500}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SensorChart;