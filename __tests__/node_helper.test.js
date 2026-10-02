jest.mock("node_helper", () => ({ create: (def) => def, checkFetchError: jest.fn(() => "MODULE_ERROR_UNSPECIFIED") }), { virtual: true });
jest.mock("logger", () => ({ log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }), { virtual: true });
jest.mock("googleapis", () => ({ google: {} }));

const helperDefinition = require("../node_helper.js");

function makeHelper() {
  const helper = Object.create(helperDefinition);
  helper.name = "MMM-GoogleCalendar";
  helper.path = "/tmp";
  helper.sendSocketNotification = jest.fn();
  helper.start();
  helper.calendarService = {
    events: {
      list: jest.fn((params, cb) => cb(null, { data: { items: [{ id: params.calendarId }] } }))
    }
  };
  return helper;
}

const addPayload = (id, calendarID) => ({
  id,
  calendarID,
  fetchInterval: 1000,
  maximumEntries: 10,
  pastDaysCount: 0,
  maximumNumberOfDays: 30
});

describe("node_helper fetch loops", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("keeps a single loop when the same calendar is added repeatedly", () => {
    const helper = makeHelper();
    const list = helper.calendarService.events.list;

    for (let i = 0; i < 6; i++) {
      helper.socketNotificationReceived("ADD_CALENDAR", addPayload("module_1", "cal@x"));
    }
    expect(list).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(list).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(1000);
    expect(list).toHaveBeenCalledTimes(3);
    helper.stop();
  });

  it("re-sends cached events to a repeated add", () => {
    const helper = makeHelper();
    helper.socketNotificationReceived("ADD_CALENDAR", addPayload("module_1", "cal@x"));
    helper.socketNotificationReceived("ADD_CALENDAR", addPayload("module_1", "cal@x"));

    const eventNotifications = helper.sendSocketNotification.mock.calls.filter(
      ([n]) => n === "CALENDAR_EVENTS"
    );
    expect(eventNotifications).toHaveLength(2);
    expect(helper.calendarService.events.list).toHaveBeenCalledTimes(1);
    helper.stop();
  });

  it("runs separate loops for different instances or calendars", () => {
    const helper = makeHelper();
    helper.socketNotificationReceived("ADD_CALENDAR", addPayload("module_1", "cal@x"));
    helper.socketNotificationReceived("ADD_CALENDAR", addPayload("module_2", "cal@x"));
    helper.socketNotificationReceived("ADD_CALENDAR", addPayload("module_2", "other@x"));
    expect(helper.calendarService.events.list).toHaveBeenCalledTimes(3);

    jest.advanceTimersByTime(1000);
    expect(helper.calendarService.events.list).toHaveBeenCalledTimes(6);
    helper.stop();
  });

  it("restarts a loop that stopped because the service went away", () => {
    const helper = makeHelper();
    const service = helper.calendarService;
    helper.socketNotificationReceived("ADD_CALENDAR", addPayload("module_1", "cal@x"));

    helper.calendarService = null;
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(5000);
    expect(service.events.list).toHaveBeenCalledTimes(1);

    helper.calendarService = service;
    helper.socketNotificationReceived("ADD_CALENDAR", addPayload("module_1", "cal@x"));
    expect(service.events.list).toHaveBeenCalledTimes(2);
    helper.stop();
  });

  it("stop() clears pending timers", () => {
    const helper = makeHelper();
    helper.socketNotificationReceived("ADD_CALENDAR", addPayload("module_1", "cal@x"));
    helper.stop();
    jest.advanceTimersByTime(5000);
    expect(helper.calendarService.events.list).toHaveBeenCalledTimes(1);
  });
});
