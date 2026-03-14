import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './SensorChart.css';

/**
 * Custom Dot: Determines color based on shade position (0=Green, 100=Red, else Orange)
 */
const CustomizedDot = (props) => {
    const { cx, cy, payload } = props;
    let fill = '#ffa726'; // Intermediate
    
    if (payload.current_position === 0) fill = '#66bb6a'; // Open
    else if (payload.current_position === 100) fill = '#ef5350'; // Closed

    return (
        <svg x={cx - 6} y={cy - 6} width={12} height={12} fill="none">
            <circle cx="6" cy="6" r="5" fill={fill} stroke="#fff" strokeWidth="2" />
        </svg>
    );
};

/**
 * Custom Tooltip: Formats the hover information
 */
const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    
    const data = payload[0].payload;
    const isClosed = data.current_position === 100;
    const isOpen = data.current_position === 0;

    return (
        <div className="custom-tooltip">
            <p className="tooltip-time">{new Date(data.recorded_at).toLocaleTimeString()}</p>
            <p className="tooltip-data" style={{ color: '#ff7300' }}>
                🌡️ Temp: <strong>{data.temperature}°C</strong>
            </p>
            <p className="tooltip-data" style={{ color: isClosed ? '#ef5350' : isOpen ? '#66bb6a' : '#ffa726' }}>
                🪟 Shade: <strong>{isOpen ? 'Open' : isClosed ? 'Closed' : `${data.current_position}%`}</strong>
            </p>
        </div>
    );
};

/**
 * SensorChart Component
 */
const SensorChart = ({ data = [] }) => {
    // Handle both array and {data: [...]} API response formats
    const rawData = Array.isArray(data) ? data : (data?.data || []);
    const chartData = [...rawData].reverse();

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="sensor-chart-container">
            {/* Legend Section */}
            <div className="chart-legend">
                <div className="legend-item"><span className="legend-dot" style={{background: '#66bb6a'}}/> Open</div>
                <div className="legend-item"><span className="legend-dot" style={{background: '#ef5350'}}/> Closed</div>
                <div className="legend-item"><span className="legend-dot" style={{background: '#ffa726'}}/> Partial</div>
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
                    <Line 
                        type="monotone" 
                        dataKey="temperature" 
                        stroke="#ff7300" 
                        strokeWidth={3}
                        dot={<CustomizedDot />} 
                        activeDot={{ r: 8 }}
                        animationDuration={500}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default SensorChart;