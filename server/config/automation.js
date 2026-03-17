/**
 * Smart Shade Algorithm Configuration
 * Defines the weights, limits, and thresholds used to calculate 
 * the shade's physical position based on real-time sensor data.
 */
module.exports = {
    // Algorithm Weights (Must sum to 1.0)
    WEIGHTS: {
        TEMP: 0.6,  // Temperature accounts for 60% of the decision
        LIGHT: 0.4  // Light intensity accounts for 40% of the decision
    },

    // Normalization Limits (Used to calculate the 0-100 score)
    LIMITS: {
        MAX_TEMP: 35,  // At 35°C, the temperature score hits 100
        MIN_TEMP: 20,  // Below 20°C, the temperature score is 0 (pleasant)
        MAX_LIGHT: 80000 // ~80,000 lux = clear sky at solar noon (solar elevation model max)
    },

    // Closure Thresholds (Prevents the shade from twitching on minor changes)
    THRESHOLDS: {
        LEVEL_1: 20, // Score > 20 -> Close 25%
        LEVEL_2: 40, // Score > 40 -> Close 50%
        LEVEL_3: 70, // Score > 70 -> Close 75%
        LEVEL_4: 90  // Score > 90 -> Close 100%
    }
};