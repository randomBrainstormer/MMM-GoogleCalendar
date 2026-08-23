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

// gaxios (google-auth-library's HTTP transport) only uses the platform's built-in
// fetch when a browser `window` global exists; with no `window` - i.e. node_helper.js
// running inside MagicMirror's Electron main process, or plain `node authorize.js` -
// it falls back to the node-fetch@2 npm package. On Node 24.17.0 that path throws a
// false-positive "Premature close" (ERR_STREAM_PREMATURE_CLOSE) from an http.Agent
// keep-alive regression (nodejs/node#63989, fixed upstream in a later 24.x), which
// breaks OAuth token refresh and calendar fetches. Node's built-in fetch (undici) has
// its own connection pool and never touches http.Agent, so pointing gaxios at it via
// its documented `fetchImplementation` option (https://github.com/googleapis/gaxios#request-options)
// sidesteps the bug while keeping the whole googleapis stack intact. gaxios' own JSDoc
// for the option confirms the default: "will use the browser context if available, and
// fall back to `node-fetch` in node.js otherwise." Harmless on server-only mode and on
// unaffected Node versions. See issue #99.
const nativeFetch =
  typeof globalThis.fetch === "function"
    ? (...args) => globalThis.fetch(...args)
    : undefined;

/**
 * Route an OAuth2 client's HTTP traffic through Node's built-in fetch.
 * Both token refresh and API calls go through the client's transporter, so
 * setting it here covers everything that client is later used for.
 *
 * @param {object} oAuth2Client
 * @returns {object} the same client, for chaining
 */
function useNativeFetch(oAuth2Client) {
  if (nativeFetch && oAuth2Client && oAuth2Client.transporter) {
    oAuth2Client.transporter.defaults = oAuth2Client.transporter.defaults || {};
    oAuth2Client.transporter.defaults.fetchImplementation = nativeFetch;
  }
  return oAuth2Client;
}

// Google shut the out-of-band ("copy the code from the page") flow down in 2022:
// https://developers.googleblog.com/2022/02/making-oauth-flows-safer.html
// Credentials downloaded before then can still carry these entries, and sending one
// as redirect_uri now gets the whole authorization request rejected. Always skip them.
const OOB_REDIRECT_URIS = [
  "urn:ietf:wg:oauth:2.0:oob",
  "urn:ietf:wg:oauth:2.0:oob:auto",
  "oob"
];

/**
 * Is this a loopback address? Google allows Desktop-app clients to redirect to any
 * loopback address on any port without registering it first (RFC 8252 section 7.3):
 * https://developers.google.com/identity/protocols/oauth2/native-app
 *
 * @param {string} hostname
 * @returns {boolean}
 */
function isLoopbackHostname(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

/**
 * Pick a usable loopback redirect URI out of a credentials.json `redirect_uris`
 * array, skipping dead out-of-band entries and anything non-loopback.
 *
 * @param {string[]} redirectUris the `redirect_uris` array, possibly missing/empty
 * @param {string} fallback used when nothing in the array is usable
 * @returns {string} a redirect URI, as written in the credentials where possible
 */
function pickLoopbackRedirectUri(redirectUris, fallback) {
  if (!Array.isArray(redirectUris)) {
    return fallback;
  }

  const match = redirectUris.find((uri) => {
    if (typeof uri !== "string" || OOB_REDIRECT_URIS.includes(uri.trim())) {
      return false;
    }
    try {
      return isLoopbackHostname(new URL(uri).hostname);
    } catch (err) {
      return false;
    }
  });

  return match || fallback;
}

module.exports = {
  encodeQueryData,
  formatError,
  useNativeFetch,
  isLoopbackHostname,
  pickLoopbackRedirectUri,
  OOB_REDIRECT_URIS
};
