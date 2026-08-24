/**
 * Platform bridge.
 *
 * The same components run in a browser and inside the Capacitor Android shell.
 * On the browser they use standard web APIs; in the app they use the native
 * plugins, which give proper Android permission prompts and, for the camera,
 * a real capture UI instead of a file picker.
 */
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

/**
 * Capture a photo and return it as a File ready for multipart upload.
 *
 * On the browser this is null — the caller falls back to its hidden
 * <input type="file" capture> element, which is the only way to reach the
 * camera from a web page.
 *
 * @returns {Promise<File|null>} The captured image, or null if cancelled.
 */
export const capturePhoto = async () => {
    if (!isNative()) return null;

    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

    const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        saveToGallery: false,
    });

    // The plugin hands back a URI; read it into a File so the existing upload
    // path (FormData -> multer -> S3) works without special-casing native.
    const response = await fetch(photo.webPath);
    const blob = await response.blob();

    return new File([blob], `capture-${Date.now()}.${photo.format || 'jpeg'}`, {
        type: blob.type || 'image/jpeg',
    });
};

/**
 * Read the device's current position.
 * Uses the native plugin in the app (which prompts for Android permissions)
 * and the browser API on the web.
 *
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
export const getCurrentPosition = async () => {
    if (isNative()) {
        const { Geolocation } = await import('@capacitor/geolocation');

        // Ask explicitly so the prompt appears at a moment the user expects it
        const permission = await Geolocation.requestPermissions();
        if (permission.location === 'denied') {
            throw new Error('Location permission denied');
        }

        const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
        });
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    }

    if (!navigator.geolocation) {
        throw new Error('This browser does not provide location services');
    }

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            (err) => reject(
                err.code === err.PERMISSION_DENIED
                    ? new Error('Location permission denied (HTTPS is required for GPS)')
                    : new Error('Could not read your location')
            ),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
};

/**
 * Open a URL outside the app — used to hand navigation to the maps app.
 */
export const openExternal = (url) => {
    // '_system' is honoured by the native shell; browsers treat it as a new tab
    window.open(url, isNative() ? '_system' : '_blank', 'noopener');
};
