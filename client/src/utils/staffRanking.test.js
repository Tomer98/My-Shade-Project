/**
 * Unit tests for staff ranking.
 * Run with: npx vitest run  (or copy into the server suite to run under Jest)
 */
import { describe, test, expect } from 'vitest';
import { worksInArea, sortStaffForArea, describeStaff } from './staffRanking';

describe('worksInArea', () => {
    test('matches on a shared number token', () => {
        // The case that failed in manual testing
        expect(worksInArea('building 216', 'Classroom 216')).toBe(true);
    });

    test('matches on a shared word token', () => {
        expect(worksInArea('Auditorium', 'Main Auditorium')).toBe(true);
    });

    test('does not match unrelated areas', () => {
        expect(worksInArea('Building 5', 'Classroom 216')).toBe(false);
    });

    test('generic words alone never match', () => {
        // Both contain "building", but that carries no locating information
        expect(worksInArea('building', 'building 7')).toBe(false);
    });

    test('empty or missing work area never matches', () => {
        expect(worksInArea('', 'Classroom 216')).toBe(false);
        expect(worksInArea(null, 'Classroom 216')).toBe(false);
    });
});

describe('sortStaffForArea', () => {
    const room = 'Classroom 216';

    test('area match outranks a lighter workload', () => {
        const staff = [
            { id: 1, username: 'Idle', work_area: 'Building 5', is_available: 1, open_missions: 0 },
            { id: 2, username: 'Local', work_area: 'building 216', is_available: 1, open_missions: 9 },
        ];
        expect(sortStaffForArea(staff, room)[0].username).toBe('Local');
    });

    test('availability outranks workload when neither is local', () => {
        const staff = [
            { id: 1, username: 'Busy', work_area: null, is_available: 0, open_missions: 0 },
            { id: 2, username: 'Free', work_area: null, is_available: 1, open_missions: 5 },
        ];
        expect(sortStaffForArea(staff, room)[0].username).toBe('Free');
    });

    test('falls back to lightest workload', () => {
        const staff = [
            { id: 1, username: 'Heavy', work_area: null, is_available: 1, open_missions: 4 },
            { id: 2, username: 'Light', work_area: null, is_available: 1, open_missions: 1 },
        ];
        expect(sortStaffForArea(staff, room)[0].username).toBe('Light');
    });

    test('does not mutate the input array', () => {
        const staff = [
            { id: 1, username: 'A', work_area: null, is_available: 1, open_missions: 5 },
            { id: 2, username: 'B', work_area: null, is_available: 1, open_missions: 1 },
        ];
        const original = [...staff];
        sortStaffForArea(staff, room);
        expect(staff).toEqual(original);
    });
});

describe('describeStaff', () => {
    test('shows speciality and workload', () => {
        const s = { username: 'Bob', speciality: 'Electrical', is_available: 1, open_missions: 2 };
        expect(describeStaff(s)).toBe('Bob — Electrical · 2 open');
    });

    test('flags unavailability instead of workload', () => {
        const s = { username: 'Bob', speciality: null, is_available: 0, open_missions: 2 };
        expect(describeStaff(s)).toBe('Bob · unavailable');
    });

    test('flags a worker based in the mission area', () => {
        const s = { username: 'Bob', speciality: null, work_area: 'building 216', is_available: 1, open_missions: 0 };
        expect(describeStaff(s, 'Classroom 216')).toBe('Bob · 0 open · in area');
    });
});
