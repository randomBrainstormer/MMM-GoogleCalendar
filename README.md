# Module: MMM-GoogleCalendar

This module is a customization from MagicMirror's default calendar module to display your Google calendars (including the Google Family calendar) without needing to make calendars public or using iCals. Inspired by the [GoogleTask module](https://github.com/jgauth/MMM-GoogleTasks).

### Dependencies

1. The [Google Node.js client library](https://github.com/google/google-api-nodejs-client/): This dependency is required for authenticating to Google and using the Google Calendar API (v3). See Installation for instructions

## Installation

To install the module, use your terminal to:

1. Navigate to your MagicMirror's modules folder. If you are using the default installation directory, use the command:<br />`cd ~/MagicMirror/modules`
2. Clone the module:<br />`git clone https://github.com/randomBrainstormer/MMM-GoogleCalendar.git`
3. Install dependencies:<br /> run `npm install` from the MMM-GoogleCalendar directory.

## Authentication Setup

Before you can add your calendar you need to setup the Google Calendar API and OAuth2 client from the Google Cloud Platform:

1. Go [here](https://developers.google.com/calendar/api/quickstart/nodejs), and follow the instructions found in the `prerequisites` section to create the Google Cloud project (you could also use an existing project if you wish).
2. Once you have enabled setup the project and created your OAuth ID client, download the client ID as `json` (look for the download option) and rename it `credentials.json`. NOTE: When creating the OAuth ID client you should see a list of diffrent credential types, this module is currently only supporting `Desktop app` and `Web`, being the latter the most recommendable for mirrors without mouse and keyboard. If you select `Web`, you **must** use your private IP from your mirror including the port (e.g. `192.168.0.20:8080`). Don't use `localhost` or any other loopback like `127.0.0.1`.
3. Move `credentials.json` to your MMM-GoogleCalendar directory (MagicMirror/modules/MMM-GoogleCalendar/)
4. [Enable Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com). Select the same project as in step 1.
5. For authorize, you have two options:
   1. If you've selected `Desktop app` at the step 1, then run this command from the MMM-GoogleCalendar directory: `node authorize.js` and follow the instructions that will display in the console. NOTE: After completing the `authorize.js` script it should print your calendar ID and most recent entries, you can copy the calendar ID to use later in the config file. (If you can't find your ID, check the troubleshooting section for help). If you run the script but don't see anything happening, check the troubleshooting section below, you may need to connect through VNC rather than SSH.
   2. If you've selected `Web`, then you'll need to scan the QR Code with your phone. Ensure that your phone is connected to the same WiFi network as your Magic Mirror. After scanning the QR code, your phone will open a URL. Grant access to your calendar at this URL. Once access is granted, your phone should display the Magic Mirror interface. Note: You may need to temporarily allow your phone to access the Magic Mirror by setting `ipWhitelist: []` in your Magic Mirror's configuration file (`~/MagicMirror/config/config.js`).

### Supported OAuth Credentials Type

As mentioned in the second step above, when creating your OAuth client ID you'll have to choose between a different set of options. This module only supports the `Desktop app` and `Web` credential types. The main difference between credential types is the authentication flow. If you think you need support for a different flow, feel free to open an issue, merge requests are also welcome.

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

Although this module works with Google calendars only, most of the options from the original calendar module are supported, please check the [MagicMirror² documentation](https://docs.magicmirror.builders/modules/calendar.html). Merge Request with latest changes are always welcome.

## FAQ

**What happend to the old type of OAth credentials?** <br />
In previous versions we used the `Web Application` and `TV & Limited Input devices` credentials type of OAuth, these are not used anymore, with the current version of googellibs the `Desktop app` is the best/easiest way to setup the module.

**Can this module display `.ICS` calendars or any other format?** <br />
No, this module will only work with google calendar directly, the reason is that information in google calendars is stored in different format, thus no support for other calendar types. You could, however, use the default calendar module to view ICS.

**Can't seem to get this working, what should I do?**<br />
Check out the troubleshooting guide below, if you don't find a solution for your problem feel free to [open an issue here](https://github.com/randomBrainstormer/MMM-GoogleCalendar/issues).

## Troubleshooting

| Error                                                                                       | Solution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I ran the authentication steps but I didn't get the calendar ID printed                     | If your calendar ID was not printed, you can find it on your Google calendar settings page. Basically, just visit [https://calendar.google.com](https://calendar.google.com) and look for the settings (should be on the upper right section, an icon similar to a gear). Once you're in the settings page, look on the left for your `calendar settings` and click on the calendar you want to display in `MMM-GoogleCalendar`, you're calendar ID will be somewhere in the integrate your calendar section. You do not need to change settings, just copy the ID and use it in `MMM-GoogleCalendar` |
| While installing the module I get `Error: Cannot find module...`                            | You're probably trying to execute the command in the wrong directory. Use the `ls` command to list the items in your current directory and navigate to where you've installed this module, by default the path is usually `/home/pi/MagicMirror/modules/MMM-GoogleCalendar`                                                                                                                                                                                                                                                                                                                           |
| When installing the module I get `TypeError: Cannot destructure property 'client_secret'..` | The credentials file from Google Cloud is of the wrong type, make sure to create a credential for `Desktop App`                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| I restarted my raspberry, my calendars suddenly don't show anymore                          | Most likely the token expired and you have to reauthenticate with Google again. Just run `node authorize.js` as done in step 5. If this doesn't work, navigate to the MMM-GoogleCalendar directory and delete the file `token.json` and try running `node authorize.js` again. Note: If you're connecting through SSH/command line you can delete the token by using the command `rm -rf token.json`. If the problem persist, try creating a new credential and repeating the authorize process. (You can delete the old one unless you use it for other stuff).                                                   |
| `Error: invalid_grant`                                                                      | Make sure the email used during the `node authorize.js` step is the same OR has access to the credentials in Google Cloud. If the problem persist, completely delete the current token by navigating to the MMM-GoogleCalendar directory and deleting `token.json`, if you connect to the raspberry through SSH try running `rm -rf token.json` to delete the token, once deleted run node authorize.js again. If this process doesn't work try creating a new credential and repeating the authorize process. (You can delete the old one unless you use it for other stuff).                        |
| Error in the MMM-GoogleCalendar module. check logs for more details                         | Check the log for more details, try running `pm2 logs mm` to see the latest logs and if there's any actual error from this module, is probably easier to find the error if you restart magic mirror so the log is blank: `pm2 restart mm` then check once it starts `pm2 logs mm`. Another way to see logs is right click on the mirror and select "inspect", then select "console" in the small window that opens up, there should also be some more info on whats is causing the error.                                                                                                             |
| Error: The provided keyfile does not define a valid redirect URI. There must be at least one redirect URI defined, and this sample assumes it redirects to 'http://localhost:3000/oauth2callback'.  Please edit your keyfile, and add a 'redirect_uris' section                                                                                       | You probably have the wrong type of OAuth, this may also appear if you've installed this plugin before the last major update. Try switching to a `Desktop App` OAuth credential, and try to run the install steps again.
| `Error: NOENT: no such file or directory, open '/home/pi/MagicMirror/modules/MMM-GoogleCalendar/token.json` | You need to run `authorize.js` so the token file can be auto generated. Check the [Authentication Setup](https://github.com/randomBrainstormer/MMM-GoogleCalendar/edit/main/README.md#authentication-setup) section for guided steps.
| I run `node authorize` but nothing happens, it just sits there with no updates. | You're probably connecting to your Pi through SSH, which is probably the nicest way to connect, however, this new module forces a browser to open in the Pi itself, hence you're unable to see it when connecting through SSH, try using VNC or connecting the keyboard/mouse directly to the pi.
| When attempting to log in after executing `authorize.js`, I encounter a 403 Error with the message "Access Denied". | To resolve this, ensure that your email address is included in the "Test Users" list found within the "OAuth Consent" screen.
