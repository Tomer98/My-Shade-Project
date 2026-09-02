/**
 * Multi-Room Sensor Simulator
 * ---------------------------
 * This script acts as mock IoT hardware. It generates random weather scenarios
 * (Summer, Winter, Glare, Neutral) for multiple rooms simultaneously and sends
 * the raw data to the server's public sensor endpoint.
 *
 * Usage (run in its own terminal):
 *   node scripts/multi_simulator.js            # simulate every room in the DB
 *   node scripts/multi_simulator.js 1 2 10     # simulate specific room IDs
 *
 * With no arguments it discovers the real room IDs from the API, so it keeps
 * working after rooms are added or deleted. Discovery needs a login, taken from
 * SIM_USER / SIM_PASS (defaults to the seeded dev admin).
 */
const axios = require('axios');

// --- Configuration ---
const API_BASE = process.env.SIM_API_BASE || 'http://localhost:3001/api';
const SERVER_URL = `${API_BASE}/sensors`;
const INTERVAL_MS = 4000; // 4 seconds between cycles

/**
 * Resolves which rooms to simulate: explicit CLI arguments if given, otherwise
 * every room the API reports.
 * @returns {Promise<number[]>} Area IDs to simulate.
 */
async function resolveTargetIds() {
    const fromArgs = process.argv.slice(2).map(Number).filter(Number.isInteger);
    if (fromArgs.length > 0) return fromArgs;

    const username = process.env.SIM_USER;
    const password = process.env.SIM_PASS;

    if (!username || !password) {
        throw new Error(
            'discovery needs SIM_USER and SIM_PASS, or pass room ids directly: ' +
            'node scripts/multi_simulator.js 1 2 3'
        );
    }

    const login = await axios.post(`${API_BASE}/auth/login`, { username, password });
    const token = login.data.token;

    const areas = await axios.get(`${API_BASE}/areas`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    return (areas.data.data || []).map(a => a.id);
}

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
(async () => {
    console.log('🚀 --- Scenario-Based Simulator Started --- 🚀');

    let targetIds;
    try {
        targetIds = await resolveTargetIds();
    } catch (error) {
        console.error(`❌ Could not discover rooms: ${error.message}`);
        console.error('   Is the server running? You can also pass IDs directly:');
        console.error('   node scripts/multi_simulator.js 1 2 3');
        process.exit(1);
    }

    if (targetIds.length === 0) {
        console.error('❌ No rooms found to simulate. Create a room first.');
        process.exit(1);
    }

    console.log(`Targeting Areas: ${targetIds.join(', ')}`);
    console.log(`Interval: ${INTERVAL_MS / 1000} seconds\n`);

    setInterval(() => {
        console.log('\n--- New Weather Cycle ---');
        targetIds.forEach(id => sendData(id));
    }, INTERVAL_MS);
})();