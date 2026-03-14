/**
 * Intelligent Scheduler Service
 * Evaluates real-time sensor and weather data to automate shade positions.
 */
const cron = require('node-cron');
const db = require('../config/db');
const weatherService = require('./weatherService');
const config = require('../config/automation'); 

let ioInstance = null;
const lastActionTypes = {}; // Cache to track the last action type per area

// ==========================================
// 🧠 Logic Brain (Calculate Score & Action)
// ==========================================
const calculateShadeAction = (temp, light, condition, isSimulated) => {
    
    // --- 1. Extreme Weather Checks ---

    // 🌧️ Storm / Rain
    if (['Storm', 'Rain', 'Heavy Rain'].includes(condition)) {
        return { 
            action: 'CLOSE', 
            score: 1.0, 
            reason: '🌧️ Rain Protection', 
            actionType: 'STORM' 
        };
    }

    // 🔥 Extreme Heat (Using config limit)
    if (temp >= config.LIMITS.MAX_TEMP) {
        return { 
            action: 'CLOSE', 
            score: 1.0, 
            reason: `🔥🔥 Extreme Heat (${temp}°C)`, 
            actionType: 'EXTREME_HEAT' 
        };
    }

    // ❄️ Extreme Cold
    if (temp <= 10) { 
        return { 
            action: 'CLOSE', 
            score: 1.0, 
            reason: `❄️ Extreme Cold (${temp}°C)`, 
            actionType: 'EXTREME_COLD' 
        };
    }

    // --- 2. Standard Calculation (Using Automation Config Weights) ---
    
    // Normalize Temperature: (Current - Min) / (Max - Min) -> values between 0.0 and 1.0
    const tempRange = config.LIMITS.MAX_TEMP - config.LIMITS.MIN_TEMP; 
    const normTemp = Math.min(Math.max((temp - config.LIMITS.MIN_TEMP) / tempRange, 0), 1); 
    
    // Normalize Light (Assuming Lux up to 10,000 as max threshold)
    const normLight = Math.min(Math.max(light / 10000, 0), 1);
    
    // Apply Weights from config
    const score = (config.WEIGHTS.TEMP * normTemp) + (config.WEIGHTS.LIGHT * normLight);
    
    // Determine the baseline action type
    let actionType = 'AUTO'; 
    if (score >= 0.95) actionType = 'CLOSED'; 
    else if (score <= 0.05) actionType = 'OPENED'; 

    return { 
        action: 'PARTIAL', 
        score, 
        reason: `Balanced (Score: ${score.toFixed(2)})`,
        actionType: actionType 
    };
};

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
                    decision: globalDecision.action === 'CLOSE' ? 'CLOSE' : 'AUTO',
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
        } catch (error) {
            console.error('Scheduler Cycle Error:', error.message);
        }
    });
};

module.exports = { initScheduler };