import { io } from "socket.io-client";

// TODO: In production, move to .env file
const SOCKET_URL = "http://localhost:3001";

// Initialize Socket connection
export const socket = io(SOCKET_URL, {
    transports: ["websocket"], // Use fastest available protocol
    autoConnect: true,         // Connect automatically on load
});