const NodeHelper = require("node_helper");
const { google } = require("googleapis");
const { encodeQueryData, formatError } = require("./helpers");
const fs = require("fs");
const path = require("path");
const Log = require("logger");

const TOKEN_FILE_NAME = "token.json";
const CREDENTIALS_FILE_NAME = "credentials.json";

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

    _this.oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris ? redirect_uris[0] : "http://localhost:8080" // Default redirect URI
    );

    _this.oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        console.error(`${_this.name}: Error retrieving access token`, err);
        _this.sendSocketNotification("AUTH_FAILED", {
          error_type: "ERROR_TOKEN_EXCHANGE"
        });
        return;
      }
      _this.oAuth2Client.setCredentials(token);
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
      // Store the token to disk for later program executions
      fs.writeFile(
        path.join(_this.path, TOKEN_FILE_NAME),
        JSON.stringify(token),
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
      callback(_this.oAuth2Client, _this);
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

  /**
   * Check for data.error from API response
   * @param {object} request - The request object, expected to contain response.data.error
   * @returns {string | undefined} The error code in uppercase or undefined.
   */
  checkForHTTPError: function (request) {
    return request?.response?.data?.error?.toUpperCase();
  },

  startCalendarService: function (auth, _this) {
    _this.calendarService = google.calendar({ version: "v3", auth });
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

    this.calendarService.events.list(
      {
        calendarId: calendarID,
        timeMin: new Date(
          new Date().setDate(new Date().getDate() - pastDaysCount)
        ).toISOString(),
        timeMax: new Date(
          new Date().setDate(new Date().getDate() + maximumNumberOfDays)
        ).toISOString(),
        maxResults: maximumEntries,
        singleEvents: true,
        orderBy: "startTime"
      },
      (err, res) => {
        // Arrow function for callback
        if (err) {
          Log.error(
            `${this.name} Error. Could not fetch calendar: `,
            calendarID,
            formatError(err)
          );
          let errorType = NodeHelper.checkFetchError(err);
          if (errorType === "MODULE_ERROR_UNSPECIFIED") {
            errorType = this.checkForHTTPError(err) || errorType;
          }

          if (
            errorType === "INVALID_GRANT" ||
            err?.response?.status === 401 ||
            err?.message?.toLowerCase().includes("invalid_grant")
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
        } else {
          const events = res.data.items;

          Log.info(
            `${this.name}: ${events.length} events loaded for ${calendarID}`
          );
          this.broadcastEvents(events, identifier, calendarID);
        }

        this.scheduleNextCalendarFetch(
          calendarID,
          fetchInterval,
          maximumEntries,
          pastDaysCount,
          maximumNumberOfDays,
          identifier
        );
      }
    );
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
