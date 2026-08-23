const fs = require("fs").promises;
const http = require("http");
const path = require("path");
const readline = require("readline");
const process = require("process");
const { google } = require("googleapis");
const { useNativeFetch, pickLoopbackRedirectUri } = require("./helpers");

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");
// Google accepts any loopback port for a Desktop-app client without registering it,
// so when credentials.json doesn't pin one we let the OS pick a free port.
const EPHEMERAL_PORT = 0;

const USAGE = `Usage: node authorize.js [--port <number>]

Authorizes this module against your Google account and writes token.json.

  --port <number>  Listen on this exact port instead of one chosen at random.
                   Use it with an SSH tunnel so authorization completes without
                   copying anything by hand:

                     ssh -L 9999:localhost:9999 pi@your-mirror
                     node authorize.js --port 9999

                   Then open the printed URL in a browser on your own machine.
  --help           Show this message.
`;

/**
 * @param {string[]} argv
 * @return {{port: number|null, help: boolean}}
 */
function parseArgs(argv) {
  const args = { port: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--port" || arg === "-p") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1 || value > 65535) {
        throw new Error(`--port needs a number between 1 and 65535.`);
      }
      args.port = value;
    } else {
      throw new Error(`Unknown option "${arg}".\n\n${USAGE}`);
    }
  }
  return args;
}

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  let content;
  try {
    content = await fs.readFile(TOKEN_PATH);
  } catch (err) {
    if (err.code === "ENOENT") {
      // Expected on a first run, or after deleting token.json to re-authorize.
      return null;
    }
    throw err;
  }

  try {
    return useNativeFetch(google.auth.fromJSON(JSON.parse(content)));
  } catch (err) {
    console.error(
      `MMM-GoogleCalendar: ${TOKEN_PATH} exists but could not be read.`,
      "Delete it and run this script again to re-authorize.\n",
      err
    );
    return null;
  }
}

/**
 * Reads and validates credentials.json.
 *
 * @return {Promise<object>} the `installed` section of the key file
 */
async function loadClientSecrets() {
  let keys;
  try {
    keys = JSON.parse(await fs.readFile(CREDENTIALS_PATH));
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `Could not find ${CREDENTIALS_PATH}.\n` +
          "Download the OAuth client credentials for a *Desktop app* from the Google\n" +
          "Cloud Console, rename the file to credentials.json, and put it in this folder."
      );
    }
    throw new Error(`Could not read ${CREDENTIALS_PATH}: ${err.message}`);
  }

  const key = keys.installed;
  if (!key) {
    throw new Error(
      `${CREDENTIALS_PATH} has no "installed" section.\n` +
        'This module only supports the "Desktop app" credential type. Create new\n' +
        "credentials in the Google Cloud Console and pick Desktop app as the type."
    );
  }
  if (!key.client_id || !key.client_secret) {
    throw new Error(
      `${CREDENTIALS_PATH} is missing client_id or client_secret. Re-download it.`
    );
  }
  return key;
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * The `type`/`client_id`/`client_secret`/`refresh_token` quartet is what
 * google.auth.fromJSON expects; the raw token fields alongside it are what
 * node_helper.js's setCredentials() call uses. Writing both keeps a token
 * minted here usable by the module and vice versa.
 *
 * @param {object} key the `installed` section of credentials.json
 * @param {object} tokens the token set returned by Google
 * @return {Promise<void>}
 */
async function saveCredentials(key, tokens) {
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    ...tokens
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Pulls the authorization code out of whatever the user pasted - either the full
 * redirect URL copied from the browser's address bar, or the bare code.
 *
 * @param {string} input
 * @return {string|null}
 */
function extractCode(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(trimmed).searchParams.get("code");
  } catch (err) {
    // Not a URL, so assume the user pasted just the code.
    return trimmed;
  }
}

/**
 * Starts the loopback listener that catches Google's redirect.
 *
 * Google redirects to a loopback address; when the browser runs on this machine we
 * can catch the code automatically. Binding can fail (credentials.json asking for
 * port 80 as a non-root user, or a port already in use) - that's non-fatal, since
 * the paste-the-URL path below works without a listener.
 *
 * @param {number} port
 * @param {function(string): void} onCode
 * @param {function(Error): void} onError
 * @return {Promise<{server: http.Server|null, port: number}>}
 */
