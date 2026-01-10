const cron = require('node-cron');
const db = require('../config/db');
const weatherService = require('./weatherService'); 

let ioInstance = null;

// ==========================================
// 🧠 המוח הלוגי (חישוב ציון לכל חדר)
// ==========================================
const calculateShadeAction = (temp, light, condition, isSimulated) => {
    
    // --- 1. בדיקות קיצון (בטיחות והגנה) - עוקף כל חישוב אחר ---

    // 🌧️ הגנה מגשם וסערה (קריטי!)
    // בסימולציה נתעלם, אלא אם נרצה בעתיד לדמות גם את זה
    if (!isSimulated && (condition === 'Storm' || condition === 'Rain' || condition === 'Heavy Rain')) {
        return { 
            action: 'CLOSE', 
            score: 1.0, 
            reason: '🌧️ Rain Protection (Safety)' 
        };
    }

    // 🔥 הגנה מחום קיצוני (מעל 35 מעלות)
    if (temp > 35) {
        return { 
            action: 'CLOSE', 
            score: 1.0, 
            reason: `🔥🔥 Extreme Heat Protection (${temp}°C)` 
        };
    }

    // ❄️ הגנה מקור קיצוני (מתחת ל-5 מעלות) - בידוד החדר
    if (temp < 5) {
        return { 
            action: 'CLOSE', 
            score: 1.0, 
            reason: `❄️ Extreme Cold Insulation (${temp}°C)` 
        };
    }

    // --- 2. חישוב נוחות רציף (Comfort Logic) ---
    
    // נרמול טמפרטורה: 
    // טווח הנוחות: 20 מעלות (פתוח) עד 35 מעלות (סגור)
    // כל מה שמעל 20 מתחיל להעלות את הציון
    const normTemp = Math.min(Math.max((temp - 20) / 15, 0), 1); 
    
    // נרמול אור:
    // 0 לוקס (חושך) עד 10,000 לוקס (שמש ישירה חזקה)
    const normLight = Math.min(Math.max(light / 10000, 0), 1);
    
    // חישוב ציון משוקלל: 
    // נתנו משקל מעט גבוה יותר לטמפרטורה (60%) מאשר לאור (40%)
    let score = (0.6 * normTemp) + (0.4 * normLight);
    
    let action = 'PARTIAL';
    let reason = `Balanced Adjustment (Score: ${score.toFixed(2)})`;

    // הגדרות טקסטואליות לתצוגה בלבד (התנועה עצמה תהיה רציפה באחוזים)
    if (score >= 0.95) {
        action = 'CLOSE';
        reason = `High Intensity (Score: ${score.toFixed(2)})`;
    } else if (score <= 0.05) {
        action = 'OPEN';
        reason = `Low Intensity (Score: ${score.toFixed(2)})`;
    }

    return { action, score, reason };
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
            
            // 2. שליפת אזורים
            const [areas] = await db.query('SELECT * FROM areas');

            for (const area of areas) {
                // דילוג על מצב ידני
                if (area.shade_state === 'MANUAL') continue;

                let currentTemp, currentLight, currentCondition, isSimulated;

                // --- לוג דיבאג ---
                if (area.is_simulation) {
                    console.log(`🔎 Sim Room ${area.id}: Temp ${area.sim_temp}°C, Light ${area.sim_light}lx`);
                }

                // --- בחירת מקור הנתונים ---
                if (area.is_simulation) {
                    currentTemp = area.sim_temp;
                    currentLight = area.sim_light;
                    currentCondition = 'Simulation'; // בסימולציה אין גשם כרגע
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

                if (diff >= 5 || targetPosition === 0 || targetPosition === 100) {
                    
                    // בדיקה נוספת: אם ההפרש הוא רק 1-2 אחוז והיעד הוא לא קצה - נתעלם
                    if (diff < 5 && targetPosition !== 0 && targetPosition !== 100) continue;

                    console.log(`🚀 ACTION: Moving ${area.room} to ${targetPosition}% (Reason: ${decision.reason})`);
                    
                    let newState = 'AUTO';
                    if (targetPosition === 100) newState = 'CLOSED';
                    else if (targetPosition === 0) newState = 'OPEN';

                    await db.query(
                        'UPDATE areas SET current_position = ?, shade_state = ? WHERE id = ?',
                        [targetPosition, newState, area.id]
                    );

                    // תיעוד לוגים
                    await db.query(
                        `INSERT INTO logs (area_id, temperature, light_intensity, current_position)
                         VALUES (?, ?, ?, ?)`, 
                        [area.id, currentTemp, currentLight, targetPosition]
                    );
                    
                    if (ioInstance) ioInstance.emit('refresh_areas');
                }
            }
            
        } catch (error) {
            console.error('Scheduler Cycle Error:', error.message);
        }
    });
};

module.exports = { initScheduler };