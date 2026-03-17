/**
 * Weather Service
 * Fetches real-time weather data from OpenWeatherMap API.
 * Includes retry with exponential backoff, timeout, and graceful fallback.
 */
const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.WEATHER_API_KEY;
const CITY = process.env.WEATHER_CITY || 'Holon,IL';

// --- Resilience Configuration ---
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;   // 1s, 2s, 4s (exponential)
const REQUEST_TIMEOUT_MS = 5000; // 5 second timeout per attempt

// Cache: stores the last successful result to use during outages
let lastKnownWeather = null;

/**
 * Sleep utility for delays between retries.
 * @param {number} ms - Milliseconds to wait.
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches current weather with retry logic and exponential backoff.
 * On failure, falls back to cached data, then to generated defaults.
 * 
 * @returns {Promise<{temp: number, light: number, condition: string, clouds: number}>}
 */
exports.getCurrentWeather = async () => {
    if (!API_KEY) {
        console.warn("⚠️ No WEATHER_API_KEY found. Using fallback data.");
        return getFallbackData('No API key configured');
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&units=metric&appid=${API_KEY}`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
            const data = response.data;

            const temp = data.main.temp;
            const condition = data.weather?.[0]?.main || 'Clear';
            const clouds = data.clouds.all;

            // Calculate estimated light intensity (Lux)
            const now = Date.now() / 1000;
            const sunrise = data.sys.sunrise;
            const sunset = data.sys.sunset;
            let light = 10; // Default: nighttime

            if (now > sunrise && now < sunset) {
                const cloudFactor = 1 - (clouds / 100);
                const dayProgress = (now - sunrise) / (sunset - sunrise); // 0.0 at sunrise, 1.0 at sunset
                const solarElevation = Math.sin(dayProgress * Math.PI);   // peaks at 1.0 at solar noon
                light = Math.round(80000 * solarElevation * cloudFactor);
            }

            const result = { temp, light: Math.round(light), condition, clouds };

            // Cache successful result for future fallback
            lastKnownWeather = result;

            return result;

        } catch (error) {
            const isLastAttempt = attempt === MAX_RETRIES;
            const status = error.response?.status || 'NETWORK';
            const isTimeout = error.code === 'ECONNABORTED';

            console.warn(
                `⚠️ Weather API attempt ${attempt}/${MAX_RETRIES} failed ` +
                `(${isTimeout ? 'TIMEOUT' : `Status: ${status}`})`
            );

            // Don't retry on client errors (bad API key, city not found, etc.)
            if (error.response && error.response.status >= 400 && error.response.status < 500) {
                console.error(`❌ Client error ${status} — not retrying.`);
                return getFallbackData(`API error: ${status}`);
            }

            if (!isLastAttempt) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                console.log(`   ⏳ Retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }
    }

    // All retries exhausted
    return getFallbackData('All retries failed');
};

/**
 * Returns the best available fallback data.
 * Priority: Last cached result > Generated defaults.
 * @param {string} reason - Why the fallback was triggered.
 */
function getFallbackData(reason) {
    if (lastKnownWeather) {
        console.log(`🔄 Using cached weather data (Reason: ${reason})`);
        return lastKnownWeather;
    }

    console.log(`⚠️ No cache available. Using generated defaults (Reason: ${reason})`);
    return {
        temp: Math.round((20 + Math.random() * 10) * 10) / 10,
        light: Math.floor(Math.random() * 1000),
        condition: 'Clear',
        clouds: Math.floor(Math.random() * 100)
    };
}