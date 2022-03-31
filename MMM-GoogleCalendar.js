/* Magic Mirror
 * Module: MMM-GoogleCalendar
 *
 * adaptation of MM default calendar module for Google Calendar events
 * MIT Licensed.
 */
Module.register("MMM-GoogleCalendar", {
  // Define module defaults
  defaults: {
    maximumEntries: 10, // Total Maximum Entries
    maximumNumberOfDays: 365,
    limitDays: 0, // Limit the number of days shown, 0 = no limit
    displaySymbol: true,
    defaultSymbol: "calendar", // Fontawesome Symbol see https://fontawesome.com/cheatsheet?from=io
    showLocation: false,
    displayRepeatingCountTitle: false,
    defaultRepeatingCountTitle: "",
    maxTitleLength: 25,
    maxLocationTitleLength: 25,
    wrapEvents: false, // wrap events to multiple lines breaking at maxTitleLength
    wrapLocationEvents: false,
    maxTitleLines: 3,
    maxEventTitleLines: 3,
    fetchInterval: 5 * 60 * 1000, // Update every 5 minutes.
    animationSpeed: 2000,
    fade: true,
    urgency: 7,
    timeFormat: "relative",
    dateFormat: "MMM Do",
    dateEndFormat: "LT",
    fullDayEventDateFormat: "MMM Do",
    showEnd: false,
    getRelative: 6,
    fadePoint: 0.25, // Start on 1/4th of the list.
    hidePrivate: false,
    hideOngoing: false,
    hideTime: false,
    colored: false,
    coloredSymbolOnly: false,
    customEvents: [], // Array of {keyword: "", symbol: "", color: ""} where Keyword is a regexp and symbol/color are to be applied for matched
    tableClass: "small",
    calendars: [
      {
        symbol: "calendar",
        url: "https://www.calendarlabs.com/templates/ical/US-Holidays.ics"
      }
    ],
    titleReplace: {
      "De verjaardag van ": "",
      "'s birthday": ""
    },
    locationTitleReplace: {
      "street ": ""
    },
    broadcastEvents: false,
    excludedEvents: [],
    sliceMultiDayEvents: false,
    nextDaysRelative: false
  },

  requiresVersion: "2.1.0",

  // Define required scripts.
  getStyles: function () {
    return ["calendar.css", "font-awesome.css"];
  },

  // Define required scripts.
  getScripts: function () {
    return ["moment.js"];
  },

  // Define required translations.
  getTranslations: function () {
    return {
      en: "translations/en.json"
    };
  },

  // Override start method.
  start: function () {
    Log.info("Starting module: " + this.name);

    // Set locale.
    moment.updateLocale(
      config.language,
      this.getLocaleSpecification(config.timeFormat)
    );

    // clear data holder before start
    this.calendarData = {};

    // indicate no data available yet
    this.loaded = false;

    // check if current URL is module's auth url
    if (location.search.includes(this.name)) {
      this.sendSocketNotification("MODULE_READY", {
        queryParams: location.search
      });
    } else {
      // check user token is authenticated.
      this.sendSocketNotification("MODULE_READY");
    }
  },

  // Override socket notification handler.
  socketNotificationReceived: function (notification, payload) {
    // Authentication done before any calendar is fetched
    if (notification === "AUTH_FAILED") {
      let error_message = this.translate(payload.error_type);
      this.error = this.translate("MODULE_CONFIG_ERROR", {
        MODULE_NAME: this.name,
        ERROR: error_message
      });
      this.loaded = true;
      this.updateDom(this.config.animationSpeed);
      return;
    }

    if (notification === "AUTH_NEEDED") {
      this.error = "ERROR_AUTH_NEEDED";
      if (payload.credentialType === "web") {
        this.errorUrl = payload.url;
      }
      this.updateDom(this.config.animationSpeed);
      return;
    } else {
      // reset error URL
      this.errorUrl = null;
    }

    if (notification === "SERVICE_READY") {
      // start fetching calendars
      this.fetchCalendars();
    }

    if (this.identifier !== payload.id) {
      return;
    }

    if (notification === "CALENDAR_EVENTS") {
      if (this.hasCalendarID(payload.calendarID)) {
        this.calendarData[payload.calendarID] = payload.events;
        this.error = null;
        this.loaded = true;

        if (this.config.broadcastEvents) {
          this.broadcastEvents();
        }
      }
    } else if (notification === "CALENDAR_ERROR") {
      let error_message = this.translate(payload.error_type);
      this.error = this.translate("MODULE_CONFIG_ERROR", {
        MODULE_NAME: this.name,
        ERROR: error_message
      });
      this.loaded = true;
    }

    this.updateDom(this.config.animationSpeed);
  },

  // Override dom generator.
  getDom: function () {
    // Define second, minute, hour, and day constants
    const oneSecond = 1000; // 1,000 milliseconds
    const oneMinute = oneSecond * 60;
    const oneHour = oneMinute * 60;
    const oneDay = oneHour * 24;

    const events = this.createEventList();

    const wrapper = document.createElement("table");
    wrapper.className = this.config.tableClass;

    if (this.error) {
      // web credentials will have a WEB url
      if (this.error === "ERROR_AUTH_NEEDED" && this.errorUrl) {
        wrapper.innerHTML = `Please <a href=${this.errorUrl}>click here</a> to authorize this module.`;
      } else {
        // default to generic error
        wrapper.innerHTML = this.error;
        wrapper.className = this.config.tableClass + " dimmed";
      }
      return wrapper;
    }

    if (events.length === 0) {
      wrapper.innerHTML = this.loaded
        ? this.translate("EMPTY")
        : this.translate("LOADING");
      wrapper.className = this.config.tableClass + " dimmed";
      return wrapper;
    }

    let currentFadeStep = 0;
    let startFade;
    let fadeSteps;

    if (this.config.fade && this.config.fadePoint < 1) {
      if (this.config.fadePoint < 0) {
        this.config.fadePoint = 0;
      }
      startFade = events.length * this.config.fadePoint;
      fadeSteps = events.length - startFade;
    }

    let lastSeenDate = "";

    events.forEach((event, index) => {
      const dateAsString = moment(event.startDate).format(
        this.config.dateFormat
      );
      if (this.config.timeFormat === "dateheaders") {
        if (lastSeenDate !== dateAsString) {
          const dateRow = document.createElement("tr");
          dateRow.className = "normal";

          const dateCell = document.createElement("td");
          dateCell.colSpan = "3";
          dateCell.innerHTML = dateAsString;
          dateCell.style.paddingTop = "10px";
          dateRow.appendChild(dateCell);
          wrapper.appendChild(dateRow);

          if (this.config.fade && index >= startFade) {
            //fading
            currentFadeStep = index - startFade;
            dateRow.style.opacity = 1 - (1 / fadeSteps) * currentFadeStep;
          }

          lastSeenDate = dateAsString;
        }
      }

      const eventWrapper = document.createElement("tr");

      if (this.config.colored && !this.config.coloredSymbolOnly) {
        eventWrapper.style.cssText =
          "color:" + this.colorForCalendar(event.calendarID);
      }

      eventWrapper.className = "normal event";

      const symbolWrapper = document.createElement("td");

      if (this.config.displaySymbol) {
        if (this.config.colored && this.config.coloredSymbolOnly) {
          symbolWrapper.style.cssText =
            "color:" + this.colorForCalendar(event.calendarID);
        }

        const symbolClass = this.symbolClassForCalendar(event.calendarID);
        symbolWrapper.className = "symbol align-right " + symbolClass;

        const symbols = this.symbolsForEvent(event);
        // If symbols are displayed and custom symbol is set, replace event symbol
        if (this.config.displaySymbol && this.config.customEvents.length > 0) {
          for (let ev in this.config.customEvents) {
            if (
              typeof this.config.customEvents[ev].symbol !== "undefined" &&
              this.config.customEvents[ev].symbol !== ""
            ) {
              let needle = new RegExp(
                this.config.customEvents[ev].keyword,
                "gi"
              );
              if (needle.test(event.title)) {
                symbols[0] = this.config.customEvents[ev].symbol;
                break;
              }
            }
          }
        }
        symbols.forEach((s, index) => {
          const symbol = document.createElement("span");
          symbol.className = "fa fa-fw fa-" + s;
          if (index > 0) {
            symbol.style.paddingLeft = "5px";
          }
          symbolWrapper.appendChild(symbol);
        });
        eventWrapper.appendChild(symbolWrapper);
      } else if (this.config.timeFormat === "dateheaders") {
        const blankCell = document.createElement("td");
        blankCell.innerHTML = "&nbsp;&nbsp;&nbsp;";
        eventWrapper.appendChild(blankCell);
      }

      const titleWrapper = document.createElement("td");
      let repeatingCountTitle = "";

      if (
        this.config.displayRepeatingCountTitle &&
        event.firstYear !== undefined
      ) {
        repeatingCountTitle = this.countTitleForCalendar(event.calendarID);

        if (repeatingCountTitle !== "") {
          const thisYear = new Date(parseInt(event.startDate)).getFullYear(),
            yearDiff = thisYear - event.firstYear;

          repeatingCountTitle = ", " + yearDiff + ". " + repeatingCountTitle;
        }
      }

      // Color events if custom color is specified
      if (this.config.customEvents.length > 0) {
        for (let ev in this.config.customEvents) {
          if (
            typeof this.config.customEvents[ev].color !== "undefined" &&
            this.config.customEvents[ev].color !== ""
          ) {
            let needle = new RegExp(this.config.customEvents[ev].keyword, "gi");
            if (needle.test(event.title)) {
              // Respect parameter ColoredSymbolOnly also for custom events
              if (!this.config.coloredSymbolOnly) {
                eventWrapper.style.cssText =
                  "color:" + this.config.customEvents[ev].color;
                titleWrapper.style.cssText =
                  "color:" + this.config.customEvents[ev].color;
              }
              if (this.config.displaySymbol) {
                symbolWrapper.style.cssText =
                  "color:" + this.config.customEvents[ev].color;
              }
              break;
            }
          }
        }
      }

      titleWrapper.innerHTML =
        this.titleTransform(
          event.title,
          this.config.titleReplace,
          this.config.wrapEvents,
          this.config.maxTitleLength,
          this.config.maxTitleLines
        ) + repeatingCountTitle;

      const titleClass = this.titleClassForCalendar(event.calendarID);

      if (!this.config.colored) {
        titleWrapper.className = "title bright " + titleClass;
      } else {
        titleWrapper.className = "title " + titleClass;
      }

      if (this.config.timeFormat === "dateheaders") {
        if (event.fullDayEvent) {
          titleWrapper.colSpan = "2";
          titleWrapper.classList.add("align-left");
        } else {
          const timeWrapper = document.createElement("td");
          timeWrapper.className =
            "time light align-left " +
            this.timeClassForCalendar(event.calendarID);
          timeWrapper.style.paddingLeft = "2px";
          timeWrapper.innerHTML = moment(event.startDate).format("LT");
          eventWrapper.appendChild(timeWrapper);
          titleWrapper.classList.add("align-right");
        }

        eventWrapper.appendChild(titleWrapper);
      } else {
        const timeWrapper = document.createElement("td");

        eventWrapper.appendChild(titleWrapper);
        const now = new Date();

        if (this.config.timeFormat === "absolute") {
          // Use dateFormat
          timeWrapper.innerHTML = this.capFirst(
            moment(event.startDate).format(this.config.dateFormat)
          );
          // Add end time if showEnd
          if (this.config.showEnd) {
            timeWrapper.innerHTML += "-";
            timeWrapper.innerHTML += this.capFirst(
              moment(event.endDate).format(this.config.dateEndFormat)
            );
          }
          // For full day events we use the fullDayEventDateFormat
          if (event.fullDayEvent) {
            //subtract one second so that fullDayEvents end at 23:59:59, and not at 0:00:00 one the next day
            event.endDate -= oneSecond;
            timeWrapper.innerHTML = this.capFirst(
              moment(event.startDate).format(this.config.fullDayEventDateFormat)
            );
          }
          if (this.config.getRelative > 0 && event.startDate < now) {
            // Ongoing and getRelative is set
            timeWrapper.innerHTML = this.capFirst(
              this.translate("RUNNING", {
                fallback: this.translate("RUNNING") + " {timeUntilEnd}",
                timeUntilEnd: moment(event.endDate).fromNow(true)
              })
            );
          } else if (
            this.config.urgency > 0 &&
            event.startDate - now < this.config.urgency * oneDay
          ) {
            // Within urgency days
            timeWrapper.innerHTML = this.capFirst(
              moment(event.startDate).fromNow()
            );
          }
          if (event.fullDayEvent && this.config.nextDaysRelative) {
            // Full days events within the next two days
            if (event.today) {
              timeWrapper.innerHTML = this.capFirst(this.translate("TODAY"));
            } else if (
              event.startDate - now < oneDay &&
              event.startDate - now > 0
            ) {
              timeWrapper.innerHTML = this.capFirst(this.translate("TOMORROW"));
            } else if (
              event.startDate - now < 2 * oneDay &&
              event.startDate - now > 0
            ) {
              if (this.translate("DAYAFTERTOMORROW") !== "DAYAFTERTOMORROW") {
                timeWrapper.innerHTML = this.capFirst(
                  this.translate("DAYAFTERTOMORROW")
                );
              }
            }
          }
        } else {
          // Show relative times
          if (event.startDate >= now) {
            // Use relative  time
            if (!this.config.hideTime) {
              timeWrapper.innerHTML = this.capFirst(
                moment(event.startDate).calendar(null, {
                  sameElse: this.config.dateFormat
                })
              );
            } else {
              timeWrapper.innerHTML = this.capFirst(
                moment(event.startDate).calendar(null, {
                  sameDay: "[" + this.translate("TODAY") + "]",
                  nextDay: "[" + this.translate("TOMORROW") + "]",
                  nextWeek: "dddd",
                  sameElse: this.config.dateFormat
                })
              );
            }
            if (event.startDate - now < this.config.getRelative * oneHour) {
              // If event is within getRelative  hours, display 'in xxx' time format or moment.fromNow()
              timeWrapper.innerHTML = this.capFirst(
                moment(event.startDate).fromNow()
              );
            }
          } else {
            // Ongoing event
            timeWrapper.innerHTML = this.capFirst(
              this.translate("RUNNING", {
                fallback: this.translate("RUNNING") + " {timeUntilEnd}",
                timeUntilEnd: moment(event.endDate).fromNow(true)
              })
            );
          }
        }
        timeWrapper.className =
          "time light " + this.timeClassForCalendar(event.calendarID);
        eventWrapper.appendChild(timeWrapper);
      }

      wrapper.appendChild(eventWrapper);

      // Create fade effect.
      if (index >= startFade) {
        currentFadeStep = index - startFade;
        eventWrapper.style.opacity = 1 - (1 / fadeSteps) * currentFadeStep;
      }

      if (this.config.showLocation) {
        if (event.location) {
          const locationRow = document.createElement("tr");
          locationRow.className = "normal xsmall light";

          if (this.config.displaySymbol) {
            const symbolCell = document.createElement("td");
            locationRow.appendChild(symbolCell);
          }

          const descCell = document.createElement("td");
          descCell.className = "location";
          descCell.colSpan = "2";
          descCell.innerHTML = this.titleTransform(
            event.location,
            this.config.locationTitleReplace,
            this.config.wrapLocationEvents,
            this.config.maxLocationTitleLength,
            this.config.maxEventTitleLines
          );
          locationRow.appendChild(descCell);

          wrapper.appendChild(locationRow);

          if (index >= startFade) {
            currentFadeStep = index - startFade;
            locationRow.style.opacity = 1 - (1 / fadeSteps) * currentFadeStep;
          }
        }
      }
    });

    return wrapper;
  },

  fetchCalendars: function () {
    this.config.calendars.forEach((calendar) => {
      if (!calendar.calendarID) {
        Log.warn(this.name + ": Unable to fetch, no calendar ID found!");
        return;
      }

      const calendarConfig = {
        maximumEntries: calendar.maximumEntries,
        maximumNumberOfDays: calendar.maximumNumberOfDays
      };

      if (
        calendar.symbolClass === "undefined" ||
        calendar.symbolClass === null
      ) {
        calendarConfig.symbolClass = "";
      }
      if (calendar.titleClass === "undefined" || calendar.titleClass === null) {
        calendarConfig.titleClass = "";
      }
      if (calendar.timeClass === "undefined" || calendar.timeClass === null) {
        calendarConfig.timeClass = "";
      }

      // tell helper to start a fetcher for this calendar
      // fetcher till cycle
      this.addCalendar(calendar.calendarID, calendarConfig);
    });
  },

  /**
   * This function accepts a number (either 12 or 24) and returns a moment.js LocaleSpecification with the
   * corresponding timeformat to be used in the calendar display. If no number is given (or otherwise invalid input)
   * it will a localeSpecification object with the system locale time format.
   *
   * @param {number} timeFormat Specifies either 12 or 24 hour time format
   * @returns {moment.LocaleSpecification} formatted time
   */
  getLocaleSpecification: function (timeFormat) {
    switch (timeFormat) {
      case 12: {
        return { longDateFormat: { LT: "h:mm A" } };
      }
      case 24: {
        return { longDateFormat: { LT: "HH:mm" } };
      }
      default: {
        return {
          longDateFormat: { LT: moment.localeData().longDateFormat("LT") }
        };
      }
    }
  },

  /**
   * Checks if this config contains the calendar ID.
   *
   * @param {string} ID The calendar ID
   * @returns {boolean} True if the calendar config contains the ID, False otherwise
   */
  hasCalendarID: function (ID) {
    for (const calendar of this.config.calendars) {
      if (calendar.calendarID === ID) {
        return true;
      }
    }

    return false;
  },

  /**
   * Parse google date obj
   * @param {*} googleDate
   * @returns timestamp
   */
  extractCalendarDate: function (googleDate) {
    // case is "all day event"
    if (googleDate.hasOwnProperty("date")) {
      return moment(googleDate.date).valueOf();
    }

    return moment(googleDate.dateTime).valueOf();
  },

  /**
   * Creates the sorted list of all events.
   *
   * @returns {object[]} Array with events.
   */
  createEventList: function () {
    const now = new Date();
    const today = moment().startOf("day");
    const future = moment()
      .startOf("day")
      .add(this.config.maximumNumberOfDays, "days")
      .toDate();
    let events = [];

    const formatStr = undefined;

    for (const calendarID in this.calendarData) {
      const calendar = this.calendarData[calendarID];
      for (const e in calendar) {
        const event = JSON.parse(JSON.stringify(calendar[e])); // clone object

        // added props
        event.calendarID = calendarID;
        event.endDate = this.extractCalendarDate(event.end);
        event.startDate = this.extractCalendarDate(event.start);

        if (event.endDate < now) {
          continue;
        }
        if (this.config.hidePrivate) {
          if (event.visibility === "PRIVATE") {
            // do not add the current event, skip it
            continue;
          }
        }
        if (this.config.hideOngoing) {
          if (event.endDate < now) {
            continue;
          }
        }
        if (this.listContainsEvent(events, event)) {
          continue;
        }
        event.url = event.htmlLink;
        event.today =
          event.startDate >= today &&
          event.startDate < today + 24 * 60 * 60 * 1000;
        event.title = event.summary;

        /* if sliceMultiDayEvents is set to true, multiday events (events exceeding at least one midnight) are sliced into days,
         * otherwise, esp. in dateheaders mode it is not clear how long these events are.
         */
        const maxCount =
          Math.ceil(
            (event.endDate -
              1 -
              moment(event.startDate, formatStr)
                .endOf("day")
                .format(formatStr)) /
              (1000 * 60 * 60 * 24)
          ) + 1;
        if (this.config.sliceMultiDayEvents && maxCount > 1) {
          const splitEvents = [];
          let midnight = moment(event.startDate, formatStr)
            .clone()
            .startOf("day")
            .add(1, "day")
            .format(formatStr);
          let count = 1;
          while (event.endDate > midnight) {
            const thisEvent = JSON.parse(JSON.stringify(event)); // clone object
            thisEvent.today =
              thisEvent.startDate >= today &&
              thisEvent.startDate < today + 24 * 60 * 60 * 1000;
            thisEvent.endDate = midnight;
            thisEvent.title += " (" + count + "/" + maxCount + ")";
            splitEvents.push(thisEvent);

            event.startDate = midnight;
            count += 1;
            midnight = moment(midnight, formatStr)
              .add(1, "day")
              .format(formatStr); // next day
          }
          // Last day
          event.title += " (" + count + "/" + maxCount + ")";
          splitEvents.push(event);

          for (let splitEvent of splitEvents) {
            if (splitEvent.end > now && splitEvent.end <= future) {
              events.push(splitEvent);
            }
          }
        } else {
          events.push(event);
        }
      }
    }

    events.sort(function (a, b) {
      return a.startDate - b.startDate;
    });

    // Limit the number of days displayed
    // If limitDays is set > 0, limit display to that number of days
    if (this.config.limitDays > 0) {
      let newEvents = [];
      let lastDate = today.clone().subtract(1, "days").format("YYYYMMDD");
      let days = 0;
      for (const ev of events) {
        let eventDate = moment(ev.startDate, formatStr).format("YYYYMMDD");
        // if date of event is later than lastdate
        // check if we already are showing max unique days
        if (eventDate > lastDate) {
          // if the only entry in the first day is a full day event that day is not counted as unique
          if (
            newEvents.length === 1 &&
            days === 1 &&
            newEvents[0].fullDayEvent
          ) {
            days--;
          }
          days++;
          if (days > this.config.limitDays) {
            continue;
          } else {
            lastDate = eventDate;
          }
        }
        newEvents.push(ev);
      }
      events = newEvents;
    }

    return events.slice(0, this.config.maximumEntries);
  },

  listContainsEvent: function (eventList, event) {
    for (const evt of eventList) {
      if (
        evt.summary === event.summary &&
        parseInt(evt.start) === parseInt(event.start)
      ) {
        return true;
      }
    }
    return false;
  },

  /**
   * Requests node helper to add calendar ID
   *
   * @param {string} calendarID string
   * @param {object} calendarConfig The config of the specific calendar
   */
  addCalendar: function (calendarID, calendarConfig) {
    this.sendSocketNotification("ADD_CALENDAR", {
      id: this.identifier,
      calendarID,
      excludedEvents:
        calendarConfig.excludedEvents || this.config.excludedEvents,
      maximumEntries:
        calendarConfig.maximumEntries || this.config.maximumEntries,
      maximumNumberOfDays:
        calendarConfig.maximumNumberOfDays || this.config.maximumNumberOfDays,
      fetchInterval: this.config.fetchInterval,
      symbolClass: calendarConfig.symbolClass,
      titleClass: calendarConfig.titleClass,
      timeClass: calendarConfig.timeClass
    });
  },

  /**
   * Retrieves the symbols for a specific event.
   *
   * @param {object} event Event to look for.
   * @returns {string[]} The symbols
   */
  symbolsForEvent: function (event) {
    let symbols = this.getCalendarPropertyAsArray(
      event.calendarID,
      "symbol",
      this.config.defaultSymbol
    );

    if (
      event.recurringEvent === true &&
      this.hasCalendarProperty(event.calendarID, "recurringSymbol")
    ) {
      symbols = this.mergeUnique(
        this.getCalendarPropertyAsArray(
          event.calendarID,
          "recurringSymbol",
          this.config.defaultSymbol
        ),
        symbols
      );
    }

    if (
      event.fullDayEvent === true &&
      this.hasCalendarProperty(event.calendarID, "fullDaySymbol")
    ) {
      symbols = this.mergeUnique(
        this.getCalendarPropertyAsArray(
          event.calendarID,
          "fullDaySymbol",
          this.config.defaultSymbol
        ),
        symbols
      );
    }

    return symbols;
  },

  mergeUnique: function (arr1, arr2) {
    return arr1.concat(
      arr2.filter(function (item) {
        return arr1.indexOf(item) === -1;
      })
    );
  },

  /**
   * Retrieves the symbolClass for a specific calendar ID.
   *
   * @param {string} calendarID The calendar ID
   * @returns {string} The class to be used for the symbols of the calendar
   */
  symbolClassForCalendar: function (calendarID) {
    return this.getCalendarProperty(calendarID, "symbolClass", "");
  },

  /**
   * Retrieves the titleClass for a specific calendar ID.
   *
   * @param {string} calendarID The calendar ID
   * @returns {string} The class to be used for the title of the calendar
   */
  titleClassForCalendar: function (calendarID) {
    return this.getCalendarProperty(calendarID, "titleClass", "");
  },

  /**
   * Retrieves the timeClass for a specific calendar ID.
   *
   * @param {string} calendarID The calendar ID
   * @returns {string} The class to be used for the time of the calendar
   */
  timeClassForCalendar: function (calendarID) {
    return this.getCalendarProperty(calendarID, "timeClass", "");
  },

  /**
   * Retrieves the calendar name for a specific calendar ID.
   *
   * @param {string} calendarID The calendar ID
   * @returns {string} The name of the calendar
   */
  calendarNameForCalendar: function (calendarID) {
    return this.getCalendarProperty(calendarID, "name", "");
  },

  /**
   * Retrieves the color for a specific calendar ID.
   *
   * @param {string} calendarID The calendar ID
   * @returns {string} The color
   */
  colorForCalendar: function (calendarID) {
    return this.getCalendarProperty(calendarID, "color", "#fff");
  },

  /**
   * Retrieves the count title for a specific calendar ID.
   *
   * @param {string} calendarID The calendar ID
   * @returns {string} The title
   */
  countTitleForCalendar: function (calendarID) {
    return this.getCalendarProperty(
      calendarID,
      "repeatingCountTitle",
      this.config.defaultRepeatingCountTitle
    );
  },

  /**
   * Helper method to retrieve the property for a specific calendar ID.
   *
   * @param {string} calendarID The calendar ID
   * @param {string} property The property to look for
   * @param {string} defaultValue The value if the property is not found
   * @returns {*} The property
   */
  getCalendarProperty: function (calendarID, property, defaultValue) {
    for (const calendar of this.config.calendars) {
      if (
        calendar.calendarID === calendarID &&
        calendar.hasOwnProperty(property)
      ) {
        return calendar[property];
      }
    }

    return defaultValue;
  },

  getCalendarPropertyAsArray: function (calendarID, property, defaultValue) {
    let p = this.getCalendarProperty(calendarID, property, defaultValue);
    if (!(p instanceof Array)) p = [p];
    return p;
  },

  hasCalendarProperty: function (calendarID, property) {
    return !!this.getCalendarProperty(calendarID, property, undefined);
  },

  /**
   * Shortens a string if it's longer than maxLength and add a ellipsis to the end
   *
   * @param {string} string Text string to shorten
   * @param {number} maxLength The max length of the string
   * @param {boolean} wrapEvents Wrap the text after the line has reached maxLength
   * @param {number} maxTitleLines The max number of vertical lines before cutting event title
   * @returns {string} The shortened string
   */
  shorten: function (string, maxLength, wrapEvents, maxTitleLines) {
    if (typeof string !== "string") {
      return "";
    }

    if (wrapEvents === true) {
      const words = string.split(" ");
      let temp = "";
      let currentLine = "";
      let line = 0;

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (
          currentLine.length + word.length <
          (typeof maxLength === "number" ? maxLength : 25) - 1
        ) {
          // max - 1 to account for a space
          currentLine += word + " ";
        } else {
          line++;
          if (line > maxTitleLines - 1) {
            if (i < words.length) {
              currentLine += "&hellip;";
            }
            break;
          }

          if (currentLine.length > 0) {
            temp += currentLine + "<br>" + word + " ";
          } else {
            temp += word + "<br>";
          }
          currentLine = "";
        }
      }

      return (temp + currentLine).trim();
    } else {
      if (
        maxLength &&
        typeof maxLength === "number" &&
        string.length > maxLength
      ) {
        return string.trim().slice(0, maxLength) + "&hellip;";
      } else {
        return string.trim();
      }
    }
  },

  /**
   * Capitalize the first letter of a string
   *
   * @param {string} string The string to capitalize
   * @returns {string} The capitalized string
   */
  capFirst: function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  },

  /**
   * Transforms the title of an event for usage.
   * Replaces parts of the text as defined in config.titleReplace.
   * Shortens title based on config.maxTitleLength and config.wrapEvents
   *
   * @param {string} title The title to transform.
   * @param {object} titleReplace Pairs of strings to be replaced in the title
   * @param {boolean} wrapEvents Wrap the text after the line has reached maxLength
   * @param {number} maxTitleLength The max length of the string
   * @param {number} maxTitleLines The max number of vertical lines before cutting event title
   * @returns {string} The transformed title.
   */
  titleTransform: function (
    title,
    titleReplace,
    wrapEvents,
    maxTitleLength,
    maxTitleLines
  ) {
    for (let needle in titleReplace) {
      const replacement = titleReplace[needle];

      const regParts = needle.match(/^\/(.+)\/([gim]*)$/);
      if (regParts) {
        // the parsed pattern is a regexp.
        needle = new RegExp(regParts[1], regParts[2]);
      }

      title = title.replace(needle, replacement);
    }

    title = this.shorten(title, maxTitleLength, wrapEvents, maxTitleLines);
    return title;
  },

  /**
   * Broadcasts the events to all other modules for reuse.
   * The all events available in one array, sorted on startDate.
   */
  broadcastEvents: function () {
    const eventList = [];
    for (const calendarID in this.calendarData) {
      for (const ev of this.calendarData[calendarID]) {
        const event = Object.assign({}, ev);
        event.symbol = this.symbolsForEvent(event);
        event.calendarName = this.calendarNameForCalendar(calendarID);
        event.color = this.colorForCalendar(calendarID);
        delete event.calendarID;
        eventList.push(event);
      }
    }

    eventList.sort(function (a, b) {
      return a.startDate - b.startDate;
    });

    this.sendNotification("CALENDAR_EVENTS", eventList);
  }
});
