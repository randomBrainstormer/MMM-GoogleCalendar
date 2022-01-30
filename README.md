# Module: MMM-GoogleCalendar

This module is a customization from MagicMirror's default calendar module to display your Google calendars (including the Google Family calendar) without needing to make calendars public or using iCals. Inspired by the [GoogleTask module](https://github.com/jgauth/MMM-GoogleTasks).

### Dependencies

1. The [Google Node.js client library](https://github.com/google/google-api-nodejs-client/): This dependenci is required for authenticating to Google and using the Google Calendar API (v3). See Installation for instructions.

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
6. Follow the instructions shown after you run the command, it should print your calendar. Copy the ID of the calendar you want to the config. (If you can't find yoru ID, check the troubleshooting section for help).

## Using the module

### MagicMirror² Configuration

To use this module, add the following configuration block to the modules array in the `config/config.js` file, don't forget to replace the "MyGoogleCalendarIDHere" with your actual calendar ID:

```javascript
{
    module: 'MMM-GoogleCalendar',
    header: "My Google Private Cal",
    position: "top_left",
    config: {
        calendars: [
            {
              symbol: "calendar-week",
              calendarID: "MyGoogleCalendarIDHere"
            },
            // add another calendar HERE if needed
        ],
    }
},
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
| I ran the authentication steps but I didn't get the calendar ID printed | If your calendar ID was not printed, you can find it on your Google calendar settings page. Basically, just visit [https://calendar.google.com](https://calendar.google.com) and look for the settings (should be on the upper right section, an icon similar to a gear). Once you're in the settings page, look on the left for your `calendar settings` and click on the calendar you want to display in `MMM-GoogleCalendar`, you're calendar ID will be somewhere in the integrate your calendar section. You do not need to change settings, just copy the ID and use it in `MMM-GoogleCalendar` | 
| While installing the module I get `Error: Cannot find module...` | You're probably trying to execute the command in the wrong directory. Use the `ls` command to list the items in your current directory and navigate to where you've installed this module, by default the path is usually `/home/pi/MagicMirror/modules/MMM-GoogleCalendar`  |
| When installing the module I get `TypeError: Cannot destructure property 'client_secret'..` | The credentials file from Google Cloud is of the wrong type, make sure to create a credential for `TV and unlimited input` |
| I restarted my raspberry, my calendars suddenly don't show anymore | Most likely the token expired and you have to reauthenticate with Google again. Just run `node authorize.js` as done in step 5. If this doesn't work, navigate to the MMM-GoogleCalendar directory and delete the file `token.json` and try running `node authorize.js` again. Note: If you're connecting through SSH you can delete the token by using the command `rm -rf token.json`. If the problem persist, try creating a new credential and repeating the authorize process. (You can delete the old one unless you use it for other stuff). |
|`Error: invalid_grant` | Make sure the email used during the `node authorize.js` step is the same OR has access to the credentials in Google Cloud. If the problem persist, completely delete the current token by navigating to the MMM-GoogleCalendar directory and deleting `token.json`, if you connect to the raspberry through SSH try running `rm -rf token.json` to delete the token, once deleted run node authorize.js again. If this process doesn't work try creating a new credential and repeating the authorize process. (You can delete the old one unless you use it for other stuff). |
|Error in the MMM-GoogleCalendar module. check logs for more details| Check the log for more details, try running `pm2 logs mm` to see the latest logs and if there's any actual error from this module, is probably easier to find the error if you restart magic mirror so the log is blank: `pm2 restart mm` then check once it starts `pm2 logs mm`. Another way to see logs is right click on the mirror and select "inspect", then select "console" in the small window that opens up, there should also be some more info on whats is causing the error.|
 
