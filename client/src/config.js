/**
 * Central configuration for client-side API endpoints.
 * Values are loaded from the .env file at build time by Vite.
 *
 * Web builds use relative paths ("/api"), which the Vite dev server proxies to
 * the backend — that keeps the API on the page's origin so it works on
 * localhost, over the LAN, and through an HTTPS tunnel alike.
 *
 * The Android build has no such proxy: the page is served from inside the app,
 * so the API must be an absolute URL. Build it with `npm run build:android`,
 * which loads .env.android (see .env.android.example).
 */
import { Capacitor } from '@capacitor/core';

export const API_BASE_URL = import.meta.env.VITE_API_URL;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

// A relative URL inside the native shell resolves to the WebView itself and
// every request fails. Fail loudly at startup rather than one call at a time.
if (Capacitor.isNativePlatform() && !/^https?:\/\//i.test(API_BASE_URL || '')) {
    console.error(
        `[config] VITE_API_URL is "${API_BASE_URL}", which cannot work in the ` +
        'Android app. Set it to the server\'s absolute URL in .env.android ' +
        'and rebuild with: npm run build:android'
    );
}
