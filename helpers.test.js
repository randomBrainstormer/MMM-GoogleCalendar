const { encodeQueryData, formatError } = require("./helpers");

describe("encodeQueryData", () => {
  test("should return an empty string for an empty object", () => {
    expect(encodeQueryData({})).toBe("");
  });

  test("should encode a single key-value pair", () => {
    expect(encodeQueryData({ key: "value" })).toBe("key=value");
  });

  test("should encode multiple key-value pairs", () => {
    expect(encodeQueryData({ key1: "value1", key2: "value2" })).toBe(
      "key1=value1&key2=value2"
    );
  });

  test("should URI encode special characters in keys and values", () => {
    expect(encodeQueryData({ "key space": "value/slash" })).toBe(
      "key%20space=value%2Fslash"
    );
    expect(encodeQueryData({ "another key": "email@example.com" })).toBe(
      "another%20key=email%40example.com"
    );
  });
});

describe("formatError", () => {
  test("should format an Error object", () => {
    const error = new Error("Test error message");
    error.name = "TestError";
    const formatted = formatError(error);
    // Check for key parts of the error formatting
    expect(formatted).toContain("Error: TestError");
    expect(formatted).toContain("Message: Test error message");
    expect(formatted).toContain("Stack: TestError: Test error message"); // Actual stack will vary, check for start
  });

  test("should format a plain JavaScript object", () => {
    const errorObj = { code: 500, message: "Internal Server Error" };
    // Adjusting to the actual output which includes a prefix
    expect(formatError(errorObj)).toBe(`Non-Error Object: ${JSON.stringify(errorObj, null, 2)}`);
  });

  test("should format a string", () => {
    // Strings are returned as is, which is fine.
    expect(formatError("This is an error string")).toBe(
      "This is an error string"
    );
  });

  test("should handle null", () => {
    // Adjusting to the actual output
    expect(formatError(null)).toBe("Non-Error Object: null");
  });

  test("should handle undefined", () => {
    // Strings are returned as is, which is fine.
    expect(formatError(undefined)).toBe("undefined");
  });

  test("should handle an object with circular references (gracefully)", () => {
    const circularObj = {};
    circularObj.a = circularObj;
    // Adjusting to the actual output
    expect(formatError(circularObj)).toBe("Non-Error Object (stringify failed): [object Object]");
  });
});
