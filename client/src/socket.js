import { io } from "socket.io-client";

// הכתובת של השרת שלך (הדוקר)
const SOCKET_URL = "http://localhost:3001";

// יצירת החיבור
export const socket = io(SOCKET_URL, {
    transports: ["websocket"], // שימוש בפרוטוקול המהיר ביותר
    autoConnect: true,         // התחברות אוטומטית בעלייה
});