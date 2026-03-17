/**
 * Multi-Room Sensor Simulator
 * ---------------------------
 * This script acts as mock IoT hardware. It generates random weather scenarios
 * (Summer, Winter, Glare, Neutral) for multiple rooms simultaneously and sends
 * the raw data to the server's public sensor endpoint.
 * Usage: Run this script in a separate terminal to demo the smart automation.
 * Command: node scripts/multi_simulator.js
 */
const axios = require('axios');

// --- Configuration ---
const SERVER_URL = 'http://localhost:3001/api/sensors';
const TARGET_IDS = [2, 3, 4]; // The IDs of the areas/rooms to simulate
const INTERVAL_MS = 4000;     // 4 seconds between cycles

console.log('🚀 --- Scenario-Based Simulator Started --- 🚀');
console.log(`Targeting Areas: ${TARGET_IDS.join(', ')}`);
console.log(`Interval: ${INTERVAL_MS / 1000} seconds\n`);

/**
 * Helper: Generate a random number within a range.
 * @param {number} min 
 * @param {number} max 
 * @returns {number} Random number rounded to 1 decimal place.
 */
function getRandom(min, max) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(1));
}

/**
 * Generate a random weather scenario to trigger the smart algorithm.
 * @param {number} id - Area ID
 * @returns {Object} Payload matching the sensor API requirements.
 */
function generateScenario(id) {
    const scenario = Math.floor(Math.random() * 4) + 1;
    let temp, light;

    switch (scenario) {
        case 1: // ☀️ Hot Summer (Should trigger CLOSE for cooling)
            temp = getRandom(29, 35);
            light = getRandom(70, 100);
            console.log(`[Area ${id}] 🔥 Summer Scenario   -> Temp: ${temp}°C | Light: ${light}%`);
            break;

        case 2: // ❄️ Sunny Winter (Should trigger OPEN for passive heating)
            temp = getRandom(15, 21);
            light = getRandom(65, 95);
            console.log(`[Area ${id}] ❄️ Winter Sun Scenario -> Temp: ${temp}°C | Light: ${light}%`);
            break;

        case 3: // 😎 Extreme Glare (Should trigger CLOSE immediately)
            temp = getRandom(23, 25);
            light = getRandom(91, 100); 
            console.log(`[Area ${id}] 😎 Glare Scenario      -> Temp: ${temp}°C | Light: ${light}%`);
            break;

        case 4: // ☁️ Neutral/Cloudy Day (Should maintain state / Neutral)
            temp = getRandom(23, 25);
            light = getRandom(30, 50);
            console.log(`[Area ${id}] ☁️ Neutral Scenario    -> Temp: ${temp}°C | Light: ${light}%`);
            break;
    }

    return {
        area_id: id,
        temperature: temp,
        light_intensity: light
    };
}

/**
 * Send the simulated data to the main server.
 * @param {number} id - Area ID
 */
async function sendData(id) {
    const fakeData = generateScenario(id);
    try {
        await axios.post(SERVER_URL, fakeData);
    } catch (error) {
        const status = error.response ? error.response.status : 'Network Error';
        console.error(`❌ [Area ${id}] Failed to send data. Status: ${status}`);
    }
}

// ==========================================
// 🌪️ Main Loop
// ==========================================
setInterval(() => {
    console.log('\n--- New Weather Cycle ---');
    TARGET_IDS.forEach(id => sendData(id));
}, INTERVAL_MS);