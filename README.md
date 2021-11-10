# Module: MMM-GoogleCalendar

This module is a customization from MaigcMirror's default calendar module to display your Google calendars (including the Google Family calendar) without need to make iCals public. Inspired by the [GoogleTask module](https://github.com/jgauth/MMM-GoogleTasks).

### Dependencies

1. The [Google Node.js client library](https://github.com/google/google-api-nodejs-client/): For authentication and Google Calendar API (v3). See Installation for instructions

## Installation

To install the module, use your terminal to:

1. Navigate to your MagicMirror's modules folder. If you are using the default installation directory, use the command:<br />`cd ~/MagicMirror/modules`
2. Clone the module:<br />`git clone https://github.com/randomBrainstormer/MMM-GoogleCalendar.git`
3. Install Google API:<br />`npm install googleapis`

## Authentication Setup

Before you can add your calendar you need to setup the Google Calendar API and OAuth2 client from the Google Cloud Platform:

1. Go [here](https://developers.google.com/calendar/api/quickstart/nodejs), and follow the instructions found in the `prerequisites` to create the Google Cloud project (you could also use an existing project if you wish).
2. Once you have enabled setup the project and created your OAuth ID client, download the client ID as `json` (look for the download option) and rename it `credentials.json`.
3. Move `credentials.json` to your MMM-GoogleCalendar directory (MagicMirror/modules/MMM-GoogleCalendar/)
4. [Enable Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com). Select the same project as in step 1.
5. Run authenticate.js:<br />`node authenticate.js`.
6. Follow the instructions and it should print your calendar. Copy the ID of the calendar you want to the config.

## Using the module

### MagicMirror² Configuration

To use this module, add the following configuration block to the modules array in the `config/config.js` file:

```js
var config = {
    modules: [
        ...
        {
            module: 'MMM-GoogleCalendar',
            header: "My Google Private Cal",
            position: "top_left",
            config: {
              calendars: [
                {
                  symbol: "calendar-week",
                  calendarID: "GoogleCalendarID"
                },
                {
                  symbol: "calendar-alt",
                  calendarID: "MyOtherGoogleCalID"
                  // other "calendar" options
                },
              ],
              ...
                // other "configuration" options
            }
        },
        ...
    ]
}
```

### Configuration Options

Altough this module works with Google calendars only, most of the options from the original calendar module are supported, please check the [MagicMirror² documentation](https://docs.magicmirror.builders/modules/calendar.html). PRs with latest chanes are always welcome.
 
