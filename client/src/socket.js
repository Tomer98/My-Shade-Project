import { io } from "socket.io-client";
import { SOCKET_URL } from './config';

// An empty SOCKET_URL means "same origin", which lets the dev-server proxy
// carry the WebSocket — required for HTTPS tunnels and plain LAN access alike.
export const socket = io(SOCKET_URL || undefined, {
    transports: ["websocket", "polling"],
    autoConnect: true,
});