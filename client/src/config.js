/**
 * Central configuration for client-side API endpoints.
 * Values are loaded from the .env file at build time by Vite.
 * For production, set VITE_API_URL and VITE_SOCKET_URL in the deployment environment.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;