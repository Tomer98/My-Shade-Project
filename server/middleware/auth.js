const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  // קבלת הטוקן (תמיכה בכל סוגי הכותרות)
  let token = req.headers['authorization'] || req.headers['x-access-token'];

  // אם אין טוקן בכלל
  if (!token) {
    return res.status(403).send("A token is required for authentication");
  }

  try {
    // ניקוי המילה "Bearer " בצורה בטוחה
    if (token.startsWith('Bearer ')) {
        token = token.slice(7).trim(); // שינוי ל-trim() למניעת קריסות
    }

    // מפתח גיבוי למקרה ש-.env לא נטען בדוקר
    const secretKey = process.env.JWT_SECRET || "my_secret_key";
    
    // אימות
    const decoded = jwt.verify(token, secretKey);
    req.user = decoded;

  } catch (err) {
    console.log("⚠️ Token Error:", err.message);
    return res.status(401).send("Invalid Token");
  }
  
  return next();
};

const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
        return res.status(401).send("User not authenticated");
    }
    
    // הגנה מקריסה אם למשתמש אין תפקיד מוגדר
    const userRole = req.user.role || 'user';
    
    if (!allowedRoles.includes(userRole)) {
      console.log(`⛔ Access denied. User role: ${userRole}, Required: ${allowedRoles}`);
      return res.status(403).send("Access denied");
    }
    next();
  };
};

module.exports = { verifyToken, checkRole };