const cron = require('node-cron');
const db = require('./config/db');

const initScheduler = () => {
    console.log('⏰ Intelligent Scheduler is initialized and running...');

    // רץ כל דקה
    cron.schedule('* * * * *', async () => {
        
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        
        try {
            // 1. שליפת משימות
            const [tasks] = await db.query(
                `SELECT s.*, a.last_manual_change, a.room 
                 FROM schedules s
                 JOIN areas a ON s.area_id = a.id
                 WHERE s.execution_time = ? AND s.is_active = TRUE`, 
                [currentTime]
            );

            if (tasks.length === 0) return;

            console.log(`🔎 Found ${tasks.length} tasks for ${currentTime}`);

            for (const task of tasks) {
                // --- בדיקת Override (האם נגעו ידנית?) ---
                let shouldExecute = true;

                if (task.last_manual_change) {
                    const lastChange = new Date(task.last_manual_change);
                    const diffMinutes = (now - lastChange) / 1000 / 60; 

                    if (diffMinutes < 60) {
                        console.log(`✋ Skipping schedule for ${task.room}: Manual override detected (${Math.round(diffMinutes)} min ago)`);
                        shouldExecute = false;
                    }
                }

                if (shouldExecute) {
                    console.log(`🚀 Executing schedule for ${task.room}: ${task.action_type}`);
                    
                    // 2. ביצוע הפעולה (עדכון החדר)
                    await db.query(
                        'UPDATE areas SET shade_state = "AUTO", current_position = ? WHERE id = ?',
                        [task.target_position, task.area_id]
                    );

                    // 3. --- התיקון: רישום בטבלת ההיסטוריה ---
                    // אנחנו מכניסים "קריאת חיישן" מלאכותית כדי שהאתר יתעדכן
                    await db.query(
                        `INSERT INTO sensor_readings (area_id, temperature, light_intensity, current_position)
                         VALUES (?, 24, 50, ?)`, // (טמפ' ואור פיקטיביים, העיקר המיקום)
                        [task.area_id, task.target_position]
                    );
                    
                    console.log(`📝 Log entry added for ${task.room}`);
                }
            }

        } catch (error) {
            console.error('Scheduler Error:', error);
        }
    });
};

module.exports = initScheduler;