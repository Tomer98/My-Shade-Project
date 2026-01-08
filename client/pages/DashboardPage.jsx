import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SmartDashboard from './SmartDashboard'; // המוח המדעי
import AlertsSystem from './AlertsSystem';     // המערכת שלך (העתק אותה לפרויקט)

const DashboardPage = () => {
  // נניח שיש לנו משתמש מחובר (במערכת מלאה זה יגיע מ-Context או LocalStorage)
  // שנה את ה-role ל-'admin' כדי לראות את כל הכפתורים במערכת שלך!
  const [user, setUser] = useState({ id: 1, username: 'Current User', role: 'admin' }); 
  
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  // משיכת רשימת האזורים (כי AlertsSystem שלך צריך את זה ל-Select Box)
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/areas');
        // וודא שהשרת מחזיר מערך. אם זה עטוף ב-{data: [...]}, תשנה בהתאם
        setAreas(res.data.data || res.data); 
      } catch (err) {
        console.error("Failed to load areas");
      } finally {
        setLoading(false);
      }
    };

    fetchAreas();
  }, []);

  if (loading) return <div className="p-10 text-center">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-bold text-gray-800">Shade Control System</h1>
           <p className="text-gray-500">Holon Institute of Technology (HIT)</p>
        </div>
        <div className="text-right">
            <span className="bg-blue-600 text-white px-4 py-2 rounded shadow">
                Hello, {user.username} ({user.role})
            </span>
        </div>
      </header>

      {/* חלק 1: הבסיס המדעי (חובה להגשה) */}
      <section className="mb-10">
        <SmartDashboard />
      </section>

      {/* חלק 2: ניהול ותקלות (הקוד המעולה שלך) */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-gray-800 border-l-4 border-blue-500 pl-3">
            Maintenance & Alerts Center
        </h2>
        {/* אנחנו מעבירים לקומפוננטה שלך את מה שהיא צריכה */}
        <AlertsSystem user={user} areas={areas} />
      </section>

    </div>
  );
};

export default DashboardPage;