// משקלים לאלגוריתם (Scientific Basis)
const W_TEMP = 0.6; // 60% משקל לטמפרטורה
const W_LIGHT = 0.4; // 40% משקל לאור

/**
 * מחשב החלטה על בסיס נתונים סביבתיים
 */
const calculateShadeAction = (temp, light, weatherCondition) => {
    // 1. Safety Override (בטיחות קודמת להכל)
    if (weatherCondition === 'Storm' || weatherCondition === 'Rain') {
        return { 
            action: 'CLOSE', 
            reason: 'Safety Override: Storm/Rain detected', 
            score: 1.0 
        };
    }

    // 2. נרמול נתונים (בין 0 ל-1)
    // מניחים ש-35 מעלות זה המקסימום, ו-1000 לוקס זה סינוור
    const normTemp = Math.min(temp / 35, 1); 
    const normLight = Math.min(light / 1000, 1);

    // 3. חישוב הציון המשוקלל (The Weighted Score)
    const comfortScore = (normTemp * W_TEMP) + (normLight * W_LIGHT);

    // 4. קבלת החלטה
    if (comfortScore > 0.7) {
        return { action: 'CLOSE', reason: `High Heat/Glare Score: ${comfortScore.toFixed(2)}`, score: comfortScore };
    } else {
        return { action: 'OPEN', reason: `Optimal Conditions Score: ${comfortScore.toFixed(2)}`, score: comfortScore };
    }
};

module.exports = { calculateShadeAction };