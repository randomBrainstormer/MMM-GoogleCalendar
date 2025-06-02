const { encodeQueryData, formatError } = require('../helpers.js');

describe('encodeQueryData', () => {
  test('should return an empty string for an empty object', () => {
    expect(encodeQueryData({})).toBe('');
  });

  test('should encode a single key/value pair', () => {
    expect(encodeQueryData({ key: 'value' })).toBe('key=value');
  });

  test('should encode multiple key/value pairs', () => {
    expect(encodeQueryData({ key1: 'value1', key2: 'value2' })).toBe('key1=value1&key2=value2');
  });

  test('should URI encode keys and values', () => {
    expect(encodeQueryData({ 'key with space': 'value with space & char' })).toBe('key%20with%20space=value%20with%20space%20%26%20char');
  });

  test('should handle numbers as values', () => {
    expect(encodeQueryData({ key: 123 })).toBe('key=123');
  });
});

describe('formatError', () => {
  test('should format an Error object', () => {
    const err = new Error('Test error message');
    err.name = 'TestError';
    // Stack trace can be variable, so we check for inclusion of name and message
    const formatted = formatError(err);
    expect(formatted).toContain('Error: TestError');
    expect(formatted).toContain('Message: Test error message');
    expect(formatted).toContain('Stack:'); // Check if 'Stack:' prefix is present
  });

  test('should format a string', () => {
    expect(formatError('This is a string error')).toBe('This is a string error');
  });

  test('should format a plain object', () => {
    const objError = { code: 500, message: 'Object error' };
    // Expect a JSON stringification of the object
    expect(formatError(objError)).toBe(`Non-Error Object: ${JSON.stringify(objError, null, 2)}`);
  });

  test('should handle null gracefully', () => {
    expect(formatError(null)).toBe('Non-Error Object: null'); // Corrected expectation
  });

  test('should handle undefined gracefully', () => {
    expect(formatError(undefined)).toBe('undefined');
  });

  test('should handle circular references in objects gracefully', () => {
    const obj = { name: 'circular' };
    obj.self = obj;
    expect(formatError(obj)).toBe('Non-Error Object (stringify failed): [object Object]');
  });
});
