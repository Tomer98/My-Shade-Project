/**
 * Decision Engine
 * Pure logic function that calculates the recommended shade action
 * based on temperature, light, and weather conditions.
 * Extracted from scheduler.js for testability.
 */
const config = require('../config/automation');

const calculateShadeAction = (temp, light, condition) => {
    
    // --- 1. Extreme Weather Checks ---
    if (['Storm', 'Rain', 'Heavy Rain'].includes(condition)) {
        return { action: 'CLOSE', score: 1.0, reason: '🌧️ Rain Protection', actionType: 'STORM' };
    }

    if (temp >= config.LIMITS.MAX_TEMP) {
        return { action: 'CLOSE', score: 1.0, reason: `🔥🔥 Extreme Heat (${temp}°C)`, actionType: 'EXTREME_HEAT' };
    }

    if (temp <= 10) {
        return { action: 'CLOSE', score: 1.0, reason: `❄️ Extreme Cold (${temp}°C)`, actionType: 'EXTREME_COLD' };
    }

    // --- 2. Standard Calculation ---
    const tempRange = config.LIMITS.MAX_TEMP - config.LIMITS.MIN_TEMP;
    const normTemp = Math.min(Math.max((temp - config.LIMITS.MIN_TEMP) / tempRange, 0), 1);
    const normLight = Math.min(Math.max(light / 10000, 0), 1);
    const score = (config.WEIGHTS.TEMP * normTemp) + (config.WEIGHTS.LIGHT * normLight);

    let actionType = 'AUTO';
    if (score >= 0.95) actionType = 'CLOSED';
    else if (score <= 0.05) actionType = 'OPENED';

    return { action: 'PARTIAL', score, reason: `Balanced (Score: ${score.toFixed(2)})`, actionType };
};

module.exports = { calculateShadeAction };