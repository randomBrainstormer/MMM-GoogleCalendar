const NodeHelper = require("node_helper");
const { google } = require("googleapis");
const fs = require("fs");
const Log = require("logger");

const TOKEN_PATH = "/token.json";

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
        this.authenticate();
      } else {
        this.sendSocketNotification("SERVICE_READY", {});
      }
    }
    if (notification === "ADD_CALENDAR") {
      this.fetchCalendar(
        payload.calendarID,
        payload.fetchInterval,
        payload.maximumEntries,
        payload.id
      );
    }
  },

  // Authenticate oAuth credentials
  authenticate: function () {
    var _this = this;

    fs.readFile(_this.path + "/credentials.json", (err, content) => {
      if (err) {
        _this.sendSocketNotification("AUTH_FAILED", { error_type: err });
        return console.log("Error loading client secret file:", err);
      }
      // Authorize a client with credentials, then call the Google Tasks API.
      authorize(JSON.parse(content), _this.startCalendarService);
    });

    /**
     * Create an OAuth2 client with the given credentials, and then execute the
     * given callback function.
     * @param {Object} credentials The authorization client credentials.
     * @param {function} callback The callback to call with the authorized client.
     */
    function authorize(credentials, callback) {
      const { client_secret, client_id, redirect_uris } = credentials.installed;
      _this.oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      // Check if we have previously stored a token.
      fs.readFile(_this.path + TOKEN_PATH, (err, token) => {
        if (err) {
          return console.log(
            this.name + ": Error loading token:",
            err,
            "Make sure you have authorized the app."
          );
        }
        _this.oAuth2Client.setCredentials(JSON.parse(token));
        callback(_this.oAuth2Client, _this);
      });
    }
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
   * @param {string} identifier ID of the module
   */
  fetchCalendar: function (
    calendarID,
    fetchInterval,
    maximumEntries,
    identifier
  ) {
    this.calendarService.events.list(
      {
        calendarId: calendarID,
        timeMin: new Date().toISOString(),
        maxResults: maximumEntries,
        singleEvents: true,
        orderBy: "startTime"
      },
      (err, res) => {
        if (err) {
          Log.error(
            "Calendar Error. Could not fetch calendar: ",
            calendarID,
            err
          );
          let error_type = NodeHelper.checkFetchError(err);
          this.sendSocketNotification("CALENDAR_ERROR", {
            id: identifier,
            error_type
          });
          return;
        }

        const events = res.data.items;
        Log.info(
          `${this.name}: ${events.length} events loaded for ${calendarID}`
        );
        this.broadcastEvents(events, identifier, calendarID);
        this.scheduleNextCalendarFetch(
          calendarID,
          fetchInterval,
          maximumEntries,
          identifier
        );
      }
    );
  },

  scheduleNextCalendarFetch: function (
    calendarID,
    fetchInterval,
    maximumEntries,
    identifier
  ) {
    var _this = this;
    if (this.isHelperActive) {
      setTimeout(function () {
        _this.fetchCalendar(
          calendarID,
          fetchInterval,
          maximumEntries,
          identifier
        );
      }, fetchInterval);
    }
  },

  broadcastEvents: function (events, identifier, calendarID) {
    this.sendSocketNotification("CALENDAR_EVENTS", {
      id: identifier,
      calendarID,
      events: events
    });
  }
});
