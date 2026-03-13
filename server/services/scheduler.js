const cron = require('node-cron');
const db = require('../config/db');
const weatherService = require('./weatherService'); 

let ioInstance = null;
const lastActionTypes = {}; // Cache to track the last action type per area

// ==========================================
// 🧠 המוח הלוגי (חישוב ציון לכל חדר)
// ==========================================
const calculateShadeAction = (temp, light, condition, isSimulated) => {
    
    // --- 1. בדיקות קיצון ---

    // 🌧️ סערה
    if (condition === 'Storm' || condition === 'Rain' || condition === 'Heavy Rain') {
        return { 
            action: 'CLOSE', 
            score: 1.0, 
            reason: '🌧️ Rain Protection', 
            actionType: 'STORM' // <--- חדש
        };
    }

    // 🔥 חום קיצוני
    if (temp > 35) {
        return { 
            action: 'CLOSE', 
            score: 1.0, 
            reason: `🔥🔥 Extreme Heat (${temp}°C)`, 
            actionType: 'EXTREME_HEAT' // <--- חדש: זה מה שיפעיל את האייקון האדום
        };
    }

    // ❄️ קור קיצוני
    if (temp < 10) { // העליתי קצת ל-10 שיהיה קל לבדוק, תחזיר ל-5 אם תרצה
        return { 
            action: 'CLOSE', 
            score: 1.0, 
            reason: `❄️ Extreme Cold (${temp}°C)`, 
            actionType: 'EXTREME_COLD' // <--- חדש: יפעיל אייקון כחול
        };
    }

    // --- 2. חישוב רגיל ---
    const normTemp = Math.min(Math.max((temp - 20) / 15, 0), 1); 
    const normLight = Math.min(Math.max(light / 10000, 0), 1);
    
    let score = (0.6 * normTemp) + (0.4 * normLight);
    
    // הגדרת סוג הפעולה הרגילה
    let actionType = 'AUTO'; 
    if (score >= 0.95) actionType = 'CLOSED'; // סגירה מלאה רגילה
    else if (score <= 0.05) actionType = 'OPENED'; // פתיחה מלאה רגילה

    return { 
        action: 'PARTIAL', 
        score, 
        reason: `Balanced (Score: ${score.toFixed(2)})`,
        actionType: actionType // <--- חדש
    };
};

// ==========================================
// ⏰ אתחול המתזמן החכם
// ==========================================
const initScheduler = (io) => {
    ioInstance = io;
    console.log('⏰ Intelligent Scheduler running (Continuous Mode)...');

    // רץ כל 5 שניות לתגובתיות גבוהה
    cron.schedule('*/5 * * * * *', async () => {
        try {
            // 1. קבלת מזג אוויר אמיתי
            const realWeather = await weatherService.getCurrentWeather(); 
            
            // --- FIX: Save to weather_logs for the Frontend Top Bar ---
            await db.query(
                `INSERT INTO weather_logs (temp, light_level, weather_condition, clouds, score, decision, reason, recorded_at)
                 VALUES (?, ?, ?, ?, 0, 'MONITORING', 'Live Update', NOW())`,
                [realWeather.temp, realWeather.light, realWeather.condition || 'Clear', realWeather.clouds || 0]
            );

            // 2. שליפת אזורים
            const [areas] = await db.query('SELECT * FROM areas');

            for (const area of areas) {
                // דילוג על מצב ידני
                // תיקון: בודקים גם אם יש חותמת זמן לשינוי ידני (כדי לכבד מצבים כמו CLOSED/OPEN שהמשתמש קבע)
                if (area.shade_state === 'MANUAL' || area.last_manual_change) continue;

                let currentTemp, currentLight, currentCondition, isSimulated;

                // --- לוג דיבאג ---
                if (area.is_simulation) {
                    console.log(`🔎 Sim Room ${area.id}: Temp ${area.sim_temp}°C, Light ${area.sim_light}lx`);
                }

                // --- בחירת מקור הנתונים ---
                if (area.is_simulation) {
                    currentTemp = area.sim_temp;
                    currentLight = area.sim_light;
                    currentCondition = area.weather_condition || 'Clear'; 
                    isSimulated = true;
                } else {
                    currentTemp = realWeather.temp;
                    currentLight = realWeather.light;
                    // זיהוי תנאי תאורה בסיסי אם אין מידע מה-API
                    currentCondition = (currentLight < 200) ? 'Night' : (realWeather.condition || 'Sunny');
                    isSimulated = false;
                }

                // 3. חישוב ההחלטה
                const decision = calculateShadeAction(currentTemp, currentLight, currentCondition, isSimulated);

                // 4. המרה לאחוזים (0-100)
                // הציון (0.0 - 1.0) מוכפל ב-100
                let targetPosition = Math.round(decision.score * 100);

                // 5. מניעת "רעידות" (Hysteresis) ועדכון
                // נעדכן רק אם השינוי גדול מ-5%, או אם צריך להגיע לקצוות (0 או 100) בדיוק
                const diff = Math.abs(targetPosition - area.current_position);
                
                // Determine the new state string
                let newState = 'AUTO';
                if (targetPosition === 100) newState = 'CLOSED';
                else if (targetPosition === 0) newState = 'OPEN';

                // Check previous action type to see if the reason changed
                const prevActionType = lastActionTypes[area.id];

                // STOP SPAMMING: Skip update if position is effectively the same AND state matches AND reason matches
                if (diff < 5 && area.shade_state === newState && prevActionType === decision.actionType) {
                    continue;
                }

                // Update the cache for next time
                lastActionTypes[area.id] = decision.actionType;

                console.log(`🚀 ACTION: Moving ${area.room} to ${targetPosition}% (Reason: ${decision.reason})`);

                // 1. עדכון מצב החדר (תריס וסטטוס)
                await db.query(
                    'UPDATE areas SET current_position = ?, shade_state = ?, last_temperature = ?, last_light_intensity = ? WHERE id = ?',
                    [targetPosition, newState, currentTemp, currentLight, area.id]
                );

                // 2. תיעוד לוגים (כולל סוג האירוע החדש action_type)
                const [logResult] = await db.query(
                    `INSERT INTO logs (area_id, temperature, light_intensity, current_position, action_type)
                    VALUES (?, ?, ?, ?, ?)`, 
                    [area.id, currentTemp, currentLight, targetPosition, decision.actionType] 
                );

                // 3. עדכון ה-Frontend בזמן אמת
                if (ioInstance) {
                    ioInstance.emit('refresh_areas');
                    ioInstance.emit('new_log', {
                        id: logResult.insertId,
                        room: area.room,
                        temperature: currentTemp,
                        light_intensity: currentLight,
                        current_position: targetPosition,
                        action_type: decision.actionType,
                        recorded_at: new Date()
                    });
                }
            }
        } catch (error) {
            console.error('Scheduler Cycle Error:', error.message);
        }
    });
};

module.exports = { initScheduler };