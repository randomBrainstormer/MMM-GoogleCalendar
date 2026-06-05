// Mock the global Module object and its register method
const mockModule = {
  register: jest.fn((name, moduleObject) => {
    // Store the registered module object so we can access its methods
    global.MMMGoogleCalendarInstance = moduleObject;
  })
};
global.Module = mockModule;

// Mock Log and moment, as they are used in start() and other places,
// though not directly by capFirst. This prevents errors if other parts of the module
// are inadvertently touched during instantiation.
global.Log = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};
global.moment = jest.fn(() => ({
  updateLocale: jest.fn(),
  startOf: jest.fn().mockReturnThis(),
  endOf: jest.fn().mockReturnThis(),
  clone: jest.fn().mockReturnThis(),
  add: jest.fn().mockReturnThis(),
  subtract: jest.fn().mockReturnThis(),
  toDate: jest.fn().mockReturnValue(new Date(0)),
  format: jest.fn().mockReturnValue("mocked_date"),
  valueOf: jest.fn().mockReturnValue(0), // for extractCalendarDate
  calendar: jest.fn().mockReturnValue("mocked_calendar_date"),
  fromNow: jest.fn().mockReturnValue("mocked_fromNow"),
  localeData: jest.fn(() => ({ // Mock for getLocaleSpecification
      longDateFormat: jest.fn().mockReturnValue("LT")
  }))
}));
global.config = { language: 'en', timeFormat: '24' }; // Mock global config

// Now, require the module. This will execute Module.register
require('../MMM-GoogleCalendar.js');

describe('MMM-GoogleCalendar', () => {
  let GCal;

  beforeEach(() => {
    // Access the stored module instance
    GCal = global.MMMGoogleCalendarInstance;
    // Ensure a clean state for config if needed by other tests, though capFirst is simple.
    GCal.config = { ...GCal.defaults, ...global.config }; // Reset config to defaults + global mock
  });

  describe('capFirst', () => {
    test('should capitalize the first letter of a lowercase string', () => {
      expect(GCal.capFirst('hello')).toBe('Hello');
    });

    test('should return an already capitalized string as is', () => {
      expect(GCal.capFirst('World')).toBe('World');
    });

    test('should return an empty string if input is empty', () => {
      expect(GCal.capFirst('')).toBe('');
    });

    test('should capitalize a single character string', () => {
      expect(GCal.capFirst('a')).toBe('A');
    });

    test('should handle strings with leading/trailing spaces (capFirst does not trim)', () => {
      expect(GCal.capFirst(' test ')).toBe(' test '); // Corrected expectation
    });

    test('should handle strings with numbers or symbols at the beginning', () => {
      expect(GCal.capFirst('1test')).toBe('1test');
      expect(GCal.capFirst('$test')).toBe('$test');
    });
  });

  describe('extractCalendarDate', () => {
    test('parses an all-day event (date)', () => {
      expect(GCal.extractCalendarDate({ date: '2026-06-05' })).toBe(0); // mocked valueOf
    });

    test('parses a timed event (dateTime)', () => {
      expect(GCal.extractCalendarDate({ dateTime: '2026-06-05T10:00:00Z' })).toBe(0);
    });

    test('returns null for undefined without throwing (issue #27)', () => {
      expect(() => GCal.extractCalendarDate(undefined)).not.toThrow();
      expect(GCal.extractCalendarDate(undefined)).toBeNull();
    });

    test('returns null for null without throwing', () => {
      expect(GCal.extractCalendarDate(null)).toBeNull();
    });
  });

  describe('createEventList', () => {
    test('skips events missing start/end instead of aborting the whole render (issue #27)', () => {
      GCal.calendarData = {
        cal1: [
          { id: 'good', summary: 'Good', start: { dateTime: 'x' }, end: { dateTime: 'y' } },
          { id: 'cancelled', status: 'cancelled' }, // no start/end
          { id: 'good2', summary: 'Good2', start: { dateTime: 'x' }, end: { dateTime: 'y' } }
        ]
      };

      let result;
      expect(() => {
        result = GCal.createEventList();
      }).not.toThrow();

      // The malformed event is dropped, the valid ones survive.
      const ids = result.map((e) => e.id);
      expect(ids).toContain('good');
      expect(ids).toContain('good2');
      expect(ids).not.toContain('cancelled');
    });
  });

  // Add more describe blocks for other pure functions if identified
});
