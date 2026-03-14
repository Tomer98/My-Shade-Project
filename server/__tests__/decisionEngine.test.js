const { calculateShadeAction } = require('../services/decisionEngine');

describe('Decision Engine - calculateShadeAction', () => {

    // === Extreme Weather Tests ===
    
    describe('Extreme Conditions', () => {
        test('should CLOSE for Storm', () => {
            const result = calculateShadeAction(25, 500, 'Storm');
            expect(result.actionType).toBe('STORM');
            expect(result.score).toBe(1.0);
        });

        test('should CLOSE for Rain', () => {
            const result = calculateShadeAction(25, 500, 'Rain');
            expect(result.actionType).toBe('STORM');
        });

        test('should CLOSE for extreme heat (>=35°C)', () => {
            const result = calculateShadeAction(40, 500, 'Clear');
            expect(result.actionType).toBe('EXTREME_HEAT');
            expect(result.score).toBe(1.0);
        });

        test('should CLOSE for extreme cold (<=10°C)', () => {
            const result = calculateShadeAction(5, 500, 'Clear');
            expect(result.actionType).toBe('EXTREME_COLD');
            expect(result.score).toBe(1.0);
        });
    });

    // === Standard Calculation Tests ===

    describe('Standard Scoring', () => {
        test('should return OPENED for cool temp + low light', () => {
            const result = calculateShadeAction(20, 0, 'Clear');
            expect(result.actionType).toBe('OPENED');
            expect(result.score).toBeLessThanOrEqual(0.05);
        });

        test('should return AUTO for moderate conditions', () => {
            const result = calculateShadeAction(27, 3000, 'Clear');
            expect(result.actionType).toBe('AUTO');
            expect(result.score).toBeGreaterThan(0.05);
            expect(result.score).toBeLessThan(0.95);
        });

        test('should return higher score for hotter temperatures', () => {
            const cool = calculateShadeAction(22, 3000, 'Clear');
            const hot = calculateShadeAction(33, 3000, 'Clear');
            expect(hot.score).toBeGreaterThan(cool.score);
        });

        test('should return higher score for brighter light', () => {
            const dim = calculateShadeAction(25, 1000, 'Clear');
            const bright = calculateShadeAction(25, 9000, 'Clear');
            expect(bright.score).toBeGreaterThan(dim.score);
        });

        test('score should always be between 0 and 1', () => {
            const result = calculateShadeAction(27, 5000, 'Clear');
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(1);
        });
    });

    // === Edge Cases ===

    describe('Edge Cases', () => {
        test('should handle exactly 35°C as EXTREME_HEAT', () => {
            const result = calculateShadeAction(35, 500, 'Clear');
            expect(result.actionType).toBe('EXTREME_HEAT');
        });

        test('should handle exactly 10°C as EXTREME_COLD', () => {
            const result = calculateShadeAction(10, 500, 'Clear');
            expect(result.actionType).toBe('EXTREME_COLD');
        });

        test('should handle 0 light gracefully', () => {
            const result = calculateShadeAction(25, 0, 'Clear');
            expect(result.score).toBeGreaterThanOrEqual(0);
        });

        test('should handle negative temperatures', () => {
            const result = calculateShadeAction(-10, 500, 'Clear');
            expect(result.actionType).toBe('EXTREME_COLD');
        });
    });
});