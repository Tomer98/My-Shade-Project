/**
 * Shared utility to retrieve the Auth token for API calls.
 */
export const getAuthHeader = () => {
    try {
        const savedUser = localStorage.getItem('shade_app_user');
        if (!savedUser) return null;
        const token = JSON.parse(savedUser)?.token;
        return token ? { headers: { Authorization: `Bearer ${token}` } } : null;
    } catch (e) {
        return null;
    }
};