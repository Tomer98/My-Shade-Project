/**
 * Weather Service
 * Fetches real-time weather data from OpenWeatherMap API.
 * Includes retry with exponential backoff, timeout, graceful fallback, and TTL caching.
 */
const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.WEATHER_API_KEY;
const CITY = process.env.WEATHER_CITY || 'Holon,IL';

// --- Resilience Configuration ---
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;   // 1s, 2s, 4s (exponential)
const REQUEST_TIMEOUT_MS = 5000; // 5 second timeout per attempt

// --- Cache Configuration ---
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes — matches OpenWeatherMap update frequency

// Fallback cache: last successful result used during outages
let lastKnownWeather = null;

// TTL cache: raw API fields stored to avoid redundant network calls
let weatherCache = null; // { temp, condition, clouds, sunrise, sunset, fetchedAt }

/**
 * Sleep utility for delays between retries.
 * @param {number} ms - Milliseconds to wait.
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculates estimated lux from cached raw API data and the current time.
 * Called on every request so light stays accurate even when API data is cached.
 * @param {{ sunrise: number, sunset: number, clouds: number }} raw
 * @returns {number} Estimated lux value.
 */
const calculateLight = ({ sunrise, sunset, clouds }) => {
    const now = Date.now() / 1000;
    if (now <= sunrise || now >= sunset) return 10; // nighttime
    const cloudFactor = 1 - (clouds / 100);
    const dayProgress = (now - sunrise) / (sunset - sunrise);
    const solarElevation = Math.sin(dayProgress * Math.PI);
    return Math.round(80000 * solarElevation * cloudFactor);
};

/**
 * Fetches current weather with TTL caching, retry logic, and exponential backoff.
 * API is only called when the cache is stale (older than 10 minutes).
 * Light is recalculated on every call to reflect real-time sun position.
 *
 * @returns {Promise<{temp: number, light: number, condition: string, clouds: number}>}
 */
exports.getCurrentWeather = async () => {
    if (!API_KEY) {
        console.warn("⚠️ No WEATHER_API_KEY found. Using fallback data.");
        return getFallbackData('No API key configured');
    }

    // Return cached data with freshly calculated light if cache is still valid
    if (weatherCache && (Date.now() - weatherCache.fetchedAt) < CACHE_TTL_MS) {
        const light = calculateLight(weatherCache);
        return { temp: weatherCache.temp, light, condition: weatherCache.condition, clouds: weatherCache.clouds };
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&units=metric&appid=${API_KEY}`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
            const data = response.data;

            const temp = data.main.temp;
            const condition = data.weather?.[0]?.main || 'Clear';
            const clouds = data.clouds.all;
            const sunrise = data.sys.sunrise;
            const sunset = data.sys.sunset;

            // Store raw fields in TTL cache
            weatherCache = { temp, condition, clouds, sunrise, sunset, fetchedAt: Date.now() };

            const light = calculateLight(weatherCache);
            const result = { temp, light, condition, clouds };

            // Update fallback cache
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
                await sleep(delay);
            }
        }
    }

    // All retries exhausted
    return getFallbackData('All retries failed');
};

/**
 * Clears the TTL cache. Used in tests to force a fresh API call.
 */
exports.clearCache = () => {
    weatherCache = null;
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
