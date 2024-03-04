# Module: MMM-GoogleCalendar

This module is a customization from MagicMirror's default calendar module to display your Google calendars (including the Google Family calendar) without needing to make calendars public or using iCals. Inspired by the [GoogleTask module](https://github.com/jgauth/MMM-GoogleTasks).

## How to Setup

1. **Open Your Command Line Tool:** This is where we'll type in some instructions for your computer. If you're not sure how to open it, here are some quick guides for [Windows](https://www.lifewire.com/how-to-open-command-prompt-2618089), [Mac](https://www.macworld.co.uk/how-to/open-terminal-mac-3608274/), and [Linux](https://www.howtogeek.com/682770/how-to-open-the-terminal-on-a-mac/).

2. **Navigate to the Right Folder:** We need to move to the directory where your MagicMirror's modules are stored. If your installation followed the standard path, type the following command and press Enter:  
   `cd ~/MagicMirror/modules`

3. **Download this MMM-GoogleCalendar Module:** Now, we'll fetch the module that allows you to display your Google Calendar. Enter this command and hit Enter:  
   `git clone https://github.com/randomBrainstormer/MMM-GoogleCalendar.git`

4. **Install Necessary Dependencies:** Before installing the dependencies, we need to move into the calendar module's directory. Type this command to enter the module's directory:  
   `cd MMM-GoogleCalendar`  
   Now, let's install the necessary depenencies for the module. Type the following command and press Enter:  
   `npm install`

Now that the module is installed, you're on the right track! The next steps will involve setting up and granting the necessary access for your calendar to be displayed. Follow the upcoming instructions to complete the setup.

## Setting Up Access to Your Calendar

To get your calendar showing up, we need to do a bit of setup with Google's tools. Here's how you can get everything ready:

1. **Create a Google Cloud Project:**  
   - First, you'll need to create a new project on Google Cloud Platform to manage your access to the Google Calendar API.  
   - Follow the detailed guide [here](https://developers.google.com/workspace/guides/create-project) to create your project. You can also use an existing project if you already have one.

2. **Enable Google Calendar API:**  
   - Once your project is ready, you need to enable the Google Calendar API for it.  
   - Visit [this link](https://developers.google.com/calendar/api/quickstart/nodejs#set_up_your_environment) and follow the instructions to enable the API in your project.

3. **Configure OAuth Consent Screen:**  
   - For your application to access your Google Calendar, you'll need to configure the OAuth consent screen.  
   - This step is crucial for authentication; detailed instructions can be found [here](https://developers.google.com/calendar/api/quickstart/nodejs#configure_the_oauth_consent_screen).  
   - Don't forget to add yourself as a user once you've configured the consent screen.

After these initial setup steps, you're ready to create an OAuth 2.0 client ID:

4. **Create OAuth Client ID and Download Credentials:**  
   - Within your Google Cloud project, proceed to create an OAuth client ID, explicitly choosing **"Desktop application"** as the application type. It's vital to select this specific type; choosing any other may lead to issues during authentication.
   - Once you've selected "Desktop application," go ahead and create the client ID.
   - Download the newly created client ID and save it as `credentials.json`.
   - This `credentials.json` file is crucial as it enables the connection between your MagicMirror and your Google Calendar.

5. **Move Your Credentials File:**  
   - Take the `credentials.json` file and place it inside your MMM-GoogleCalendar directory: `MagicMirror/modules/MMM-GoogleCalendar/`.

6. **Authenticate with Google:**  
   - Inside the MMM-GoogleCalendar directory, run `node authorize.js` from your terminal.  
   - This command will open a Google sign-in page in your web browser. Log in with your Google account as you normally would.  
   - During this process, you might see a screen alerting you that "Google hasn't verified this app." This is a standard message for apps using OAuth that aren't published yet. Simply look for and click on the "Continue" button to proceed with the authentication.

By completing these steps, you've successfully laid the groundwork for your Google Calendar to communicate with your MagicMirror. The module is installed, and with the necessary permissions configured, you're ready to personalize your calendar settings.

Now that the install is finished, you can proceed to the next section to customize your calendar display settings. The following steps will guide you through configuring your calendar module in the MagicMirror configuration file.

## Using the module

### Configuration

Now it's time to bring your calendar to life on your MagicMirror! To do this, you need to add a specific configuration block to your MagicMirror's settings. This block of code tells your MagicMirror how to display your Google Calendar and which calendar to show.

Here's how you set it up:

1. Open the `config/config.js` file in your MagicMirror directory. Remember, you should now be in the main directory of MagicMirror², not in the MMM-GoogleCalendar module directory. If you're not sure you're in the right place, the path should look something like this: `~/MagicMirror/config/config.js`.
2. **Add Module Configuration:**  
   - Now, integrate the module into your MagicMirror² by adding the following configuration block to the `modules` array in the `config/config.js` file. It's crucial to replace `"MyGoogleCalendarIDHere"` with your actual calendar ID.

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
                 // To add more calendars, replicate the above entry within this array with the respective ID
             ],
         }
     },
     ```

     **Finding Your Google Calendar ID:**  
     If you're unsure where to find your Google Calendar ID, it's quite straightforward:
     - Head over to your Google Calendar by visiting [https://calendar.google.com](https://calendar.google.com).
     - Look for the settings icon (resembling a gear) in the upper right corner and click on it to access `Settings`.
     - On the left side, navigate to `Settings for my calendars`, and select the calendar you wish to display on MMM-GoogleCalendar.
     - Scroll until you find the `Integrate calendar` section. Your calendar ID is listed there. This ID usually ends with `@group.calendar.google.com`.
     - There's no need to modify any settings here—just copy the Calendar ID and replace `"MyGoogleCalendarIDHere"` in the module configuration with your actual ID.

### Configuration Options

This module is designed specifically for Google calendars, but it inherits many customizable features from the original MagicMirror² calendar module. To explore all the available options and tailor your calendar display to your liking, please refer to the [MagicMirror² documentation](https://docs.magicmirror.builders/modules/calendar.html).

We are committed to improving and updating this module, so if you have enhancements or updates, feel free to contribute. Merge requests with the latest changes are always appreciated and welcome!

## FAQ

**What happened to the old types of OAuth credentials?**  
Previously, we used the `Web Application` and `TV & Limited Input devices` types for OAuth credentials. These are no longer used because, with the current version of the Google libraries, the `Desktop app` credential type offers the simplest and most straightforward setup process for this module.

**Can this module display `.ICS` calendars or any other format?**  
Unfortunately, this module is designed to work exclusively with Google Calendar. Google Calendar data is formatted differently, which is why there's no support for other calendar types within this module. If you need to display `.ICS` calendars or other formats, consider using the default MagicMirror² calendar module.

**I'm having trouble getting this module to work. What should I do?**  
First, don't worry! We have a troubleshooting guide that addresses common issues and their solutions. If you're still stuck after consulting the guide, please feel free to [open an issue here](https://github.com/randomBrainstormer/MMM-G

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
