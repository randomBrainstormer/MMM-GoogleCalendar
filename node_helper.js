const NodeHelper = require("node_helper");
const { google } = require("googleapis");
const https = require("https");
const { encodeQueryData, formatError } = require("./helpers");
const fs = require("fs");
const path = require("path");
const Log = require("logger");

const TOKEN_FILE_NAME = "token.json";
const CREDENTIALS_FILE_NAME = "credentials.json";
const OAUTH_TOKEN_HOST = "oauth2.googleapis.com";
const CALENDAR_API_HOST = "www.googleapis.com";

// The recurring calendar fetch (getAccessToken/fetchCalendar below) talks to Google
// directly over Node's `https` module instead of through `googleapis`/`gaxios`.
// `gaxios` (google-auth-library's transport) only uses native `fetch` when a browser
// `window` global exists; with no `window` - i.e. `node_helper.js` running inside
// Electron's main process under `npm run start:wayland` - it falls back to the
// `node-fetch` npm package, and that combination reliably fails the OAuth token
// refresh call with "Invalid response body ... Premature close" (100% reproducible,
// confirmed identical requests succeed instantly via plain `node`/system Node outside
// Electron). Same bug independently diagnosed for MMM-GoogleSDM - see that module's
// CLAUDE.md/node_helper.js for the sibling fix. The one-time interactive auth-code
// exchange below (authenticate/authenticateWeb, only used when token.json is missing)
// still goes through `googleapis` and could hit the same issue if ever triggered.
function httpsRequestJSON(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch (err) {
          reject(new Error(`Could not parse response from ${options.host}: ${err.message}`));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(
            parsed?.error_description || parsed?.error?.message || parsed?.error || `HTTP ${res.statusCode}`
          );
          err.statusCode = res.statusCode;
          err.errorCode = typeof parsed?.error === "string" ? parsed.error : parsed?.error?.status;
          reject(err);
          return;
        }
        resolve(parsed);
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = NodeHelper.create({
  // Override start method.
  start: function () {
    Log.log("Starting node helper for: " + this.name);
    this.fetchers = [];
    this.isHelperActive = true;

    this.calendarService;
  },

  stop: function () {
    this.isHelperActive = false;
  },

  // Override socketNotificationReceived method.
  socketNotificationReceived: function (notification, payload) {
    if (notification === "MODULE_READY") {
      if (!this.calendarService) {
        if (payload.queryParams) {
          const params = new URLSearchParams(payload.queryParams);
          this.authenticateWithQueryParams(params);
        } else {
          this.authenticate();
        }
      } else {
        this.sendSocketNotification("SERVICE_READY", {});
      }
    }
    if (notification === "ADD_CALENDAR") {
      this.fetchCalendar(
        payload.calendarID,
        payload.fetchInterval,
        payload.maximumEntries,
        payload.pastDaysCount,
        payload.maximumNumberOfDays,
        payload.id
      );
    }
  },

  authenticateWithQueryParams: function (params) {
    const error = params.get("error");
    if (error) {
      this.sendSocketNotification("AUTH_FAILED", { error_type: error });
      return;
    }

    const _this = this;
    const code = params.get("code");

    fs.readFile(
      path.join(_this.path, CREDENTIALS_FILE_NAME),
      (err, content) => {
        if (err) {
          _this.sendSocketNotification("AUTH_FAILED", {
            error_type: "ERROR_LOADING_CREDENTIALS"
          });
          return console.error(
            `${_this.name}: Error loading client secret file:`,
            err
          );
        }

        let parsedCredentials;
        try {
          parsedCredentials = JSON.parse(content);
        } catch (parseError) {
          _this.sendSocketNotification("AUTH_FAILED", {
            error_type: "ERROR_PARSING_CREDENTIALS"
          });
          return console.error(
            `${_this.name}: Error parsing client secret file:`,
            parseError
          );
        }

        // Authorize a client with credentials, then call the Google Tasks API.
        _this.authenticateWeb(
          _this,
          code,
          parsedCredentials,
          _this.startCalendarService
        );
      }
    );
  },

  // replaces the old authenticate method
  authenticateWeb: function (_this, code, credentials, callback) {
    // This function now assumes `credentials` is the full parsed object
    // and the caller has ensured `credentials.installed` exists.
    if (!credentials.installed) {
      _this.sendSocketNotification("AUTH_FAILED", {
        error_type: "INVALID_CREDENTIALS_TYPE" // Or a new more specific error
      });
      console.error(
        `${_this.name}: credentials.json does not contain 'installed' key. Please use 'Desktop application' credentials.`
      );
      return;
    }
    const { client_secret, client_id, redirect_uris } = credentials.installed;

    if (!client_secret || !client_id) {
      _this.sendSocketNotification("AUTH_FAILED", {
        error_type: "WRONG_CREDENTIALS_FORMAT"
      });
      return;
    }

    // Authorization-code-for-token exchange, done over raw `https` for the same
    // reason as getAccessToken()/fetchCalendar() above: `google.auth.OAuth2#getToken()`
    // goes through gaxios, which reliably fails with "Premature close" inside
    // Electron's main process. This is the last runtime call that used to go
    // through `googleapis` - see the httpsRequestJSON comment up top, and
    // CLAUDE.md in this module's folder, for the full story.
    const redirect_uri = redirect_uris ? redirect_uris[0] : "http://localhost:8080";
    const body = new URLSearchParams({
      client_id,
      client_secret,
      code,
      grant_type: "authorization_code",
      redirect_uri
    }).toString();

    httpsRequestJSON(
      {
        host: OAUTH_TOKEN_HOST,
        path: "/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      body
    )
      .then((token) => {
        // getAccessToken() (used for every subsequent fetch) expects token.json to
        // be self-contained - client_id/client_secret stored alongside the refresh_token,
        // not just the bare token response - so it never needs credentials.json again.
        // Google only returns a refresh_token on the first consent grant (or with
        // prompt=consent); fall back to whatever is already on disk so a re-auth
        // without a fresh refresh_token doesn't wipe out a working one.
        fs.readFile(path.join(_this.path, TOKEN_FILE_NAME), (readErr, existingContent) => {
          let existing = {};
          if (!readErr) {
            try {
              existing = JSON.parse(existingContent);
            } catch (e) {
              existing = {};
            }
          }

          const toStore = {
            type: "authorized_user",
            client_id,
            client_secret,
            refresh_token: token.refresh_token || existing.refresh_token
          };

          if (!toStore.refresh_token) {
            Log.warn(`${_this.name}: Google did not return a refresh_token and none was already stored; re-auth with prompt=consent may be required.`);
          }

          fs.writeFile(
            path.join(_this.path, TOKEN_FILE_NAME),
            JSON.stringify(toStore),
            (writeFileErr) => {
              if (writeFileErr) {
                // Log the error, but don't send AUTH_FAILED here as the token was successfully retrieved.
                return console.error(
                  `${_this.name}: Error writing token file:`,
                  writeFileErr
                );
              }
              console.log(
                `${_this.name}: Token stored to`,
                path.join(_this.path, TOKEN_FILE_NAME)
              );
            }
          );

          callback(null, _this);
        });
      })
      .catch((err) => {
        console.error(`${_this.name}: Error retrieving access token`, err);
        _this.sendSocketNotification("AUTH_FAILED", {
          error_type: "ERROR_TOKEN_EXCHANGE"
        });
      });
  },

  // Authenticate oAuth credentials
  authenticate: function () {
    const _this = this;

    fs.readFile(
      path.join(_this.path, CREDENTIALS_FILE_NAME),
      (err, content) => {
        if (err) {
          _this.sendSocketNotification("AUTH_FAILED", {
            error_type: "ERROR_LOADING_CREDENTIALS"
          });
          return console.error(
            `${_this.name}: Error loading client secret file:`,
            err
          );
        }
        let parsedCredentials;
        try {
          parsedCredentials = JSON.parse(content);
        } catch (parseError) {
          _this.sendSocketNotification("AUTH_FAILED", {
            error_type: "ERROR_PARSING_CREDENTIALS"
          });
          return console.error(
            `${_this.name}: Error parsing client secret file:`,
            parseError
          );
        }
        authorize(parsedCredentials, _this.startCalendarService);
      }
    );

    function authorize(credentials, callback) {
      if (!credentials.installed) {
        _this.sendSocketNotification("AUTH_FAILED", {
          error_type: "INVALID_CREDENTIALS_TYPE"
        });
        console.error(
          `${_this.name}: credentials.json does not contain 'installed' key. Please use 'Desktop application' credentials.`
        );
        return;
      }
      const creds = credentials.installed;
      const credentialType = "installed"; // Hardcoded as we only support web now

      const { client_secret, client_id, redirect_uris } = creds;

      if (!client_secret || !client_id) {
        _this.sendSocketNotification("AUTH_FAILED", {
          error_type: "WRONG_CREDENTIALS_FORMAT"
        });
        return;
      }

      _this.oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris ? redirect_uris[0] : "http://localhost:8080" // Default redirect URI
      );

      // Check if we have previously stored a token.
      fs.readFile(path.join(_this.path, TOKEN_FILE_NAME), (err, token) => {
        if (err) {
          const redirect_uri = redirect_uris
            ? redirect_uris[0]
            : `http://localhost:8080`;

          _this.sendSocketNotification("AUTH_NEEDED", {
            url: `https://accounts.google.com/o/oauth2/v2/auth?${encodeQueryData(
              {
                scope: "https://www.googleapis.com/auth/calendar.readonly",
                access_type: "offline",
                include_granted_scopes: true,
                response_type: "code",
                state: _this.name,
                redirect_uri,
                client_id
              }
            )}`,
            credentialType // Should be "web" now
          });

          return console.log(
            // Keep this log for server-side info
            `${_this.name}: Error loading token:`,
            err,
            "Make sure you have authorized the app."
          );
        }
        _this.oAuth2Client.setCredentials(JSON.parse(token));
        _this.oAuth2Client.on("tokens", (newTokens) => {
          fs.readFile(path.join(_this.path, TOKEN_FILE_NAME), (readErr, content) => {
            if (readErr) return;
            try {
              const merged = { ...JSON.parse(content), ...newTokens };
              fs.writeFile(path.join(_this.path, TOKEN_FILE_NAME), JSON.stringify(merged), () => {});
            } catch (e) {
              Log.error(`${_this.name}: Error persisting refreshed token`, e);
            }
          });
        });
        callback(_this.oAuth2Client, _this);
      });
    }
  },

  // Reads the stored refresh token and exchanges it for a fresh access token,
  // talking to Google directly over `https` (see comment near httpsRequestJSON above).
  getAccessToken: function () {
    return new Promise((resolve, reject) => {
      fs.readFile(path.join(this.path, TOKEN_FILE_NAME), (err, content) => {
        if (err) {
          reject(err);
          return;
        }
        let token;
        try {
          token = JSON.parse(content);
        } catch (parseErr) {
          reject(parseErr);
          return;
        }

        const body = new URLSearchParams({
          client_id: token.client_id,
          client_secret: token.client_secret,
          refresh_token: token.refresh_token,
          grant_type: "refresh_token"
        }).toString();

        httpsRequestJSON(
          {
            host: OAUTH_TOKEN_HOST,
            path: "/token",
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": Buffer.byteLength(body)
            }
          },
          body
        )
          .then((res) => resolve(res.access_token))
          .catch(reject);
      });
    });
  },

  startCalendarService: function (auth, _this) {
    _this.calendarService = true;
    _this.sendSocketNotification("SERVICE_READY", {});
  },

  /**
   * Fetch calendars
   *
   * @param {string} calendarID The ID of the calendar
   * @param {number} fetchInterval How often does the calendar needs to be fetched in ms
   * @param {number} maximumEntries The maximum number of events fetched.
   * @param {number} pastDaysCount Number of past days to fetch events from.
   * @param {number} maximumNumberOfDays Number of future days to fetch events into.
   * @param {string} identifier ID of the module
   */
  fetchCalendar: function (
    calendarID,
    fetchInterval,
    maximumEntries,
    pastDaysCount,
    maximumNumberOfDays = 365,
    identifier
  ) {
    if (!this.calendarService) return;

    const queryParams = {
      timeMin: new Date(
        new Date().setDate(new Date().getDate() - pastDaysCount)
      ).toISOString(),
      timeMax: new Date(
        new Date().setDate(new Date().getDate() + maximumNumberOfDays)
      ).toISOString(),
      maxResults: maximumEntries,
      singleEvents: true,
      orderBy: "startTime"
    };

    this.getAccessToken()
      .then((accessToken) => httpsRequestJSON({
        host: CALENDAR_API_HOST,
        path: `/calendar/v3/calendars/${encodeURIComponent(calendarID)}/events?${encodeQueryData(queryParams)}`,
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` }
      }))
      .then((res) => {
        const events = res.items || [];
        Log.info(
          `${this.name}: ${events.length} events loaded for ${calendarID}`
        );
        this.broadcastEvents(events, identifier, calendarID);
      })
      .catch((err) => {
        Log.error(
          `${this.name} Error. Could not fetch calendar: `,
          calendarID,
          formatError(err)
        );
        let errorType = NodeHelper.checkFetchError(err);
        if (errorType === "MODULE_ERROR_UNSPECIFIED" && err.errorCode) {
          errorType = String(err.errorCode).toUpperCase();
        }

        if (
          err.errorCode === "invalid_grant" ||
          err.statusCode === 401 ||
          (err.message && err.message.toLowerCase().includes("invalid_grant"))
        ) {
          Log.warn(`${this.name}: Token invalid or revoked, clearing token and requesting re-auth`);
          this.calendarService = null;
          fs.unlink(path.join(this.path, TOKEN_FILE_NAME), () => {});
          this.authenticate();
          return;
        }

        // send error to module
        this.sendSocketNotification("CALENDAR_ERROR", {
          id: identifier,
          error_type: errorType
        });
      })
      .finally(() => {
        this.scheduleNextCalendarFetch(
          calendarID,
          fetchInterval,
          maximumEntries,
          pastDaysCount,
          maximumNumberOfDays,
          identifier
        );
      });
  },

  scheduleNextCalendarFetch: function (
    calendarID,
    fetchInterval,
    maximumEntries,
    pastDaysCount,
    maximumNumberOfDays,
    identifier
  ) {
    if (this.isHelperActive) {
      setTimeout(() => {
        // Arrow function for setTimeout callback
        this.fetchCalendar(
          // `this` inside arrow function correctly refers to helper instance
          calendarID,
          fetchInterval,
          maximumEntries,
          pastDaysCount,
          maximumNumberOfDays,
          identifier
        );
      }, fetchInterval);
    }
  },

  broadcastEvents: function (events, identifier, calendarID) {
    // parameters, let/const not applicable
    this.sendSocketNotification("CALENDAR_EVENTS", {
      id: identifier,
      calendarID,
      events: events
    });
  }
});
