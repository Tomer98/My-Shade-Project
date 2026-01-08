const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.WEATHER_API_KEY;
const CITY = process.env.WEATHER_CITY || 'Holon,IL';

exports.getCurrentWeather = async () => {
    try {
        if (!API_KEY) {
            console.warn("⚠️ No API Key found. Using random data.");
            return getRandomData();
        }

        const url = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&units=metric&appid=${API_KEY}`;
        const response = await axios.get(url);
        const data = response.data;

        // 1. שליפת הטמפרטורה האמיתית
        const temp = data.main.temp;

        // 2. חישוב חכם של עוצמת האור (Lux)
        // ה-API נותן אחוז עננים (clouds.all) ושעת זריחה/שקיעה
        const clouds = data.clouds.all; // 0-100%
        const now = Date.now() / 1000; // זמן נוכחי בשניות
        const sunrise = data.sys.sunrise;
        const sunset = data.sys.sunset;

        let light = 0;

        // אם עכשיו יום (בין זריחה לשקיעה)
        if (now > sunrise && now < sunset) {
            // בסיס: 1000 לוקס ביום בהיר
            // כל אחוז עננים מוריד את האור
            const cloudFactor = 1 - (clouds / 100); 
            light = 800 + (400 * cloudFactor); // תוצאה בין 800 ל-1200
        } else {
            // לילה - חושך (או תאורת רחוב מינימלית)
            light = 10;
        }

        console.log(`🌍 Real Weather fetched for ${CITY}: ${temp}°C, Clouds: ${clouds}%, Calc Light: ${light.toFixed(0)}lx`);

        return { temp, light: Math.round(light) };

    } catch (error) {
        console.error("❌ Weather API Error:", error.message);
        return getRandomData(); // גיבוי למקרה של תקלה
    }
};

// פונקציית גיבוי (למקרה שהאינטרנט נופל)
function getRandomData() {
    return {
        temp: (20 + Math.random() * 10).toFixed(1),
        light: Math.floor(Math.random() * 1000)
    };
}