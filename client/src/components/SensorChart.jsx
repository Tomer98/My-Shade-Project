import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SensorChart = ({ data }) => {
  
  // --- לוגיקה פשוטה לחילוץ המערך ---
  let chartDataRaw = [];

  // בדיקה 1: האם 'data' הוא כבר המערך שאנחנו רוצים?
  if (Array.isArray(data)) {
    chartDataRaw = data;
  } 
  // בדיקה 2: האם 'data' הוא האובייקט מהשרת שמכיל בתוכו property בשם data?
  else if (data && typeof data === 'object' && Array.isArray(data.data)) {
    chartDataRaw = data.data;
  }

  console.log("📊 Raw Data for Chart:", chartDataRaw);

  // --- בדיקה אם יש נתונים להציג ---
  if (!chartDataRaw || chartDataRaw.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
        No history data available yet.
      </div>
    );
  }

  // --- עיבוד הנתונים לגרף (פירמוט תאריכים ומספרים) ---
  const formattedData = [...chartDataRaw].reverse().map((item) => {
    // חילוץ תאריך
    let timeLabel = "??:??";
    const dateVal = item.recorded_at || item.timestamp || item.date;
    
    if (dateVal) {
        const dateObj = new Date(dateVal);
        if (!isNaN(dateObj.getTime())) {
            // שעות ודקות בלבד
            timeLabel = dateObj.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        }
    }

    // המרה למספרים
    const temp = item.temperature !== undefined ? Number(item.temperature) : 0;
    const light = item.light_intensity !== undefined ? Number(item.light_intensity) : 0;

    return {
      ...item,
      temperature: isNaN(temp) ? 0 : temp,
      light_intensity: isNaN(light) ? 0 : light,
      time: timeLabel,
    };
  });

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart
          data={formattedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis yAxisId="left" label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="right" orientation="right" label={{ value: 'Light (%)', angle: 90, position: 'insideRight' }} />
          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
          <Legend verticalAlign="top" height={36}/>
          <Line yAxisId="left" type="monotone" dataKey="temperature" stroke="#e74c3c" strokeWidth={3} activeDot={{ r: 8 }} name="Temperature" />
          <Line yAxisId="right" type="monotone" dataKey="light_intensity" stroke="#f1c40f" strokeWidth={3} name="Light Level" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SensorChart;