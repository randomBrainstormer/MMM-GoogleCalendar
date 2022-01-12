# Module: MMM-GoogleCalendar

This module is a customization from MagicMirror's default calendar module to display your Google calendars (including the Google Family calendar) without needing to make calendars public or using iCals. Inspired by the [GoogleTask module](https://github.com/jgauth/MMM-GoogleTasks).

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
5. Run this command from the MMM-GoogleCalendar directory: `node authorize.js` and follow the instructions that will display in the console. 
6. Follow the instructions shown after you run the command, it should print your calendar. Copy the ID of the calendar you want to the config.

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

Although this module works with Google calendars only, most of the options from the original calendar module are supported, please check the [MagicMirror² documentation](https://docs.magicmirror.builders/modules/calendar.html). PRs with latest changes are always welcome.


## FAQ

**Can this module display `.ICS` calendars or any other format?** <br />
No, this module will only work with google calendar directly, the reason is that information in google calendars is stored in different format, thus no support for other calendar types. You could, however, use the default calendar module to view ICS.

**Can't seem to get this working, what should I do?**<br />
Check out the troubleshooting guide below, if you don't find a solution for your problem feel free to [open an issue here](https://github.com/randomBrainstormer/MMM-GoogleCalendar/issues).


## Troubleshooting

| Error         | Solution  |
|---------------|-----------|
| While installing the module I get `Error: Cannot find module...` | You're probably trying to execute the command in the wrong directory. Use the `ls` command to list the items in your current directory and navigate to where you've installed this module, by default the path is usually `/home/pi/MagicMirror/modules/MMM-GoogleCalendar`  |
| When installing the module I get `TypeError: Cannot destructure property 'client_secret'..` | The credentials file from Google Cloud is of the wrong type, make sure to create a credential for `TV and unlimited input` |
| I restarted my raspberry, my calendars suddenly don't show anymore | Most likely the token expired and you have to reauthenticate with Google again. Just run `node authorize.js` as done in step 5.  |
 
