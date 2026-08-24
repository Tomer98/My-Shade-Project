/**
 * Shared helpers for ranking maintenance staff when assigning a mission.
 * Used by both the mission list's inline assign dropdown and the
 * new-mission form so the two always agree on ordering and labels.
 */

/**
 * Splits a location string into comparable tokens, dropping generic words that
 * carry no locating information ("building", "room", ...). Keeps anything else
 * of length >= 2, so "Classroom 216" -> ["classroom", "216"].
 */
const GENERIC_WORDS = new Set(['building', 'bldg', 'room', 'floor', 'area', 'zone', 'the', 'and']);

const tokenize = (value) =>
    (value || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(t => t.length >= 2 && !GENERIC_WORDS.has(t));

/**
 * True when a worker's declared work area and the mission's room share any
 * meaningful token. Token matching (rather than a plain substring test) is what
 * lets "Building 216" match "Classroom 216" — they share "216" — while still
 * keeping "Building 5" and "Classroom 216" apart.
 */
export const worksInArea = (workArea, roomName) => {
    const areaTokens = tokenize(workArea);
    if (areaTokens.length === 0) return false;

    const roomTokens = new Set(tokenize(roomName));
    return areaTokens.some(t => roomTokens.has(t));
};

/**
 * Ranks candidates the way a manager would: people already working in that
 * area first, then whoever is available, then lightest workload.
 */
export const sortStaffForArea = (staff, roomName) =>
    [...staff].sort((a, b) => {
        const aLocal = worksInArea(a.work_area, roomName) ? 1 : 0;
        const bLocal = worksInArea(b.work_area, roomName) ? 1 : 0;
        if (aLocal !== bLocal) return bLocal - aLocal;

        const aFree = a.is_available ? 1 : 0;
        const bFree = b.is_available ? 1 : 0;
        if (aFree !== bFree) return bFree - aFree;

        return Number(a.open_missions || 0) - Number(b.open_missions || 0);
    });

/**
 * Renders a worker for an assign dropdown, e.g.
 * "Bob — Electrical · 2 open · in area"
 * @param {Object} s - The staff member.
 * @param {string} [roomName] - When given, flags workers based in that area.
 */
export const describeStaff = (s, roomName) => {
    const parts = [s.username];
    if (s.speciality) parts.push(s.speciality);

    let label = parts.join(' — ');
    label += s.is_available ? ` · ${s.open_missions || 0} open` : ' · unavailable';

    if (roomName && worksInArea(s.work_area, roomName)) label += ' · in area';

    return label;
};
