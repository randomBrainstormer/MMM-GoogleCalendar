const {
  encodeQueryData,
  formatError,
  useNativeFetch,
  pickLoopbackRedirectUri,
  withDefaultPort
} = require('../helpers.js');
const { extractCode, parseArgs } = require('../authorize.js');

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

describe("pickLoopbackRedirectUri", () => {
  const FALLBACK = "http://localhost:8080";

  it("uses the loopback redirect from credentials.json as written", () => {
    expect(pickLoopbackRedirectUri(["http://localhost"], FALLBACK)).toBe(
      "http://localhost"
    );
    expect(
      pickLoopbackRedirectUri(["http://localhost:3000/oauth2callback"], FALLBACK)
    ).toBe("http://localhost:3000/oauth2callback");
  });

  it("accepts 127.0.0.1 and ::1, which local-auth used to reject", () => {
    expect(pickLoopbackRedirectUri(["http://127.0.0.1:1234"], FALLBACK)).toBe(
      "http://127.0.0.1:1234"
    );
    expect(pickLoopbackRedirectUri(["http://[::1]:1234"], FALLBACK)).toBe(
      "http://[::1]:1234"
    );
  });

  it("skips the out-of-band entries Google turned off in 2022", () => {
    expect(
      pickLoopbackRedirectUri(
        ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"],
        FALLBACK
      )
    ).toBe("http://localhost");
    expect(
      pickLoopbackRedirectUri(["urn:ietf:wg:oauth:2.0:oob:auto"], FALLBACK)
    ).toBe(FALLBACK);
  });

  it("falls back when redirect_uris is missing, empty, or non-loopback", () => {
    expect(pickLoopbackRedirectUri(undefined, FALLBACK)).toBe(FALLBACK);
    expect(pickLoopbackRedirectUri([], FALLBACK)).toBe(FALLBACK);
    expect(pickLoopbackRedirectUri(["https://example.com/cb"], FALLBACK)).toBe(
      FALLBACK
    );
    expect(pickLoopbackRedirectUri(["not a url", null, 42], FALLBACK)).toBe(
      FALLBACK
    );
  });
});

describe("useNativeFetch", () => {
  it("points the client's transporter at the built-in fetch", () => {
    const client = { transporter: {} };
    useNativeFetch(client);
    expect(typeof client.transporter.defaults.fetchImplementation).toBe(
      "function"
    );
  });

  it("preserves other transporter defaults", () => {
    const client = { transporter: { defaults: { timeout: 1 } } };
    useNativeFetch(client);
    expect(client.transporter.defaults.timeout).toBe(1);
  });

  it("tolerates a client with no transporter", () => {
    expect(() => useNativeFetch({})).not.toThrow();
    expect(() => useNativeFetch(null)).not.toThrow();
  });
});

describe("extractCode", () => {
  it("pulls the code out of a pasted redirect URL", () => {
    expect(
      extractCode("http://localhost:1234/?code=4/0AX4&scope=https://foo")
    ).toBe("4/0AX4");
  });

  it("accepts a bare code", () => {
    expect(extractCode("  4/0AX4  ")).toBe("4/0AX4");
  });

  it("returns null for empty input, and for a URL with no code", () => {
    expect(extractCode("   ")).toBeNull();
    expect(extractCode("http://localhost:1234/?error=access_denied")).toBeNull();
  });
});

describe("parseArgs", () => {
  it("defaults to no pinned port", () => {
    expect(parseArgs([])).toEqual({ port: null, help: false });
  });

  it("accepts --port and -p", () => {
    expect(parseArgs(["--port", "9999"]).port).toBe(9999);
    expect(parseArgs(["-p", "1"]).port).toBe(1);
  });

  it("rejects ports that aren't usable", () => {
    expect(() => parseArgs(["--port", "abc"])).toThrow(/between 1 and 65535/);
    expect(() => parseArgs(["--port", "0"])).toThrow(/between 1 and 65535/);
    expect(() => parseArgs(["--port", "70000"])).toThrow(/between 1 and 65535/);
    expect(() => parseArgs(["--port"])).toThrow(/between 1 and 65535/);
  });

  it("recognises --help and rejects unknown options", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(() => parseArgs(["--nope"])).toThrow(/Unknown option/);
  });
});

describe("withDefaultPort", () => {
  it("fills in MagicMirror's port for a bare localhost redirect", () => {
    // The common case: Desktop-app credentials.json ships "http://localhost",
    // which would otherwise mean port 80, where nothing is listening.
    expect(withDefaultPort("http://localhost", 8080)).toBe(
      "http://localhost:8080/"
    );
  });

  it("leaves an explicit port untouched", () => {
    expect(withDefaultPort("http://localhost:3000", 8080)).toBe(
      "http://localhost:3000/"
    );
  });

  it("preserves the path", () => {
    expect(withDefaultPort("http://localhost/oauth2callback", 8080)).toBe(
      "http://localhost:8080/oauth2callback"
    );
  });

  it("returns unparseable input unchanged", () => {
    expect(withDefaultPort("not a url", 8080)).toBe("not a url");
  });
});
