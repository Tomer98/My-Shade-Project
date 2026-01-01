const axios = require('axios');

const SERVER_URL = 'http://localhost:3001/api/sensors/data';
const TARGET_IDS = [2, 3, 4]; // ה-IDs של החדרים שלך

console.log('--- Scenario-Based Simulator Started ---');

// פונקציה עזר לקבלת מספר בטווח
function getRandom(min, max) {
    return (Math.random() * (max - min) + min).toFixed(1);
}

// פונקציה שמייצרת "מזג אוויר" שונה כדי להפעיל את הלוגיקה החכמה
function generateScenario(id) {
    // נגריל תרחיש (1-4)
    const scenario = Math.floor(Math.random() * 4) + 1;
    
    let temp, light;

    switch (scenario) {
        case 1: // ☀️ קיץ לוהט (אמור לסגור את התריס)
            // טמפרטורה גבוהה (29-35), שמש חזקה
            temp = getRandom(29, 35);
            light = getRandom(70, 100);
            console.log(`Room ${id}: 🔥 Summer Scenario`);
            break;

        case 2: // ❄️ חורף שמשי (אמור לפתוח לחימום פסיבי)
            // טמפרטורה נמוכה (15-21), שמש טובה
            temp = getRandom(15, 21);
            light = getRandom(65, 95);
            console.log(`Room ${id}: ❄️ Winter Sun Scenario`);
            break;

        case 3: // 😎 סינוור קיצוני (אמור לסגור מיידית)
            // טמפרטורה רגילה, אבל אור חזק מאוד
            temp = getRandom(23, 25);
            light = getRandom(91, 100); // מעל 90%
            console.log(`Room ${id}: 😎 Glare Scenario`);
            break;

        case 4: // ☁️ סתם יום נעים (לא אמור לשנות סטטוס - היסטרזיס)
            temp = getRandom(23, 25);
            light = getRandom(30, 50);
            console.log(`Room ${id}: ☁️ Neutral Scenario`);
            break;
    }

    return {
        area_id: id,
        temperature: temp,
        light_intensity: light
    };
}

async function sendData(id) {
    const fakeData = generateScenario(id);
    try {
        await axios.post(SERVER_URL, fakeData);
    } catch (error) {
        console.error(`❌ Error Room ${id}`);
    }
}

// הפעלה כל 4 שניות (קצת יותר לאט כדי שנספיק לראות את השינויים)
setInterval(() => {
    console.log('--- New Weather Cycle ---');
    TARGET_IDS.forEach(id => sendData(id));
}, 4000);