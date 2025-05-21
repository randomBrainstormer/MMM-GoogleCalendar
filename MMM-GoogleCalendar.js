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
    pastDaysCount: 0,
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
    hideDuplicates: false,
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
    nextDaysRelative: false,
	broadcastPastEvents: false,
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
      const errorMessage = this.translate(payload.error_type);
      this.error = this.translate("MODULE_CONFIG_ERROR", {
        MODULE_NAME: this.name,
        ERROR: errorMessage
      });
      this.loaded = true;
      this.updateDom(this.config.animationSpeed);
      return;
    }

    if (notification === "AUTH_NEEDED") {
      if (payload.credentialType === "web" && payload.url) {
        this.error = "AUTH_PROMPT_CLICK_HERE";
        this.errorUrl = payload.url;
      } else {
        this.error = "AUTH_ERROR_GENERIC";
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
      const errorMessage = this.translate(payload.error_type);
      this.error = this.translate("MODULE_CONFIG_ERROR", {
        MODULE_NAME: this.name,
        ERROR: errorMessage
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
      if (this.error === "AUTH_PROMPT_CLICK_HERE" && this.errorUrl) {
        const authPrompt = this.translate("AUTH_PROMPT_CLICK_HERE");
        wrapper.innerHTML = authPrompt.replace("{authUrl}", this.errorUrl);
      } else if (this.error === "AUTH_ERROR_GENERIC") { // New generic auth error
        wrapper.innerHTML = this.translate(this.error);
      } else { // Existing error messages (likely already translated)
        wrapper.innerHTML = this.error;
      }
      wrapper.className = `${this.config.tableClass} dimmed`;
      return wrapper;
    }

    if (events.length === 0) {
      wrapper.innerHTML = this.loaded
        ? this.translate("EMPTY")
        : this.translate("LOADING");
      wrapper.className = `${this.config.tableClass} dimmed`;
      return wrapper;
    }

    let currentFadeStep = 0;
    let startFade = 0; // Initialize with a default value
    let fadeSteps = 0; // Initialize with a default value

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
        eventWrapper.style.cssText = `color:${this.colorForCalendar(event.calendarID)}`;
      }

      eventWrapper.className = "normal event";

      const symbolWrapper = document.createElement("td");

      if (this.config.displaySymbol) {
        if (this.config.colored && this.config.coloredSymbolOnly) {
          symbolWrapper.style.cssText = `color:${this.colorForCalendar(event.calendarID)}`;
        }

        const symbolClass = this.symbolClassForCalendar(event.calendarID);
        symbolWrapper.className = `symbol align-right ${symbolClass}`;

        const symbols = this.symbolsForEvent(event);
        // If symbols are displayed and custom symbol is set, replace event symbol
        if (this.config.displaySymbol && this.config.customEvents.length > 0) {
          for (const customEvent of this.config.customEvents) { // Use for...of for arrays
            if (
              typeof customEvent.symbol !== "undefined" &&
              customEvent.symbol !== ""
            ) {
              const needle = new RegExp(
                customEvent.keyword,
                "gi"
              );
              if (needle.test(event.title)) {
                symbols[0] = customEvent.symbol;
                break;
              }
            }
          }
        }
        symbols.forEach((s, idx) => { // Renamed index to idx to avoid conflict
          const symbol = document.createElement("span");
          symbol.className = `fa fa-fw fa-${s}`;
          if (idx > 0) {
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
          const thisYear = new Date(parseInt(event.startDate, 10)).getFullYear(); // Add radix for parseInt
          const yearDiff = thisYear - event.firstYear;

          repeatingCountTitle = `, ${yearDiff}. ${repeatingCountTitle}`; // Template literal
        }
      }

      // Color events if custom color is specified
      if (this.config.customEvents.length > 0) {
        for (const customEvent of this.config.customEvents) { // Use for...of for arrays
          if (
            typeof customEvent.color !== "undefined" &&
            customEvent.color !== ""
          ) {
            const needle = new RegExp(customEvent.keyword, "gi");
            if (needle.test(event.title)) {
              // Respect parameter ColoredSymbolOnly also for custom events
              if (!this.config.coloredSymbolOnly) {
                eventWrapper.style.cssText = `color:${customEvent.color}`;
                titleWrapper.style.cssText = `color:${customEvent.color}`;
              }
              if (this.config.displaySymbol) {
                symbolWrapper.style.cssText = `color:${customEvent.color}`;
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
        titleWrapper.className = `title bright ${titleClass}`;
      } else {
        titleWrapper.className = `title ${titleClass}`;
      }

      if (this.config.timeFormat === "dateheaders") {
        if (event.fullDayEvent) {
          titleWrapper.colSpan = "2";
          titleWrapper.classList.add("align-left");
        } else {
          const timeWrapper = document.createElement("td");
          timeWrapper.className = `time light align-left ${this.timeClassForCalendar(event.calendarID)}`;
          timeWrapper.style.paddingLeft = "2px";
          timeWrapper.innerHTML = moment(event.startDate).format("LT");

          // Add endDate to dataheaders if showEnd is enabled
          if (this.config.showEnd) {
            timeWrapper.innerHTML += ` - ${this.capFirst(moment(event.endDate, "x").format("LT"))}`;
          }

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
            timeWrapper.innerHTML += `-${this.capFirst(moment(event.endDate).format(this.config.dateEndFormat))}`;
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
                fallback: `${this.translate("RUNNING")} {timeUntilEnd}`, // Template literal
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
                  sameDay: `[${this.translate("TODAY")}]`, // Template literal
                  nextDay: `[${this.translate("TOMORROW")}]`, // Template literal
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
                fallback: `${this.translate("RUNNING")} {timeUntilEnd}`, // Template literal
                timeUntilEnd: moment(event.endDate).fromNow(true)
              })
            );
          }
        }
        timeWrapper.className = `time light ${this.timeClassForCalendar(event.calendarID)}`;
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

  /**
	 * Filter out events according to the calendar config.
	 * This function is called from `createEventList` for each event.
	 * @param {object} event - The event object to check.
	 * @param {array} eventsList - The list of events already processed and not filtered out, used for duplicate checking.
	 * @returns {boolean} - True if the event should be filtered out (excluded), false otherwise.
	 */
  filterEvent: function(event, eventsList) {
    // Note: The order of checks can impact performance slightly, but the current order is logical.
    // For example, checking for excludedEvents or hidePrivate first might be marginally faster
    // if those are common, as it avoids the listContainsEvent check for duplicates.

    // Filter based on `excludedEvents` config
  if (this.config.excludedEvents?.length && this.config.excludedEvents.includes(event.summary)) {
    Log.debug(`Event ${event.id} ('${event.summary}') filtered due to excludedEvents settings.`);
    return true;
  }

  // Filter based on `hidePrivate` config
  if (this.config.hidePrivate && ['private', 'confidential'].includes(event.visibility?.toLowerCase())) {
    Log.debug(`Event ${event.id} ('${event.summary}') filtered due to hidePrivate settings.`);
    return true;
  }

  // Filter based on `hideDuplicates` config by checking against the eventsList
  if (this.config.hideDuplicates && this.listContainsEvent(eventsList, event)) {
    Log.debug(`Event ${event.id} ('${event.summary}') filtered due to hideDuplicates settings.`);
    return true;
  }

  const now = new Date();
  // Filter based on `hideOngoing` config
  if (this.config.hideOngoing && event.startDate < now && event.endDate > now) {
    Log.debug(`Event ${event.id} ('${event.summary}') filtered due to hideOngoing settings.`);
    return true;
  }

  return false; // Event should not be filtered out
  },

  fetchCalendars: function () {
    this.config.calendars.forEach((calendar) => {
      if (!calendar.calendarID) {
        Log.warn(`${this.name}: Unable to fetch, no calendar ID found!`); // Template literal
        return;
      }

      const calendarConfig = {
		maximumEntries: calendar.maximumEntries,
		maximumNumberOfDays: calendar.maximumNumberOfDays,
		broadcastPastEvents: calendar.broadcastPastEvents,
		excludedEvents: calendar.excludedEvents,
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
   * @param {object} googleDate - The google date object. (type annotation)
   * @returns {number} timestamp (type annotation)
   */
  extractCalendarDate: function (googleDate) {
    // case is "all day event"
    if (Object.prototype.hasOwnProperty.call(googleDate, "date")) { // Fixed no-prototype-builtins
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
    const events = []; // Changed from let to const as it's reassigned with .slice() later, but primarily mutated.

    const formatStr = undefined; // This seems unused, consider removing if truly not needed.

    for (const calendarID in this.calendarData) {
      const calendar = this.calendarData[calendarID];
      for (const e in calendar) { // Consider using for...of if calendar is an array or iterating its keys differently
        const event = JSON.parse(JSON.stringify(calendar[e])); // clone object

        // added props
        event.calendarID = calendarID;
        event.endDate = this.extractCalendarDate(event.end);
        event.startDate = this.extractCalendarDate(event.start);

        // Call filterEvent to determine if the event should be excluded based on various settings.
        // The 'events' array (eventsList in filterEvent) is the accumulating list of events
        // that have passed all filters so far, used for duplicate checking.
		if (this.filterEvent(event, events)) {
			continue; // Skip this event if filterEvent returns true
		}

        // The redundant duplicate check that was here has been removed.
        // filterEvent now solely handles the hideDuplicates logic.

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
              moment(event.startDate, formatStr) // formatStr is undefined here
                .endOf("day")
                .format(formatStr)) / // formatStr is undefined here
              (1000 * 60 * 60 * 24)
          ) + 1;
        if (this.config.sliceMultiDayEvents && maxCount > 1) {
          const splitEvents = [];
          let midnight = moment(event.startDate, formatStr) // formatStr is undefined here
            .clone()
            .startOf("day")
            .add(1, "day")
            .format(formatStr); // formatStr is undefined here
          let count = 1;
          while (event.endDate > midnight) {
            const thisEvent = JSON.parse(JSON.stringify(event)); // clone object
            thisEvent.today =
              thisEvent.startDate >= today &&
              thisEvent.startDate < today + 24 * 60 * 60 * 1000;
            thisEvent.endDate = midnight;
            thisEvent.title += ` (${count}/${maxCount})`; // Template literal
            splitEvents.push(thisEvent);

            event.startDate = midnight;
            count += 1;
            midnight = moment(midnight, formatStr) // formatStr is undefined here
              .add(1, "day")
              .format(formatStr); // formatStr is undefined here // next day
          }
          // Last day
          event.title += ` (${count}/${maxCount})`; // Template literal
          splitEvents.push(event);

          for (const splitEvent of splitEvents) { // Use for...of for arrays
            if (splitEvent.end > now && splitEvent.end <= future) {
              events.push(splitEvent);
            }
          }
        } else {
          events.push(event);
        }
      }
    }

    events.sort((a, b) => a.startDate - b.startDate); // Arrow function for sort

    // Limit the number of days displayed
    // If limitDays is set > 0, limit display to that number of days
    if (this.config.limitDays > 0) {
      const newEvents = []; // Changed from let to const
      let lastDate = today.clone().subtract(1, "days").format("YYYYMMDD");
      let days = 0;
      for (const ev of events) { // Use for...of for arrays
        const eventDate = moment(ev.startDate, formatStr).format("YYYYMMDD"); // formatStr is undefined here
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
      return newEvents.slice(0, this.config.maximumEntries); // Return directly after reassignment
    }

    return events.slice(0, this.config.maximumEntries);
  },

  listContainsEvent: function (eventList, event) {
    for (const evt of eventList) { // Use for...of for arrays
      if (
        evt.summary === event.summary &&
        parseInt(evt.startDate, 10) === parseInt(event.startDate, 10) // Add radix for parseInt
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
      pastDaysCount:
        calendarConfig.pastDaysCount || this.config.pastDaysCount,
      fetchInterval: this.config.fetchInterval,
      symbolClass: calendarConfig.symbolClass,
      titleClass: calendarConfig.titleClass,
      timeClass: calendarConfig.timeClass,
      broadcastPastEvents: calendarConfig.broadcastPastEvents || this.config.broadcastPastEvents
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
      arr2.filter((item) => arr1.indexOf(item) === -1) // Arrow function
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
    for (const calendar of this.config.calendars) { // Use for...of for arrays
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
    if (!Array.isArray(p)) { // More standard check for array
      p = [p];
    }
    return p;
  },

  // Corrected hasCalendarProperty to avoid direct prototype call if possible,
  // but ESLint might still prefer Object.hasOwn or a more explicit check.
  // For now, this adheres to the common safe pattern.
  hasCalendarProperty: function (calendarID, property) {
    const calendar = this.config.calendars.find(c => c.calendarID === calendarID);
    // Ensure calendar is not null and then check for the property.
    return !!(calendar && Object.prototype.hasOwnProperty.call(calendar, property));
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
          currentLine += `${word} `; // Template literal
        } else {
          line++;
          if (line > maxTitleLines - 1) {
            if (i < words.length) {
              currentLine += "&hellip;";
            }
            break;
          }

          if (currentLine.length > 0) {
            temp += `${currentLine}<br>${word} `; // Template literal
          } else {
            temp += `${word}<br>`; // Template literal
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
        return `${string.trim().slice(0, maxLength)}&hellip;`; // Template literal
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
    let newTitle = title; // Work on a new variable
    for (const needle in titleReplace) { // Use const for keys in for...in
      if (Object.prototype.hasOwnProperty.call(titleReplace, needle)) { // Fixed no-prototype-builtins
        const replacement = titleReplace[needle];
        let searchPattern = needle; // Use a new variable for the pattern

        const regParts = needle.match(/^\/(.+)\/([gim]*)$/);
        if (regParts) {
          // the parsed pattern is a regexp.
          searchPattern = new RegExp(regParts[1], regParts[2]);
        }
        newTitle = newTitle.replace(searchPattern, replacement);
      }
    }

    newTitle = this.shorten(newTitle, maxTitleLength, wrapEvents, maxTitleLines);
    return newTitle;
  },

  /**
   * Broadcasts the events to all other modules for reuse.
   * The all events available in one array, sorted on startDate.
   */
  broadcastEvents: function () {
    const now = new Date();
    const eventList = [];
    for (const calendarID in this.calendarData) { // `calendarID` is a key, `const` is appropriate
      for (const ev of this.calendarData[calendarID]) { // Use for...of for arrays
        const event = { ...ev }; // Use spread syntax for shallow clone instead of Object.assign
        event.symbol = this.symbolsForEvent(event);
        event.calendarName = this.calendarNameForCalendar(calendarID);
        event.color = this.colorForCalendar(calendarID);
        delete event.calendarID;

        // Make a broadcasting event to be compatible with the default calendar module.
        event.title = event.summary;
        event.fullDayEvent = !!(event.start?.date && event.end?.date); // Simpler boolean conversion
        const startDate = event.start?.date ?? event.start?.dateTime;
        const endDate = event.end?.date ?? event.end?.dateTime;
        event.startDate = startDate ? moment(startDate).valueOf() : null;
        event.endDate = endDate ? moment(endDate).valueOf() : null;

		if (this.config.broadcastEvents && !this.config.broadcastPastEvents && event.endDate < now) {
			continue;
		}

        eventList.push(event);
      }
    }

    eventList.sort((a, b) => a.startDate - b.startDate); // Arrow function

    this.sendNotification("CALENDAR_EVENTS", eventList);
  }
});
