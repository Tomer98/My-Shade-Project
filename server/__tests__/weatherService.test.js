const axios = require('axios');

// Mock axios BEFORE importing the service
jest.mock('axios');

// We need to set the env var before the module loads it
process.env.WEATHER_API_KEY = 'test_fake_key';
process.env.WEATHER_CITY = 'TestCity,IL';

const weatherService = require('../services/weatherService');

describe('Weather Service - Resilience', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should return valid data on successful API call', async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                main: { temp: 28 },
                weather: [{ main: 'Clear' }],
                clouds: { all: 20 },
                sys: { sunrise: 0, sunset: Date.now() / 1000 + 3600 } // 1hr from now
            }
        });

        const result = await weatherService.getCurrentWeather();
        expect(result.temp).toBe(28);
        expect(result.condition).toBe('Clear');
        expect(result.clouds).toBe(20);
        expect(result.light).toBeGreaterThan(0);
    });

    test('should retry on failure and eventually return fallback', async () => {
        // All 3 attempts fail
        axios.get
            .mockRejectedValueOnce(new Error('timeout'))
            .mockRejectedValueOnce(new Error('timeout'))
            .mockRejectedValueOnce(new Error('timeout'));

        const result = await weatherService.getCurrentWeather();

        // Should have tried 3 times
        expect(axios.get).toHaveBeenCalledTimes(3);

        // Should still return valid fallback data
        expect(result).toHaveProperty('temp');
        expect(result).toHaveProperty('light');
        expect(result).toHaveProperty('condition');
    });

    test('should not retry on 401 (client error)', async () => {
        const error = new Error('Unauthorized');
        error.response = { status: 401 };

        axios.get.mockRejectedValueOnce(error);

        const result = await weatherService.getCurrentWeather();

        // Should NOT retry — only 1 call
        expect(axios.get).toHaveBeenCalledTimes(1);
        expect(result).toHaveProperty('temp');
    });

    test('should succeed on second retry after initial failure', async () => {
        axios.get
            .mockRejectedValueOnce(new Error('timeout'))
            .mockResolvedValueOnce({
                data: {
                    main: { temp: 22 },
                    weather: [{ main: 'Cloudy' }],
                    clouds: { all: 80 },
                    sys: { sunrise: 0, sunset: Date.now() / 1000 + 3600 }
                }
            });

        const result = await weatherService.getCurrentWeather();
        expect(axios.get).toHaveBeenCalledTimes(2);
        expect(result.temp).toBe(22);
        expect(result.condition).toBe('Cloudy');
    });
});