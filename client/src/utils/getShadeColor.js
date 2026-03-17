/**
 * Determines the visual color representation based on the shade's current position.
 * @param {number|string} position - The current closure percentage (0-100).
 * @returns {string} Hex color code (Green for open, Orange for partial, Red for closed).
 */
export const getShadeColor = (position) => {
    // Parse safely to integer, default to 0 if invalid
    const pos = parseInt(position, 10) || 0;
    
    if (pos < 30) return '#2ecc71'; // Green (Mostly Open)
    if (pos < 70) return '#f39c12'; // Orange (Partially Closed)
    return '#e74c3c'; // Red (Mostly Closed)
};