const cron = require('node-cron');
const db = require('../config/db');
const weatherService = require('./weatherService'); 

let ioInstance = null;

// --- המוח המדעי (לוגיקה) ---
const calculateShadeAction = (temp, light, condition) => {
    const normTemp = Math.min(Math.max((temp - 20) / 20, 0), 1); 
    const normLight = Math.min(Math.max(light / 10000, 0), 1);
    let score = (0.6 * normTemp) + (0.4 * normLight);
    
    if (condition === 'Storm' || condition === 'Rain') score = 1.0; 

    let action = 'WAITING';
    let reason = 'Optimal Conditions';

    if (score >= 0.7) {
        action = 'CLOSE';
        reason = `High Intensity (Score: ${score.toFixed(2)})`;
    } else if (score <= 0.3) {
        action = 'OPEN';
        reason = `Low Intensity (Score: ${score.toFixed(2)})`;
    }

    return { action, score, reason };
};

const initScheduler = (io) => {
    ioInstance = io;
    console.log('⏰ Intelligent Scheduler is initialized and running...');

    // רץ כל 10 שניות
    cron.schedule('*/10 * * * * *', async () => {
        
        // --- התיקון הגדול: המרה כפויה לשעון ישראל ---
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Asia/Jerusalem' // <--- זה מה שהיה חסר!
        });

        // לוג דיבאג כדי שתראה שהשרת חי ובודק את השעה הנכונה
        console.log(`⏱️ Scheduler Tick: Checking for tasks at [${currentTime}] (Israel Time)...`);

        try {
            // 1. מזג אוויר ומוח מדעי
            const weather = await weatherService.getCurrentWeather(); 
            const currentTemp = weather.temp;
            const currentLight = weather.light;
            const currentCondition = (currentLight < 200) ? 'Night/Cloudy' : 'Sunny'; 

            const smartDecision = calculateShadeAction(currentTemp, currentLight, currentCondition);

            // שמירת לוגים מדעיים
            await db.query(
                'INSERT INTO weather_logs (temp, light_level, condition_text, decision, reason, score) VALUES (?, ?, ?, ?, ?, ?)',
                [currentTemp, currentLight, currentCondition, smartDecision.action, smartDecision.reason, smartDecision.score]
            );

            if (ioInstance) {
                ioInstance.emit('weather_update', {
                    temp: currentTemp,
                    light: currentLight,
                    score: smartDecision.score,
                    decision: smartDecision.action,
                    reason: smartDecision.reason
                });
            }

            // בדיקת Override קריטי
            if (smartDecision.score >= 0.95) { 
                console.log(`⚠️ CRITICAL WEATHER override.`);
                await db.query('UPDATE areas SET shade_state = "CLOSED", current_position = 100 WHERE shade_state = "AUTO"');
                if (ioInstance) ioInstance.emit('refresh_areas');
                return; 
            }

            // 2. ביצוע לו"ז משימות (Schedules)
            // אנחנו מחפשים משימה שהזמן שלה שווה בדיוק לזמן בישראל עכשיו
            const [tasks] = await db.query(
                `SELECT s.*, a.room 
                 FROM schedules s
                 JOIN areas a ON s.area_id = a.id
                 WHERE s.execution_time = ? AND s.is_active = TRUE`, 
                [currentTime]
            );

            if (tasks.length > 0) {
                console.log(`✅ MATCH FOUND! Executing ${tasks.length} tasks for ${currentTime}`);

                for (const task of tasks) {
                    console.log(`🚀 Performing Task: ${task.action_type} for ${task.room}`);
                    
                    // ביצוע הפעולה
                    await db.query(
                        'UPDATE areas SET shade_state = "AUTO", current_position = ? WHERE id = ?',
                        [task.target_position, task.area_id]
                    );

                    // תיעוד
                    await db.query(
                        `INSERT INTO logs (area_id, temperature, light_intensity, current_position)
                         VALUES (?, ?, ?, ?)`, 
                        [task.area_id, currentTemp, currentLight, task.target_position]
                    );

                    if (ioInstance) {
                        ioInstance.emit('new_log', {
                            room: task.room,
                            temperature: currentTemp,
                            light_intensity: currentLight,
                            current_position: task.target_position,
                            recorded_at: new Date()
                        });
                        ioInstance.emit('refresh_areas');
                    }
                }
            }

        } catch (error) {
            console.error('Scheduler Error:', error.message);
        }
    });
};

module.exports = initScheduler;