function startLoopbackListener(port, onCode, onError, strict = false) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let code;
      try {
        code = new URL(req.url, "http://localhost").searchParams.get("code");
      } catch (err) {
        code = null;
      }

      if (!code) {
        res.end("No authorization code in this request.");
        return;
      }

      res.end(
        "MMM-GoogleCalendar: authorization received. You can close this tab and return to the terminal."
      );
      onCode(code);
    });

    server.on("error", (err) => {
      if (strict) {
        // The user pinned this port, most likely to match an SSH tunnel. Moving
        // to another one would quietly break that, so fail loudly instead.
        reject(
          new Error(
            `Could not listen on port ${port}: ${err.message}\n` +
              "Pick a free port, or drop --port to let one be chosen automatically."
          )
        );
        return;
      }
      if (port !== EPHEMERAL_PORT) {
        // Retry on a port the OS picks for us - Google allows any loopback port.
        startLoopbackListener(EPHEMERAL_PORT, onCode, onError).then(resolve);
        return;
      }
      onError(err);
      resolve({ server: null, port: EPHEMERAL_PORT });
    });

    server.listen(port, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

/**
 * Load, or request, authorization to call APIs.
 */
async function authorize({ port: requestedPortOverride = null } = {}) {
  const existing = await loadSavedCredentialsIfExist();
  if (existing) {
    console.log(
      `MMM-GoogleCalendar: already authorized (${TOKEN_PATH}).`,
      "Delete that file and run this script again to re-authorize."
    );
    return existing;
  }

  const key = await loadClientSecrets();

  // Where Google should send the browser after the user consents. Desktop-app
  // credentials normally carry "http://localhost"; anything non-loopback or
  // out-of-band is unusable, so fall back to a loopback address of our own.
  const configuredRedirect = pickLoopbackRedirectUri(
    key.redirect_uris,
    "http://localhost"
  );
  const redirectUrl = new URL(configuredRedirect);
  const requestedPort =
    requestedPortOverride ||
    (redirectUrl.port ? Number(redirectUrl.port) : EPHEMERAL_PORT);

  let resolveCode;
  let rejectFlow;
  const codePromise = new Promise((resolve, reject) => {
    resolveCode = resolve;
    rejectFlow = reject;
  });

  const { server, port } = await startLoopbackListener(
    requestedPort,
    resolveCode,
    () => {
      console.log(
        "MMM-GoogleCalendar: could not open a local listener, so the browser",
        "redirect can't be caught automatically. Use the copy/paste step below."
      );
    },
    requestedPortOverride !== null
  );

  redirectUrl.port = String(port);
  const redirectUri = redirectUrl.toString();

  const oAuth2Client = useNativeFetch(
    new google.auth.OAuth2(key.client_id, key.client_secret, redirectUri)
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    // Without this Google omits the refresh token on every consent after the
    // first, leaving a token.json the module can't refresh.
    prompt: "consent"
  });

  console.log(
    [
      "",
      "MMM-GoogleCalendar: open this URL to authorize the module.",
      "You can open it on any device - your phone or laptop is fine.",
      "",
      authUrl,
      "",
      "After you grant access your browser is sent to a localhost address. That page",
      "may well fail to load - that is expected and harmless. Copy the full URL out",
      "of the address bar and paste it here, then press Enter.",
      ""
    ].join("\n")
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question("Paste the URL (or just the code) here: ", (answer) => {
    const code = extractCode(answer);
    if (code) {
      resolveCode(code);
    } else {
      rejectFlow(new Error("No authorization code found in that input."));
    }
  });

  // No interactive stdin (a non-interactive shell, `docker exec` without -i, a
  // service manager). The local listener can still finish the job, but if that
  // failed to bind there is nothing left to wait for, so say so instead of hanging.
  rl.on("close", () => {
    if (!server) {
      rejectFlow(
        new Error(
          "Nothing to read the authorization code from: this terminal has no\n" +
            "interactive input and the local listener could not start. Run this\n" +
            "script from an interactive shell (for example `docker exec -it ...`)."
        )
      );
    }
  });

  let code;
  try {
    // Whichever arrives first wins: the local listener catching the redirect, or
    // the user pasting the URL back in.
    code = await codePromise;
  } finally {
    rl.close();
    if (server) {
      server.close();
    }
  }

  let tokens;
  try {
    ({ tokens } = await oAuth2Client.getToken({
      code,
      redirect_uri: redirectUri
    }));
  } catch (err) {
    throw new Error(
      `Google rejected the authorization code: ${err.message}\n` +
        "Common causes: the code was already used or has expired (they are\n" +
        "single-use and short-lived, so get a fresh one by running this script\n" +
        "again), credentials.json belongs to a different Google Cloud project,\n" +
        "or this device's clock is wrong."
    );
  }
  oAuth2Client.setCredentials(tokens);

  if (!tokens.refresh_token) {
    console.warn(
      "MMM-GoogleCalendar: Google did not return a refresh token, so the module",
      "will lose access when this one expires. Revoke the module's access at",
      "https://myaccount.google.com/permissions and run this script again."
    );
  }

  await saveCredentials(key, tokens);
  console.log(`MMM-GoogleCalendar: token stored to ${TOKEN_PATH}`);
  return oAuth2Client;
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listEvents(auth) {
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: "startTime"
  });
  const events = res.data.items;
  if (!events || events.length === 0) {
    console.log("MMM-GoogleCalendar: No upcoming events found.");
    return;
  }
  console.log("MMM-GoogleCalendar: Upcoming 10 events:");
  events.map((event) => {
    const start = event.start.dateTime || event.start.date;
    console.log(`${start} - ${event.summary}`);
  });
}

if (require.main === module) {
  Promise.resolve()
    .then(() => {
      const args = parseArgs(process.argv.slice(2));
      if (args.help) {
        console.log(USAGE);
        return null;
      }
      return authorize(args).then(listEvents);
    })
    .catch((err) => {
      console.error(`\nMMM-GoogleCalendar: ${err.message}`);
      process.exitCode = 1;
    });
}

module.exports = { extractCode, loadClientSecrets, saveCredentials, parseArgs };
