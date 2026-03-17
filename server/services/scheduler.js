/**
 * Intelligent Scheduler Service
 * Evaluates real-time sensor and weather data to automate shade positions.
 */
const cron = require('node-cron');
const db = require('../config/db');
const weatherService = require('./weatherService');
const config = require('../config/automation');
const { calculateShadeAction } = require('./decisionEngine'); 

let ioInstance = null;
const lastActionTypes = {}; // Cache to track the last action type per area

// Tracks which schedule IDs have already fired this minute to prevent duplicate execution
const executedThisMinute = new Set();
let currentMinute = '';

// ==========================================
// ⏰ Initialize Smart Scheduler
// ==========================================
const initScheduler = (io) => {
    ioInstance = io;
    console.log('⏰ Intelligent Scheduler running (Continuous Mode)...');

    // Runs every 5 seconds for high responsiveness
    cron.schedule('*/5 * * * * *', async () => {
        try {
            // 1. Fetch real-time weather & Calculate Global Algorithm Score
            const realWeather = await weatherService.getCurrentWeather(); 
            const globalCondition = realWeather.condition || 'Clear';
            
            // Calculate what the algorithm "thinks" globally right now
            const globalDecision = calculateShadeAction(realWeather.temp, realWeather.light, globalCondition, false);

            // Log global weather to DB WITH the actual algorithm score and reasoning
            await db.query(
                `INSERT INTO weather_logs (temp, light_level, weather_condition, clouds, score, decision, reason, recorded_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                [realWeather.temp, realWeather.light, globalCondition, realWeather.clouds || 0, globalDecision.score, globalDecision.actionType, globalDecision.reason]
            );

            // 📢 2. EMIT REAL-TIME UPDATE TO REACT DASHBOARD
            if (ioInstance) {
                ioInstance.emit('smartDataUpdate', {
                    temp: realWeather.temp,
                    light: realWeather.light,
                    clouds: realWeather.clouds || 0,
                    score: globalDecision.score,
                    decision: globalDecision.actionType,
                    reason: globalDecision.reason
                });
            }

            // 3. Fetch all areas and update individual rooms
            const [areas] = await db.query('SELECT * FROM areas');

            for (const area of areas) {
                // Skip if area is in MANUAL mode or has a recent manual override
                if (area.shade_state === 'MANUAL' || area.last_manual_change) continue;

                let currentTemp, currentLight, currentCondition, isSimulated;

                // --- Data Source Selection ---
                if (area.is_simulation) {
                    currentTemp = area.sim_temp;
                    currentLight = area.sim_light;
                    currentCondition = area.weather_condition || 'Clear'; 
                    isSimulated = true;
                } else {
                    currentTemp = realWeather.temp;
                    currentLight = realWeather.light;
                    currentCondition = (currentLight < 200) ? 'Night' : (realWeather.condition || 'Sunny');
                    isSimulated = false;
                }

                // 4. Calculate Decision
                const decision = calculateShadeAction(currentTemp, currentLight, currentCondition, isSimulated);

                // 5. Convert score (0.0 - 1.0) to percentage (0-100)
                let targetPosition = Math.round(decision.score * 100);

                // 6. Apply Hysteresis (Prevent twitching)
                const diff = Math.abs(targetPosition - area.current_position);
                
                let newState = 'AUTO';
                if (targetPosition === 100) newState = 'CLOSED';
                else if (targetPosition === 0) newState = 'OPEN';

                const prevActionType = lastActionTypes[area.id];

                // Skip update if change is minimal (<5%) AND state/reason hasn't changed
                if (diff < 5 && area.shade_state === newState && prevActionType === decision.actionType) {
                    continue;
                }

                lastActionTypes[area.id] = decision.actionType;
                console.log(`🚀 ACTION: Moving ${area.room} to ${targetPosition}% (Reason: ${decision.reason})`);

                // 7. Update Database State
                await db.query(
                    'UPDATE areas SET current_position = ?, shade_state = ?, last_temperature = ?, last_light_intensity = ? WHERE id = ?',
                    [targetPosition, newState, currentTemp, currentLight, area.id]
                );

                // 8. Insert Log Entry
                const [logResult] = await db.query(
                    `INSERT INTO logs (area_id, temperature, light_intensity, current_position, action_type)
                     VALUES (?, ?, ?, ?, ?)`, 
                    [area.id, currentTemp, currentLight, targetPosition, decision.actionType] 
                );

                // 9. Emit Real-time Updates to Client (Rooms)
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
            // ==========================================
            // ⏰ Execute Time-Based Schedules
            // ==========================================

            // Build current HH:MM string
            const now = new Date();
            const timeNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            // When the minute changes, reset the tracker so schedules can fire again next time
            if (timeNow !== currentMinute) {
                currentMinute = timeNow;
                executedThisMinute.clear();
            }

            // Find all active schedules whose execution time matches right now
            const [dueSchedules] = await db.query(
                `SELECT s.*, a.room FROM schedules s
                 JOIN areas a ON s.area_id = a.id
                 WHERE s.execution_time = ? AND s.is_active = TRUE`,
                [timeNow]
            );

            for (const schedule of dueSchedules) {
                // Skip if already fired this minute
                if (executedThisMinute.has(schedule.id)) continue;
                executedThisMinute.add(schedule.id);

                // OPEN → position 0, CLOSE → position 100
                const position = schedule.action_type === 'OPEN' ? 0 : 100;
                const newState = schedule.action_type === 'OPEN' ? 'OPEN' : 'CLOSED';

                // Apply the scheduled action to the area
                await db.query(
                    'UPDATE areas SET current_position = ?, shade_state = ?, last_manual_change = NOW() WHERE id = ?',
                    [position, newState, schedule.area_id]
                );

                // Log the scheduled execution
                await db.query(
                    'INSERT INTO logs (area_id, temperature, light_intensity, current_position, action_type) VALUES (?, 0, 0, ?, ?)',
                    [schedule.area_id, position, `SCHEDULE_${schedule.action_type}`]
                );

                console.log(`📅 SCHEDULE EXECUTED: ${schedule.action_type} for "${schedule.room}" at ${timeNow}`);

                if (ioInstance) {
                    ioInstance.emit('refresh_areas');
                    ioInstance.emit('new_log', {
                        action_type: `SCHEDULE_${schedule.action_type}`,
                        room: schedule.room,
                        current_position: position,
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