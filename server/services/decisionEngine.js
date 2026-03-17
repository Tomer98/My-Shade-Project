/**
 * Decision Engine
 * Pure logic function that calculates the recommended shade action
 * based on temperature, light, and weather conditions.
 * Extracted from scheduler.js for testability.
 */
const config = require('../config/automation');

/**
 * Snaps a continuous score (0.0–1.0) to the nearest configured step.
 * @param {number} rawScore - The continuous score to snap.
 * @returns {number} One of: 0, 0.25, 0.50, 0.75, 1.0
 */
const snapToStep = (rawScore) => {
    const pct = rawScore * 100;
    if (pct < config.THRESHOLDS.LEVEL_1) return 0;
    if (pct < config.THRESHOLDS.LEVEL_2) return 0.25;
    if (pct < config.THRESHOLDS.LEVEL_3) return 0.50;
    if (pct < config.THRESHOLDS.LEVEL_4) return 0.75;
    return 1.0;
};

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
    const rawScore = (config.WEIGHTS.TEMP * normTemp) + (config.WEIGHTS.LIGHT * normLight);
    const score = snapToStep(rawScore);

    let actionType = 'AUTO';
    if (score >= 0.95) actionType = 'CLOSED';
    else if (score <= 0.05) actionType = 'OPENED';

    return { action: 'PARTIAL', score, reason: `Balanced (Score: ${rawScore.toFixed(2)})`, actionType };
};

module.exports = { calculateShadeAction };