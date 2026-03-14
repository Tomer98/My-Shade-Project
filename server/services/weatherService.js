/**
 * Weather Service
 * Fetches real-time weather data from OpenWeatherMap API and calculates
 * estimated light intensity (Lux) based on cloud cover and time of day.
 */
const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.WEATHER_API_KEY;
const CITY = process.env.WEATHER_CITY || 'Holon,IL';

/**
 * Fetches current weather and calculates light intensity.
 * Falls back to random data if the API key is missing or the request fails.
 * @returns {Promise<{temp: number, light: number, condition: string, clouds: number}>}
 */
exports.getCurrentWeather = async () => {
    try {
        if (!API_KEY) {
            console.warn("⚠️ No API Key found. Using random fallback data.");
            return getRandomData();
        }

        const url = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&units=metric&appid=${API_KEY}`;
        const response = await axios.get(url);
        const data = response.data;

        // 1. Extract real temperature and weather condition
        const temp = data.main.temp;
        const condition = data.weather && data.weather[0] ? data.weather[0].main : 'Clear';

        // 2. Smart Light Intensity (Lux) Calculation
        // The API provides cloud percentage (clouds.all) and sunrise/sunset timestamps
        const clouds = data.clouds.all; // 0-100%
        const now = Date.now() / 1000; // Current time in seconds
        const sunrise = data.sys.sunrise;
        const sunset = data.sys.sunset;

        let light = 0;

        // Check if it's daytime (between sunrise and sunset)
        if (now > sunrise && now < sunset) {
            // Base: 800 to 1200 Lux on a clear day
            // Cloud factor reduces the light intensity
            const cloudFactor = 1 - (clouds / 100); 
            light = 800 + (400 * cloudFactor); 
        } else {
            // Nighttime - minimal light (e.g., streetlights or moonlight)
            light = 10;
        }

        return { temp, light: Math.round(light), condition, clouds };

    } catch (error) {
        console.error("❌ Weather API Error:", error.message);
        return getRandomData(); // Fallback in case of network or API failure
    }
};

/**
 * Generates random weather data for fallback/testing purposes.
 * @returns {{temp: number, light: number, condition: string, clouds: number}}
 */
function getRandomData() {
    return {
        // Math.round logic ensures we return a Number and not a String (unlike toFixed)
        temp: Math.round((20 + Math.random() * 10) * 10) / 10, 
        light: Math.floor(Math.random() * 1000),
        condition: 'Clear',
        clouds: Math.floor(Math.random() * 100)
    };
}