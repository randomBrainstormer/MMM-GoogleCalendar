/**
 * Encode query params
 */
function encodeQueryData(data) {
  const ret = [];
  for (let d in data) {
    ret.push(encodeURIComponent(d) + "=" + encodeURIComponent(data[d]));
  }
  return ret.join("&");
}

function formatError(err) {
  if (err instanceof Error) {
    return `Error: ${err.name}\nMessage: ${err.message}\nStack: ${err.stack}`;
  } else if (typeof err === "object") {
    try {
      return `Non-Error Object: ${JSON.stringify(err, null, 2)}`;
    } catch (stringifyError) {
      // Just in case JSON.stringify fails (e.g., due to circular references)
      return `Non-Error Object (stringify failed): ${String(err)}`;
    }
  } else {
    // other types (e.g., strings, numbers)
    return String(err);
  }
}

module.exports = {
  encodeQueryData,
  formatError
};
